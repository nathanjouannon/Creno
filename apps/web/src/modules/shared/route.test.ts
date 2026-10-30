import { AppError } from '@creno/validation';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fakeAuthenticator, resetAuthenticator, setAuthenticator } from './auth';
import { resetRateLimits } from './rate-limit';
import { route, routeTemplate } from './route';

const post = (body?: unknown, url = 'http://localhost/api/things') =>
  new Request(url, {
    method: 'POST',
    headers: { origin: 'http://localhost:3000' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const bodySchema = z
  .object({
    email: z.string().email(),
    title: z.string().min(1),
    endsAt: z.string().datetime(),
    password: z.string().min(10, { message: 'FIELD_PASSWORD_TOO_SHORT' }),
  })
  .strict();

const valid = {
  email: 'a@b.fr',
  title: 'Tournoi',
  endsAt: '2027-01-14T09:00:00Z',
  password: '0123456789',
};

let stdout: string[];
const realWrite = process.stdout.write.bind(process.stdout);

beforeEach(() => {
  stdout = [];
  process.stdout.write = ((chunk: string) => (
    stdout.push(String(chunk)),
    true
  )) as typeof process.stdout.write;
});

afterEach(() => {
  process.stdout.write = realWrite;
  resetAuthenticator();
});

describe('route envelope: error translation', () => {
  it('translates an AppError into the Error schema with its catalog status, message and details', async () => {
    const handler = route({ auth: 'optional' }, () => {
      throw new AppError('SLOT_FULL', { slotId: 12 });
    });
    const response = await handler(post());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      code: 'SLOT_FULL',
      message: "Ce créneau vient d'être complété.",
      details: { slotId: 12 },
      requestId: expect.stringMatching(/^req_[0-9a-f]{8}$/),
    });
  });

  it('puts the same requestId in the body and the X-Request-Id header', async () => {
    const response = await route({ auth: 'optional' }, () => {
      throw new AppError('NOT_FOUND');
    })(post());
    expect((await response.json()).requestId).toBe(response.headers.get('X-Request-Id'));
  });

  it('adds Retry-After to a RATE_LIMITED response', async () => {
    const response = await route({ auth: 'optional' }, () => {
      throw new AppError('RATE_LIMITED', { retryAfter: 30 });
    })(post());
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  it('turns an unexpected exception into INTERNAL_ERROR without any technical detail, and logs the trace', async () => {
    const response = await route({ auth: 'optional' }, () => {
      throw new Error('relation "users" does not exist');
    })(post());
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Une erreur est survenue.',
      requestId: expect.any(String),
    });
    expect(JSON.stringify(body)).not.toContain('users');
    const logged = stdout.join('');
    expect(logged).toContain('relation \\"users\\" does not exist');
    expect(logged).toContain('"stack"');
    expect(logged).toContain(body.requestId);
  });

  it('[F-01 S4] turns an invalid body into VALIDATION_ERROR with a field code per field, no message from Zod', async () => {
    const response = await route({ auth: 'optional', body: bodySchema }, () => ({}))(
      post({ ...valid, email: 'nope', title: '', endsAt: 'tomorrow', password: 'short' }),
    );
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details.fields).toEqual([
      { field: 'email', code: 'FIELD_EMAIL_INVALID' },
      { field: 'title', code: 'FIELD_REQUIRED' },
      { field: 'endsAt', code: 'FIELD_DATE_INVALID' },
      { field: 'password', code: 'FIELD_PASSWORD_TOO_SHORT' },
    ]);
  });

  it('reports a missing field as FIELD_REQUIRED and an extra field as FIELD_UNKNOWN', async () => {
    const withoutTitle: Partial<typeof valid> = { ...valid };
    delete withoutTitle.title;
    const response = await route({ auth: 'optional', body: bodySchema }, () => ({}))(
      post({ ...withoutTitle, admin: true }),
    );
    const fields = (await response.json()).details.fields;
    expect(fields).toContainEqual({ field: 'title', code: 'FIELD_REQUIRED' });
    expect(fields).toContainEqual({ field: 'admin', code: 'FIELD_UNKNOWN' });
  });

  it('names nested fields with dots', async () => {
    const schema = z.object({ slots: z.array(z.object({ endsAt: z.string().datetime() })) });
    const response = await route({ auth: 'optional', body: schema }, () => ({}))(
      post({ slots: [{ endsAt: 'x' }] }),
    );
    expect((await response.json()).details.fields).toEqual([
      { field: 'slots.0.endsAt', code: 'FIELD_DATE_INVALID' },
    ]);
  });

  it('treats an empty or malformed body as missing fields', async () => {
    const handler = route({ auth: 'optional', body: bodySchema }, () => ({}));
    for (const request of [
      post(),
      new Request('http://localhost/x', {
        method: 'POST',
        headers: { origin: 'http://localhost:3000' },
        body: '{oops',
      }),
    ]) {
      const response = await handler(request);
      expect(response.status).toBe(400);
      expect((await response.json()).details.fields).toContainEqual({
        field: 'title',
        code: 'FIELD_REQUIRED',
      });
    }
  });

  it('validates route params and query with Zod and passes the parsed values to the handler', async () => {
    const handler = route(
      {
        auth: 'optional',
        params: z.object({ slotId: z.coerce.number().int().positive() }),
        query: z.object({ page: z.coerce.number().default(1) }),
      },
      ({ params, query }) => ({ body: { slotId: params.slotId, page: query.page } }),
    );
    const ok = await handler(new Request('http://localhost/x?page=3'), {
      params: Promise.resolve({ slotId: '12' }),
    });
    expect(await ok.json()).toEqual({ slotId: 12, page: 3 });

    const bad = await handler(new Request('http://localhost/x'), {
      params: Promise.resolve({ slotId: 'abc' }),
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).details.fields).toEqual([
      { field: 'slotId', code: 'FIELD_REQUIRED' },
    ]);
  });

  it('returns the handler result with its status, and 204 without a body', async () => {
    const created = await route({ auth: 'optional' }, () => ({ status: 201, body: { id: 1 } }))(
      post(),
    );
    expect(created.status).toBe(201);
    expect(await created.json()).toEqual({ id: 1 });
    const empty = await route({ auth: 'optional' }, () => ({ status: 204 }))(post());
    expect(empty.status).toBe(204);
    expect(await empty.text()).toBe('');
  });
});

