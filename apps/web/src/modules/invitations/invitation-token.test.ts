import { describe, expect, it } from 'vitest';
import { generateInvitationToken, hashInvitationToken } from './invitation-token';

describe('invitation token', () => {
  it('is long, random and URL safe', () => {
    const token = generateInvitationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateInvitationToken()).not.toBe(token);
  });

  it('is stored as a hash that does not contain it and is stable', () => {
    const token = generateInvitationToken();
    const hash = hashInvitationToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
    expect(hashInvitationToken(token)).toBe(hash);
  });
});
