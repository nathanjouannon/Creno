import type { PrismaClient, UserRole } from '@prisma/client';

export interface ResetTokenRecord {
  id: number;
  expiresAt: Date;
  usedAt: Date | null;
  user: { id: number; email: string };
}

/** What creating a link reads and writes, while the user's row is locked. */
export interface LinkTransaction {
  /** `null` when the user does not exist. */
  findRole(): Promise<UserRole | null>;
  /** RG-12: the new link replaces every earlier one of the user. */
  replaceTokens(tokenHash: string, expiresAt: Date): Promise<void>;
}

export function createPasswordResetRepository(prisma: PrismaClient) {
  return {
    /**
     * RG-12 (#82): the user's row is locked first (an update without change), so a promotion to administrator at the
     * same moment comes entirely before or after: the role read here is the one the link is created for. The decision
     * stays in the service.
     */
    inLinkTransaction<T>(userId: number, work: (tx: LinkTransaction) => Promise<T>): Promise<T> {
      return prisma.$transaction(async (client) => {
        await client.user.updateMany({
          where: { id: userId },
          data: { tokenVersion: { increment: 0 } },
        });
        return work({
          findRole: async () =>
            (await client.user.findUnique({ where: { id: userId }, select: { role: true } }))
              ?.role ?? null,
          replaceTokens: async (tokenHash, expiresAt) => {
            await client.resetToken.deleteMany({ where: { userId } });
            await client.resetToken.create({ data: { userId, token: tokenHash, expiresAt } });
          },
        });
      });
    },

    /** The account of an address, compared without case and literally (the rescue command, #82). */
    async findUserIdByEmail(email: string): Promise<number | null> {
      const normalized = email.trim().toLowerCase();
      // An insensitive equals is an ILIKE where `%` and `_` match anything: the exact address is kept afterwards
      const candidates = await prisma.user.findMany({
        where: { email: { equals: normalized, mode: 'insensitive' } },
        select: { id: true, email: true },
      });
      return candidates.find((user) => user.email.toLowerCase() === normalized)?.id ?? null;
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
