import { createHash, randomBytes } from 'node:crypto';

/** 256 bits from the system generator: a link (invitation, password reset) cannot be guessed (security.md). */
export function generateLinkToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Only this hash is stored (security.md): a leaked database gives no usable link. The token is random and long,
 * so a fast hash is enough; a slow one would only cost time on every public request.
 */
export function hashLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
