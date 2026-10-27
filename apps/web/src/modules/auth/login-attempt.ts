import { createHmac } from 'node:crypto';

// RG-03, ADR-0013: failures are counted per typed address, whether or not it belongs to an account.
export const MAX_FAILURES = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

export interface AttemptState {
  failedCount: number;
  /** null: not blocked. */
  lockedUntil: Date | null;
}

/** RG-01: the address is compared without case and without the spaces around it. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Key of the `login_attempts` row: a keyed digest of the normalised address, never the address itself.
 * Keyed with the application secret so a leaked table cannot be reversed by trying known addresses.
 */
export function identifierHash(email: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`login-attempt:${normalizeEmail(email)}`)
    .digest('hex');
}

/** Blocked while now is before `lockedUntil`; the very instant it ends, a new attempt is allowed. */
export function isLocked(state: AttemptState | null, now: Date): boolean {
  return state?.lockedUntil != null && now < state.lockedUntil;
}

/**
 * State after one more failure. An elapsed block starts a fresh count. The fifth consecutive failure starts the
 * 15-minute block; attempts made during the block never reach this function, so they do not extend it.
 */
export function afterFailure(current: AttemptState | null, now: Date): AttemptState {
  if (isLocked(current, now)) return current as AttemptState;
  const previous = current && current.lockedUntil == null ? current.failedCount : 0;
  const failedCount = previous + 1;
  return {
    failedCount,
    lockedUntil: failedCount >= MAX_FAILURES ? new Date(now.getTime() + LOCK_DURATION_MS) : null,
  };
}
