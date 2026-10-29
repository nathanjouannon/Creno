import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RegistrationMode } from '@prisma/client';
import Ajv from 'ajv';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { createUser } from '../factories/user';
import { createTestDatabase, type TestDatabase } from '../helpers/test-database';

// F-22, RG-19, RG-20 (ADR-0016): free slots and registration modes, through the routes, on a real database.

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
// 14 March, 09:00 in Europe/Paris; the event runs 09:00 to 18:00 local time (08:00 to 17:00 UTC)
const NOW = '2027-03-14T07:00:00Z';
const EVENT = { startsAt: '2027-03-14T08:00:00Z', endsAt: '2027-03-14T17:00:00Z' };
const at = (time: string) => `2027-03-14T${time}:00Z`;
const range = (start: string, end: string) => ({ startsAt: at(start), endsAt: at(end) });

let database: TestDatabase;
let shared: typeof import('@/modules/shared');
let freeSlots: typeof import('@/app/api/events/[eventId]/free-slots/route');
let freeSlotItem: typeof import('@/app/api/free-slots/[freeSlotId]/route');
let registrationItem: typeof import('@/app/api/registrations/[registrationId]/route');
let events: typeof import('@/app/api/events/route');
let eventItem: typeof import('@/app/api/events/[eventId]/route');
let eventSlots: typeof import('@/app/api/events/[eventId]/slots/route');
let me: typeof import('@/app/api/me/route');
let adminId: number;
let leaId: number;
let marcId: number;
let volunteerIds: number[];

type Caller = { id: number; role: 'ADMIN' | 'USER' } | null;
const asAdmin = () => as({ id: adminId, role: 'ADMIN' });
const asUser = (id = leaId) => as({ id, role: 'USER' });
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

const createFreeSlot = (eventId: number, body: unknown) =>
  send(freeSlots.POST, 'POST', `/events/${eventId}/free-slots`, { eventId: String(eventId) }, body);
const deleteFreeSlot = (id: number) =>
  send(freeSlotItem.DELETE, 'DELETE', `/free-slots/${id}`, { freeSlotId: String(id) });
const removeRegistration = (id: number) =>
  send(registrationItem.DELETE, 'DELETE', `/registrations/${id}`, { registrationId: String(id) });
const getEvent = (id: number) =>
  send(eventItem.GET, 'GET', `/events/${id}`, { eventId: String(id) });
const patchEvent = (id: number, body: unknown) =>
  send(eventItem.PATCH, 'PATCH', `/events/${id}`, { eventId: String(id) }, body);
const deleteEvent = (id: number) =>
  send(eventItem.DELETE, 'DELETE', `/events/${id}`, { eventId: String(id) });
const createEvent = (body: unknown) => send(events.POST, 'POST', '/events', {}, body);
const createSlot = (eventId: number, body: unknown) =>
  send(eventSlots.POST, 'POST', `/events/${eventId}/slots`, { eventId: String(eventId) }, body);

async function insertEvent(registrationMode: RegistrationMode = 'FREE', times = EVENT) {
  return database.prisma.event.create({
    data: {
      title: 'Journée de ski du club',
      startsAt: new Date(times.startsAt),
      endsAt: new Date(times.endsAt),
      registrationMode,
    },
  });
}

async function insertFreeSlot(eventId: number, userId: number | null, start: string, end: string) {
  return database.prisma.registration.create({
    data: { eventId, userId, startsAt: new Date(at(start)), endsAt: new Date(at(end)) },
  });
}

async function insertSlot(eventId: number, capacity: number | null, userIds: number[] = []) {
  return database.prisma.slot.create({
    data: {
      eventId,
      startsAt: new Date(at('08:00')),
      endsAt: new Date(at('11:00')),
      capacity,
      registrations: { create: userIds.map((userId) => ({ userId })) },
    },
  });
}

const freeSlotsOf = (eventId: number) =>
  database.prisma.registration.findMany({
    where: { eventId },
    orderBy: [{ userId: 'asc' }, { startsAt: 'asc' }],
  });

