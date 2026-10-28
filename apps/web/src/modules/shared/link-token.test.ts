import { describe, expect, it } from 'vitest';
import { generateLinkToken, hashLinkToken } from './link-token';

describe('link token', () => {
  it('is long, random and URL safe', () => {
    const token = generateLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateLinkToken()).not.toBe(token);
  });

  it('is stored as a hash that does not contain it and is stable', () => {
    const token = generateLinkToken();
    const hash = hashLinkToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashLinkToken(token)).toBe(hash);
  });
});
