import { Prisma, type PrismaClient, type UserRole } from '@prisma/client';

export interface InstalledUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
  createdAt: Date;
}

export interface ClubRecord {
  name: string;
  timezone: string;
}

export interface NewInstallation {
  club: ClubRecord;
  admin: { firstName: string; lastName: string; email: string; passwordHash: string };
}

export function createClubRepository(prisma: PrismaClient) {
  return {
    countUsers: (): Promise<number> => prisma.user.count(),

    findClub: (): Promise<ClubRecord | null> =>
      prisma.club.findUnique({ where: { id: 1 }, select: { name: true, timezone: true } }),

    /**
     * Creates the club and its first administrator in one transaction. The club row has the fixed key 1, so of two
     * simultaneous installations the second one hits the unique key once the first commits: it gets `null`
     * and nothing is written (RG-17).
     */
    async createClubAndAdmin({ club, admin }: NewInstallation): Promise<InstalledUser | null> {
      try {
        return await prisma.$transaction(async (tx) => {
          await tx.club.create({ data: { id: 1, name: club.name, timezone: club.timezone } });
          return tx.user.create({
            data: { ...admin, role: 'ADMIN' },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              tokenVersion: true,
              createdAt: true,
            },
          });
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          return null;
        throw error;
      }
    },
  };
}

export type ClubRepository = ReturnType<typeof createClubRepository>;
