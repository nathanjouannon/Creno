import type { PrismaClient, UserRole } from '@prisma/client';

let counter = 0;

interface UserOverrides {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  tokenVersion?: number;
  passwordHash?: string;
}

/** Inserts a user; the password hash is a placeholder unless the test needs a real one. */
export function createUser(prisma: PrismaClient, overrides: UserOverrides = {}) {
  counter += 1;
  return prisma.user.create({
    data: {
      firstName: 'Léa',
      lastName: `Bernard${counter}`,
      email: `user${counter}@example.org`,
      passwordHash: 'not-a-real-hash',
      ...overrides,
    },
  });
}
