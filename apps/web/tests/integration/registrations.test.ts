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
const conformsToSlot = (value: unknown) =>
  new Ajv({ strict: false }).compile({
    components: openapi.components,
    $ref: '#/components/schemas/Slot',
  })(value);

const ORIGIN = 'http://localhost:3000';
const NOW = '2027-03-14T08:00:00Z';

let database: TestDatabase;
let collection: typeof import('@/app/api/slots/[slotId]/registrations/route');
let mine: typeof import('@/app/api/slots/[slotId]/registrations/me/route');
let item: typeof import('@/app/api/registrations/[registrationId]/route');
let slotItem: typeof import('@/app/api/slots/[slotId]/route');
let shared: typeof import('@/modules/shared');
let adminId: number;
let userId: number;
let volunteerIds: number[];

type Caller = { id: number; role: 'ADMIN' | 'USER' } | null;
const asAdmin = (): Caller => ({ id: adminId, role: 'ADMIN' });
const asUser = (): Caller => ({ id: userId, role: 'USER' });
const as = (caller: Caller) => shared.setAuthenticator(shared.fakeAuthenticator(caller));

type Handler = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

async function send(
  handler: Handler,
  method: string,
  path: string,
  params: Record<string, string>,
) {
  const response = await handler(
    new Request(`http://localhost/api${path}`, { method, headers: { origin: ORIGIN } }),
    { params: Promise.resolve(params) },
  );
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

const register = (slotId: number) =>
  send(collection.POST, 'POST', `/slots/${slotId}/registrations`, { slotId: String(slotId) });
const unregister = (slotId: number) =>
  send(mine.DELETE, 'DELETE', `/slots/${slotId}/registrations/me`, { slotId: String(slotId) });
const removeRegistration = (id: number) =>
  send(item.DELETE, 'DELETE', `/registrations/${id}`, { registrationId: String(id) });

// 14 March: the event runs 08:00 to 18:00 in Europe/Paris, the slots 09:00 to 12:00 and 11:00 to 14:00 local time
const eventTimes = { startsAt: '2027-03-14T07:00:00Z', endsAt: '2027-03-14T17:00:00Z' };
const morning = { startsAt: '2027-03-14T08:00:00Z', endsAt: '2027-03-14T11:00:00Z' };
const late = { startsAt: '2027-03-14T10:00:00Z', endsAt: '2027-03-14T13:00:00Z' };
// Started one hour before NOW
const started = { startsAt: '2027-03-14T07:00:00Z', endsAt: '2027-03-14T10:00:00Z' };

async function insertEvent(times = eventTimes) {
  return database.prisma.event.create({
    data: { title: 'Course', startsAt: new Date(times.startsAt), endsAt: new Date(times.endsAt) },
  });
}

async function insertSlot(
  eventId: number,
  capacity: number | null,
  registeredCount = 0,
  times: { startsAt: string; endsAt: string } = {
    startsAt: '2027-03-14T09:00:00Z',
    endsAt: '2027-03-14T12:00:00Z',
  },
) {
  return database.prisma.slot.create({
    data: {
      eventId,
      startsAt: new Date(times.startsAt),
      endsAt: new Date(times.endsAt),
      capacity,
      registrations: {
        create: volunteerIds.slice(0, registeredCount).map((id) => ({ userId: id })),
      },
    },
  });
}

const countRegistrations = (slotId: number) =>
  database.prisma.registration.count({ where: { slotId } });

beforeAll(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.url;
  vi.resetModules();
  shared = await import('@/modules/shared');
  collection = await import('@/app/api/slots/[slotId]/registrations/route');
  mine = await import('@/app/api/slots/[slotId]/registrations/me/route');
  item = await import('@/app/api/registrations/[registrationId]/route');
  slotItem = await import('@/app/api/slots/[slotId]/route');
  adminId = (await createUser(database.prisma, { role: 'ADMIN' })).id;
  userId = (await createUser(database.prisma)).id;
  volunteerIds = [];
  for (let i = 0; i < 60; i++) volunteerIds.push((await createUser(database.prisma)).id);
}, 120_000);

afterAll(async () => {
  await database?.drop();
});

