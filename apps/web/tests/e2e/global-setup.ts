import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const webDir = fileURLToPath(new URL('../..', import.meta.url));

/** Recreates the end-to-end database from the migrations, so every run starts from a new instance. */
export default async function globalSetup() {
  const admin = new PrismaClient({ datasourceUrl: process.env.E2E_ADMIN_DATABASE_URL });
  try {
    await admin.$executeRawUnsafe('DROP DATABASE IF EXISTS creno_e2e WITH (FORCE)');
    await admin.$executeRawUnsafe('CREATE DATABASE creno_e2e');
  } finally {
    await admin.$disconnect();
  }
  const migrated = spawnSync('pnpm', ['exec', 'tsx', 'prisma/tools.ts', 'migrate'], {
    cwd: webDir,
    env: { ...process.env, DATABASE_URL: process.env.E2E_DATABASE_URL },
    encoding: 'utf8',
  });
  if (migrated.status !== 0)
    throw new Error(`migration failed: ${migrated.stdout}${migrated.stderr}`);
}
