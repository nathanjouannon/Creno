import { Prisma, type PrismaClient, type UserRole } from '@prisma/client';
import { isSerializationFailure } from '@/modules/shared';

export interface MemberRecord {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export interface RoleTransaction {
  find(userId: number): Promise<MemberRecord | null>;
  countAdmins(): Promise<number>;
  setRole(userId: number, role: UserRole): Promise<MemberRecord>;
}

export interface DeletionTransaction {
  find(userId: number): Promise<MemberRecord | null>;
  countAdmins(): Promise<number>;
  deleteRegistrationsOfUnstartedSlots(userId: number, now: Date): Promise<void>;
  anonymizeRegistrations(userId: number): Promise<void>;
  deleteResetTokens(userId: number): Promise<void>;
  deleteUser(userId: number): Promise<void>;
}

const select = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

const RETRIES = 6;

async function serializable<T>(
  prisma: PrismaClient,
  work: (client: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      // Two changes at the same moment: the refused one is replayed
      if (!isSerializationFailure(error) || attempt >= RETRIES) throw error;
    }
  }
}

export function createMembersRepository(prisma: PrismaClient) {
  return {
    list: (): Promise<MemberRecord[]> =>
      prisma.user.findMany({
        select,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      }),

    find: (id: number): Promise<MemberRecord | null> =>
      prisma.user.findUnique({ where: { id }, select }),

    /**
     * RG-04: reads the administrators and writes the role as one serializable unit. Two administrators who withdraw
     * their right at the same time both read two administrators; the database refuses the second write, which is
     * replayed and now reads one. The decision itself stays in the service.
     */
    inRoleTransaction: <T>(work: (tx: RoleTransaction) => Promise<T>): Promise<T> =>
      serializable(prisma, (client) =>
        work({
          find: (userId) => client.user.findUnique({ where: { id: userId }, select }),
          countAdmins: () => client.user.count({ where: { role: 'ADMIN' } }),
          setRole: (userId, role) =>
            client.user.update({ where: { id: userId }, data: { role }, select }),
        }),
      ),

    /** RG-04, RG-11: same guarantee for the last administrator who deletes their account. */
    inDeletionTransaction: <T>(work: (tx: DeletionTransaction) => Promise<T>): Promise<T> =>
      serializable(prisma, (client) =>
        work({
          find: (userId) => client.user.findUnique({ where: { id: userId }, select }),
          countAdmins: () => client.user.count({ where: { role: 'ADMIN' } }),
          deleteRegistrationsOfUnstartedSlots: async (userId, now) => {
            await client.registration.deleteMany({
              where: { userId, slot: { startsAt: { gt: now } } },
            });
          },
          anonymizeRegistrations: async (userId) => {
            await client.registration.updateMany({ where: { userId }, data: { userId: null } });
          },
          deleteResetTokens: async (userId) => {
            await client.resetToken.deleteMany({ where: { userId } });
          },
          deleteUser: async (userId) => {
            await client.user.delete({ where: { id: userId } });
          },
        }),
      ),
  };
}

export type MembersRepository = ReturnType<typeof createMembersRepository>;
