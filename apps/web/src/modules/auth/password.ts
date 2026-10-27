import { hash, verify } from '@node-rs/argon2';

// argon2id with the OWASP minimum (19 MiB of memory, 2 iterations, 1 lane); recorded in security.md, section 5.
// Raising these later is safe: `verifyPassword` reads the parameters stored in each hash.
// Algorithm 2 is Argon2id (the library's const enum cannot be imported with isolatedModules).
const PARAMS = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, PARAMS);
}

/** Constant-time comparison done by argon2 itself; a malformed stored hash is simply a mismatch. */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
