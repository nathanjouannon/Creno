import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUser } from '../factories/user';
import { createTestDatabase, type TestDatabase } from '../helpers/test-database';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct-password-1';

let database: TestDatabase;
let me: typeof import('@/app/api/me/route');
let shared: typeof import('@/modules/shared');
let auth: typeof import('@/modules/auth');
let userId: number;

const as = (id: number, role: 'USER' | 'ADMIN' = 'USER') =>
  shared.setAuthenticator(shared.fakeAuthenticator({ id, role }));

const patchMe = (body: unknown) =>
  me.PATCH(
    new Request('http://localhost/api/me', {
      method: 'PATCH',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({}) },
  );

const change = (overrides: Record<string, unknown>) => ({
  firstName: 'Léa',
  lastName: 'Bernard',
  email: 'lea@exemple.fr',
  ...overrides,
});

beforeAll(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.url;
  vi.resetModules();
  shared = await import('@/modules/shared');
  auth = await import('@/modules/auth');
  me = await import('@/app/api/me/route');
}, 120_000);

afterAll(async () => {
  await database?.drop();
});

beforeEach(async () => {
  shared.resetRateLimits();
  await database.prisma.user.deleteMany();
  const user = await createUser(database.prisma, {
    firstName: 'Léa',
    lastName: 'Bernard',
    email: 'lea@exemple.fr',
    passwordHash: await auth.hashPassword(PASSWORD),
  });
  userId = user.id;
  as(userId);
});
afterEach(() => shared.resetAuthenticator());

describe('PATCH /me (F-20, RG-18)', () => {
  it('[F-20 S2] changes the name and first name without a password, and keeps the address', async () => {
    const response = await patchMe(change({ firstName: 'Léana', lastName: 'Durand' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      firstName: 'Léana',
      lastName: 'Durand',
      email: 'lea@exemple.fr',
    });
    const row = await database.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect([row.firstName, row.lastName]).toEqual(['Léana', 'Durand']);
  });

  it('[F-20 S3] a new address with the current password is saved; the old one no longer finds the user', async () => {
    const response = await patchMe(
      change({ email: ' nouvelle@exemple.fr ', currentPassword: PASSWORD }),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).email).toBe('nouvelle@exemple.fr');
    const login = await import('@/modules/auth').then((m) => m.getLoginService());
    const log = shared.getLogger();
    await expect(
      login.login({ email: 'lea@exemple.fr', password: PASSWORD }, log),
    ).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    });
    await expect(
      login.login({ email: 'nouvelle@exemple.fr', password: PASSWORD }, log),
    ).resolves.toBeDefined();
  });

  it('[F-20 S4] a missing or wrong current password is a field error and nothing changes', async () => {
    const missing = await patchMe(change({ email: 'nouvelle@exemple.fr' }));
    const wrong = await patchMe(
      change({ email: 'nouvelle@exemple.fr', currentPassword: 'wrong-password' }),
    );

    expect(missing.status).toBe(400);
    expect((await missing.json()).details.fields).toEqual([
      { field: 'currentPassword', code: 'FIELD_REQUIRED' },
    ]);
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).details.fields).toEqual([
      { field: 'currentPassword', code: 'FIELD_PASSWORD_INCORRECT' },
    ]);
    expect((await database.prisma.user.findUniqueOrThrow({ where: { id: userId } })).email).toBe(
      'lea@exemple.fr',
    );
  });

  it('[F-20 S5] RG-01: an address used by someone else is refused without regard to case', async () => {
    await createUser(database.prisma, { email: 'Marie@Club.fr' });

    const response = await patchMe(change({ email: 'marie@club.fr', currentPassword: PASSWORD }));

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('USER_EMAIL_IN_USE');
    expect((await database.prisma.user.findUniqueOrThrow({ where: { id: userId } })).email).toBe(
      'lea@exemple.fr',
    );
  });

  it("RG-01: changing only the case of one's own address is not a conflict with oneself", async () => {
    const response = await patchMe(change({ email: 'Lea@Exemple.fr', currentPassword: PASSWORD }));
    expect(response.status).toBe(200);
  });

  it('[F-20 S6] an empty name or a malformed address is VALIDATION_ERROR', async () => {
    const response = await patchMe(change({ lastName: '', email: 'sans-arobase' }));
    expect(response.status).toBe(400);
    expect((await response.json()).details.fields).toEqual([
      { field: 'lastName', code: 'FIELD_REQUIRED' },
      { field: 'email', code: 'FIELD_EMAIL_INVALID' },
    ]);
  });

  it('RG-14: access denied without a session; a role in the body is refused and never applied', async () => {
    shared.resetAuthenticator();
    shared.setAuthenticator(async () => null);
    expect((await patchMe(change({}))).status).toBe(401);

    as(userId);
    expect((await patchMe(change({ role: 'ADMIN' }))).status).toBe(400);
    expect((await database.prisma.user.findUniqueOrThrow({ where: { id: userId } })).role).toBe(
      'USER',
    );
  });

  it("RG-18: only the owner's row changes, whoever else exists", async () => {
    const other = await createUser(database.prisma, {
      firstName: 'Paul',
      email: 'paul@exemple.fr',
    });
    await patchMe(change({ firstName: 'Léana' }));
    expect(
      (await database.prisma.user.findUniqueOrThrow({ where: { id: other.id } })).firstName,
    ).toBe('Paul');
  });
});