beforeEach(async () => {
  shared.resetRateLimits();
  shared.setClock(shared.fixedClock(NOW));
  as(asUser());
  await database.prisma.event.deleteMany();
});
afterEach(() => {
  shared.resetClock();
  shared.resetAuthenticator();
});

describe('POST /slots/{slotId}/registrations (F-07)', () => {
  it('[F-07 S1] RG-07: registers the caller and returns the updated slot', async () => {
    const slot = await insertSlot((await insertEvent()).id, 4, 2);
    const response = await register(slot.id);
    expect(response.status).toBe(201);
    expect(conformsToSlot(response.body)).toBe(true);
    expect(response.body).toMatchObject({ registeredCount: 3, remainingPlaces: 1, full: false });
    expect(response.body.attendees.filter((a: { isMe: boolean }) => a.isMe)).toHaveLength(1);
    expect(await countRegistrations(slot.id)).toBe(3);
  });

  it('[F-07 S2] RG-07: refuses a full slot with SLOT_FULL', async () => {
    const slot = await insertSlot((await insertEvent()).id, 2, 2);
    const response = await register(slot.id);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SLOT_FULL');
    expect(await countRegistrations(slot.id)).toBe(2);
  });

  it('[F-07 S3] RG-07: the last seat goes to exactly one of 50 simultaneous requests', async () => {
    const slot = await insertSlot((await insertEvent()).id, 4, 3);
    const callers = volunteerIds.slice(3, 53);
    // The authenticator is process-wide: the request header says who is calling
    shared.setAuthenticator(async (request) => ({
      id: Number(request.headers.get('x-caller')),
      role: 'USER',
    }));
    const responses = await Promise.all(
      callers.map(async (id) => {
        const response = await collection.POST(
          new Request(`http://localhost/api/slots/${slot.id}/registrations`, {
            method: 'POST',
            headers: { origin: ORIGIN, 'x-caller': String(id) },
          }),
          { params: Promise.resolve({ slotId: String(slot.id) }) },
        );
        return { status: response.status, body: await response.json().catch(() => null) };
      }),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409 && r.body.code === 'SLOT_FULL')).toHaveLength(
      49,
    );
    expect(await countRegistrations(slot.id)).toBe(4);
  }, 60_000);

  it('RG-07: an unlimited slot accepts every registration', async () => {
    const slot = await insertSlot((await insertEvent()).id, null, 20);
    const response = await register(slot.id);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      registeredCount: 21,
      remainingPlaces: null,
      full: false,
    });
  });

  it('[F-07 S4] RG-08: refuses a slot that has started', async () => {
    const slot = await insertSlot((await insertEvent()).id, 4, 0, started);
    const response = await register(slot.id);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SLOT_STARTED');
    expect(await countRegistrations(slot.id)).toBe(0);
  });

  it('[F-07 S4 bis] RG-08: refuses at the exact start of the slot', async () => {
    const slot = await insertSlot((await insertEvent()).id, 4, 0, morning); // starts at NOW
    const response = await register(slot.id);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SLOT_STARTED');
  });

  it('[F-07 S4 ter] RG-08: an administrator registers with the same rules', async () => {
    as(asAdmin());
    const open = await insertSlot((await insertEvent()).id, 4);
    expect((await register(open.id)).status).toBe(201);
    const full = await insertSlot(open.eventId, 1, 1);
    expect((await register(full.id)).body.code).toBe('SLOT_FULL');
    const begun = await insertSlot(open.eventId, 4, 0, started);
    expect((await register(begun.id)).body.code).toBe('SLOT_STARTED');
  });

  it('[F-07 S5] RG-08: overlapping slots are both accepted', async () => {
    const event = await insertEvent();
    const first = await insertSlot(event.id, 4, 0, {
      startsAt: '2027-03-14T08:30:00Z',
      endsAt: '2027-03-14T11:00:00Z',
    });
    const second = await insertSlot(event.id, 4, 0, late);
    expect((await register(first.id)).status).toBe(201);
    expect((await register(second.id)).status).toBe(201);
  });

  it('RG-08: a second registration to the same slot is refused', async () => {
    const slot = await insertSlot((await insertEvent()).id, 4);
    await register(slot.id);
    const response = await register(slot.id);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('REGISTRATION_ALREADY_EXISTS');
    expect(await countRegistrations(slot.id)).toBe(1);
  });

  it('RG-09: a slot of a past event is not found for a user, EVENT_PAST for an administrator (RG-15)', async () => {
    const past = await insertEvent({
      startsAt: '2027-03-13T07:00:00Z',
      endsAt: '2027-03-13T17:00:00Z',
    });
    const slot = await insertSlot(past.id, 4, 0, {
      startsAt: '2027-03-13T09:00:00Z',
      endsAt: '2027-03-13T12:00:00Z',
    });
    expect((await register(slot.id)).body.code).toBe('SLOT_NOT_FOUND');
    as(asAdmin());
    expect((await register(slot.id)).body.code).toBe('EVENT_PAST');
    expect(await countRegistrations(slot.id)).toBe(0);
  });

  it('answers 404 SLOT_NOT_FOUND for an unknown slot and 401 to a visitor', async () => {
    expect((await register(999_999)).body.code).toBe('SLOT_NOT_FOUND');
    as(null);
    expect((await register(1)).status).toBe(401);
  });
});