beforeAll(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.url;
  vi.resetModules();
  shared = await import('@/modules/shared');
  freeSlots = await import('@/app/api/events/[eventId]/free-slots/route');
  freeSlotItem = await import('@/app/api/free-slots/[freeSlotId]/route');
  registrationItem = await import('@/app/api/registrations/[registrationId]/route');
  events = await import('@/app/api/events/route');
  eventItem = await import('@/app/api/events/[eventId]/route');
  eventSlots = await import('@/app/api/events/[eventId]/slots/route');
  me = await import('@/app/api/me/route');
  adminId = (await createUser(database.prisma, { role: 'ADMIN', firstName: 'Alex' })).id;
  leaId = (await createUser(database.prisma, { firstName: 'Léa', lastName: 'Bernard' })).id;
  marcId = (await createUser(database.prisma, { firstName: 'Marc', lastName: 'Dubois' })).id;
  volunteerIds = [];
  for (let i = 0; i < 5; i++) volunteerIds.push((await createUser(database.prisma)).id);
}, 120_000);

afterAll(async () => {
  await database?.drop();
});

beforeEach(async () => {
  shared.resetRateLimits();
  shared.setClock(shared.fixedClock(NOW));
  asUser();
  await database.prisma.event.deleteMany();
});
afterEach(() => {
  shared.resetClock();
  shared.resetAuthenticator();
});

