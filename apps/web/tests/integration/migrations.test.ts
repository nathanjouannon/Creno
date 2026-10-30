import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const webDir = fileURLToPath(new URL('../..', import.meta.url));
const rootEnv = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (!process.env.DATABASE_URL && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// Disposable database created next to the development one (environments.md, section 1).
const adminUrl = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid');
const dbName = `creno_test_${randomBytes(4).toString('hex')}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${dbName}`;

const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
let db: PrismaClient;

function tool(command: 'migrate' | 'rollback'): void {
  const r = spawnSync('pnpm', ['exec', 'tsx', 'prisma/tools.ts', command], {
    cwd: webDir,
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    encoding: 'utf8',
  });
  expect(r.status, r.stdout + r.stderr).toBe(0);
}

async function tables(): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY 1`,
  );
  return rows.map((r) => r.tablename);
}

async function columns(table: string): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = '${table}'`,
  );
  return rows.map((r) => r.column_name);
}
const slotColumns = () => columns('slots');

async function constraints(table: string): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<{ conname: string }[]>(
    `SELECT conname FROM pg_constraint WHERE conrelid = '${table}'::regclass ORDER BY 1`,
  );
  return rows.map((r) => r.conname);
}

const EXPECTED_TABLES = [
  'club',
  'events',
  'invitations',
  'login_attempts',
  'registrations',
  'reset_tokens',
  'slots',
  'users',
];

beforeAll(async () => {
  await admin.$executeRawUnsafe(`CREATE DATABASE ${dbName}`);
  db = new PrismaClient({ datasourceUrl: testUrl.toString() });
}, 30_000);

afterAll(async () => {
  await db?.$disconnect();
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.$disconnect();
});

