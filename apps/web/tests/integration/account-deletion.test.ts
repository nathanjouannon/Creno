import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUser } from '../factories/user';
import { createTestDatabase, type TestDatabase } from '../helpers/test-database';

const NOW = '2027-03-14T08:00:00Z';
const ORIGIN = 'http://localhost:3000';

let database: TestDatabase;
let me: typeof import('@/app/api/me/route');
let check: typeof import('@/app/api/me/deletion-check/route');
let shared: typeof import('@/modules/shared');

type Caller = { id: number; role: 'ADMIN' | 'USER' };
const as = (caller: Caller) => shared.setAuthenticator(shared.fakeAuthenticator(caller));

const deleteMe = () =>
  me.DELETE(
    new Request('http://localhost/api/me', { method: 'DELETE', headers: { origin: ORIGIN } }),
    { params: Promise.resolve({}) },
  );
const checkMe = () =>
  check.GET(new Request('http://localhost/api/me/deletion-check'), {
    params: Promise.resolve({}),
  });

/** Every row of every table as text, so no column can hide a leftover. */
async function dumpDatabase(): Promise<string> {
  const tables = await database.prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  const dumps = await Promise.all(
    tables.map(({ table_name }) =>
      database.prisma.$queryRawUnsafe<{ row: string }[]>(
        `SELECT t::text AS row FROM "${table_name}" t`,
      ),
    ),
  );
  return dumps.flat().map((r) => r.row).join('\n');
}

async function slotAt(startsAt: string) {
  const event = await database.prisma.event.findFirstOrThrow();
  return database.prisma.slot.create({
    data: { eventId: event.id, startsAt, endsAt: '2027-03-30T00:00:00Z' },
  });
}

beforeAll(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.url;
  vi.resetModules();
  shared = await import('@/modules/shared');
  me = await import('@/app/api/me/route');
  check = await import('@/app/api/me/deletion-check/route');
}, 120_000);

afterAll(async () => {
  await database?.drop();
});

beforeEach(async () => {
  shared.setClock(shared.fixedClock(NOW));
  await database.prisma.event.deleteMany();
  await database.prisma.user.deleteMany();
  await database.prisma.event.create({
    data: { title: 'Fête', startsAt: '2027-03-10T00:00:00Z', endsAt: '2027-03-30T00:00:00Z' },
  });
});
afterEach(() => {
  shared.resetClock();
  shared.resetAuthenticator();
});

