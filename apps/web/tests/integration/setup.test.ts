import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
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
const valid = {
  club: { name: 'Ski Club des Arcs', timezone: 'Europe/Paris' },
  admin: {
    firstName: 'Alex',
    lastName: 'Martin',
    email: 'mail.ex@exemple.fr',
    password: '0123456789',
  },
};

let database: TestDatabase;
let setup: typeof import('@/app/api/setup/route');
let club: typeof import('@/app/api/club/route');
let me: typeof import('@/app/api/me/route');
let shared: typeof import('@/modules/shared');

const post = (body: unknown) =>
  setup.POST(
    new Request('http://localhost/api/setup', {
      method: 'POST',
      headers: { origin: ORIGIN },
      body: JSON.stringify(body),
    }),
  );

beforeAll(async () => {
  database = await createTestDatabase();
  process.env.DATABASE_URL = database.url;
  vi.resetModules();
  shared = await import('@/modules/shared');
  setup = await import('@/app/api/setup/route');
  club = await import('@/app/api/club/route');
  me = await import('@/app/api/me/route');
}, 60_000);

afterAll(async () => {
  await database?.drop();
});

// Each test starts from a new instance
beforeEach(async () => {
  shared.resetRateLimits();
  await database.prisma.$transaction([
    database.prisma.user.deleteMany(),
    database.prisma.club.deleteMany(),
  ]);
});

describe('POST /setup (F-19, RG-17)', () => {
  it('[F-19 S1] creates the club and the first administrator, and opens their session', async () => {
    const response = await post(valid);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      firstName: 'Alex',
      lastName: 'Martin',
      email: 'mail.ex@exemple.fr',
      role: 'ADMIN',
    });
    expect(conforms('User', body)).toBe(true);

    expect(await database.prisma.club.findMany()).toMatchObject([
      { id: 1, name: 'Ski Club des Arcs', timezone: 'Europe/Paris' },
    ]);
    expect(await database.prisma.user.count()).toBe(1);

    // The Set-Cookie opens a session for that administrator
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    const current = await me.GET(new Request('http://localhost/api/me', { headers: { cookie } }));
    expect(current.status).toBe(200);
    expect((await current.json()).role).toBe('ADMIN');
  });

  it('RG-01: stores a hash, never the password, and trims the e-mail', async () => {
    await post({ ...valid, admin: { ...valid.admin, email: '  mail.ex@exemple.fr ' } });
    const user = await database.prisma.user.findFirstOrThrow();
    expect(user.email).toBe('mail.ex@exemple.fr');
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain('0123456789');
  });

  it('[F-19 S2] RG-17, RG-01: refuses missing or invalid fields with their field codes, and creates nothing', async () => {
    const response = await post({
      club: { name: '', timezone: 'Europe/Paris' },
      admin: { ...valid.admin, email: 'alex@exemple', password: '123456789' },
    });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details.fields).toEqual([
      { field: 'club.name', code: 'FIELD_REQUIRED' },
      { field: 'admin.email', code: 'FIELD_EMAIL_INVALID' },
      { field: 'admin.password', code: 'FIELD_PASSWORD_TOO_SHORT' },
    ]);
    expect(conforms('Error', body)).toBe(true);
    expect(await database.prisma.user.count()).toBe(0);
    expect(await database.prisma.club.count()).toBe(0);
  });

  it('RG-16: refuses a time zone that is not IANA with FIELD_TIMEZONE_INVALID', async () => {
    const response = await post({ ...valid, club: { name: 'Club', timezone: 'Mars/Olympus' } });
    expect(response.status).toBe(400);
    expect((await response.json()).details.fields).toEqual([
      { field: 'club.timezone', code: 'FIELD_TIMEZONE_INVALID' },
    ]);
  });

  it('[F-19 S3] RG-17: answers 404 NOT_FOUND once installed and creates no second administrator', async () => {
    expect((await post(valid)).status).toBe(201);
    const second = await post({ ...valid, admin: { ...valid.admin, email: 'other@exemple.fr' } });
    expect(second.status).toBe(404);
    expect((await second.json()).code).toBe('NOT_FOUND');
    expect(await database.prisma.user.count()).toBe(1);
    expect(await database.prisma.club.count()).toBe(1);
  });

  it('[F-19 S5] RG-17: of simultaneous installations exactly one wins, the others get 404', async () => {
    const attempts = Array.from({ length: 8 }, (_, i) =>
      post({ ...valid, admin: { ...valid.admin, email: `admin${i}@exemple.fr` } }),
    );
    const statuses = (await Promise.all(attempts)).map((r) => r.status).sort();
    expect(statuses).toEqual([201, 404, 404, 404, 404, 404, 404, 404]);
    expect(await database.prisma.user.count()).toBe(1);
    expect(await database.prisma.club.count()).toBe(1);
    expect(await database.prisma.user.count({ where: { role: 'ADMIN' } })).toBe(1);
  });

  it('refuses a request from a foreign origin', async () => {
    const response = await setup.POST(
      new Request('http://localhost/api/setup', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
        body: JSON.stringify(valid),
      }),
    );
    expect(response.status).toBe(403);
    expect(await database.prisma.user.count()).toBe(0);
  });
});

describe('GET /club (RG-16)', () => {
  it('returns the name and time zone to a signed-in user', async () => {
    const installed = await post(valid);
    const cookie = installed.headers.get('set-cookie')!.split(';')[0]!;
    const response = await club.GET(
      new Request('http://localhost/api/club', { headers: { cookie } }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ name: 'Ski Club des Arcs', timezone: 'Europe/Paris' });
    expect(conforms('Club', body)).toBe(true);
  });

  it('answers 401 without a session', async () => {
    await post(valid);
    expect((await club.GET(new Request('http://localhost/api/club'))).status).toBe(401);
  });
});
