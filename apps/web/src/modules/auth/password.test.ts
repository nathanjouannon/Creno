import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing (RG-01, security.md)', () => {
  it('stores an argon2id hash with the OWASP minimum parameters, never the password', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    expect(hash).not.toContain('correct horse');
  });

  it('accepts the right password and refuses a wrong one', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword(hash, 'correct horse battery')).toBe(true);
    expect(await verifyPassword(hash, 'correct horse batterz')).toBe(false);
    expect(await verifyPassword(hash, '')).toBe(false);
  });

  it('salts: the same password gives two different hashes that both verify', async () => {
    const [a, b] = await Promise.all([hashPassword('0123456789'), hashPassword('0123456789')]);
    expect(a).not.toBe(b);
    expect(await verifyPassword(a, '0123456789')).toBe(true);
    expect(await verifyPassword(b, '0123456789')).toBe(true);
  });

  it('treats a malformed stored hash as a mismatch instead of throwing', async () => {
    expect(await verifyPassword('not-a-hash', 'whatever')).toBe(false);
  });
});
