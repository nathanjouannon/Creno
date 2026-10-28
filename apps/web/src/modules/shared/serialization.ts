import { Prisma } from '@prisma/client';

/**
 * A transaction PostgreSQL refused to keep because of a concurrent one, to be replayed. Prisma reports it as `P2034`
 * when the conflict is found during a statement, but a conflict found at commit can arrive without a code, with the
 * server's wording: both are recognised.
 */
export function isSerializationFailure(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') return true;
  const message = error instanceof Error ? error.message : '';
  return /could not serialize access|serialization failure|deadlock detected|\b40001\b|\b40P01\b/i.test(
    message,
  );
}
