import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { isSerializationFailure } from './serialization';

describe('isSerializationFailure', () => {
  it('recognises the Prisma write conflict code', () => {
    const error = new Prisma.PrismaClientKnownRequestError('conflict', {
      code: 'P2034',
      clientVersion: 'test',
    });
    expect(isSerializationFailure(error)).toBe(true);
  });

  it('recognises a conflict found at commit, reported without a code', () => {
    const error = new Prisma.PrismaClientUnknownRequestError(
      'ERROR: could not serialize access due to read/write dependencies among transactions',
      { clientVersion: 'test' },
    );
    expect(isSerializationFailure(error)).toBe(true);
    expect(isSerializationFailure(new Error('deadlock detected'))).toBe(true);
  });

  it('leaves every other error alone', () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'test',
    });
    expect(isSerializationFailure(duplicate)).toBe(false);
    expect(isSerializationFailure(new Error('connection refused'))).toBe(false);
    expect(isSerializationFailure('boom')).toBe(false);
  });
});
