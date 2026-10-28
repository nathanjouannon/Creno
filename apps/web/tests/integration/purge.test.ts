import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser } from '../factories/user';
import { createTestDatabase, type TestDatabase } from '../helpers/test-database';
import { createMaintenanceRepository } from '@/modules/maintenance/maintenance.repository';
import { createMaintenanceService } from '@/modules/maintenance/maintenance.service';
import { fixedClock } from '@/modules/shared';

const NOW = new Date('2027-03-14T08:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const daysAgo = (d: number) => hoursAgo(d * 24);
const hoursAhead = (h: number) => hoursAgo(-h);

let database: TestDatabase;
let userId: number;

const purge = () =>
  createMaintenanceService({
    repository: createMaintenanceRepository(database.prisma),
    clock: fixedClock(NOW),
  }).purge();

beforeAll(async () => {
  database = await createTestDatabase();
  userId = (await createUser(database.prisma)).id;
});
afterAll(() => database.drop());
beforeEach(async () => {
  await database.prisma.loginAttempt.deleteMany();
  await database.prisma.resetToken.deleteMany();
});

const attempt = (hash: string, updatedAt: Date, lockedUntil: Date | null = null) =>
  database.prisma.loginAttempt.create({
    data: { identifierHash: hash, failedCount: lockedUntil ? 5 : 2, lockedUntil, updatedAt },
  });
const token = (name: string, expiresAt: Date, usedAt: Date | null = null) =>
  database.prisma.resetToken.create({ data: { userId, token: name, expiresAt, usedAt } });

describe('purge (security.md, section 4)', () => {
  it('deletes login attempts without a block for over 24 h and only those', async () => {
    await attempt('old-never-blocked', hoursAgo(25));
    await attempt('old-block-over', hoursAgo(26), hoursAgo(25));
    await attempt('recent-never-blocked', hoursAgo(23));
    await attempt('old-but-blocked-recently', hoursAgo(30), hoursAgo(2));
    await attempt('blocked-now', hoursAgo(1), hoursAhead(14));

    const result = await purge();

    expect(result.loginAttempts).toBe(2);
    const kept = await database.prisma.loginAttempt.findMany({ select: { identifierHash: true } });
    expect(kept.map((r) => r.identifierHash).sort()).toEqual([
      'blocked-now',
      'old-but-blocked-recently',
      'recent-never-blocked',
    ]);
  });

  it('deletes reset tokens expired or used for over 30 days and only those', async () => {
    await token('expired-long-ago', daysAgo(31));
    await token('used-long-ago', daysAgo(20), daysAgo(31));
    await token('expired-recently', daysAgo(29));
    await token('used-recently', daysAgo(1), daysAgo(2));
    await token('still-valid', daysAgo(-2));

    const result = await purge();

    expect(result.resetTokens).toBe(2);
    const kept = await database.prisma.resetToken.findMany({ select: { token: true } });
    expect(kept.map((r) => r.token).sort()).toEqual([
      'expired-recently',
      'still-valid',
      'used-recently',
    ]);
  });

  it('leaves users and everything else alone', async () => {
    await token('expired-long-ago', daysAgo(40));
    await purge();
    expect(await database.prisma.user.count({ where: { id: userId } })).toBe(1);
  });
});
