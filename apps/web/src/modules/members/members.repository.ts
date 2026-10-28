import { Prisma, type PrismaClient, type UserRole } from '@prisma/client';

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

const select = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  createdAt: true,
} as const;

const RETRIES = 6;

// A serialization failure (two role changes at the same moment) is replayed
const isConflict = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';

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
    async inRoleTransaction<T>(work: (tx: RoleTransaction) => Promise<T>): Promise<T> {
      for (let attempt = 1; ; attempt++) {
        try {
          return await prisma.$transaction(
            (client) =>
              work({
                find: (userId) => client.user.findUnique({ where: { id: userId }, select }),
                countAdmins: () => client.user.count({ where: { role: 'ADMIN' } }),
                setRole: (userId, role) =>
                  client.user.update({ where: { id: userId }, data: { role }, select }),
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

export type MembersRepository = ReturnType<typeof createMembersRepository>;