describe('POST /events/{eventId}/free-slots (F-22, RG-20)', () => {
  it("[F-22 S3] creates the caller's free slot and answers a FreeSlot", async () => {
    const event = await insertEvent();
    const response = await createFreeSlot(event.id, range('09:00', '11:30'));
    expect(response.status).toBe(201);
    expect(conforms('FreeSlot', response.body)).toBe(true);
    expect(response.body).toMatchObject({
      eventId: event.id,
      startsAt: '2027-03-14T09:00:00.000Z',
      endsAt: '2027-03-14T11:30:00.000Z',
      started: false,
      displayName: 'Léa B.',
      isMe: true,
    });
    const [stored] = await freeSlotsOf(event.id);
    expect(stored).toMatchObject({ slotId: null, userId: leaId, eventId: event.id });
  });

  it('[F-22 S4] out of the event is refused under the field concerned, nothing stored', async () => {
    const event = await insertEvent();
    const before = await createFreeSlot(event.id, range('07:30', '09:00'));
    expect(before.status).toBe(400);
    expect(before.body.details.fields).toEqual([
      { field: 'startsAt', code: 'FIELD_FREE_SLOT_OUT_OF_EVENT' },
    ]);
    const after = await createFreeSlot(event.id, range('16:00', '18:00'));
    expect(after.body.details.fields).toEqual([
      { field: 'endsAt', code: 'FIELD_FREE_SLOT_OUT_OF_EVENT' },
    ]);
    expect(await freeSlotsOf(event.id)).toHaveLength(0);
  });

  it('[F-22 S5] less than 30 minutes is refused on the end; exactly 30 is accepted', async () => {
    const event = await insertEvent();
    const short = await createFreeSlot(event.id, range('09:00', '09:20'));
    expect(short.status).toBe(400);
    expect(short.body.details.fields).toEqual([
      { field: 'endsAt', code: 'FIELD_FREE_SLOT_TOO_SHORT' },
    ]);
    expect((await createFreeSlot(event.id, range('09:00', '09:30'))).status).toBe(201);
  });

  it('[F-22 S6] an end before the start is refused', async () => {
    const event = await insertEvent();
    const response = await createFreeSlot(event.id, range('11:00', '09:00'));
    expect(response.body.details.fields).toEqual([
      { field: 'endsAt', code: 'FIELD_END_NOT_AFTER_START' },
    ]);
  });

  it('[F-22 S7] RG-08: a start at the current time or before is refused on an ongoing event', async () => {
    const event = await insertEvent();
    shared.setClock(shared.fixedClock(at('10:00')));
    for (const start of ['09:00', '10:00']) {
      const response = await createFreeSlot(event.id, { startsAt: at(start), endsAt: at('12:00') });
      expect(response.body.details.fields).toEqual([
        { field: 'startsAt', code: 'FIELD_START_NOT_IN_FUTURE' },
      ]);
    }
    expect((await createFreeSlot(event.id, range('10:01', '12:00'))).status).toBe(201);
  });

  it('[F-22 S8] several free slots that touch or are apart are all stored', async () => {
    const event = await insertEvent();
    for (const [start, end] of [
      ['09:00', '11:00'],
      ['11:00', '13:00'],
      ['14:00', '15:00'],
    ] as const)
      expect((await createFreeSlot(event.id, range(start, end))).status).toBe(201);
    expect(await freeSlotsOf(event.id)).toHaveLength(3);
  });

  it('[F-22 S9] an overlap is refused with the free slot it overlaps, the first one is kept', async () => {
    const event = await insertEvent();
    const first = await createFreeSlot(event.id, range('09:00', '11:00'));
    const response = await createFreeSlot(event.id, range('10:00', '12:00'));
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'FREE_SLOT_OVERLAP',
      message: 'Tu as déjà des horaires qui recouvrent ceux-ci.',
      details: { freeSlotId: first.body.id },
    });
    expect(await freeSlotsOf(event.id)).toHaveLength(1);
  });

  it('RG-20: the overlap is checked per user, and per event', async () => {
    const event = await insertEvent();
    const other = await insertEvent();
    await insertFreeSlot(event.id, marcId, '09:00', '11:00');
    await insertFreeSlot(other.id, leaId, '09:00', '11:00');
    expect((await createFreeSlot(event.id, range('09:00', '11:00'))).status).toBe(201);
  });

  it('[F-22 S10] RG-20: two simultaneous overlapping requests, only one is stored', async () => {
    const event = await insertEvent();
    const responses = await Promise.all([
      createFreeSlot(event.id, range('09:00', '11:00')),
      createFreeSlot(event.id, range('10:00', '12:00')),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(responses.find((r) => r.status === 409)?.body.code).toBe('FREE_SLOT_OVERLAP');
    expect(await freeSlotsOf(event.id)).toHaveLength(1);
  });

  it('[F-22 S10] RG-20: 50 simultaneous requests from 5 users leave no overlap', async () => {
    const event = await insertEvent();
    const requests = Array.from({ length: 50 }, (_, i) => {
      const userId = volunteerIds[i % 5]!;
      const start = 9 + (i % 7); // overlapping two-hour ranges from 09:00 to 15:00
      const body = {
        startsAt: at(`${String(start).padStart(2, '0')}:00`),
        endsAt: at(`${String(start + 2).padStart(2, '0')}:00`),
      };
      return { userId, body };
    });
    // Each request carries its own caller
    shared.setAuthenticator(async (request) => ({
      id: Number(request.headers.get('x-test-user')),
      role: 'USER',
    }));
    const responses = await Promise.all(
      requests.map(async ({ userId, body }) => {
        const response = freeSlots.POST(
          new Request(`http://localhost/api/events/${event.id}/free-slots`, {
            method: 'POST',
            headers: { origin: ORIGIN, 'x-test-user': String(userId) },
            body: JSON.stringify(body),
          }),
          { params: Promise.resolve({ eventId: String(event.id) }) },
        );
        return (await response).status;
      }),
    );
    expect(responses.every((status) => status === 201 || status === 409)).toBe(true);
    const stored = await freeSlotsOf(event.id);
    for (const userId of volunteerIds) {
      const mine = stored.filter((r) => r.userId === userId);
      for (let i = 1; i < mine.length; i++)
        expect(mine[i]!.startsAt!.getTime()).toBeGreaterThanOrEqual(mine[i - 1]!.endsAt!.getTime());
    }
    expect(stored.length).toBe(responses.filter((status) => status === 201).length);
  }, 60_000);

  it('[F-22 S11] RG-20: no limit, five people on the same hours are all stored', async () => {
    const event = await insertEvent();
    for (const id of volunteerIds) {
      asUser(id);
      expect((await createFreeSlot(event.id, range('09:00', '11:00'))).status).toBe(201);
    }
    asUser();
    const detail = await getEvent(event.id);
    expect(detail.body.freeSlots).toHaveLength(5);
  });

  it('[F-22 S16] RG-19: an event in fixed slots refuses a free slot', async () => {
    const event = await insertEvent('FIXED');
    const response = await createFreeSlot(event.id, range('09:00', '11:00'));
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'EVENT_FREE_SLOTS_NOT_ALLOWED',
      message: 'Cet événement ne propose pas de créneaux libres.',
    });
  });

  it('[F-22 S14] RG-19: an event with both modes accepts a free slot', async () => {
    const event = await insertEvent('BOTH');
    expect((await createFreeSlot(event.id, range('09:00', '11:00'))).status).toBe(201);
  });

  it('[F-22 S21] an administrator chooses their own hours like a volunteer', async () => {
    const event = await insertEvent();
    asAdmin();
    const response = await createFreeSlot(event.id, range('09:00', '11:00'));
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ displayName: 'Alex B.', isMe: true });
  });

  it('[F-22 S22] RG-09, RG-15: a past event is not found for a user, read only for an administrator', async () => {
    const event = await insertEvent('FREE', {
      startsAt: '2027-03-13T08:00:00Z',
      endsAt: '2027-03-13T17:00:00Z',
    });
    const body = { startsAt: '2027-03-13T09:00:00Z', endsAt: '2027-03-13T10:00:00Z' };
    expect((await createFreeSlot(event.id, body)).body.code).toBe('EVENT_NOT_FOUND');
    asAdmin();
    expect((await createFreeSlot(event.id, body)).body.code).toBe('EVENT_PAST');
  });

  it('refuses an unknown event, an unauthenticated caller and an unknown field', async () => {
    expect((await createFreeSlot(999_999, range('09:00', '11:00'))).body.code).toBe(
      'EVENT_NOT_FOUND',
    );
    const event = await insertEvent();
    const withUser = await createFreeSlot(event.id, { ...range('09:00', '11:00'), userId: marcId });
    expect(withUser.status).toBe(400);
    as(null);
    expect((await createFreeSlot(event.id, range('09:00', '11:00'))).status).toBe(401);
    expect(await freeSlotsOf(event.id)).toHaveLength(0);
  });
});

