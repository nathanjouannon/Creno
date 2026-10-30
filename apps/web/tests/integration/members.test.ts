import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { createUser } from '../factories/user';
import { createTestDatabase, type TestDatabase } from '../helpers/test-database';

const openapi = parse(
  readFileSync(
    fileURLToPath(new URL('../../../../docs/api/openapi.yaml', import.meta.url)),
    'utf8',
  ),
);
const conforms = (schema: string, value: unknown) =>
  new Ajv({ strict: false }).compile({
    components: openapi.components,
    $ref: `#/components/schemas/${schema}`,
  })(value);

const ORIGIN = 'http://localhost:3000';
const NOW = '2027-03-14T08:00:00Z';
const PASSWORD = 'correct-password-1';
const NEW_PASSWORD = 'brand-new-password-2';

let database: TestDatabase;
let users: typeof import('@/app/api/users/route');
let user: typeof import('@/app/api/users/[userId]/route');
let role: typeof import('@/app/api/users/[userId]/role/route');
let createReset: typeof import('@/app/api/users/[userId]/password-resets/route');
let reset: typeof import('@/app/api/password-resets/[token]/route');
let loginRoute: typeof import('@/app/api/auth/login/route');
let meRoute: typeof import('@/app/api/me/route');
let shared: typeof import('@/modules/shared');
let auth: typeof import('@/modules/auth');
let adminA: { id: number };
let adminB: { id: number };
let member: { id: number };

type Caller = { id: number; role: 'ADMIN' | 'USER' } | null;
const as = (caller: Caller) => shared.setAuthenticator(shared.fakeAuthenticator(caller));
const asAdmin = (id: number) => as({ id, role: 'ADMIN' });

type Handler = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

async function send(
  handler: Handler,
  method: string,
  path: string,
  params: Record<string, string> = {},
  body?: unknown,
) {
  const response = await handler(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: { origin: ORIGIN },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve(params) },
  );
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

const setRole = (id: number, to: string) =>
  send(role.PUT, 'PUT', `/users/${id}/role`, { userId: String(id) }, { role: to });
const generateLink = (id: number) =>
  send(createReset.POST, 'POST', `/users/${id}/password-resets`, { userId: String(id) });
const tokenOf = (url: string) => url.split('/reinitialisation/')[1]!;
const checkReset = (token: string) =>
  send(reset.GET, 'GET', `/password-resets/${token}`, { token });
const resetPassword = (token: string, password: string) =>
  send(reset.POST, 'POST', `/password-resets/${token}`, { token }, { password });
const login = (email: string, password: string) =>
  loginRoute.POST(
    new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { origin: ORIGIN },
      body: JSON.stringify({ email, password }),
    }),
  );
const me = (cookie: string) =>
  meRoute.GET(new Request('http://localhost/api/me', { headers: { cookie } }));

const roleOf = async (id: number) =>
  (await database.prisma.user.findUniqueOrThrow({ where: { id } })).role;

beforeAll(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.url;
  vi.resetModules();
  shared = await import('@/modules/shared');
  auth = await import('@/modules/auth');
  users = await import('@/app/api/users/route');
  user = await import('@/app/api/users/[userId]/route');
  role = await import('@/app/api/users/[userId]/role/route');
  createReset = await import('@/app/api/users/[userId]/password-resets/route');
  reset = await import('@/app/api/password-resets/[token]/route');
  loginRoute = await import('@/app/api/auth/login/route');
  meRoute = await import('@/app/api/me/route');
}, 120_000);

afterAll(async () => {
  await database?.drop();
});

beforeEach(async () => {
  shared.resetRateLimits();
  shared.setClock(shared.fixedClock(NOW));
  await database.prisma.user.deleteMany();
  await database.prisma.loginAttempt.deleteMany();
  adminA = await createUser(database.prisma, { role: 'ADMIN', lastName: 'Adam', firstName: 'Zoé' });
  adminB = await createUser(database.prisma, {
    role: 'ADMIN',
    lastName: 'Adam',
    firstName: 'Alix',
  });
  member = await createUser(database.prisma, {
    lastName: 'Zola',
    email: 'mail.ex@exemple.fr',
    passwordHash: await auth.hashPassword(PASSWORD),
  });
  asAdmin(adminA.id);
});
afterEach(() => {
  shared.resetClock();
  shared.resetAuthenticator();
});

