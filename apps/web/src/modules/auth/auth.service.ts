import { AppError } from '@creno/validation';
import type { Clock, SessionUser } from '@/modules/shared';
import type { AuthRepository, UserRecord } from './auth.repository';
import { buildClearedSessionCookie, buildSessionCookie, readSessionToken } from './cookie';
import { signSessionToken, verifySessionToken } from './token';

interface Dependencies {
  repository: AuthRepository;
  clock: Clock;
  secret: string;
  /** Production: `__Host-` cookie with `Secure`. */
  secureCookie: boolean;
}

/** The `User` schema of openapi.yaml; never the hash or the token version. */
export function toUserView(user: UserRecord) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

export function createAuthService({ repository, clock, secret, secureCookie }: Dependencies) {
  return {
    /**
     * ADR-0006, RG-14: signature and expiry, then the user is read again. A deleted user (RG-11) or a stale
     * `tokenVersion` (RG-12) refuses the token, and the role is the one stored now (RG-04).
     */
    async resolveSession(request: Request): Promise<SessionUser | null> {
      const token = readSessionToken(request, secureCookie);
      if (!token) return null;
      const claims = await verifySessionToken(token, { secret, now: clock.now() });
      if (!claims) return null;
      const record = await repository.findSessionRecord(claims.userId);
      if (!record || record.tokenVersion !== claims.tokenVersion) return null;
      return { id: record.id, role: record.role };
    },

    /** `Set-Cookie` value that opens a session for a user (login, installation, invitation). */
    async openSession(user: { id: number; tokenVersion: number }): Promise<string> {
      const token = await signSessionToken(
        { userId: user.id, tokenVersion: user.tokenVersion },
        { secret, now: clock.now() },
      );
      return buildSessionCookie(token, secureCookie);
    },

    closeSession(): string {
      return buildClearedSessionCookie(secureCookie);
    },

    async getCurrentUser(user: SessionUser) {
      const record = await repository.findUser(user.id);
      // Deleted between the session check and this read
      if (!record) throw new AppError('AUTH_REQUIRED');
      return toUserView(record);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