describe('registration and capacity change at the same time', () => {
  it('RG-07: never leaves more registrations than seats', async () => {
    // One process-wide authenticator: the header says who calls, an administrator or a user
    shared.setAuthenticator(async (request) =>
      request.headers.get('x-caller') === 'admin' ? asAdmin() : asUser(),
    );
    for (let round = 0; round < 10; round++) {
      const slot = await insertSlot((await insertEvent()).id, 4, 3);
      const params = { params: Promise.resolve({ slotId: String(slot.id) }) };
      const [registered, lowered] = await Promise.all([
        collection.POST(
          new Request(`http://localhost/api/slots/${slot.id}/registrations`, {
            method: 'POST',
            headers: { origin: ORIGIN },
          }),
          params,
        ),
        slotItem.PATCH(
          new Request(`http://localhost/api/slots/${slot.id}`, {
            method: 'PATCH',
            headers: { origin: ORIGIN, 'x-caller': 'admin' },
            body: JSON.stringify({ capacity: 3 }),
          }),
          params,
        ),
      ]);
      const { capacity } = await database.prisma.slot.findUniqueOrThrow({ where: { id: slot.id } });
      expect(await countRegistrations(slot.id)).toBeLessThanOrEqual(capacity ?? Infinity);
      // Exactly one of the two wins: the other is refused by the rule, never by an error
      expect([registered.status, lowered.status].sort()).toEqual(
        registered.status === 201 ? [201, 409] : [200, 409],
      );
    }
  }, 60_000);
});

describe('DELETE /slots/{slotId}/registrations/me (F-08)', () => {
  it('[F-08 S1] RG-08: frees a seat of a full slot', async () => {
    const slot = await insertSlot((await insertEvent()).id, 2, 1);
    await register(slot.id);
    expect((await register(slot.id)).body.code).toBe('REGISTRATION_ALREADY_EXISTS');
    expect((await unregister(slot.id)).status).toBe(204);
    expect(await countRegistrations(slot.id)).toBe(1);
    as({ id: volunteerIds[5]!, role: 'USER' });
    expect((await register(slot.id)).status).toBe(201);
  });

  it('[F-08 S2] changes slot: unregister from A, register to B', async () => {
    const event = await insertEvent();
    const a = await insertSlot(event.id, 4);
    const b = await insertSlot(event.id, 4, 0, late);
    await register(a.id);
    expect((await unregister(a.id)).status).toBe(204);
    expect((await register(b.id)).status).toBe(201);
    expect(await countRegistrations(a.id)).toBe(0);
    expect(await countRegistrations(b.id)).toBe(1);
  });

  it('[F-08 S3] keeps the registration to A when B is full', async () => {
    const event = await insertEvent();
    const a = await insertSlot(event.id, 4);
    const b = await insertSlot(event.id, 1, 1, late);
    await register(a.id);
    expect((await register(b.id)).body.code).toBe('SLOT_FULL');
    expect(await countRegistrations(a.id)).toBe(1);
  });

  it('[F-08 S4] RG-08: refuses a slot that has started, and keeps the registration', async () => {
    const slot = await insertSlot((await insertEvent()).id, 4, 0, started);
    await database.prisma.registration.create({ data: { slotId: slot.id, userId } });
    const response = await unregister(slot.id);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SLOT_STARTED');
    expect(await countRegistrations(slot.id)).toBe(1);
  });

  it('RG-08: refuses at the exact start of the slot', async () => {
    const slot = await insertSlot((await insertEvent()).id, 4, 0, morning);
    await database.prisma.registration.create({ data: { slotId: slot.id, userId } });
    expect((await unregister(slot.id)).body.code).toBe('SLOT_STARTED');
  });

  it('answers 404 REGISTRATION_NOT_FOUND when the caller is not registered', async () => {
    const slot = await insertSlot((await insertEvent()).id, 4, 1);
    const response = await unregister(slot.id);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('REGISTRATION_NOT_FOUND');
    expect(await countRegistrations(slot.id)).toBe(1);
  });

  it('answers 404 SLOT_NOT_FOUND for an unknown slot', async () => {
    expect((await unregister(999_999)).body.code).toBe('SLOT_NOT_FOUND');
  });
});

