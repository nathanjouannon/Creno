// Migration runner (ADR-0015): applies SQL migrations with Prisma Migrate and undoes the last one with its down.sql.
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const prismaDir = fileURLToPath(new URL('.', import.meta.url));
const webDir = fileURLToPath(new URL('..', import.meta.url));

function prisma(args: string[], input?: string): void {
  const result = spawnSync('pnpm', ['exec', 'prisma', ...args], {
    cwd: webDir,
    input,
    stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
    env: process.env,
  });
  if (result.status !== 0) throw new Error(`prisma ${args[0]} failed`);
}

export function migrate(): void {
  prisma(['migrate', 'deploy', '--schema', 'prisma/schema.prisma']);
}

// Undo the last applied migration and forget it, in one transaction.
export async function rollback(): Promise<void> {
  const client = new PrismaClient();
  let name: string | undefined;
  try {
    const rows = await client.$queryRawUnsafe<{ migration_name: string }[]>(
      `SELECT migration_name FROM _prisma_migrations
       WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
       ORDER BY migration_name DESC LIMIT 1`,
    );
    name = rows[0]?.migration_name;
  } catch {
    name = undefined; // no _prisma_migrations table: nothing applied
  } finally {
    await client.$disconnect();
  }
  if (!name) {
    console.log('No applied migration to roll back.');
    return;
  }
  const downFile = `${prismaDir}migrations/${name}/down.sql`;
  if (!existsSync(downFile)) throw new Error(`Missing down.sql for ${name}`);
  const script = `BEGIN;\n${readFileSync(downFile, 'utf8')}\nDELETE FROM _prisma_migrations WHERE migration_name = '${name}';\nCOMMIT;\n`;
  prisma(['db', 'execute', '--stdin', '--schema', 'prisma/schema.prisma'], script);
  console.log(`Rolled back ${name}.`);
}

const command = process.argv[2];
if (command === 'migrate') migrate();
else if (command === 'rollback') await rollback();
