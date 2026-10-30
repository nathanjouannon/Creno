import { randomBytes } from 'node:crypto';

/** 128 random bits, new for every page: a script injected into the page cannot guess it. */
export function newNonce(): string {
  return randomBytes(16).toString('base64');
}

/**
 * security.md, section 4: strict policy, no inline script without the nonce of the page (#80). Next.js gives the nonce
 * to its own scripts, and `strict-dynamic` lets them load the chunks they need. The development server evaluates its
 * modules (`eval`), so `unsafe-eval` is allowed there only. Inline styles stay allowed: React and Next.js set some.
 */
export function contentSecurityPolicy(nonce: string, development = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
