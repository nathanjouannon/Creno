import type { PrismaClient, UserRole } from '@prisma/client';
import type { AttemptState } from './login-attempt';

export interface LoginUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  tokenVersion: number;
  createdAt: Date;
}

/** The counter of one address, read and written while its row is locked. */
export interface AttemptTransaction {
  find(): Promise<AttemptState | null>;
  save(state: AttemptState): Promise<void>;
}

export function createLoginRepository(prisma: PrismaClient) {
  return {
    /** The address is compared without case (RG-01). */
    findUserByEmail: (email: string): Promise<LoginUser | null> =>
      prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          passwordHash: true,
          tokenVersion: true,
          createdAt: true,
        },
      }),

    /** Reset after a successful login (RG-03). */
    async clearAttempts(identifierHash: string): Promise<void> {
      await prisma.loginAttempt.deleteMany({ where: { identifierHash } });
    },

    /**
     * RG-03: the attempts of one address run one after the other, so each reads the count left by the previous one
     * and none is lost (#78). The row is created if missing (`ON CONFLICT DO NOTHING`, so two first attempts do not
     * collide), then updated without change, which holds its row lock until the transaction ends; read committed
     * re-reads after the wait. No retry loop, so no request fails for contention, and no raw SQL. The decision stays
     * in the service.
     */
    async inAttemptTransaction<T>(
      identifierHash: string,
      work: (tx: AttemptTransaction) => Promise<T>,
    ): Promise<T> {
      return prisma.$transaction(async (client) => {
        await client.loginAttempt.createMany({
          data: [{ identifierHash, failedCount: 0 }],
          skipDuplicates: true,
        });
        await client.loginAttempt.updateMany({
          where: { identifierHash },
          data: { failedCount: { increment: 0 } },
        });
        return work({
          find: () =>
            client.loginAttempt.findUnique({
              where: { identifierHash },
              select: { failedCount: true, lockedUntil: true },
            }),
          save: async (state) => {
            await client.loginAttempt.upsert({
              where: { identifierHash },
              create: { identifierHash, ...state },
              update: state,
            });
          },
        });
      });
    },
  };
}

export type LoginRepository = ReturnType<typeof createLoginRepository>;
