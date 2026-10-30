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
const EMAIL = 'mail.ex@exemple.fr';
const PASSWORD = 'correct-password-1';
const START = new Date('2027-01-14T09:00:00Z');
const minutes = (n: number) => new Date(START.getTime() + n * 60_000);

let database: TestDatabase;
let loginRoute: typeof import('@/app/api/auth/login/route');
let meRoute: typeof import('@/app/api/me/route');
let shared: typeof import('@/modules/shared');
let auth: typeof import('@/modules/auth');
let userId: number;

const login = (email: string, password: string) =>
  loginRoute.POST(
    new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { origin: ORIGIN },
      body: JSON.stringify({ email, password }),
    }),
  );

const attempts = () => database.prisma.loginAttempt.findMany();

async function fail(times: number, email = EMAIL) {
  for (let i = 0; i < times; i++) expect((await login(email, 'wrong-password')).status).toBe(401);
}

beforeAll(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.url;
  vi.resetModules();
  shared = await import('@/modules/shared');
  auth = await import('@/modules/auth');
  loginRoute = await import('@/app/api/auth/login/route');
  meRoute = await import('@/app/api/me/route');
  const user = await createUser(database.prisma, {
    email: EMAIL,
    firstName: 'Alex',
    passwordHash: await auth.hashPassword(PASSWORD),
  });
  userId = user.id;
}, 60_000);

afterAll(async () => {
  await database?.drop();
});

beforeEach(async () => {
  shared.resetRateLimits();
  shared.setClock(shared.fixedClock(START));
  await database.prisma.loginAttempt.deleteMany();
});
afterEach(() => shared.resetClock());

