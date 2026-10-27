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
const NOW = '2027-01-14T09:00:00Z';

let database: TestDatabase;
let collection: typeof import('@/app/api/events/route');
let item: typeof import('@/app/api/events/[eventId]/route');
let shared: typeof import('@/modules/shared');
let adminId: number;
let userId: number;
let otherUserId: number;

type Role = 'admin' | 'user' | 'anonymous';

function as(role: Role) {
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
  options: { body?: unknown; eventId?: string } = {},
) {
  const response = await handler(
    new Request(`http://localhost/api${path}`, {
      method,
      headers: { origin: ORIGIN },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    {
      params: Promise.resolve<Record<string, string>>(
        options.eventId ? { eventId: options.eventId } : {},
      ),
    },
  );
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : undefined };
}

const list = (scope?: string) =>
  send(collection.GET, 'GET', `/events${scope ? `?scope=${scope}` : ''}`);
const create = (body: unknown) => send(collection.POST, 'POST', '/events', { body });
const get = (id: number) => send(item.GET, 'GET', `/events/${id}`, { eventId: String(id) });
const patch = (id: number, body: unknown) =>
  send(item.PATCH, 'PATCH', `/events/${id}`, { eventId: String(id), body });
const remove = (id: number) =>
  send(item.DELETE, 'DELETE', `/events/${id}`, { eventId: String(id) });

const slot = { startsAt: '2027-01-15T07:00:00Z', endsAt: '2027-01-15T10:00:00Z', capacity: 4 };
const input = {
  title: 'Course de ski du 15 janvier',
  description: 'Ouverture de piste',
  location: 'Station des Arcs',
  startsAt: '2027-01-15T07:00:00Z', // 08:00 in Europe/Paris
  endsAt: '2027-01-15T16:00:00Z',
  slots: [slot],
};

async function insertEvent(startsAt: string, endsAt: string, title = 'Événement') {
  return database.prisma.event.create({
    data: { title, startsAt: new Date(startsAt), endsAt: new Date(endsAt) },
  });
}

beforeAll(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.url;
  vi.resetModules();
  shared = await import('@/modules/shared');
  collection = await import('@/app/api/events/route');
  item = await import('@/app/api/events/[eventId]/route');
  adminId = (await createUser(database.prisma, { role: 'ADMIN', firstName: 'Alex' })).id;
  userId = (await createUser(database.prisma, { firstName: 'Léa', lastName: 'Bernard' })).id;
  otherUserId = (await createUser(database.prisma, { firstName: 'Marie', lastName: 'Durand' })).id;
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

describe('POST /events (F-04)', () => {
  it('[F-04 S1] RG-06: an administrator creates an event with a slot; users see it in the upcoming list', async () => {
    const created = await create(input);
    expect(created.status).toBe(201);
    expect(conforms('EventDetail', created.body)).toBe(true);
    expect(created.body).toMatchObject({
      title: input.title,
      location: input.location,
      status: 'upcoming',
      slotCount: 1,
    });
    expect(created.body.slots[0]).toMatchObject({ capacity: 4, remainingPlaces: 4, full: false });

    as('user');
    const listed = await list();
    expect(listed.status).toBe(200);
    expect(listed.body.map((e: { id: number }) => e.id)).toEqual([created.body.id]);
    expect(conforms('EventSummary', listed.body[0])).toBe(true);
  });

  it('[F-04 S2] the title is required: nothing is created', async () => {
    const response = await create({ ...input, title: '   ' });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details.fields).toEqual([{ field: 'title', code: 'FIELD_REQUIRED' }]);
    expect(await database.prisma.event.count()).toBe(0);
  });

  it('[F-04 S3] RG-06: an event is created without slot', async () => {
    const withoutSlots = { ...input, slots: undefined };
    const response = await create(withoutSlots);
    expect(response.status).toBe(201);
    expect(response.body.slots).toEqual([]);
    expect(response.body.slotCount).toBe(0);
  });

  it.each([
    ['before the start', '2027-01-15T06:00:00Z'],
    ['equal to the start', '2027-01-15T07:00:00Z'],
  ])(
    '[F-04 S3 bis] RG-06: an end %s is refused on the end field, nothing is created',
    async (_, endsAt) => {
      const response = await create({ ...input, endsAt });
      expect(response.status).toBe(400);
      expect(response.body.details.fields).toEqual([
        { field: 'endsAt', code: 'FIELD_END_NOT_AFTER_START' },
      ]);
      expect(await database.prisma.event.count()).toBe(0);
    },
  );

  it('F-04: one invalid slot refuses the whole creation (atomic): no event, no slot', async () => {
    const response = await create({ ...input, slots: [slot, { ...slot, capacity: 0 }] });
    expect(response.status).toBe(400);
    expect(response.body.details.fields).toEqual([
      { field: 'slots.1.capacity', code: 'FIELD_CAPACITY_TOO_LOW' },
    ]);
    expect(await database.prisma.event.count()).toBe(0);
    expect(await database.prisma.slot.count()).toBe(0);
  });

  it('RG-07: a slot may exceed the dates of the event', async () => {
    const response = await create({
      ...input,
      slots: [{ startsAt: '2027-01-15T05:00:00Z', endsAt: '2027-01-15T18:00:00Z' }],
    });
    expect(response.status).toBe(201);
    expect(response.body.slots[0].capacity).toBeNull();
  });

  it('[F-04 S8] RG-16: dates are stored in UTC and returned as ISO 8601 UTC', async () => {
    const response = await create(input);
    expect(response.body.startsAt).toBe('2027-01-15T07:00:00.000Z');
    const stored = await database.prisma.event.findUniqueOrThrow({
      where: { id: response.body.id },
    });
    expect(stored.startsAt.toISOString()).toBe('2027-01-15T07:00:00.000Z');
    // 08:00 for everybody in the club's zone, whatever the device
    expect(shared.toLocalDateTime(stored.startsAt, 'Europe/Paris')).toBe('2027-01-15T08:00:00');
  });
});

describe('GET /events (F-06, F-09, RG-09)', () => {
  it('RG-09: upcoming holds upcoming and ongoing events by start, not the ones that just ended', async () => {
    const later = await insertEvent('2027-01-20T08:00:00Z', '2027-01-20T10:00:00Z', 'Plus tard');
    const ongoing = await insertEvent('2027-01-14T08:00:00Z', '2027-01-14T10:00:00Z', 'En cours');
    await insertEvent('2027-01-14T07:00:00Z', NOW, 'Terminé pile maintenant');
    const soon = await insertEvent('2027-01-15T08:00:00Z', '2027-01-15T10:00:00Z', 'Bientôt');

    as('user');
    const response = await list('upcoming');
    expect(response.body.map((e: { id: number }) => e.id)).toEqual([ongoing.id, soon.id, later.id]);
    expect(response.body.map((e: { status: string }) => e.status)).toEqual([
      'ongoing',
      'upcoming',
      'upcoming',
    ]);
  });

  it('RG-09: an administrator lists past events, most recent end first', async () => {
    const older = await insertEvent('2027-01-10T08:00:00Z', '2027-01-10T10:00:00Z');
    const recent = await insertEvent('2027-01-12T08:00:00Z', '2027-01-12T10:00:00Z');
    await insertEvent('2027-01-20T08:00:00Z', '2027-01-20T10:00:00Z');

    const response = await list('past');
    expect(response.status).toBe(200);
    expect(response.body.map((e: { id: number }) => e.id)).toEqual([recent.id, older.id]);
    expect(response.body.every((e: { status: string }) => e.status === 'past')).toBe(true);
  });

  it('RG-14: a user asking for past events gets 403 FORBIDDEN', async () => {
    as('user');
    const response = await list('past');
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('an unknown scope is a validation error', async () => {
    expect((await list('everything')).status).toBe(400);
  });

  it('a visitor gets 401', async () => {
    as('anonymous');
    expect((await list()).status).toBe(401);
  });
});

describe('GET /events/{eventId} (F-06, F-09, RG-09)', () => {
  it('RG-07, RG-09, RG-11: slots with their computed state and attendees as "Prénom N."', async () => {
    const created = (await create({ ...input, slots: [{ ...slot, capacity: 2 }] })).body;
    const slotId = created.slots[0].id;
    const mine = await database.prisma.registration.create({ data: { slotId, userId } });
    const former = await createUser(database.prisma, { firstName: 'Paul' });
    await database.prisma.registration.create({ data: { slotId, userId: former.id } });
    await database.prisma.user.delete({ where: { id: former.id } }); // RG-11: the registration stays, anonymous

    as('user');
    const response = await get(created.id);
    expect(response.status).toBe(200);
    expect(conforms('EventDetail', response.body)).toBe(true);
    expect(response.body.slots[0]).toMatchObject({
      registeredCount: 2,
      remainingPlaces: 0,
      full: true,
      started: false,
    });
    expect(response.body.slots[0].attendees).toEqual([
      { registrationId: mine.id, displayName: 'Léa B.', isMe: true },
      { registrationId: expect.any(Number), displayName: null, isMe: false },
    ]);
  });

  it('RG-08: a slot is "started" from its exact start', async () => {
    const created = (await create(input)).body;
    shared.setClock(shared.fixedClock('2027-01-15T07:00:00Z'));
    expect((await get(created.id)).body.slots[0].started).toBe(true);
    shared.setClock(shared.fixedClock('2027-01-15T06:59:59.999Z'));
    expect((await get(created.id)).body.slots[0].started).toBe(false);
  });

  it('[F-04 S7] RG-09, RG-15: a past event is 404 EVENT_NOT_FOUND for a user and read only for an administrator', async () => {
    const past = await insertEvent('2027-01-14T07:00:00Z', NOW);

    as('user');
    const hidden = await get(past.id);
    expect(hidden.status).toBe(404);
    expect(hidden.body.code).toBe('EVENT_NOT_FOUND');

    as('admin');
    const seen = await get(past.id);
    expect(seen.status).toBe(200);
    expect(seen.body.status).toBe('past');
  });

  it('an unknown identifier is 404 EVENT_NOT_FOUND', async () => {
    const response = await get(999_999);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('EVENT_NOT_FOUND');
  });
});

describe('PATCH /events/{eventId} (F-04)', () => {
  it('[F-04 S4] the new location is visible to everybody and the registrations are kept', async () => {
    const created = (await create(input)).body;
    await database.prisma.registration.create({ data: { slotId: created.slots[0].id, userId } });

    const response = await patch(created.id, { location: 'Bourg-Saint-Maurice' });
    expect(response.status).toBe(200);
    expect(conforms('EventDetail', response.body)).toBe(true);
    expect(response.body).toMatchObject({ location: 'Bourg-Saint-Maurice', title: input.title });
    expect(response.body.slots[0].registeredCount).toBe(1);

    as('user');
    expect((await get(created.id)).body.location).toBe('Bourg-Saint-Maurice');
  });

  it('a field sent as null is emptied', async () => {
    const created = (await create(input)).body;
    expect((await patch(created.id, { description: null })).body.description).toBeNull();
  });

  it('RG-06: moving only the start after the stored end is refused, nothing changes', async () => {
    const created = (await create(input)).body;
    const response = await patch(created.id, { startsAt: '2027-01-15T17:00:00Z' });
    expect(response.status).toBe(400);
    expect(response.body.details.fields).toEqual([
      { field: 'endsAt', code: 'FIELD_END_NOT_AFTER_START' },
    ]);
    expect((await get(created.id)).body.startsAt).toBe('2027-01-15T07:00:00.000Z');
  });

  it('an empty change is a validation error', async () => {
    const created = (await create(input)).body;
    expect((await patch(created.id, {})).status).toBe(400);
  });

  it('[F-04 S7] RG-15: a past event answers 409 EVENT_PAST and is not modified', async () => {
    const past = await insertEvent('2027-01-14T07:00:00Z', NOW, 'Ancien');
    const response = await patch(past.id, { title: 'Nouveau' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EVENT_PAST');
    expect((await database.prisma.event.findUniqueOrThrow({ where: { id: past.id } })).title).toBe(
      'Ancien',
    );
  });

  it('an unknown identifier is 404 EVENT_NOT_FOUND', async () => {
    const response = await patch(999_999, { title: 'x' });
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('EVENT_NOT_FOUND');
  });
});

describe('DELETE /events/{eventId} (F-04, RG-10)', () => {
  it('[F-04 S5] RG-10: an event with registrations is deleted with its slots and registrations', async () => {
    const created = (await create({ ...input, slots: [slot, slot] })).body;
    for (const s of created.slots) {
      await database.prisma.registration.create({ data: { slotId: s.id, userId } });
      await database.prisma.registration.create({ data: { slotId: s.id, userId: otherUserId } });
    }

    expect((await remove(created.id)).status).toBe(204);
    expect(await database.prisma.event.count()).toBe(0);
    expect(await database.prisma.slot.count()).toBe(0);
    expect(await database.prisma.registration.count()).toBe(0);
    expect((await get(created.id)).status).toBe(404);
  });

  it('[F-04 S6] RG-10: an event without registration is deleted at once', async () => {
    const created = (await create(input)).body;
    expect((await remove(created.id)).status).toBe(204);
    expect(await database.prisma.event.count()).toBe(0);
  });

  it('[F-04 S7] RG-15: a past event answers 409 EVENT_PAST and is kept', async () => {
    const past = await insertEvent('2027-01-14T07:00:00Z', NOW);
    const response = await remove(past.id);
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('EVENT_PAST');
    expect(await database.prisma.event.count()).toBe(1);
  });

  it('an unknown identifier is 404 EVENT_NOT_FOUND', async () => {
    expect((await remove(999_999)).body.code).toBe('EVENT_NOT_FOUND');
  });
});

describe('RG-14: a user cannot administer events', () => {
  it('POST, PATCH and DELETE answer 403 FORBIDDEN and nothing is modified', async () => {
    const created = (await create(input)).body;

    as('user');
    for (const response of [
      await create({ ...input, title: 'Pirate' }),
      await patch(created.id, { title: 'Pirate' }),
      await remove(created.id),
    ]) {
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    }

    const events = await database.prisma.event.findMany();
    expect(events.map((e) => e.title)).toEqual([input.title]);
  });

  it('a visitor gets 401 on every route', async () => {
    const created = (await create(input)).body;
    as('anonymous');
    for (const response of [
      await list(),
      await create(input),
      await get(created.id),
      await patch(created.id, { title: 'x' }),
      await remove(created.id),
    ]) {
      expect(response.status).toBe(401);
    }
    expect(await database.prisma.event.count()).toBe(1);
  });
});
