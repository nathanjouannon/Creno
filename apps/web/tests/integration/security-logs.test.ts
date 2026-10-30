import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createUser } from '../factories/user';
import { createTestDatabase, type TestDatabase } from '../helpers/test-database';

// security.md, section 4 (#81): the security events are logged with internal ids, never an e-mail, a password or a
// token, and every request line names its route by its template.
const ORIGIN = 'http://localhost:3000';
const ADMIN_EMAIL = 'premier.admin@exemple.fr';

let database: TestDatabase;
let shared: typeof import('@/modules/shared');
let setupRoute: typeof import('@/app/api/setup/route');
let resetLinkRoute: typeof import('@/app/api/users/[userId]/password-resets/route');
let resetRoute: typeof import('@/app/api/password-resets/[token]/route');
let roleRoute: typeof import('@/app/api/users/[userId]/role/route');
let meRoute: typeof import('@/app/api/me/route');

let lines: string[] = [];
const realWrite = process.stdout.write.bind(process.stdout);

/** The JSON lines written while running `action`. */
async function logsOf(action: () => Promise<unknown>) {
  lines = [];
  process.stdout.write = ((chunk: string) => (
    lines.push(String(chunk)),
    true
  )) as typeof process.stdout.write;
  try {
    await action();
  } finally {
    process.stdout.write = realWrite;
  }
  const text = lines.join('');
  return {
    text,
    entries: text
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Record<string, unknown>),
  };
}

const send = (method: string, path: string, body?: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { origin: ORIGIN },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const withParams = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

let adminId: number;

beforeAll(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.url;
  vi.resetModules();
  shared = await import('@/modules/shared');
  setupRoute = await import('@/app/api/setup/route');
  resetLinkRoute = await import('@/app/api/users/[userId]/password-resets/route');
  resetRoute = await import('@/app/api/password-resets/[token]/route');
  roleRoute = await import('@/app/api/users/[userId]/role/route');
  meRoute = await import('@/app/api/me/route');
}, 60_000);

afterAll(async () => {
  await database?.drop();
});

afterEach(() => {
  shared.resetAuthenticator();
  shared.resetRateLimits();
});

describe('security events (security.md, section 4, #81)', () => {
  it('RG-17: the installation is logged with the id of the first administrator', async () => {
    const { entries, text } = await logsOf(async () => {
      const response = await setupRoute.POST(
        send('POST', '/api/setup', {
          club: { name: 'Club des logs', timezone: 'Europe/Paris' },
          admin: {
            firstName: 'Alex',
            lastName: 'Martin',
            email: ADMIN_EMAIL,
            password: '0123456789',
          },
        }),
      );
      expect(response.status).toBe(201);
      adminId = (await response.json()).id;
    });
    expect(entries).toContainEqual(
      expect.objectContaining({ msg: 'instance installed', userId: adminId }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ msg: 'request', route: '/api/setup', status: 201 }),
    );
    expect(text).not.toMatch(/premier\.admin|0123456789/);
  });

  it('RG-12: generating and using a reset link are logged, without the token or the address', async () => {
    const member = await createUser(database.prisma, { email: 'membre.logs@exemple.fr' });
    shared.setAuthenticator(shared.fakeAuthenticator({ id: adminId, role: 'ADMIN' }));

    let token = '';
    const created = await logsOf(async () => {
      const response = await resetLinkRoute.POST(
        send('POST', `/api/users/${member.id}/password-resets`),
        withParams({ userId: String(member.id) }),
      );
      expect(response.status).toBe(201);
      token = String((await response.json()).url)
        .split('/')
        .at(-1)!;
    });
    expect(created.entries).toContainEqual(
      expect.objectContaining({
        msg: 'password reset link created',
        actorId: adminId,
        userId: member.id,
      }),
    );
    expect(created.entries).toContainEqual(
      expect.objectContaining({ route: '/api/users/[userId]/password-resets', userId: adminId }),
    );
    expect(created.text).not.toContain(token);

    shared.resetAuthenticator();
    const used = await logsOf(async () => {
      const response = await resetRoute.POST(
        send('POST', `/api/password-resets/${token}`, { password: 'nouveau-mot-de-passe' }),
        withParams({ token }),
      );
      expect(response.status).toBe(204);
    });
    expect(used.entries).toContainEqual(
      expect.objectContaining({ msg: 'password reset used', userId: member.id }),
    );
    expect(used.entries).toContainEqual(
      expect.objectContaining({ msg: 'request', route: '/api/password-resets/[token]' }),
    );
    expect(used.text).not.toContain(token);
    expect(used.text).not.toMatch(/membre\.logs|nouveau-mot-de-passe/);
  });

  it('RG-04: a role change is logged with who did it, and a request that changes nothing is not', async () => {
    const member = await createUser(database.prisma, { email: 'promu.logs@exemple.fr' });
    shared.setAuthenticator(shared.fakeAuthenticator({ id: adminId, role: 'ADMIN' }));
    const promote = () =>
      roleRoute.PUT(
        send('PUT', `/api/users/${member.id}/role`, { role: 'ADMIN' }),
        withParams({ userId: String(member.id) }),
      );

    const changed = await logsOf(promote);
    expect(changed.entries).toContainEqual(
      expect.objectContaining({
        msg: 'role changed',
        actorId: adminId,
        userId: member.id,
        role: 'ADMIN',
      }),
    );
    const again = await logsOf(promote);
    expect(again.entries.map((e) => e.msg)).not.toContain('role changed');
  });

  it('RG-11: an account deletion is logged with the internal id only', async () => {
    const member = await createUser(database.prisma, { email: 'parti.logs@exemple.fr' });
    shared.setAuthenticator(shared.fakeAuthenticator({ id: member.id, role: 'USER' }));
    const { entries, text } = await logsOf(async () => {
      expect((await meRoute.DELETE(send('DELETE', '/api/me'))).status).toBe(204);
    });
    expect(entries).toContainEqual(
      expect.objectContaining({ msg: 'account deleted', userId: member.id }),
    );
    expect(text).not.toContain('parti.logs');
  });
});
