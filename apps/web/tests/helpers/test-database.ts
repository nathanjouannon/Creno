import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const webDir = fileURLToPath(new URL('../..', import.meta.url));
const rootEnv = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (!process.env.DATABASE_URL?.includes('@') && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export interface TestDatabase {
  url: string;
  prisma: PrismaClient;
  drop(): Promise<void>;
}

/** A migrated database of its own, created next to the development one and dropped afterwards (environments.md, section 1). */
export async function createTestDatabase(): Promise<TestDatabase> {
  const adminUrl = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid');
  const name = `creno_test_${randomBytes(4).toString('hex')}`;
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;

  const admin = new PrismaClient({ datasourceUrl: adminUrl.toString() });
  await admin.$executeRawUnsafe(`CREATE DATABASE ${name}`);

  const migrated = spawnSync('pnpm', ['exec', 'tsx', 'prisma/tools.ts', 'migrate'], {
    cwd: webDir,
    env: { ...process.env, DATABASE_URL: url.toString() },
    encoding: 'utf8',
  });
  if (migrated.status !== 0)
    throw new Error(`migration failed: ${migrated.stdout}${migrated.stderr}`);

  const prisma = new PrismaClient({ datasourceUrl: url.toString() });
  return {
    url: url.toString(),
    prisma,
    async drop() {
      await prisma.$disconnect();
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.$disconnect();
    },
  };
}
