import { Prisma, type PrismaClient, type UserRole } from '@prisma/client';
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

export interface AttemptTransaction {
  find(identifierHash: string): Promise<AttemptState | null>;
  save(identifierHash: string, state: AttemptState): Promise<void>;
}

const RETRIES = 6;

// A serialization failure (two failures at the same moment) or a duplicate key (two first failures) is replayed
const isConflict = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === 'P2034' || error.code === 'P2002');

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

    async findAttempt(identifierHash: string): Promise<AttemptState | null> {
      const row = await prisma.loginAttempt.findUnique({
        where: { identifierHash },
        select: { failedCount: true, lockedUntil: true },
      });
      return row;
    },

    /** Reset after a successful login (RG-03). */
    async clearAttempts(identifierHash: string): Promise<void> {
      await prisma.loginAttempt.deleteMany({ where: { identifierHash } });
    },

    /**
     * Read, decide and write the counter as one serializable unit: two simultaneous failures are replayed one
     * after the other, so none is lost (RG-03). The decision itself stays in the service.
     */
    async inAttemptTransaction<T>(work: (tx: AttemptTransaction) => Promise<T>): Promise<T> {
      for (let attempt = 1; ; attempt++) {
        try {
          return await prisma.$transaction(
            (client) =>
              work({
                find: async (identifierHash) =>
                  client.loginAttempt.findUnique({
                    where: { identifierHash },
                    select: { failedCount: true, lockedUntil: true },
                  }),
                save: async (identifierHash, state) => {
                  await client.loginAttempt.upsert({
                    where: { identifierHash },
                    create: {
                      identifierHash,
                      failedCount: state.failedCount,
                      lockedUntil: state.lockedUntil,
                    },
                    update: { failedCount: state.failedCount, lockedUntil: state.lockedUntil },
                  });
                },
              }),
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          );
        } catch (error) {
          if (!isConflict(error) || attempt >= RETRIES) throw error;
        }
      }
    },
  };
}

export type LoginRepository = ReturnType<typeof createLoginRepository>;
