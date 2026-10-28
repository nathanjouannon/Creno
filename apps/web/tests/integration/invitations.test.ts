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
const valid = {
  firstName: 'Léa',
  lastName: 'Bernard',
  email: 'mail.ex@exemple.fr',
  password: '0123456789',
};

let database: TestDatabase;
let collection: typeof import('@/app/api/events/[eventId]/invitations/route');
let item: typeof import('@/app/api/invitations/[token]/route');
let me: typeof import('@/app/api/me/route');
let eventItem: typeof import('@/app/api/events/[eventId]/route');
let shared: typeof import('@/modules/shared');
let adminId: number;

type Caller = { id: number; role: 'ADMIN' | 'USER' } | null;
const as = (caller: Caller) => shared.setAuthenticator(shared.fakeAuthenticator(caller));
const asAdmin = () => as({ id: adminId, role: 'ADMIN' });

const context = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

const invite = (eventId: number) =>
  collection.POST(
    new Request(`http://localhost/api/events/${eventId}/invitations`, {
      method: 'POST',
      headers: { origin: ORIGIN },
    }),
    context({ eventId: String(eventId) }),
  );
const check = (token: string) =>
  item.GET(new Request(`http://localhost/api/invitations/${token}`), context({ token }));
const accept = (token: string, body: unknown) =>
  item.POST(
    new Request(`http://localhost/api/invitations/${token}`, {
      method: 'POST',
      headers: { origin: ORIGIN },
      body: JSON.stringify(body),
    }),
    context({ token }),
  );

const tokenOf = (url: string) => url.split('/invitation/')[1]!;

async function insertEvent(startsAt = '2027-03-14T09:00:00Z') {
  return database.prisma.event.create({
    data: {
      title: 'Course',
      startsAt: new Date(startsAt),
      endsAt: new Date('2027-03-14T17:00:00Z'),
    },
  });
}

/** A link created through the API, as an administrator would. */
async function createLink(eventId: number) {
  asAdmin();
  const body = await (await invite(eventId)).json();
  as(null);
  return body as { url: string; expiresAt: string };
}

beforeAll(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.url;
  vi.resetModules();
  shared = await import('@/modules/shared');
  collection = await import('@/app/api/events/[eventId]/invitations/route');
  item = await import('@/app/api/invitations/[token]/route');
  me = await import('@/app/api/me/route');
  eventItem = await import('@/app/api/events/[eventId]/route');
  adminId = (await createUser(database.prisma, { role: 'ADMIN' })).id;
  await database.prisma.club.create({
    data: { id: 1, name: 'Ski Club des Arcs', timezone: 'Europe/Paris' },
  });
}, 120_000);

afterAll(async () => {
  await database?.drop();
});

beforeEach(async () => {
  shared.resetRateLimits();
  shared.setClock(shared.fixedClock(NOW));
  as(null);
  await database.prisma.event.deleteMany();
  await database.prisma.user.deleteMany({ where: { id: { not: adminId } } });
});
afterEach(() => {
  shared.resetClock();
  shared.resetAuthenticator();
});

