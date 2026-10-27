import type { PrismaClient } from '@prisma/client';

export function createHealthRepository(prisma: PrismaClient) {
  return {
    /** Resolves when the database answers a real query, rejects otherwise. */
    async ping(): Promise<void> {
      await prisma.club.findFirst({ select: { id: true } });
    },
  };
}

export type HealthRepository = ReturnType<typeof createHealthRepository>;