describe('POST /auth/login (F-02, RG-03)', () => {
  it('[F-02 S1] signs in with the right credentials: User schema, session cookie that /me accepts', async () => {
    const response = await login(EMAIL, PASSWORD);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ id: userId, firstName: 'Alex', email: EMAIL, role: 'USER' });
    expect(conforms('User', body)).toBe(true);

    const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    const me = await meRoute.GET(new Request('http://localhost/api/me', { headers: { cookie } }));
    expect(me.status).toBe(200);
  });

  it('RG-01: the address is matched without case and without surrounding spaces', async () => {
    expect((await login('  MAIL.ex@Exemple.FR ', PASSWORD)).status).toBe(200);
  });

  it('[F-02 S2] a wrong password is 401 AUTH_INVALID_CREDENTIALS and conforms to the Error schema', async () => {
    const response = await login(EMAIL, 'wrong-password');
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
      message: 'E-mail ou mot de passe incorrect.',
    });
    expect(conforms('Error', body)).toBe(true);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('RG-03: an address without account gets exactly the same answer as a wrong password', async () => {
    const wrong = await login(EMAIL, 'wrong-password');
    const unknown = await login('nobody@exemple.fr', 'wrong-password');
    const strip = async (r: Response) => {
      const rest = Object.fromEntries(
        Object.entries(await r.json()).filter(([key]) => key !== 'requestId'),
      );
      return { status: r.status, rest, cookie: r.headers.get('set-cookie') };
    };
    expect(await strip(unknown)).toEqual(await strip(wrong));
  });

  it('RG-11: an account that no longer exists gets AUTH_INVALID_CREDENTIALS', async () => {
    const gone = await createUser(database.prisma, {
      email: 'gone@exemple.fr',
      passwordHash: await auth.hashPassword(PASSWORD),
    });
    expect((await login('gone@exemple.fr', PASSWORD)).status).toBe(200);
    await database.prisma.user.delete({ where: { id: gone.id } });
    const response = await login('gone@exemple.fr', PASSWORD);
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('[F-02 S3] RG-03: after 5 failures the 6th attempt is blocked 15 minutes, even with the right password', async () => {
    await fail(5);
    const blocked = await login(EMAIL, PASSWORD);
    const body = await blocked.json();
    expect(blocked.status).toBe(423);
    expect(body).toMatchObject({
      code: 'AUTH_ACCOUNT_LOCKED',
      details: { lockedUntil: minutes(15).toISOString() },
    });
    expect(conforms('Error', body)).toBe(true);
    expect(blocked.headers.get('set-cookie')).toBeNull();
  });

  it('RG-03: attempts during the block do not extend it, and it ends after 15 minutes', async () => {
    await fail(5);
    shared.setClock(shared.fixedClock(minutes(10)));
    const during = await login(EMAIL, PASSWORD);
    expect((await during.json()).details.lockedUntil).toBe(minutes(15).toISOString());

    shared.setClock(shared.fixedClock(minutes(15)));
    expect((await login(EMAIL, PASSWORD)).status).toBe(200);
  });

  it('[F-02 S3 ter] RG-03: an address without account is blocked in the same way, with the same message', async () => {
    await fail(5, 'nobody@exemple.fr');
    const blocked = await login('nobody@exemple.fr', 'wrong-password');
    const body = await blocked.json();
    expect(blocked.status).toBe(423);
    expect(body).toMatchObject({
      code: 'AUTH_ACCOUNT_LOCKED',
      details: { lockedUntil: minutes(15).toISOString() },
    });
  });

  it('[F-02 S3 bis] RG-03: a successful login resets the counter, so a later failure counts for the first', async () => {
    await fail(4);
    expect((await login(EMAIL, PASSWORD)).status).toBe(200);
    expect(await attempts()).toEqual([]);
    await fail(1);
    expect((await attempts())[0]).toMatchObject({ failedCount: 1, lockedUntil: null });
    expect((await login(EMAIL, PASSWORD)).status).toBe(200);
  });

  it('RG-03: after a block has ended, five new failures are needed to block again', async () => {
    await fail(5);
    shared.setClock(shared.fixedClock(minutes(16)));
    await fail(4);
    expect((await login(EMAIL, PASSWORD)).status).toBe(200);
  });

  it('RG-03: simultaneous failures are all counted (atomic counter)', async () => {
    const answers = await Promise.all(
      Array.from({ length: 5 }, () => login(EMAIL, 'wrong-password')),
    );
    expect(answers.map((r) => r.status)).toEqual([401, 401, 401, 401, 401]);
    const [row] = await attempts();
    expect(row).toMatchObject({ failedCount: 5 });
    expect(row?.lockedUntil).toEqual(minutes(15));
    expect((await login(EMAIL, PASSWORD)).status).toBe(423);
  });

  it('RG-03: simultaneous attempts never check more than 5 passwords (#78)', async () => {
    const answers = await Promise.all(
      Array.from({ length: 10 }, (_, i) => login(EMAIL, `wrong-password-${i}`)),
    );
    const statuses = answers.map((r) => r.status).sort();
    expect(statuses).toEqual([401, 401, 401, 401, 401, 423, 423, 423, 423, 423]);
    const [row] = await attempts();
    expect(row).toMatchObject({ failedCount: 5, lockedUntil: minutes(15) });
  });

  it('RG-03: after 4 failures, a burst gets one more check and the rest is blocked (#78)', async () => {
    await fail(4);
    shared.resetRateLimits();
    const answers = await Promise.all([
      ...Array.from({ length: 9 }, (_, i) => login(EMAIL, `wrong-password-${i}`)),
      login(EMAIL, PASSWORD),
    ]);
    const statuses = answers.map((r) => r.status);
    expect(statuses.filter((s) => s === 423)).toHaveLength(9);
    expect(statuses.filter((s) => s !== 423)).toHaveLength(1);
    expect(statuses).not.toContain(500);
  });

  it('RG-03, ADR-0013: the typed address is never stored in clear in login_attempts', async () => {
    await fail(2, 'Secret.Person@exemple.fr');
    const rows = await database.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT * FROM login_attempts',
    );
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toMatch(/secret|exemple/i);
    expect(rows[0]!.identifier_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('RG-01: an invalid body is a VALIDATION_ERROR and does not count as a failure', async () => {
    const response = await loginRoute.POST(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { origin: ORIGIN },
        body: JSON.stringify({ email: '' }),
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).details.fields).toEqual([
      { field: 'email', code: 'FIELD_REQUIRED' },
      { field: 'password', code: 'FIELD_REQUIRED' },
    ]);
    expect(await attempts()).toEqual([]);
  });

  it('the 11th request in a minute from one address is 429 (security.md)', async () => {
    for (let i = 0; i < 10; i++) await login('nobody@exemple.fr', 'x');
    expect((await login('nobody@exemple.fr', 'x')).status).toBe(429);
  });

  it('never writes the password, the typed address or a token in the logs', async () => {
    const lines: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string) => (
      lines.push(String(chunk)),
      true
    )) as typeof process.stdout.write;
    try {
      await login('hidden.address@exemple.fr', 'a-very-private-password');
      await fail(5);
      const ok = await login(EMAIL, PASSWORD).catch(() => undefined);
      void ok;
    } finally {
      process.stdout.write = write;
    }
    const logs = lines.join('');
    expect(logs).toContain('login failed');
    expect(logs).not.toContain('a-very-private-password');
    expect(logs).not.toContain('hidden.address');
    expect(logs).not.toContain(PASSWORD);
    expect(logs).not.toContain('wrong-password');
    expect(logs).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // no JWT
  });
});
