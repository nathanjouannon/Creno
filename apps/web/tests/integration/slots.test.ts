import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Prisma } from '@prisma/client';
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
const NOW = '2027-03-10T09:00:00Z';

let database: TestDatabase;
let collection: typeof import('@/app/api/events/[eventId]/slots/route');
let item: typeof import('@/app/api/slots/[slotId]/route');
let shared: typeof import('@/modules/shared');
let adminId: number;
let userId: number;
let volunteerIds: number[];

function as(role: 'admin' | 'user' | 'anonymous') {
  const caller =
    role === 'admin'
      ? { id: adminId, role: 'ADMIN' as const }
      : role === 'user'
        ? { id: userId, role: 'USER' as const }
        : null;
  shared.setAuthenticator(shared.fakeAuthenticator(caller));
}

async function send(
  handler: (
    request: Request,
    context: { params: Promise<Record<string, string>> },
  ) => Promise<Response>,
  method: string,
  path: string,
  params: Record<string, string>,
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
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

const create = (eventId: number, body: unknown) =>
  send(collection.POST, 'POST', `/events/${eventId}/slots`, { eventId: String(eventId) }, body);
const patch = (slotId: number, body: unknown) =>
  send(item.PATCH, 'PATCH', `/slots/${slotId}`, { slotId: String(slotId) }, body);
const remove = (slotId: number) =>
  send(item.DELETE, 'DELETE', `/slots/${slotId}`, { slotId: String(slotId) });

// 14 March, 08:00 to 18:00 in Europe/Paris (F-05 S3 ter)
const upcoming = { startsAt: '2027-03-14T07:00:00Z', endsAt: '2027-03-14T17:00:00Z' };
const morning = { startsAt: '2027-03-14T08:00:00Z', endsAt: '2027-03-14T11:00:00Z' };

async function insertEvent(times: { startsAt: string; endsAt: string } = upcoming) {
  return database.prisma.event.create({
    data: { title: 'Course', startsAt: new Date(times.startsAt), endsAt: new Date(times.endsAt) },
  });
}

async function insertSlot(
  eventId: number,
  capacity: number | null,
  registeredCount = 0,
  description: string | null = null,
) {
  return database.prisma.slot.create({
    data: {
      eventId,
      description,
      startsAt: new Date(morning.startsAt),
      endsAt: new Date(morning.endsAt),
      capacity,
      registrations: {
        create: volunteerIds.slice(0, registeredCount).map((id) => ({ userId: id })),
      },
    },
  });
}

const storedCapacity = async (slotId: number) =>
  (await database.prisma.slot.findUniqueOrThrow({ where: { id: slotId } })).capacity;

beforeAll(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.url;
  vi.resetModules();
  shared = await import('@/modules/shared');
  collection = await import('@/app/api/events/[eventId]/slots/route');
  item = await import('@/app/api/slots/[slotId]/route');
  adminId = (await createUser(database.prisma, { role: 'ADMIN' })).id;
  userId = (await createUser(database.prisma)).id;
  volunteerIds = [];
  for (let i = 0; i < 8; i++) volunteerIds.push((await createUser(database.prisma)).id);
}, 60_000);

afterAll(async () => {
  await database?.drop();
});

beforeEach(async () => {
  shared.resetRateLimits();
  shared.setClock(shared.fixedClock(NOW));
  as('admin');
  await database.prisma.event.deleteMany();
});
afterEach(() => {
  shared.resetClock();
  shared.resetAuthenticator();
});

