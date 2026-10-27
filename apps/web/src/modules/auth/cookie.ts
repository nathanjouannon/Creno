import { SESSION_DURATION_SECONDS } from './token';

// security.md, section 4: `__Host-` cookie, HttpOnly, Secure, SameSite=Lax, path /, 30 days.
// Development exception: the `__Host-` prefix requires `Secure`, which Safari refuses over http://localhost,
// so outside production the cookie is named `session` and is not `Secure`.
export function sessionCookieName(secure: boolean): string {
  return secure ? '__Host-session' : 'session';
}

function serialize(name: string, value: string, maxAge: number, secure: boolean): string {
  return [
    `${name}=${value}`,
    'Path=/',
    'HttpOnly',
    ...(secure ? ['Secure'] : []),
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

/** `Set-Cookie` value that opens a session. */
export function buildSessionCookie(token: string, secure: boolean): string {
  return serialize(sessionCookieName(secure), token, SESSION_DURATION_SECONDS, secure);
}

/** `Set-Cookie` value that erases the session cookie. */
export function buildClearedSessionCookie(secure: boolean): string {
  return serialize(sessionCookieName(secure), '', 0, secure);
}

export function readSessionToken(request: Request, secure: boolean): string | null {
  const name = sessionCookieName(secure);
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=') || null;
  }
  return null;
}