describe('DELETE /free-slots/{freeSlotId} (F-22, RG-08, RG-20)', () => {
  it('[F-22 S12] the caller removes their own free slot before its start', async () => {
    const event = await insertEvent();
    const mine = await insertFreeSlot(event.id, leaId, '09:00', '11:00');
    expect((await deleteFreeSlot(mine.id)).status).toBe(204);
    expect(await freeSlotsOf(event.id)).toHaveLength(0);
  });

  it('[F-22 S13] RG-08: refused from its exact start', async () => {
    const event = await insertEvent();
    const mine = await insertFreeSlot(event.id, leaId, '09:00', '11:00');
    shared.setClock(shared.fixedClock(at('09:00')));
    const response = await deleteFreeSlot(mine.id);
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'FREE_SLOT_STARTED',
      details: { freeSlotId: mine.id },
    });
    expect(await freeSlotsOf(event.id)).toHaveLength(1);
  });

  it('RG-14: the free slot of somebody else, or a fixed slot registration, is not found', async () => {
    const event = await insertEvent('BOTH');
    const marcs = await insertFreeSlot(event.id, marcId, '09:00', '11:00');
    const slot = await insertSlot(event.id, null, [leaId]);
    const fixed = await database.prisma.registration.findFirstOrThrow({
      where: { slotId: slot.id },
    });
    expect((await deleteFreeSlot(marcs.id)).body.code).toBe('FREE_SLOT_NOT_FOUND');
    expect((await deleteFreeSlot(fixed.id)).body.code).toBe('FREE_SLOT_NOT_FOUND');
    asAdmin();
    expect((await deleteFreeSlot(marcs.id)).status).toBe(404);
    expect(await database.prisma.registration.count()).toBe(2);
  });
});

describe('DELETE /registrations/{registrationId} on a free slot (F-22, RG-08, RG-14)', () => {
  it('[F-22 S20] an administrator removes the started free slot of another', async () => {
    const event = await insertEvent();
    const marcs = await insertFreeSlot(event.id, marcId, '08:00', '10:00');
    shared.setClock(shared.fixedClock(at('09:00')));
    asAdmin();
    expect((await removeRegistration(marcs.id)).status).toBe(204);
    expect(await freeSlotsOf(event.id)).toHaveLength(0);
  });

  it('RG-14: refused to a user, the free slot is kept', async () => {
    const event = await insertEvent();
    const marcs = await insertFreeSlot(event.id, marcId, '09:00', '11:00');
    expect((await removeRegistration(marcs.id)).status).toBe(403);
    expect(await freeSlotsOf(event.id)).toHaveLength(1);
  });

  it('[F-22 S22] RG-15: refused on a past event', async () => {
    const event = await insertEvent();
    const marcs = await insertFreeSlot(event.id, marcId, '09:00', '11:00');
    shared.setClock(shared.fixedClock(EVENT.endsAt));
    asAdmin();
    expect((await removeRegistration(marcs.id)).body.code).toBe('EVENT_PAST');
  });
});

