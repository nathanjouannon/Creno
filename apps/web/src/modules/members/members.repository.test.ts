import { Prisma, type PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMembersRepository } from './members.repository';

afterEach(() => vi.useRealTimers());

const conflict = () =>
  new Prisma.PrismaClientKnownRequestError('Transaction failed due to a write conflict', {
    code: 'P2034',
    clientVersion: 'test',
  });

/** A client whose transaction is refused `refusals` times, as while a competing one is slow to commit. */
function clientRefusing(refusals: number) {
  let calls = 0;
  const transaction = vi.fn(async (work: (tx: never) => Promise<unknown>) => {
    calls += 1;
    if (calls <= refusals) throw conflict();
    return work({} as never);
  });
  return { prisma: { $transaction: transaction } as unknown as PrismaClient, transaction };
}

describe('serializable replay (RG-04)', () => {
  it('[F-10 S5] RG-04: a change refused 9 times in a row is still replayed and succeeds', async () => {
    vi.useFakeTimers();
    const { prisma, transaction } = clientRefusing(9);
    const result = createMembersRepository(prisma).inRoleTransaction(async () => 'done');
    await vi.runAllTimersAsync();
    await expect(result).resolves.toBe('done');
    expect(transaction).toHaveBeenCalledTimes(10);
  });

  it('gives up after 10 attempts and lets the error through', async () => {
    vi.useFakeTimers();
    const { prisma, transaction } = clientRefusing(100);
    const result = createMembersRepository(prisma).inRoleTransaction(async () => 'done');
    const settled = expect(result).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    await vi.runAllTimersAsync();
    await settled;
    expect(transaction).toHaveBeenCalledTimes(10);
  });

  it('does not replay an error that is not a serialization failure', async () => {
    const transaction = vi.fn().mockRejectedValue(new Error('connection lost'));
    const prisma = { $transaction: transaction } as unknown as PrismaClient;
    await expect(createMembersRepository(prisma).inRoleTransaction(async () => 1)).rejects.toThrow(
      'connection lost',
    );
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