describe('GET /users, GET /users/{id} (F-10)', () => {
  it('[F-10 S1] lists name, first name, e-mail and role, sorted by name then first name, never a hash', async () => {
    const response = await users.GET(new Request('http://localhost/api/users'));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.map((u: { id: number }) => u.id)).toEqual([adminB.id, adminA.id, member.id]);
    expect(conforms('User', body[0])).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|argon2/);
  });

  it('returns a member, and USER_NOT_FOUND for an unknown one', async () => {
    const found = await send(user.GET, 'GET', `/users/${member.id}`, { userId: String(member.id) });
    expect(found.status).toBe(200);
    expect(found.body.email).toBe('mail.ex@exemple.fr');
    const missing = await send(user.GET, 'GET', '/users/99999', { userId: '99999' });
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('USER_NOT_FOUND');
  });
});

describe('PUT /users/{id}/role (F-10, RG-04)', () => {
  it('[F-10 S2] gives the right to a user; the two administrators coexist', async () => {
    const response = await setRole(member.id, 'ADMIN');
    expect(response.status).toBe(200);
    expect(conforms('User', response.body)).toBe(true);
    expect(await database.prisma.user.count({ where: { role: 'ADMIN' } })).toBe(3);
  });

  it('a role already held answers 200 and changes nothing', async () => {
    expect((await setRole(adminB.id, 'ADMIN')).status).toBe(200);
    expect((await setRole(member.id, 'USER')).status).toBe(200);
  });

  it('[F-10 S3] an administrator withdraws their own right; the other one stays', async () => {
    const response = await setRole(adminA.id, 'USER');
    expect(response.status).toBe(200);
    expect(await roleOf(adminA.id)).toBe('USER');
    expect(await roleOf(adminB.id)).toBe('ADMIN');
  });

  it('[F-10 S4] nobody withdraws the right of another administrator', async () => {
    const response = await setRole(adminB.id, 'USER');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('USER_ROLE_CHANGE_FORBIDDEN');
    expect(await roleOf(adminB.id)).toBe('ADMIN');
  });

  it('[F-10 S5] the last administrator cannot withdraw their right', async () => {
    await database.prisma.user.update({ where: { id: adminB.id }, data: { role: 'USER' } });
    const response = await setRole(adminA.id, 'USER');
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('USER_LAST_ADMIN');
    expect(await roleOf(adminA.id)).toBe('ADMIN');
  });

  it('[F-10 S6] after withdrawing their right the administrator is refused on the administration routes', async () => {
    await setRole(adminA.id, 'USER');
    as({ id: adminA.id, role: 'USER' });
    expect((await users.GET(new Request('http://localhost/api/users'))).status).toBe(403);
  });

  it('[F-10 S5] RG-04: two administrators withdrawing their right at the same time leave one administrator', async () => {
    for (let round = 0; round < 5; round++) {
      await database.prisma.user.updateMany({
        where: { id: { in: [adminA.id, adminB.id] } },
        data: { role: 'ADMIN' },
      });
      // Each request is made by its own administrator, on their own account
      shared.setAuthenticator(async (request) => ({
        id: Number(request.headers.get('x-test-user')),
        role: 'ADMIN',
      }));
      const withdraw = (id: number) =>
        role.PUT(
          new Request(`http://localhost/api/users/${id}/role`, {
            method: 'PUT',
            headers: { origin: ORIGIN, 'x-test-user': String(id) },
            body: JSON.stringify({ role: 'USER' }),
          }),
          { params: Promise.resolve({ userId: String(id) }) },
        );
      const statuses = (await Promise.all([withdraw(adminA.id), withdraw(adminB.id)])).map(
        (response) => response.status,
      );
      expect(statuses.sort()).toEqual([200, 409]);
      expect(await database.prisma.user.count({ where: { role: 'ADMIN' } })).toBe(1);
    }
  });

  it('refuses an unknown role with a validation error and an unknown user with USER_NOT_FOUND', async () => {
    expect((await setRole(member.id, 'OWNER')).status).toBe(400);
    const missing = await setRole(99999, 'ADMIN');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('USER_NOT_FOUND');
  });
});