describe('GET /events/{eventId} with free slots (F-22, RG-09, RG-19)', () => {
  it('[F-22 S19] fixed slots, then free slots by start, end and id, with names and times', async () => {
    const event = await insertEvent('BOTH');
    await insertSlot(event.id, 4, [leaId]);
    await insertFreeSlot(event.id, volunteerIds[0]!, '13:00', '15:00');
    await insertFreeSlot(event.id, marcId, '10:00', '12:00');
    await insertFreeSlot(event.id, leaId, '09:00', '11:30');
    const response = await getEvent(event.id);
    expect(response.status).toBe(200);
    expect(conforms('EventDetail', response.body)).toBe(true);
    expect(response.body.registrationMode).toBe('BOTH');
    expect(response.body.slots).toHaveLength(1);
    expect(
      response.body.freeSlots.map((f: { displayName: string; isMe: boolean }) => [
        f.displayName,
        f.isMe,
      ]),
    ).toEqual([
      ['Léa B.', true],
      ['Marc D.', false],
      ['Léa B.', false],
    ]);
  });

  it('[F-22 S15] RG-07, RG-19: free slots never count in the filling of a fixed slot', async () => {
    const event = await insertEvent('BOTH');
    await insertSlot(event.id, 2, [volunteerIds[0]!, volunteerIds[1]!]);
    for (const id of volunteerIds.slice(2)) await insertFreeSlot(event.id, id, '08:00', '11:00');
    const response = await getEvent(event.id);
    expect(response.body.slots[0]).toMatchObject({ registeredCount: 2, full: true });
    expect(response.body.freeSlots).toHaveLength(3);
  });

  it('[F-22 S1] RG-19: an event in fixed slots has no free slot and its usual shape', async () => {
    const event = await insertEvent('FIXED');
    const response = await getEvent(event.id);
    expect(response.body).toMatchObject({ registrationMode: 'FIXED', freeSlots: [] });
  });
});

describe('registration mode of an event (F-22, RG-19)', () => {
  const eventInput = {
    title: 'Journée de ski du club',
    startsAt: EVENT.startsAt,
    endsAt: EVENT.endsAt,
  };
  const fixedSlot = { startsAt: at('08:00'), endsAt: at('11:00'), capacity: 4 };

  it('[F-22 S1, S2] RG-19: created in FIXED by default, or in the mode chosen', async () => {
    asAdmin();
    const byDefault = await createEvent(eventInput);
    expect(byDefault.status).toBe(201);
    expect(byDefault.body.registrationMode).toBe('FIXED');
    const free = await createEvent({ ...eventInput, registrationMode: 'FREE' });
    expect(free.body).toMatchObject({ registrationMode: 'FREE', freeSlots: [] });
  });

  it('[F-22 S16] RG-19: no fixed slot in an event with free slots only, at creation or later', async () => {
    asAdmin();
    const refused = await createEvent({
      ...eventInput,
      registrationMode: 'FREE',
      slots: [fixedSlot],
    });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('EVENT_FIXED_SLOTS_NOT_ALLOWED');
    expect(await database.prisma.event.count()).toBe(0);
    const event = await insertEvent('FREE');
    const slot = await createSlot(event.id, fixedSlot);
    expect(slot.body).toMatchObject({
      code: 'EVENT_FIXED_SLOTS_NOT_ALLOWED',
      message: 'Cet événement ne propose que des créneaux libres.',
    });
    expect(await database.prisma.slot.count()).toBe(0);
  });

  it('[F-22 S17] RG-19: changing mode without conflict keeps every registration', async () => {
    const event = await insertEvent('FIXED');
    await insertSlot(event.id, 4, [leaId, marcId]);
    asAdmin();
    const response = await patchEvent(event.id, { registrationMode: 'BOTH' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ registrationMode: 'BOTH' });
    expect(response.body.slots[0].registeredCount).toBe(2);
  });

  it('[F-22 S18] RG-19: refused while the event holds a kind the new mode refuses', async () => {
    const event = await insertEvent('BOTH');
    await insertSlot(event.id, 4, [leaId]);
    await insertSlot(event.id, null);
    for (const id of [leaId, marcId, adminId]) await insertFreeSlot(event.id, id, '12:00', '13:00');
    asAdmin();
    const toFree = await patchEvent(event.id, { registrationMode: 'FREE' });
    expect(toFree.status).toBe(409);
    expect(toFree.body).toMatchObject({
      code: 'EVENT_MODE_HAS_SLOTS',
      message: "Pour passer en créneaux libres, supprime d'abord les créneaux fixes (2).",
      details: { slotCount: 2 },
    });
    const toFixed = await patchEvent(event.id, { registrationMode: 'FIXED', title: 'Autre' });
    expect(toFixed.body).toMatchObject({
      code: 'EVENT_MODE_HAS_FREE_SLOTS',
      message: "Pour passer en créneaux fixes, supprime d'abord les créneaux libres (3).",
    });
    const stored = await database.prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored).toMatchObject({ registrationMode: 'BOTH', title: 'Journée de ski du club' });
    expect(await database.prisma.registration.count()).toBe(4);
  });

  it('[F-22 S25] RG-14: a user cannot change the mode', async () => {
    const event = await insertEvent('FIXED');
    const response = await patchEvent(event.id, { registrationMode: 'FREE' });
    expect(response.status).toBe(403);
    expect(
      (await database.prisma.event.findUniqueOrThrow({ where: { id: event.id } })).registrationMode,
    ).toBe('FIXED');
  });

  it('RG-19: an unknown mode is a field error', async () => {
    const event = await insertEvent('FIXED');
    asAdmin();
    const response = await patchEvent(event.id, { registrationMode: 'ALL' });
    expect(response.body.details.fields).toEqual([
      { field: 'registrationMode', code: 'FIELD_REGISTRATION_MODE_INVALID' },
    ]);
  });

  it('RG-19: a mode change and a fixed slot at the same time never leave a fixed slot in FREE', async () => {
    for (let round = 0; round < 10; round++) {
      await database.prisma.event.deleteMany();
      const event = await insertEvent('BOTH');
      asAdmin();
      const [mode, slot] = await Promise.all([
        patchEvent(event.id, { registrationMode: 'FREE' }),
        createSlot(event.id, fixedSlot),
      ]);
      const stored = await database.prisma.event.findUniqueOrThrow({
        where: { id: event.id },
        include: { _count: { select: { slots: true } } },
      });
      expect(stored.registrationMode === 'FREE' && stored._count.slots > 0).toBe(false);
      // Exactly one of the two wins: the mode (slot refused) or the slot (mode refused)
      expect([
        [200, 409],
        [409, 201],
      ]).toContainEqual([mode.status, slot.status]);
    }
  }, 60_000);

  it('RG-19: a mode change and a free slot at the same time never leave a free slot in FIXED', async () => {
    for (let round = 0; round < 10; round++) {
      await database.prisma.event.deleteMany();
      const event = await insertEvent('BOTH');
      asAdmin(); // an administrator chooses hours too (RG-20)
      const [mode, freeSlot] = await Promise.all([
        patchEvent(event.id, { registrationMode: 'FIXED' }),
        createFreeSlot(event.id, range('09:00', '11:00')),
      ]);
      const stored = await database.prisma.event.findUniqueOrThrow({
        where: { id: event.id },
        include: { _count: { select: { freeSlots: true } } },
      });
      expect(stored.registrationMode === 'FIXED' && stored._count.freeSlots > 0).toBe(false);
      expect([
        [200, 409],
        [409, 201],
      ]).toContainEqual([mode.status, freeSlot.status]);
    }
  }, 60_000);
});