describe('DELETE /registrations/{registrationId} (F-09)', () => {
  const registrationOf = (slotId: number, forUser: number) =>
    database.prisma.registration.create({ data: { slotId, userId: forUser } });

  it('[F-09 S5] RG-08: an administrator removes a registration and the seat is free again', async () => {
    const slot = await insertSlot((await insertEvent()).id, 2);
    const registration = await registrationOf(slot.id, volunteerIds[0]!);
    await registrationOf(slot.id, volunteerIds[1]!);
    as(asAdmin());
    expect((await removeRegistration(registration.id)).status).toBe(204);
    expect(await countRegistrations(slot.id)).toBe(1);
    as(asUser());
    expect((await register(slot.id)).status).toBe(201);
  });

  it('[F-09 S6] RG-08: an administrator removes a registration of a started slot', async () => {
    const slot = await insertSlot((await insertEvent()).id, 4, 0, started);
    const registration = await registrationOf(slot.id, volunteerIds[0]!);
    as(asAdmin());
    expect((await removeRegistration(registration.id)).status).toBe(204);
    expect(await countRegistrations(slot.id)).toBe(0);
  });

  it('[F-09 S7] RG-15: refuses on a past event', async () => {
    const past = await insertEvent({
      startsAt: '2027-03-13T07:00:00Z',
      endsAt: '2027-03-13T17:00:00Z',
    });
    const slot = await insertSlot(past.id, 4);
    const registration = await registrationOf(slot.id, volunteerIds[0]!);
    as(asAdmin());
    const response = await removeRegistration(registration.id);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EVENT_PAST');
    expect(await countRegistrations(slot.id)).toBe(1);
  });

  it('RG-14: a user cannot remove the registration of another (403) nor a visitor (401)', async () => {
    const slot = await insertSlot((await insertEvent()).id, 4);
    const registration = await registrationOf(slot.id, volunteerIds[0]!);
    const forbidden = await removeRegistration(registration.id);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');
    as(null);
    expect((await removeRegistration(registration.id)).status).toBe(401);
    expect(await countRegistrations(slot.id)).toBe(1);
  });

  it('answers 404 REGISTRATION_NOT_FOUND for an unknown registration', async () => {
    as(asAdmin());
    expect((await removeRegistration(999_999)).body.code).toBe('REGISTRATION_NOT_FOUND');
  });
});

describe('attendees (RG-09, RG-11)', () => {
  it('RG-09, RG-11: « Prénom N. », null for a former member, isMe and registrationId', async () => {
    const slot = await insertSlot((await insertEvent()).id, 6);
    const alice = await createUser(database.prisma, { firstName: 'Léa', lastName: 'Bernard' });
    await database.prisma.registration.createMany({
      data: [
        { slotId: slot.id, userId: alice.id },
        { slotId: slot.id, userId: null },
      ],
    });
    const response = await register(slot.id);
    const { attendees } = response.body;
    expect(attendees.map((a: { displayName: string | null }) => a.displayName)).toEqual([
      'Léa B.',
      null,
      expect.stringMatching(/^\S+ B\.$/),
    ]);
    expect(attendees.map((a: { isMe: boolean }) => a.isMe)).toEqual([false, false, true]);
    expect(
      attendees.every((a: { registrationId: number }) => Number.isInteger(a.registrationId)),
    ).toBe(true);
  });
});