describe('POST /events/{eventId}/slots (F-05)', () => {
  it('[F-05 S1] RG-07: without a limit, the slot is created unlimited', async () => {
    const event = await insertEvent();
    const created = await create(event.id, morning);
    expect(created.status).toBe(201);
    expect(conformsToSlot(created.body)).toBe(true);
    expect(created.body).toMatchObject({
      eventId: event.id,
      ...{ startsAt: '2027-03-14T08:00:00.000Z', endsAt: '2027-03-14T11:00:00.000Z' },
      capacity: null,
      registeredCount: 0,
      remainingPlaces: null,
      full: false,
      started: false,
      attendees: [],
    });
    expect(await storedCapacity(created.body.id)).toBeNull();
  });

  it('RG-07: a limited slot starts with all its places', async () => {
    const event = await insertEvent();
    const created = await create(event.id, { ...morning, capacity: 4 });
    expect(created.body).toMatchObject({ capacity: 4, remainingPlaces: 4, full: false });
  });

  it('[F-05 S3] RG-07: an end before or equal to the start is refused, nothing is created', async () => {
    const event = await insertEvent();
    for (const endsAt of [morning.startsAt, '2027-03-14T07:00:00Z']) {
      const response = await create(event.id, { startsAt: morning.startsAt, endsAt });
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: { fields: [{ field: 'endsAt', code: 'FIELD_END_NOT_AFTER_START' }] },
      });
    }
    expect(await database.prisma.slot.count()).toBe(0);
  });

  it('[F-05 S3 bis] RG-07: a limit of 0 is refused with FIELD_CAPACITY_TOO_LOW, nothing is created', async () => {
    const event = await insertEvent();
    const response = await create(event.id, { ...morning, capacity: 0 });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { fields: [{ field: 'capacity', code: 'FIELD_CAPACITY_TOO_LOW' }] },
    });
    expect(await database.prisma.slot.count()).toBe(0);
  });

  it('[F-05 S3 ter] RG-07: a slot outside the dates of the event is created', async () => {
    const event = await insertEvent();
    // 14 March, 07:00 to 08:00 in Europe/Paris, before the event starts
    const setUp = { startsAt: '2027-03-14T06:00:00Z', endsAt: '2027-03-14T07:00:00Z' };
    const response = await create(event.id, setUp);
    expect(response.status).toBe(201);
    expect(await database.prisma.slot.count({ where: { eventId: event.id } })).toBe(1);
  });

  it('RG-15: a past event answers 409 EVENT_PAST and gets no slot', async () => {
    const event = await insertEvent({
      startsAt: '2027-03-09T07:00:00Z',
      endsAt: NOW, // ended exactly now
    });
    const response = await create(event.id, morning);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EVENT_PAST');
    expect(await database.prisma.slot.count()).toBe(0);
  });

  it('an unknown event is 404 EVENT_NOT_FOUND', async () => {
    const response = await create(999_999, morning);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('EVENT_NOT_FOUND');
  });
});

describe('slot description (F-21, RG-07)', () => {
  const storedDescription = async (slotId: number) =>
    (await database.prisma.slot.findUniqueOrThrow({ where: { id: slotId } })).description;

  it('[F-21 S1] RG-07: without a description the slot is created with none (null)', async () => {
    const event = await insertEvent();
    const response = await create(event.id, morning);
    expect(response.status).toBe(201);
    expect(response.body.description).toBeNull();
    const blank = await create(event.id, { ...morning, description: '   ' });
    expect(blank.body.description).toBeNull();
  });

  it('[F-21 S2] RG-07: the description is stored trimmed and returned', async () => {
    const event = await insertEvent();
    const response = await create(event.id, {
      ...morning,
      description: ' Prévoir de quoi se changer ',
    });
    expect(response.status).toBe(201);
    expect(response.body.description).toBe('Prévoir de quoi se changer');
    expect(await storedDescription(response.body.id)).toBe('Prévoir de quoi se changer');
  });

  it('[F-21 S3] RG-07: 500 characters are accepted, 501 are refused with FIELD_DESCRIPTION_TOO_LONG and nothing is created', async () => {
    const event = await insertEvent();
    expect((await create(event.id, { ...morning, description: 'é'.repeat(500) })).status).toBe(201);
    const response = await create(event.id, { ...morning, description: 'é'.repeat(501) });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { fields: [{ field: 'description', code: 'FIELD_DESCRIPTION_TOO_LONG' }] },
    });
    expect(await database.prisma.slot.count({ where: { eventId: event.id } })).toBe(1);
  });

  it('[F-21 S4] RG-07: markup is stored as typed, never interpreted', async () => {
    const event = await insertEvent();
    const response = await create(event.id, { ...morning, description: '<b>Gants</b> fournis' });
    expect(response.body.description).toBe('<b>Gants</b> fournis');
  });

  it('[F-21 S5] RG-07, RG-15: a started slot keeps its registrations when only its description changes', async () => {
    const event = await insertEvent({
      startsAt: '2027-03-14T07:00:00Z',
      endsAt: '2027-03-14T17:00:00Z',
    });
    const slot = await insertSlot(event.id, 8, 3);
    shared.setClock(shared.fixedClock('2027-03-14T09:00:00Z')); // the slot began at 08:00
    const response = await patch(slot.id, { description: 'Gants fournis' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      description: 'Gants fournis',
      started: true,
      registeredCount: 3,
      capacity: 8,
    });
  });

  it('RG-07: null or blank clears the description; leaving it out keeps it', async () => {
    const slot = await insertSlot((await insertEvent()).id, null, 0, 'À garder');
    expect((await patch(slot.id, { capacity: 4 })).body.description).toBe('À garder');
    expect((await patch(slot.id, { description: '  ' })).body.description).toBeNull();
    expect(await storedDescription(slot.id)).toBeNull();
    await patch(slot.id, { description: 'Encore' });
    expect((await patch(slot.id, { description: null })).body.description).toBeNull();
  });

  it('[F-21 S3] RG-07: a too long description on update is refused and the stored one is kept', async () => {
    const slot = await insertSlot((await insertEvent()).id, null, 0, 'Avant');
    const response = await patch(slot.id, { description: 'a'.repeat(501) });
    expect(response.status).toBe(400);
    expect(response.body.details.fields).toEqual([
      { field: 'description', code: 'FIELD_DESCRIPTION_TOO_LONG' },
    ]);
    expect(await storedDescription(slot.id)).toBe('Avant');
  });

  it('[F-21 S6] RG-15: the description of a slot of a past event cannot be changed', async () => {
    const event = await insertEvent({ startsAt: '2027-03-09T07:00:00Z', endsAt: NOW });
    const slot = await insertSlot(event.id, null, 0, 'Avant');
    const response = await patch(slot.id, { description: 'Après' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EVENT_PAST');
    expect(await storedDescription(slot.id)).toBe('Avant');
  });
});

