import { describe, expect, it } from 'vitest';
import {
  buildClearedSessionCookie,
  buildSessionCookie,
  readSessionToken,
  sessionCookieName,
} from './cookie';

const request = (cookie?: string) =>
  new Request('http://localhost/api/me', { headers: cookie ? { cookie } : {} });

describe('session cookie (security.md, section 4)', () => {
  it('production: __Host- prefix, HttpOnly, Secure, SameSite=Lax, path /, 30 days, no Domain', () => {
    const cookie = buildSessionCookie('tok', true);
    expect(cookie).toBe(
      '__Host-session=tok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000',
    );
    expect(cookie).not.toMatch(/Domain/i);
  });

  it('development exception: plain name and no Secure, so it works over http://localhost', () => {
    expect(buildSessionCookie('tok', false)).toBe(
      'session=tok; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000',
    );
    expect(sessionCookieName(false)).toBe('session');
  });

  it('erases the cookie with the same attributes and Max-Age=0', () => {
    expect(buildClearedSessionCookie(true)).toBe(
      '__Host-session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    );
  });

  it('reads the token among other cookies, and ignores a cookie of another name', () => {
    expect(readSessionToken(request('theme=dark; __Host-session=abc.def.ghi; other=1'), true)).toBe(
      'abc.def.ghi',
    );
    expect(readSessionToken(request('session=abc'), true)).toBeNull();
    expect(readSessionToken(request(), true)).toBeNull();
    expect(readSessionToken(request('__Host-session='), true)).toBeNull();
  });
});
