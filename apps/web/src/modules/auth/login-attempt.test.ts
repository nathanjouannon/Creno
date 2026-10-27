import { describe, expect, it } from 'vitest';
import {
  LOCK_DURATION_MS,
  afterFailure,
  identifierHash,
  isLocked,
  normalizeEmail,
  type AttemptState,
} from './login-attempt';

const now = new Date('2027-01-14T09:00:00Z');
const after = (ms: number) => new Date(now.getTime() + ms);

function failTimes(times: number, start: AttemptState | null = null, at = now): AttemptState {
  let state = start;
  for (let i = 0; i < times; i++) state = afterFailure(state, at);
  return state!;
}

describe('RG-03: block after 5 consecutive failures', () => {
  it('counts failures and does not block before the fifth', () => {
    expect(failTimes(1)).toEqual({ failedCount: 1, lockedUntil: null });
    expect(failTimes(4)).toEqual({ failedCount: 4, lockedUntil: null });
  });

  it('[F-02 S3] the fifth failure starts a 15-minute block', () => {
    expect(failTimes(5)).toEqual({ failedCount: 5, lockedUntil: after(LOCK_DURATION_MS) });
  });

  it('RG-03: is blocked before the end, free at the very end and after', () => {
    const state = failTimes(5);
    expect(isLocked(state, now)).toBe(true);
    expect(isLocked(state, after(LOCK_DURATION_MS - 1))).toBe(true);
    expect(isLocked(state, after(LOCK_DURATION_MS))).toBe(false);
    expect(isLocked(state, after(LOCK_DURATION_MS + 60_000))).toBe(false);
  });

  it('RG-03: an attempt made during the block does not extend it', () => {
    const state = failTimes(5);
    expect(afterFailure(state, after(10 * 60 * 1000))).toBe(state);
  });

  it('a block that has elapsed starts a new count: five more failures are needed', () => {
    const blocked = failTimes(5);
    const later = after(LOCK_DURATION_MS + 1);
    expect(afterFailure(blocked, later)).toEqual({ failedCount: 1, lockedUntil: null });
    expect(failTimes(4, blocked, later)).toEqual({ failedCount: 4, lockedUntil: null });
  });

  it('is not blocked without any recorded failure', () => {
    expect(isLocked(null, now)).toBe(false);
    expect(isLocked({ failedCount: 3, lockedUntil: null }, now)).toBe(false);
  });
});

describe('RG-03, ADR-0013: identifier of the attempts', () => {
  const secret = 'a'.repeat(32);

  it('is the same for the same address whatever the case and the spaces (RG-01)', () => {
    expect(normalizeEmail('  Mail.Ex@Exemple.FR ')).toBe('mail.ex@exemple.fr');
    expect(identifierHash('  Mail.Ex@Exemple.FR ', secret)).toBe(
      identifierHash('mail.ex@exemple.fr', secret),
    );
  });

  it('differs between addresses and between secrets', () => {
    expect(identifierHash('a@exemple.fr', secret)).not.toBe(identifierHash('b@exemple.fr', secret));
    expect(identifierHash('a@exemple.fr', secret)).not.toBe(
      identifierHash('a@exemple.fr', 'b'.repeat(32)),
    );
  });

  it('does not contain the address', () => {
    const hash = identifierHash('mail.ex@exemple.fr', secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain('exemple');
  });
});
