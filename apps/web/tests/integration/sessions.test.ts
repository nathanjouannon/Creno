import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { SignJWT } from 'jose';
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
const conformsToUser = (value: unknown) =>
  new Ajv({ strict: false }).compile({
    components: openapi.components,
    $ref: '#/components/schemas/User',
  })(value);

const ORIGIN = 'http://localhost:3000';
let database: TestDatabase;
let me: typeof import('@/app/api/me/route');
let logout: typeof import('@/app/api/auth/logout/route');
let shared: typeof import('@/modules/shared');
let auth: typeof import('@/modules/auth');
let tokens: typeof import('@/modules/auth/token');

/** `name=value` of the Set-Cookie a session opening returns, as a browser would send it back. */
async function sessionCookieFor(user: { id: number; tokenVersion: number }): Promise<string> {
  const setCookie = await auth.getAuthService().openSession(user);
  return setCookie.split(';')[0]!;
}

const getMe = (cookie?: string) =>
  me.GET(new Request('http://localhost/api/me', { headers: cookie ? { cookie } : {} }));
const postLogout = (headers: Record<string, string> = {}) =>
  logout.POST(new Request('http://localhost/api/auth/logout', { method: 'POST', headers }));

beforeAll(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.url;
  vi.resetModules();
  shared = await import('@/modules/shared');
  auth = await import('@/modules/auth');
  tokens = await import('@/modules/auth/token');
  me = await import('@/app/api/me/route');
  logout = await import('@/app/api/auth/logout/route');
}, 60_000);

afterAll(async () => {
  await database?.drop();
});

beforeEach(() => shared.resetRateLimits());
afterEach(() => shared.resetClock());

describe('GET /me and the session (ADR-0006)', () => {
  it('[F-02] returns the signed-in user as the User schema, without hash or token version', async () => {
    const user = await createUser(database.prisma, { firstName: 'Léa', lastName: 'Bernard' });
    const response = await getMe(await sessionCookieFor(user));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: user.id,
      firstName: 'Léa',
      lastName: 'Bernard',
      email: user.email,
      role: 'USER',
    });
    expect(Object.keys(body).sort()).toEqual([
      'createdAt',
      'email',
      'firstName',
      'id',
      'lastName',
      'role',
    ]);
    expect(conformsToUser(body)).toBe(true);
  });

  it('answers 401 AUTH_REQUIRED without a cookie, with garbage, or with a foreign cookie name', async () => {
    for (const cookie of [
      undefined,
      'session=garbage',
      'session=a.b.c',
      '__Host-session=anything',
    ]) {
      const response = await getMe(cookie);
      expect(response.status, String(cookie)).toBe(401);
      expect((await response.json()).code).toBe('AUTH_REQUIRED');
    }
  });

  it('answers 401 for an expired token', async () => {
    const user = await createUser(database.prisma);
    const cookie = await sessionCookieFor(user);
    shared.setClock(shared.fixedClock(new Date(Date.now() + 31 * 24 * 3600 * 1000)));
    expect((await getMe(cookie)).status).toBe(401);
  });

  it('answers 401 for a token signed with another key', async () => {
    const user = await createUser(database.prisma);
    const token = await tokens.signSessionToken(
      { userId: user.id, tokenVersion: user.tokenVersion },
      { secret: 'another-secret-another-secret-0123456789', now: new Date() },
    );
    expect((await getMe(`session=${token}`)).status).toBe(401);
  });

  it('answers 401 for a token without expiry that someone signed with the right key but another algorithm', async () => {
    const user = await createUser(database.prisma);
    const key = new TextEncoder().encode(process.env.AUTH_SECRET);
    const token = await new SignJWT({ tv: 0 })
      .setProtectedHeader({ alg: 'HS384' })
      .setSubject(String(user.id))
      .setExpirationTime('1h')
      .sign(key);
    expect((await getMe(`session=${token}`)).status).toBe(401);
  });

  it('RG-11: answers 401 once the user is deleted', async () => {
    const user = await createUser(database.prisma);
    const cookie = await sessionCookieFor(user);
    expect((await getMe(cookie)).status).toBe(200);
    await database.prisma.user.delete({ where: { id: user.id } });
    expect((await getMe(cookie)).status).toBe(401);
  });

  it('RG-12: answers 401 once the token version moved on (all sessions closed)', async () => {
    const user = await createUser(database.prisma);
    const cookie = await sessionCookieFor(user);
    await database.prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 } },
    });
    expect((await getMe(cookie)).status).toBe(401);
    // A session opened with the new version works
    const fresh = await sessionCookieFor({ id: user.id, tokenVersion: user.tokenVersion + 1 });
    expect((await getMe(fresh)).status).toBe(200);
  });

  it('RG-04, RG-14: a role changed in the database applies to the next request, without signing in again', async () => {
    const user = await createUser(database.prisma);
    const cookie = await sessionCookieFor(user);
    expect((await (await getMe(cookie)).json()).role).toBe('USER');
    await database.prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    expect((await (await getMe(cookie)).json()).role).toBe('ADMIN');
    await database.prisma.user.update({ where: { id: user.id }, data: { role: 'USER' } });
    expect((await (await getMe(cookie)).json()).role).toBe('USER');
  });

  it('never writes the session token or the e-mail in clear in the logs', async () => {
    const user = await createUser(database.prisma, { email: 'jeanne.durand@example.org' });
    const cookie = await sessionCookieFor(user);
    const lines: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string) => (
      lines.push(String(chunk)),
      true
    )) as typeof process.stdout.write;
    try {
      await getMe(cookie);
      await getMe('session=not-a-token');
    } finally {
      process.stdout.write = write;
    }
    const logs = lines.join('');
    expect(logs).toContain('"msg":"request"');
    expect(logs).not.toContain(cookie.split('=')[1]);
    expect(logs).not.toContain('jeanne.durand@example.org');
  });
});

describe('POST /auth/logout', () => {
  it('[F-02] answers 204 and erases the cookie', async () => {
    const user = await createUser(database.prisma);
    const response = await postLogout({ origin: ORIGIN, cookie: await sessionCookieFor(user) });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('set-cookie')).toMatch(/^session=; .*Max-Age=0/);
  });

  it('answers 204 even when the session was already expired or absent', async () => {
    expect((await postLogout({ origin: ORIGIN })).status).toBe(204);
    expect(
      (await postLogout({ origin: ORIGIN, cookie: 'session=expired.token.value' })).status,
    ).toBe(204);
  });

  it('refuses a request with a foreign Origin: 403 FORBIDDEN_ORIGIN, the cookie is not touched', async () => {
    const response = await postLogout({ origin: 'https://evil.example' });
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe('FORBIDDEN_ORIGIN');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('refuses a request without Origin', async () => {
    expect((await postLogout()).status).toBe(403);
  });
});