describe('deletions (F-22, RG-10, RG-11)', () => {
  it('[F-22 S23] RG-10: deleting an event deletes its fixed and free slots', async () => {
    const event = await insertEvent('BOTH');
    await insertSlot(event.id, 4, [leaId, marcId]);
    for (const id of volunteerIds.slice(0, 3)) await insertFreeSlot(event.id, id, '09:00', '10:00');
    asAdmin();
    expect((await deleteEvent(event.id)).status).toBe(204);
    expect(await database.prisma.registration.count()).toBe(0);
  });

  it('[F-22 S24] RG-11: account deletion frees the coming free slot and anonymises the started one', async () => {
    const user = await createUser(database.prisma, { firstName: 'Sofia', lastName: 'Thomas' });
    const event = await insertEvent();
    const started = await insertFreeSlot(event.id, user.id, '08:00', '09:00');
    const coming = await insertFreeSlot(event.id, user.id, '10:00', '11:00');
    shared.setClock(shared.fixedClock(at('08:30')));
    as({ id: user.id, role: 'USER' });
    const response = await me.DELETE(
      new Request('http://localhost/api/me', { method: 'DELETE', headers: { origin: ORIGIN } }),
      { params: Promise.resolve({}) },
    );
    expect(response.status).toBe(204);
    expect(await database.prisma.registration.findUnique({ where: { id: coming.id } })).toBeNull();
    expect(
      await database.prisma.registration.findUnique({ where: { id: started.id } }),
    ).toMatchObject({
      userId: null,
      startsAt: new Date(at('08:00')),
      endsAt: new Date(at('09:00')),
    });
    asUser();
    const detail = await getEvent(event.id);
    expect(detail.body.freeSlots).toEqual([
      expect.objectContaining({ displayName: null, started: true }),
    ]);
  });
});
