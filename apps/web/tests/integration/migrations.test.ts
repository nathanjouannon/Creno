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
    tool('rollback');
    expect(await tables()).toEqual([]);
    const enums = await db.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM pg_type WHERE typname = 'user_role'`,
    );
    expect(enums).toHaveLength(0);
    tool('migrate');
    expect(await tables()).toEqual(EXPECTED_TABLES);
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

  it('RG-07: slot capacity 0 is refused, NULL and 1 accepted', async () => {
    await rejects(
      `INSERT INTO slots (event_id, starts_at, ends_at, capacity) VALUES (${eventId}, ${ts(9)}, ${ts(10)}, 0)`,
    );
    await db.$executeRawUnsafe(
      `INSERT INTO slots (event_id, starts_at, ends_at, capacity) VALUES (${eventId}, ${ts(9)}, ${ts(10)}, NULL), (${eventId}, ${ts(9)}, ${ts(10)}, 1)`,
    );
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

  it('negative failed_count is refused', async () => {
    await rejects(`INSERT INTO login_attempts (identifier_hash, failed_count) VALUES ('h', -1)`);
  });
});