describe('PATCH /slots/{slotId} (F-05)', () => {
  it('[F-05 S4] RG-07: lowering the limit from 8 to 3 with 5 registered is refused, the limit stays 8', async () => {
    const slot = await insertSlot((await insertEvent()).id, 8, 5);
    const response = await patch(slot.id, { capacity: 3 });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'SLOT_CAPACITY_BELOW_REGISTRATIONS',
      details: { registeredCount: 5 },
      message: '5 personnes sont déjà inscrites : retire des inscrits avant de baisser la limite.',
    });
    expect(await storedCapacity(slot.id)).toBe(8);
  });

  it('[F-05 S5] RG-07: an unlimited slot with 5 registered gets a limit of 8, 3 places remain', async () => {
    const slot = await insertSlot((await insertEvent()).id, null, 5);
    const response = await patch(slot.id, { capacity: 8 });
    expect(response.status).toBe(200);
    expect(conformsToSlot(response.body)).toBe(true);
    expect(response.body).toMatchObject({
      capacity: 8,
      registeredCount: 5,
      remainingPlaces: 3,
      full: false,
    });
    expect(response.body.attendees).toHaveLength(5);
    expect(await storedCapacity(slot.id)).toBe(8);
  });

  it('RG-07: a limit equal to the registrations makes the slot full; null makes it unlimited again', async () => {
    const slot = await insertSlot((await insertEvent()).id, 8, 5);
    expect((await patch(slot.id, { capacity: 5 })).body).toMatchObject({
      remainingPlaces: 0,
      full: true,
    });
    expect((await patch(slot.id, { capacity: null })).body).toMatchObject({
      capacity: null,
      remainingPlaces: null,
      full: false,
    });
  });

  it('RG-07: a capacity of 0 is refused with FIELD_CAPACITY_TOO_LOW', async () => {
    const slot = await insertSlot((await insertEvent()).id, 8);
    const response = await patch(slot.id, { capacity: 0 });
    expect(response.status).toBe(400);
    expect(response.body.details.fields).toEqual([
      { field: 'capacity', code: 'FIELD_CAPACITY_TOO_LOW' },
    ]);
  });

  it('RG-07: moving only the end before the stored start is refused, nothing changes', async () => {
    const slot = await insertSlot((await insertEvent()).id, 8);
    const response = await patch(slot.id, { endsAt: '2027-03-14T07:30:00Z' });
    expect(response.status).toBe(400);
    expect(response.body.details.fields).toEqual([
      { field: 'endsAt', code: 'FIELD_END_NOT_AFTER_START' },
    ]);
    const stored = await database.prisma.slot.findUniqueOrThrow({ where: { id: slot.id } });
    expect(stored.endsAt.toISOString()).toBe('2027-03-14T11:00:00.000Z');
  });

  it('only the fields sent are changed, and registrations are kept', async () => {
    const slot = await insertSlot((await insertEvent()).id, 8, 2);
    const response = await patch(slot.id, { startsAt: '2027-03-14T09:00:00Z' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      startsAt: '2027-03-14T09:00:00.000Z',
      endsAt: '2027-03-14T11:00:00.000Z',
      capacity: 8,
      registeredCount: 2,
    });
  });

  it('an empty change is a validation error', async () => {
    const slot = await insertSlot((await insertEvent()).id, 8);
    expect((await patch(slot.id, {})).status).toBe(400);
  });

  it('RG-15: a slot of a past event answers 409 EVENT_PAST and is not modified', async () => {
    const event = await insertEvent({ startsAt: '2027-03-09T07:00:00Z', endsAt: NOW });
    const slot = await insertSlot(event.id, 8);
    const response = await patch(slot.id, { capacity: 10 });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EVENT_PAST');
    expect(await storedCapacity(slot.id)).toBe(8);
  });

  it('an unknown slot is 404 SLOT_NOT_FOUND', async () => {
    const response = await patch(999_999, { capacity: 2 });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('SLOT_NOT_FOUND');
  });

  it('RG-07: a registration racing with a lower limit cannot leave more registered than places', async () => {
    // Capacity 8, 4 registered. A registration (serializable, as T-014 will do) reads the slot and finds a place;
    // meanwhile the limit is lowered to 4. Only one of the two may commit.
    const slot = await insertSlot((await insertEvent()).id, 8, 4);
    let lowered: Awaited<ReturnType<typeof patch>> | undefined;

    const registration = database.prisma.$transaction(
      async (tx) => {
        const current = await tx.slot.findUniqueOrThrow({ where: { id: slot.id } });
        const count = await tx.registration.count({ where: { slotId: slot.id } });
        expect(count).toBeLessThan(current.capacity!);
        lowered = await patch(slot.id, { capacity: 4 });
        await tx.registration.create({ data: { slotId: slot.id, userId: volunteerIds[4]! } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    const registered = await registration.then(
      () => true,
      () => false,
    );

    const capacity = await storedCapacity(slot.id);
    const count = await database.prisma.registration.count({ where: { slotId: slot.id } });
    expect(count).toBeLessThanOrEqual(capacity!);
    // The limit change committed first, so the registration is the one refused
    expect(lowered?.status).toBe(200);
    expect(registered).toBe(false);
    expect({ capacity, count }).toEqual({ capacity: 4, count: 4 });
  });
});

describe('DELETE /slots/{slotId} (F-05, RG-10)', () => {
  it('[F-05 S6] RG-10: a slot with 3 registered is deleted with them; the other slot is unchanged', async () => {
    const event = await insertEvent();
    const slot = await insertSlot(event.id, 8, 3);
    const other = await insertSlot(event.id, 4, 1);

    const response = await remove(slot.id);
    expect(response.status).toBe(204);
    expect(await database.prisma.slot.findUnique({ where: { id: slot.id } })).toBeNull();
    expect(await database.prisma.registration.count({ where: { slotId: slot.id } })).toBe(0);
    expect(await database.prisma.registration.count({ where: { slotId: other.id } })).toBe(1);
    expect(await storedCapacity(other.id)).toBe(4);
  });

  it('[F-05 S7] RG-10: a slot without registration is deleted at once', async () => {
    const slot = await insertSlot((await insertEvent()).id, null);
    expect((await remove(slot.id)).status).toBe(204);
    expect(await database.prisma.slot.count()).toBe(0);
  });

  it('[F-05 S8] RG-06: deleting the last slot keeps the event', async () => {
    const event = await insertEvent();
    const slot = await insertSlot(event.id, null);
    expect((await remove(slot.id)).status).toBe(204);
    expect(await database.prisma.event.findUnique({ where: { id: event.id } })).not.toBeNull();
  });

  it('RG-15: a slot of a past event answers 409 EVENT_PAST and is kept', async () => {
    const event = await insertEvent({ startsAt: '2027-03-09T07:00:00Z', endsAt: NOW });
    const slot = await insertSlot(event.id, 8, 1);
    const response = await remove(slot.id);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EVENT_PAST');
    expect(await database.prisma.slot.count()).toBe(1);
  });

  it('an unknown slot is 404 SLOT_NOT_FOUND', async () => {
    const response = await remove(999_999);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('SLOT_NOT_FOUND');
  });
});

describe('RG-14: a user cannot administer slots', () => {
  it('POST, PATCH and DELETE answer 403 FORBIDDEN and nothing is modified', async () => {
    const event = await insertEvent();
    const slot = await insertSlot(event.id, 8);

    as('user');
    for (const response of [
      await create(event.id, morning),
      await patch(slot.id, { capacity: 1 }),
      await remove(slot.id),
    ]) {
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    }
    expect(await database.prisma.slot.count()).toBe(1);
    expect(await storedCapacity(slot.id)).toBe(8);
  });

  it('a visitor gets 401 on every route', async () => {
    const event = await insertEvent();
    const slot = await insertSlot(event.id, 8);
    as('anonymous');
    for (const response of [
      await create(event.id, morning),
      await patch(slot.id, { capacity: 1 }),
      await remove(slot.id),
    ]) {
      expect(response.status).toBe(401);
    }
  });
});
