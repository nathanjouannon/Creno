import type { PrismaClient } from '@prisma/client';

export interface ResetTokenRecord {
  id: number;
  expiresAt: Date;
  usedAt: Date | null;
  user: { id: number; email: string };
}

export function createPasswordResetRepository(prisma: PrismaClient) {
  return {
    userExists: async (userId: number): Promise<boolean> =>
      (await prisma.user.count({ where: { id: userId } })) > 0,

    /** RG-12: the new link replaces every earlier one of the user, in one transaction. */
    async replaceTokens(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
      await prisma.$transaction([
        prisma.resetToken.deleteMany({ where: { userId } }),
        prisma.resetToken.create({ data: { userId, token: tokenHash, expiresAt } }),
      ]);
    },

    findByTokenHash: (tokenHash: string): Promise<ResetTokenRecord | null> =>
      prisma.resetToken.findUnique({
        where: { token: tokenHash },
        select: {
          id: true,
          expiresAt: true,
          usedAt: true,
          user: { select: { id: true, email: true } },
        },
      }),

    /**
     * RG-12, RG-03: consumes the link, changes the password, ends every open session (`tokenVersion` + 1) and lifts
     * the sign-in block, as one unit. Returns false when another request used the link first: the conditional update
     * lets only one of two simultaneous requests through.
     */
    async consume(input: {
      tokenId: number;
      userId: number;
      passwordHash: string;
      usedAt: Date;
      attemptKey: string;
    }): Promise<boolean> {
      return prisma.$transaction(async (tx) => {
        const claimed = await tx.resetToken.updateMany({
          where: { id: input.tokenId, usedAt: null },
          data: { usedAt: input.usedAt },
        });
        if (claimed.count === 0) return false;
        await tx.user.update({
          where: { id: input.userId },
          data: { passwordHash: input.passwordHash, tokenVersion: { increment: 1 } },
        });
        await tx.loginAttempt.deleteMany({ where: { identifierHash: input.attemptKey } });
        return true;
      });
    },
  };
}

export type PasswordResetRepository = ReturnType<typeof createPasswordResetRepository>;
