import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, newNonce } from './content-security-policy';

const directives = (policy: string) =>
  Object.fromEntries(policy.split('; ').map((d) => [d.split(' ')[0], d.split(' ').slice(1)]));

describe('Content-Security-Policy (security.md, section 4, #80)', () => {
  it('scripts need the nonce; no inline script, no eval in production', () => {
    const { 'script-src': scripts } = directives(contentSecurityPolicy('abc'));
    expect(scripts).toEqual(["'self'", "'nonce-abc'", "'strict-dynamic'"]);
  });

  it('the development server may evaluate its modules, nothing more', () => {
    const { 'script-src': scripts } = directives(contentSecurityPolicy('abc', true));
    expect(scripts).toEqual(["'self'", "'nonce-abc'", "'strict-dynamic'", "'unsafe-eval'"]);
  });

  it('keeps the other rules of security.md: own origin only, no frame, no plugin', () => {
    const policy = directives(contentSecurityPolicy('abc'));
    expect(policy['default-src']).toEqual(["'self'"]);
    expect(policy['frame-ancestors']).toEqual(["'none'"]);
    expect(policy['object-src']).toEqual(["'none'"]);
    expect(policy['base-uri']).toEqual(["'self'"]);
    expect(policy['form-action']).toEqual(["'self'"]);
  });

  it('a nonce is 128 random bits, never the same twice', () => {
    const nonces = new Set(Array.from({ length: 100 }, newNonce));
    expect(nonces.size).toBe(100);
    for (const nonce of nonces) expect(Buffer.from(nonce, 'base64')).toHaveLength(16);
  });
});