describe('administration routes: access refused (RG-14)', () => {
  const calls: [string, () => Promise<{ status: number }>][] = [
    [
      'GET /users',
      async () => ({ status: (await users.GET(new Request('http://localhost/api/users'))).status }),
    ],
    ['GET /users/{id}', () => send(user.GET, 'GET', '/users/1', { userId: '1' })],
    ['PUT /users/{id}/role', () => setRole(1, 'ADMIN')],
    ['POST /users/{id}/password-resets', () => generateLink(1)],
  ];

  for (const [name, call] of calls) {
    it(`${name}: 403 for a user, 401 without a session`, async () => {
      as({ id: member.id, role: 'USER' });
      expect((await call()).status).toBe(403);
      as(null);
      expect((await call()).status).toBe(401);
    });
  }

  it('changes nothing when a user tries to take the right', async () => {
    as({ id: member.id, role: 'USER' });
    await setRole(member.id, 'ADMIN');
    expect(await roleOf(member.id)).toBe('USER');
  });
});

describe('password reset (F-10, F-02, RG-12, RG-03)', () => {
  it('[F-10 S7] generates a link valid 3 days, the token stored hashed', async () => {
    const response = await generateLink(member.id);
    expect(response.status).toBe(201);
    expect(conforms('ShareableLink', response.body)).toBe(true);
    expect(response.body.url).toMatch(
      /^http:\/\/localhost:3000\/reinitialisation\/[A-Za-z0-9_-]{43}$/,
    );
    expect(response.body.expiresAt).toBe('2027-03-17T08:00:00.000Z');
    const stored = await database.prisma.resetToken.findFirstOrThrow();
    expect(stored.token).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.token).not.toContain(tokenOf(response.body.url));
  });

  it('USER_NOT_FOUND for an unknown member', async () => {
    const response = await generateLink(99999);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('USER_NOT_FOUND');
  });

  it('[F-10 S8] RG-12: a new link replaces the previous one', async () => {
    const first = tokenOf((await generateLink(member.id)).body.url);
    const second = tokenOf((await generateLink(member.id)).body.url);
    for (const token of [first]) {
      const old = await checkReset(token);
      expect(old.status).toBe(410);
      expect(old.body.code).toBe('AUTH_RESET_LINK_INVALID');
      expect((await resetPassword(token, NEW_PASSWORD)).status).toBe(410);
    }
    const current = await checkReset(second);
    expect(current.status).toBe(200);
    expect(current.body.expiresAt).toBe('2027-03-17T08:00:00.000Z');
  });

  it('[F-02 S5] RG-12, RG-03: changes the password once, closes the sessions, lifts the block, opens no session', async () => {
    const before = await login('mail.ex@exemple.fr', PASSWORD);
    const cookie = before.headers.get('set-cookie')!.split(';')[0]!;
    shared.resetAuthenticator();
    expect((await me(cookie)).status).toBe(200);
    asAdmin(adminA.id);
    // Five failures: blocked, even with the right password
    for (let i = 0; i < 5; i++) await login('mail.ex@exemple.fr', 'wrong-password');
    expect((await login('mail.ex@exemple.fr', PASSWORD)).status).toBe(423);

    const token = tokenOf((await generateLink(member.id)).body.url);
    const done = await resetPassword(token, NEW_PASSWORD);
    expect(done.status).toBe(204);
    expect(done.cookie).toBeUndefined();

    // The real authenticator reads the session cookie
    shared.resetAuthenticator();
    const old = await me(cookie);
    expect(old.status).toBe(401);
    expect((await old.json()).code).toBe('AUTH_REQUIRED');
    expect((await login('mail.ex@exemple.fr', PASSWORD)).status).toBe(401);
    const fresh = await login('mail.ex@exemple.fr', NEW_PASSWORD);
    expect(fresh.status).toBe(200);
    expect(await database.prisma.loginAttempt.count()).toBe(0);
  });

  it('[F-02 S6] RG-12: a used link is refused', async () => {
    const token = tokenOf((await generateLink(member.id)).body.url);
    expect((await resetPassword(token, NEW_PASSWORD)).status).toBe(204);
    const again = await resetPassword(token, 'another-password-3');
    expect(again.status).toBe(410);
    expect(again.body.code).toBe('AUTH_RESET_LINK_INVALID');
    expect((await login('mail.ex@exemple.fr', NEW_PASSWORD)).status).toBe(200);
  });

  it('[F-02 S6] RG-12: a link older than 3 days is refused, an unknown one too', async () => {
    const token = tokenOf((await generateLink(member.id)).body.url);
    shared.setClock(shared.fixedClock('2027-03-17T07:59:59Z'));
    expect((await checkReset(token)).status).toBe(200);
    shared.setClock(shared.fixedClock('2027-03-17T08:00:00Z'));
    expect((await checkReset(token)).status).toBe(410);
    expect((await resetPassword(token, NEW_PASSWORD)).status).toBe(410);
    expect((await checkReset('unknown-token')).status).toBe(410);
  });

  it('RG-01: a short password is refused with its field code and the link stays usable', async () => {
    const token = tokenOf((await generateLink(member.id)).body.url);
    const short = await resetPassword(token, '123456789');
    expect(short.status).toBe(400);
    expect(short.body.details.fields).toEqual([
      { field: 'password', code: 'FIELD_PASSWORD_TOO_SHORT' },
    ]);
    expect((await resetPassword(token, NEW_PASSWORD)).status).toBe(204);
  });

  it('RG-12: two simultaneous uses of one link, one wins', async () => {
    const token = tokenOf((await generateLink(member.id)).body.url);
    const statuses = (
      await Promise.all([
        resetPassword(token, NEW_PASSWORD),
        resetPassword(token, 'other-password-9'),
      ])
    ).map((r) => r.status);
    expect(statuses.sort()).toEqual([204, 410]);
  });

  it('RG-12: no reset link for an administrator, not even another one (#82)', async () => {
    const response = await generateLink(adminB.id);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('USER_RESET_FORBIDDEN');
    expect(conforms('Error', response.body)).toBe(true);
    expect(await database.prisma.resetToken.count()).toBe(0);
    expect((await generateLink(adminA.id)).body.code).toBe('USER_RESET_FORBIDDEN');
  });

  it('RG-12: a link stops working when its member becomes an administrator (#82)', async () => {
    const token = tokenOf((await generateLink(member.id)).body.url);
    expect((await setRole(member.id, 'ADMIN')).status).toBe(200);
    const check = await checkReset(token);
    expect(check.status).toBe(410);
    expect(check.body.code).toBe('AUTH_RESET_LINK_INVALID');
    expect((await resetPassword(token, NEW_PASSWORD)).status).toBe(410);
    expect((await login('mail.ex@exemple.fr', PASSWORD)).status).toBe(200);
  });

  it('RG-12: a link generated while the member is promoted never survives the promotion (#82)', async () => {
    const [link, promotion] = await Promise.all([
      generateLink(member.id),
      setRole(member.id, 'ADMIN'),
    ]);
    expect(promotion.status).toBe(200);
    // Either the link came first and the promotion removed it, or the promotion came first and the link was refused
    expect(link.status === 201 || link.body.code === 'USER_RESET_FORBIDDEN').toBe(true);
    expect(await database.prisma.resetToken.count()).toBe(0);
  });

  it('RG-12: the rescue command gives an administrator a link that works (#82)', async () => {
    await database.prisma.user.update({
      where: { id: adminB.id },
      data: { email: 'secours.admin@exemple.fr' },
    });
    const link = await auth.getPasswordResetService().createRescueLink('SECOURS.admin@exemple.fr');
    const token = tokenOf(link.url);
    expect((await resetPassword(token, NEW_PASSWORD)).status).toBe(204);
    expect((await login('secours.admin@exemple.fr', NEW_PASSWORD)).status).toBe(200);
    await expect(
      auth.getPasswordResetService().createRescueLink('secours_admin@exemple.fr'),
    ).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });

  it('deleting the user drops the links (cascade)', async () => {
    await generateLink(member.id);
    await database.prisma.user.delete({ where: { id: member.id } });
    expect(await database.prisma.resetToken.count()).toBe(0);
  });
});