describe('route envelope: authentication (RG-14)', () => {
  const protectedRoute = (auth: 'user' | 'admin') =>
    route({ auth }, ({ user }) => ({ body: { id: user.id } }));

  it('refuses a request without session on a user route with AUTH_REQUIRED', async () => {
    const response = await protectedRoute('user')(post());
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('AUTH_REQUIRED');
  });

  it('RG-14: refuses a USER on an admin route with FORBIDDEN and never runs the handler', async () => {
    setAuthenticator(fakeAuthenticator({ id: 7, role: 'USER' }));
    let called = false;
    const response = await route({ auth: 'admin' }, () => ((called = true), {}))(post());
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('FORBIDDEN');
    expect(called).toBe(false);
  });

  it('RG-14: refuses an anonymous caller on an admin route with AUTH_REQUIRED', async () => {
    expect((await protectedRoute('admin')(post())).status).toBe(401);
  });

  it('lets an admin through an admin route', async () => {
    setAuthenticator(fakeAuthenticator({ id: 1, role: 'ADMIN' }));
    expect(await (await protectedRoute('admin')(post())).json()).toEqual({ id: 1 });
  });

  it('gives a null user to an optional route when nobody is signed in', async () => {
    const response = await route({ auth: 'optional' }, ({ user }) => ({
      body: { signedIn: user !== null },
    }))(post());
    expect(await response.json()).toEqual({ signedIn: false });
  });

  it('checks authentication before validating the body', async () => {
    const response = await route({ auth: 'user', body: bodySchema }, () => ({}))(post({}));
    expect(response.status).toBe(401);
  });
});

describe('route envelope: logs', () => {
  // The link routes share the strict request budget with the tests below
  afterEach(resetRateLimits);

  it('writes one JSON line per request with requestId, status and user id, but no e-mail or password', async () => {
    setAuthenticator(fakeAuthenticator({ id: 7, role: 'USER' }));
    await route({ auth: 'user', body: bodySchema }, () => ({ status: 201 }))(
      post({ ...valid, email: 'alice@club.fr' }),
    );
    const lines = stdout
      .join('')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'info',
      msg: 'request',
      status: 201,
      userId: 7,
      method: 'POST',
    });
    expect(lines[0].requestId).toMatch(/^req_/);
    expect(stdout.join('')).not.toContain('alice@club.fr');
    expect(stdout.join('')).not.toContain('0123456789');
  });

  it('names the route by its template, never with a link token from the URL (#81)', async () => {
    const token = 'not-a-real-token';
    const handler = route({ auth: 'optional', params: z.object({ token: z.string() }) }, () => ({
      status: 204,
    }));
    await handler(new Request(`http://localhost/api/password-resets/${token}`), {
      params: Promise.resolve({ token }),
    });
    const [line] = stdout.map((l) => JSON.parse(l));
    expect(line).toMatchObject({ msg: 'request', route: '/api/password-resets/[token]' });
    expect(stdout.join('')).not.toContain(token);
  });

  it('keeps the static segments and names each parameter', () => {
    expect(routeTemplate(new Request('http://localhost/api/users/12/role'), { userId: '12' })).toBe(
      '/api/users/[userId]/role',
    );
    expect(routeTemplate(new Request('http://localhost/api/events'), {})).toBe('/api/events');
  });
});

describe('route envelope: protections that come before the handler', () => {
  afterEach(resetRateLimits);

  it('[F-02] the 11th login request in a minute from one address gets 429 RATE_LIMITED with Retry-After', async () => {
    const login = route({ auth: 'optional' }, () => ({ body: {} }));
    const request = () => post(undefined, 'http://localhost/api/auth/login');
    for (let i = 0; i < 10; i++) expect((await login(request())).status).toBe(200);
    const refused = await login(request());
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get('Retry-After'))).toBeGreaterThan(0);
    const body = await refused.json();
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.details).toBeUndefined();
  });

  it('refuses a request that changes data from a foreign origin with 403 FORBIDDEN_ORIGIN before running the handler', async () => {
    let called = false;
    const handler = route({ auth: 'optional' }, () => ((called = true), {}));
    const response = await handler(
      new Request('http://localhost/api/things', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
      }),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('FORBIDDEN_ORIGIN');
    expect(called).toBe(false);
  });
});
