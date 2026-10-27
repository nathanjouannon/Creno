import { PrismaClient } from '@prisma/client';

let client: PrismaClient | undefined;

/** One Prisma client per process; only repositories import this. */
export function getPrisma(): PrismaClient {
  client ??= new PrismaClient();
  return client;
}
