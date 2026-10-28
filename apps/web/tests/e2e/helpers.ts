import { hash } from '@node-rs/argon2';
import { PrismaClient } from '@prisma/client';
import { test as base, type APIRequestContext, type TestInfo } from '@playwright/test';

export const database = new PrismaClient({ datasourceUrl: process.env.E2E_DATABASE_URL });

/** Back to a new instance: no event, no club, no user, no failed login. */
export async function resetInstance() {
  await database.$transaction([
    database.event.deleteMany(),
    database.user.deleteMany(),
    database.club.deleteMany(),
    database.loginAttempt.deleteMany(),
  ]);
}

/**
 * Every test gets its own client address (the server trusts the proxy header in this configuration), so tests do not
 * share the per-address rate limits of security.md.
 */
export function addressOf(testInfo: TestInfo): string {
  const n = Number.parseInt(testInfo.testId.slice(-6), 16);
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
}

export const test = base.extend({
  // The browser pages of the test come from this address
  context: async ({ context }, use, testInfo) => {
    await context.setExtraHTTPHeaders({ 'x-forwarded-for': addressOf(testInfo) });
    await use(context);
  },
});

export { expect } from '@playwright/test';

export const installation = {
  club: { name: 'Ski Club des Arcs', timezone: 'Europe/Paris' },
  admin: {
    firstName: 'Alex',
    lastName: 'Martin',
    email: 'mail.ex@exemple.fr',
    password: '0123456789',
  },
};

/** Installs through the API, as a first visitor would. */
export async function installInstance(
  request: APIRequestContext,
  baseURL: string,
  address: string,
) {
  const response = await request.post('/api/setup', {
    data: installation,
    headers: { origin: baseURL, 'x-forwarded-for': address },
  });
  if (response.status() !== 201) throw new Error(`installation failed: ${response.status()}`);
}

export const member = {
  firstName: 'Léa',
  lastName: 'Bernard',
  email: 'lea@exemple.fr',
  password: '9876543210',
};

/** A user without the administrator right, created in the database (the invitation route comes with T-011). */
export async function createMember() {
  await database.user.create({
    data: {
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      passwordHash: await hash(member.password),
      role: 'USER',
    },
  });
}