describe('migrations (ADR-0015)', () => {
  it('apply, undo, replay', async () => {
    tool('migrate');
    expect(await tables()).toEqual(EXPECTED_TABLES);
    tool('rollback'); // undoes the last migration only: the maximum lengths (#79)
    expect(await constraints('users')).not.toContain('users_first_name_length_check');
    expect(await tables()).toEqual(EXPECTED_TABLES);
    tool('rollback'); // then free slots and registration modes (F-22)
    expect(await columns('events')).not.toContain('registration_mode');
    expect(await columns('registrations')).not.toContain('event_id');
    tool('rollback'); // then the slot description
    expect(await tables()).toEqual(EXPECTED_TABLES);
    expect(await slotColumns()).not.toContain('description');
    tool('rollback'); // then the initial one
    expect(await tables()).toEqual([]);
    const enums = await db.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM pg_type WHERE typname = 'user_role'`,
    );
    expect(enums).toHaveLength(0);
    tool('migrate');
    expect(await tables()).toEqual(EXPECTED_TABLES);
    expect(await slotColumns()).toContain('description');
    expect(await columns('events')).toContain('registration_mode');
    expect(await constraints('events')).toContain('events_title_length_check');
  }, 120_000);

  it('F-22: existing events and registrations are kept, every event in FIXED; undo drops free slots only', async () => {
    tool('rollback'); // the maximum lengths (#79)
    tool('rollback'); // back to the schema before F-22
    const [event] = await db.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO events (title, starts_at, ends_at) VALUES ('Avant', '2030-01-01T08:00:00Z', '2030-01-01T18:00:00Z') RETURNING id`,
    );
    const [slot] = await db.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO slots (event_id, starts_at, ends_at, capacity) VALUES (${event!.id}, '2030-01-01T09:00:00Z', '2030-01-01T10:00:00Z', 2) RETURNING id`,
    );
    const [user] = await db.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO users (last_name, first_name, email, password_hash) VALUES ('B', 'L', 'migration@example.org', 'h') RETURNING id`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO registrations (slot_id, user_id) VALUES (${slot!.id}, ${user!.id})`,
    );

    tool('migrate');
    const modes = await db.$queryRawUnsafe<{ registration_mode: string }[]>(
      `SELECT registration_mode::text FROM events`,
    );
    expect(new Set(modes.map((m) => m.registration_mode))).toEqual(new Set(['FIXED']));
    const kept = await db.$queryRawUnsafe<{ slot_id: number; event_id: number | null }[]>(
      `SELECT slot_id, event_id FROM registrations`,
    );
    expect(kept).toEqual([{ slot_id: slot!.id, event_id: null }]);

    // A free slot exists only with this migration: undoing it removes the free slot, never the other rows
    await db.$executeRawUnsafe(
      `INSERT INTO registrations (event_id, starts_at, ends_at, user_id) VALUES (${event!.id}, '2030-01-01T11:00:00Z', '2030-01-01T12:00:00Z', ${user!.id})`,
    );
    tool('rollback'); // the maximum lengths (#79)
    tool('rollback');
    expect(await db.$queryRawUnsafe(`SELECT slot_id FROM registrations`)).toEqual([
      { slot_id: slot!.id },
    ]);
    tool('migrate');
    // The constraint tests below start from empty tables
    await db.$executeRawUnsafe(`TRUNCATE events, users RESTART IDENTITY CASCADE`);
  }, 120_000);
});

describe('database constraints', () => {
  const rejects = (sql: string) => expect(db.$executeRawUnsafe(sql)).rejects.toThrow();
  const ts = (h: number) => `'2030-01-01T${String(h).padStart(2, '0')}:00:00Z'`;
  let eventId: number;

  beforeAll(async () => {
    const rows = await db.$queryRawUnsafe<{ id: number }[]>(
      `INSERT INTO events (title, starts_at, ends_at) VALUES ('e', ${ts(8)}, ${ts(18)}) RETURNING id`,
    );
    eventId = rows[0]!.id;
  });

  it('RG-01, RG-06, RG-17: texts longer than their maximum are refused (#79)', async () => {
    const text = (n: number) => `'${'é'.repeat(n)}'`;
    const user = (first: number, last: number, email: string) =>
      `INSERT INTO users (last_name, first_name, email, password_hash) VALUES (${text(last)}, ${text(first)}, '${email}', 'h')`;
    // char_length counts characters: 50 accented letters are 50, not 100 bytes
    await db.$executeRawUnsafe(user(50, 50, 'long-names@example.org'));
    await rejects(user(51, 1, 'first@example.org'));
    await rejects(user(1, 51, 'last@example.org'));
    await db.$executeRawUnsafe(user(1, 1, `${'a'.repeat(242)}@example.org`)); // 254
    await rejects(user(1, 1, `${'a'.repeat(243)}@example.org`));

    const event = (title: number, location: number | null, description: number | null) =>
      `INSERT INTO events (title, location, description, starts_at, ends_at) VALUES (${text(title)}, ${location === null ? 'NULL' : text(location)}, ${description === null ? 'NULL' : text(description)}, ${ts(8)}, ${ts(9)})`;
    await db.$executeRawUnsafe(event(100, 200, 2000));
    await db.$executeRawUnsafe(event(1, null, null));
    await rejects(event(101, null, null));
    await rejects(event(1, 201, null));
    await rejects(event(1, null, 2001));

    await rejects(`INSERT INTO club (id, name, timezone) VALUES (1, ${text(121)}, 'UTC')`);
    await db.$executeRawUnsafe(
      `INSERT INTO club (id, name, timezone) VALUES (1, ${text(120)}, 'UTC')`,
    );
    await db.$executeRawUnsafe(`DELETE FROM club`);
  });

  it('RG-07: slot capacity 0 is refused, NULL and 1 accepted', async () => {
    await rejects(
      `INSERT INTO slots (event_id, starts_at, ends_at, capacity) VALUES (${eventId}, ${ts(9)}, ${ts(10)}, 0)`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO slots (event_id, starts_at, ends_at, capacity) VALUES (${eventId}, ${ts(9)}, ${ts(10)}, NULL), (${eventId}, ${ts(9)}, ${ts(10)}, 1)`,
    );
  });

  it('F-21, RG-07: a slot description is NULL or 1 to 500 characters, never blank', async () => {
    const slot = (description: string) =>
      `INSERT INTO slots (event_id, starts_at, ends_at, description) VALUES (${eventId}, ${ts(9)}, ${ts(10)}, '${description}')`;
    await db.$executeRawUnsafe(slot('a'.repeat(500)));
    await rejects(slot('a'.repeat(501)));
    await rejects(slot('   '));
    await rejects(slot(''));
  });

  it('RG-06/RG-07: end not after start is refused (event and slot)', async () => {
    await rejects(
      `INSERT INTO events (title, starts_at, ends_at) VALUES ('x', ${ts(10)}, ${ts(9)})`,
    );
    await rejects(
      `INSERT INTO events (title, starts_at, ends_at) VALUES ('x', ${ts(10)}, ${ts(10)})`,
    );
    await rejects(
      `INSERT INTO slots (event_id, starts_at, ends_at) VALUES (${eventId}, ${ts(10)}, ${ts(9)})`,
    );
  });

  it('RG-01: e-mails differing only by case are refused', async () => {
    const user = (email: string) =>
      `INSERT INTO users (last_name, first_name, email, password_hash) VALUES ('N', 'P', '${email}', 'h')`;
    await db.$executeRawUnsafe(user('Case@Example.org'));
    await rejects(user('case@example.ORG'));
  });

  it('blank names and titles are refused', async () => {
    await rejects(
      `INSERT INTO users (last_name, first_name, email, password_hash) VALUES ('  ', 'P', 'blank@example.org', 'h')`,
    );
    await rejects(
      `INSERT INTO events (title, starts_at, ends_at) VALUES ('  ', ${ts(1)}, ${ts(2)})`,
    );
    await rejects(`INSERT INTO club (name, timezone) VALUES (' ', 'Europe/Paris')`);
  });

  it('RG-16: the club has a single row with id = 1', async () => {
    await rejects(`INSERT INTO club (id, name, timezone) VALUES (2, 'A', 'Europe/Paris')`);
    await db.$executeRawUnsafe(`INSERT INTO club (name, timezone) VALUES ('A', 'Europe/Paris')`);
    await rejects(`INSERT INTO club (name, timezone) VALUES ('B', 'Europe/Paris')`);
  });

  it('RG-08: one registration per user and slot', async () => {
    const [u] = await db.$queryRawUnsafe<{ id: number }[]>(`SELECT id FROM users LIMIT 1`);
    const [s] = await db.$queryRawUnsafe<{ id: number }[]>(`SELECT id FROM slots LIMIT 1`);
    const reg = `INSERT INTO registrations (slot_id, user_id) VALUES (${s!.id}, ${u!.id})`;
    await db.$executeRawUnsafe(reg);
    await rejects(reg);
  });

  it('ADR-0016, RG-20: a registration is a fixed slot or a free slot of 30 minutes at least, never a mix', async () => {
    const [u] = await db.$queryRawUnsafe<{ id: number }[]>(`SELECT id FROM users LIMIT 1`);
    const [s] = await db.$queryRawUnsafe<{ id: number }[]>(`SELECT id FROM slots LIMIT 1`);
    const free = (start: number, end: string) =>
      `INSERT INTO registrations (event_id, starts_at, ends_at, user_id) VALUES (${eventId}, ${ts(start)}, ${end}, ${u!.id})`;
    await db.$executeRawUnsafe(free(9, `'2030-01-01T09:30:00Z'`)); // exactly 30 minutes
    await rejects(free(9, `'2030-01-01T09:29:59Z'`));
    await rejects(free(9, ts(9)));
    // Several free slots of one user in one event are allowed by the database (the service checks overlaps)
    await db.$executeRawUnsafe(free(10, ts(11)));
    // A mix of both forms, or half a free slot, is refused
    await rejects(
      `INSERT INTO registrations (slot_id, event_id, starts_at, ends_at, user_id) VALUES (${s!.id}, ${eventId}, ${ts(9)}, ${ts(10)}, ${u!.id})`,
    );
    await rejects(
      `INSERT INTO registrations (event_id, starts_at, user_id) VALUES (${eventId}, ${ts(9)}, ${u!.id})`,
    );
    await rejects(`INSERT INTO registrations (user_id) VALUES (${u!.id})`);
  });

  it('RG-19: an unknown registration mode is refused', async () => {
    await rejects(
      `INSERT INTO events (title, starts_at, ends_at, registration_mode) VALUES ('x', ${ts(1)}, ${ts(2)}, 'ALL')`,
    );
  });

  it('negative failed_count is refused', async () => {
    await rejects(`INSERT INTO login_attempts (identifier_hash, failed_count) VALUES ('h', -1)`);
  });
});
