import { Prisma, type PrismaClient, type UserRole } from '@prisma/client';

export interface MeRecord {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  createdAt: Date;
}

export interface ProfileChange {
  firstName: string;
  lastName: string;
  email: string;
}

const select = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  passwordHash: true,
  createdAt: true,
} as const;

export function createMeRepository(prisma: PrismaClient) {
  return {
    find: (id: number): Promise<MeRecord | null> =>
      prisma.user.findUnique({ where: { id }, select }),

    /**
     * RG-01: the unique index on lower(email) decides between two simultaneous uses of one address; the loser gets
     * `'email-taken'`. A user deleted in the meantime (RG-11) gets `null`.
     */
    async update(id: number, change: ProfileChange): Promise<MeRecord | null | 'email-taken'> {
      try {
        return await prisma.user.update({ where: { id }, data: change, select });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2002') return 'email-taken';
          if (error.code === 'P2025') return null;
        }
        throw error;
      }
    },
  };
}

export type MeRepository = ReturnType<typeof createMeRepository>;