describe('DELETE /me (F-11, RG-11)', () => {
  it('[F-11 S1] frees unstarted registrations, anonymises started ones and clears the cookie', async () => {
    const admin = await createUser(database.prisma, { role: 'ADMIN' });
    const leaver = await createUser(database.prisma, {
      firstName: 'Zéphyrine',
      lastName: 'Quenouille',
      email: 'zephyrine.quenouille@exemple.fr',
    });
    const other = await createUser(database.prisma);
    const started = await slotAt('2027-03-14T07:00:00Z');
    const future = await slotAt('2027-03-14T09:00:00Z');
    await database.prisma.registration.createMany({
      data: [
        { slotId: started.id, userId: leaver.id },
        { slotId: future.id, userId: leaver.id },
        { slotId: future.id, userId: other.id },
      ],
    });
    await database.prisma.resetToken.create({
      data: { userId: leaver.id, token: 'hash', expiresAt: '2027-03-17T00:00:00Z' },
    });
    as({ id: leaver.id, role: 'USER' });

    const response = await deleteMe();

    expect(response.status).toBe(204);
    expect(response.headers.get('set-cookie')).toMatch(/Max-Age=0|Expires=/i);
    expect(await database.prisma.user.findUnique({ where: { id: leaver.id } })).toBeNull();
    expect(await database.prisma.user.findUnique({ where: { id: admin.id } })).not.toBeNull();
    expect(await database.prisma.resetToken.count()).toBe(0);
    const registrations = await database.prisma.registration.findMany({
      orderBy: { slotId: 'asc' },
    });
    expect(registrations.map((r) => [r.slotId, r.userId])).toEqual([
      [started.id, null],
      [future.id, other.id],
    ]);
  });

  it('RG-11: a slot starting exactly now has started, so its registration is kept anonymised', async () => {
    await createUser(database.prisma, { role: 'ADMIN' });
    const leaver = await createUser(database.prisma);
    const slot = await slotAt(NOW);
    await database.prisma.registration.create({ data: { slotId: slot.id, userId: leaver.id } });
    as({ id: leaver.id, role: 'USER' });

    await deleteMe();

    expect(await database.prisma.registration.findMany({ select: { userId: true } })).toEqual([
      { userId: null },
    ]);
  });

  it('RG-11: no table keeps the name, first name or e-mail of the person', async () => {
    await createUser(database.prisma, { role: 'ADMIN' });
    const leaver = await createUser(database.prisma, {
      firstName: 'Zéphyrine',
      lastName: 'Quenouille',
      email: 'zephyrine.quenouille@exemple.fr',
    });
    const slot = await slotAt('2027-03-14T07:00:00Z');
    await database.prisma.registration.create({ data: { slotId: slot.id, userId: leaver.id } });
    expect(await dumpDatabase()).toContain('Quenouille');
    as({ id: leaver.id, role: 'USER' });

    await deleteMe();

    const dump = await dumpDatabase();
    for (const personal of ['Zéphyrine', 'Quenouille', 'zephyrine.quenouille@exemple.fr']) {
      expect(dump).not.toContain(personal);
    }
  });

  it('[F-11 S3] RG-04: the last administrator is refused and keeps their account', async () => {
    const admin = await createUser(database.prisma, { role: 'ADMIN' });
    as({ id: admin.id, role: 'ADMIN' });

    const attempt = await deleteMe();
    const body = await attempt.json();

    expect(attempt.status).toBe(409);
    expect(body.code).toBe('USER_LAST_ADMIN');
    expect(attempt.headers.get('set-cookie')).toBeNull();
    expect(await database.prisma.user.count()).toBe(1);
  });

  it('RG-04: an administrator may leave when another remains', async () => {
    const first = await createUser(database.prisma, { role: 'ADMIN' });
    await createUser(database.prisma, { role: 'ADMIN' });
    as({ id: first.id, role: 'ADMIN' });

    expect((await deleteMe()).status).toBe(204);
  });

  it('RG-04: two administrators deleting at the same time, one stays', async () => {
    const a = await createUser(database.prisma, { role: 'ADMIN' });
    const b = await createUser(database.prisma, { role: 'ADMIN' });
    // Each request names its caller, so the two really run as two different administrators
    shared.setAuthenticator(async (request) => ({
      id: Number(request.headers.get('x-test-user')),
      role: 'ADMIN',
    }));
    const as = (id: number) =>
      me.DELETE(
        new Request('http://localhost/api/me', {
          method: 'DELETE',
          headers: { origin: ORIGIN, 'x-test-user': String(id) },
        }),
        { params: Promise.resolve({}) },
      );
    const statuses = (await Promise.all([as(a.id), as(b.id)])).map((r) => r.status);

    expect(await database.prisma.user.count({ where: { role: 'ADMIN' } })).toBe(1);
    expect(statuses.sort()).toEqual([204, 409]);
  });

  it('refuses an unauthenticated call', async () => {
    shared.setAuthenticator(shared.fakeAuthenticator(null));
    expect((await deleteMe()).status).toBe(401);
  });
});

describe('GET /me/deletion-check (F-11 S3)', () => {
  it('answers 409 for the last administrator and deletes nothing', async () => {
    const admin = await createUser(database.prisma, { role: 'ADMIN' });
    as({ id: admin.id, role: 'ADMIN' });

    const response = await checkMe();

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('USER_LAST_ADMIN');
    expect(await database.prisma.user.count()).toBe(1);
  });

  it('answers 204 for a user and deletes nothing', async () => {
    await createUser(database.prisma, { role: 'ADMIN' });
    const member = await createUser(database.prisma);
    as({ id: member.id, role: 'USER' });

    expect((await checkMe()).status).toBe(204);
    expect(await database.prisma.user.count()).toBe(2);
  });
});
