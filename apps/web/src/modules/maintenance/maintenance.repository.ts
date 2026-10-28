import type { PrismaClient } from '@prisma/client';

export function createMaintenanceRepository(prisma: PrismaClient) {
  return {
    /**
     * Rows that no longer block anyone: untouched since the cutoff and either never blocked or blocked
     * until before the cutoff. Returns how many were deleted.
     */
    async deleteIdleLoginAttempts(cutoff: Date): Promise<number> {
      const { count } = await prisma.loginAttempt.deleteMany({
        where: {
          updatedAt: { lt: cutoff },
          OR: [{ lockedUntil: null }, { lockedUntil: { lt: cutoff } }],
        },
      });
      return count;
    },

    /** Tokens that expired, or were used, before the cutoff. Returns how many were deleted. */
    async deleteStaleResetTokens(cutoff: Date): Promise<number> {
      const { count } = await prisma.resetToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { lt: cutoff } }] },
      });
      return count;
    },
  };
}

export type MaintenanceRepository = ReturnType<typeof createMaintenanceRepository>;
