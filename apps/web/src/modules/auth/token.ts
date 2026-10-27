import { SignJWT, jwtVerify } from 'jose';

// ADR-0006: a signed JWT carrying the user id and the token version; everything else is read from the database.
export const SESSION_DURATION_SECONDS = 30 * 24 * 60 * 60;

export interface SessionClaims {
  userId: number;
  tokenVersion: number;
}

interface TokenContext {
  secret: string;
  now: Date;
}

const key = (secret: string) => new TextEncoder().encode(secret);

export function signSessionToken(
  claims: SessionClaims,
  { secret, now }: TokenContext,
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ tv: claims.tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(claims.userId))
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_DURATION_SECONDS)
    .sign(key(secret));
}

/** The claims of a genuine, unexpired token, or null for anything else (bad signature, other algorithm, expired…). */
export async function verifySessionToken(
  token: string,
  { secret, now }: TokenContext,
): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ['HS256'],
      currentDate: now,
    });
    const userId = Number(payload.sub);
    const tokenVersion = payload.tv;
    if (!Number.isInteger(userId) || userId < 1 || !Number.isInteger(tokenVersion)) return null;
    return { userId, tokenVersion: tokenVersion as number };
  } catch {
    return null;
  }
}
