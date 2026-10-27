import type { PrismaClient, UserRole } from '@prisma/client';

export interface SessionRecord {
  id: number;
  role: UserRole;
  tokenVersion: number;
}

export interface UserRecord {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export function createAuthRepository(prisma: PrismaClient) {
  return {
    findSessionRecord: (id: number): Promise<SessionRecord | null> =>
      prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, tokenVersion: true },
      }),

    // Never selects the password hash.
    findUser: (id: number): Promise<UserRecord | null> =>
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          createdAt: true,
        },
      }),
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