describe('POST /events/{id}/invitations (F-01, RG-02)', () => {
  it('[F-01 S1] returns a link on APP_URL valid until the start of the event, token stored hashed', async () => {
    const event = await insertEvent();
    asAdmin();
    const response = await invite(event.id);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(conforms('ShareableLink', body)).toBe(true);
    expect(body.url).toMatch(/^http:\/\/localhost:3000\/invitation\/[A-Za-z0-9_-]{43}$/);
    expect(body.expiresAt).toBe('2027-03-14T09:00:00.000Z');

    const stored = await database.prisma.invitation.findFirstOrThrow();
    expect(stored.token).not.toContain(tokenOf(body.url));
    expect(stored.token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('[F-01 S1] each call creates a new link and the previous ones stay valid', async () => {
    const event = await insertEvent();
    const first = await createLink(event.id);
    const second = await createLink(event.id);
    expect(first.url).not.toBe(second.url);
    expect((await check(tokenOf(first.url))).status).toBe(200);
    expect((await check(tokenOf(second.url))).status).toBe(200);
  });

  it('[F-01 S7] RG-02: refuses an event that has started with EVENT_STARTED', async () => {
    const event = await insertEvent('2027-03-14T07:00:00Z');
    asAdmin();
    const response = await invite(event.id);
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('EVENT_STARTED');
    expect(await database.prisma.invitation.count()).toBe(0);
  });

  it('RG-14: a user is refused, an anonymous caller must sign in, an unknown event is not found', async () => {
    const event = await insertEvent();
    as({ id: adminId, role: 'USER' });
    expect((await invite(event.id)).status).toBe(403);
    as(null);
    expect((await invite(event.id)).status).toBe(401);
    asAdmin();
    const missing = await invite(event.id + 1000);
    expect(missing.status).toBe(404);
    expect((await missing.json()).code).toBe('EVENT_NOT_FOUND');
  });
});

describe('GET /invitations/{token} (F-01, RG-02)', () => {
  it('[F-01 S2] tells the event and the club, with no session', async () => {
    const event = await insertEvent();
    const { url } = await createLink(event.id);
    const response = await check(tokenOf(url));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({
      eventId: event.id,
      eventTitle: 'Course',
      clubName: 'Ski Club des Arcs',
    });
  });

  it('[F-01 S4] RG-02: an unknown link is INVITATION_INVALID (410)', async () => {
    const response = await check('not-a-real-token');
    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe('INVITATION_INVALID');
  });

  it('[F-01 S4] RG-02: the link of a started event is INVITATION_INVALID', async () => {
    const event = await insertEvent();
    const { url } = await createLink(event.id);
    shared.setClock(shared.fixedClock('2027-03-14T09:00:00Z'));
    expect((await check(tokenOf(url))).status).toBe(410);
  });

  it('[F-01 S1 bis] RG-02: a postponed event keeps the same link until the new start', async () => {
    const event = await insertEvent('2027-03-14T09:00:00Z');
    const { url } = await createLink(event.id);
    await database.prisma.event.update({
      where: { id: event.id },
      data: {
        startsAt: new Date('2027-03-21T09:00:00Z'),
        endsAt: new Date('2027-03-21T17:00:00Z'),
      },
    });
    shared.setClock(shared.fixedClock('2027-03-20T09:00:00Z'));
    expect((await check(tokenOf(url))).status).toBe(200);
    shared.setClock(shared.fixedClock('2027-03-21T09:00:00Z'));
    expect((await check(tokenOf(url))).status).toBe(410);
  });

  it('RG-02: deleting the event invalidates its links', async () => {
    const event = await insertEvent();
    const { url } = await createLink(event.id);
    asAdmin();
    const deleted = await eventItem.DELETE(
      new Request(`http://localhost/api/events/${event.id}`, {
        method: 'DELETE',
        headers: { origin: ORIGIN },
      }),
      context({ eventId: String(event.id) }),
    );
    expect(deleted.status).toBe(204);
    as(null);
    expect((await check(tokenOf(url))).status).toBe(410);
    expect(await database.prisma.invitation.count()).toBe(0);
  });
});

describe('POST /invitations/{token} (F-01, RG-01, RG-02)', () => {
  it('[F-01 S2] RG-01: creates an active USER, opens the session and returns the event', async () => {
    const event = await insertEvent();
    const { url } = await createLink(event.id);
    const response = await accept(tokenOf(url), { ...valid, email: '  mail.ex@exemple.fr ' });
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(conforms('User', body.user)).toBe(true);
    expect(body).toMatchObject({
      eventId: event.id,
      user: { role: 'USER', email: 'mail.ex@exemple.fr' },
    });

    const user = await database.prisma.user.findFirstOrThrow({ where: { email: valid.email } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(valid.password);

    as(null);
    shared.resetAuthenticator();
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    const current = await me.GET(new Request('http://localhost/api/me', { headers: { cookie } }));
    expect(current.status).toBe(200);
    expect((await current.json()).firstName).toBe('Léa');
  });

  it('RG-02: two accounts with different addresses can use the same link', async () => {
    const event = await insertEvent();
    const { url } = await createLink(event.id);
    expect((await accept(tokenOf(url), valid)).status).toBe(201);
    expect((await accept(tokenOf(url), { ...valid, email: 'autre@exemple.fr' })).status).toBe(201);
  });

  it('[F-01 S3] RG-01: a 9-character password is refused with its field code and creates nothing', async () => {
    const event = await insertEvent();
    const { url } = await createLink(event.id);
    const response = await accept(tokenOf(url), { ...valid, password: '123456789' });
    expect(response.status).toBe(400);
    expect((await response.json()).details.fields).toEqual([
      { field: 'password', code: 'FIELD_PASSWORD_TOO_SHORT' },
    ]);
    expect(await database.prisma.user.count({ where: { email: valid.email } })).toBe(0);
  });

  it('[F-01 S6] RG-01: a missing or malformed field is refused', async () => {
    const event = await insertEvent();
    const { url } = await createLink(event.id);
    const response = await accept(tokenOf(url), { ...valid, lastName: '', email: 'pas-un-mail' });
    expect(response.status).toBe(400);
    expect((await response.json()).details.fields).toEqual(
      expect.arrayContaining([
        { field: 'lastName', code: 'FIELD_REQUIRED' },
        { field: 'email', code: 'FIELD_EMAIL_INVALID' },
      ]),
    );
  });

  it('[F-01 S5] RG-01: an address already used is refused whatever its case, and no second account exists', async () => {
    const event = await insertEvent();
    const { url } = await createLink(event.id);
    await accept(tokenOf(url), valid);
    const response = await accept(tokenOf(url), { ...valid, email: 'Mail.Ex@exemple.fr' });
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('USER_EMAIL_TAKEN');
    expect(
      await database.prisma.user.count({
        where: { email: { equals: valid.email, mode: 'insensitive' } },
      }),
    ).toBe(1);
  });

  it('[F-01 S5] RG-01: two simultaneous accounts with the same address, one wins', async () => {
    const event = await insertEvent();
    const { url } = await createLink(event.id);
    const statuses = (
      await Promise.all([
        accept(tokenOf(url), valid),
        accept(tokenOf(url), { ...valid, email: 'MAIL.EX@exemple.fr' }),
      ])
    ).map((response) => response.status);
    expect(statuses.sort()).toEqual([201, 409]);
    expect(
      await database.prisma.user.count({
        where: { email: { equals: valid.email, mode: 'insensitive' } },
      }),
    ).toBe(1);
  });

  it('[F-01 S4] RG-02: an expired link creates no account', async () => {
    const event = await insertEvent();
    const { url } = await createLink(event.id);
    shared.setClock(shared.fixedClock('2027-03-14T09:00:00Z'));
    const response = await accept(tokenOf(url), valid);
    expect(response.status).toBe(410);
    expect((await response.json()).code).toBe('INVITATION_INVALID');
    expect(await database.prisma.user.count({ where: { email: valid.email } })).toBe(0);
  });

  it('security.md: the token is in no log line', async () => {
    const lines: string[] = [];
    const spies = (['log', 'info', 'warn', 'error'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation((...args) => void lines.push(args.join(' '))),
    );
    const write = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk));
      return true;
    });
    const event = await insertEvent();
    const { url } = await createLink(event.id);
    await accept(tokenOf(url), valid);
    await check('another-token');
    spies.forEach((spy) => spy.mockRestore());
    write.mockRestore();
    expect(lines.join('\n')).not.toContain(tokenOf(url));
    expect(lines.join('\n')).not.toContain(valid.password);
  });
});
