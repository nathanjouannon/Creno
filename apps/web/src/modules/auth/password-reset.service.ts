import { AppError } from '@creno/validation';
import {
  generateLinkToken,
  hashLinkToken,
  type Clock,
  type Logger,
  type SessionUser,
} from '@/modules/shared';
import { identifierHash } from './login-attempt';
import type { PasswordResetRepository } from './password-reset.repository';

/** RG-12 */
export const RESET_VALIDITY_MS = 3 * 24 * 60 * 60 * 1000;

interface Dependencies {
  repository: PasswordResetRepository;
  clock: Clock;
  /** `APP_URL`: the link is built from it, never from the request. */
  appUrl: string;
  /** Key of the sign-in attempts (RG-03). */
  secret: string;
  hashPassword: (password: string) => Promise<string>;
}

export function createPasswordResetService({
  repository,
  clock,
  appUrl,
  secret,
  hashPassword,
}: Dependencies) {
  /** Unknown, used, replaced and expired links are one answer (RG-12). */
  async function findUsable(token: string) {
    const record = await repository.findByTokenHash(hashLinkToken(token));
    if (!record || record.usedAt !== null || clock.now() >= record.expiresAt)
      throw new AppError('AUTH_RESET_LINK_INVALID');
    return record;
  }

  return {
    /**
     * F-10, RG-12: a new link for the user, valid 3 days, which replaces the earlier ones. The token is returned
     * once, here; only its hash is stored. security.md, section 4: who generated it for whom is logged (#81).
     */
    async create(actor: SessionUser, userId: number, log: Logger) {
      if (!(await repository.userExists(userId))) throw new AppError('USER_NOT_FOUND');
      const token = generateLinkToken();
      const expiresAt = new Date(clock.now().getTime() + RESET_VALIDITY_MS);
      await repository.replaceTokens(userId, hashLinkToken(token), expiresAt);
      log.info('password reset link created', { actorId: actor.id, userId });
      return {
        url: new URL(`/reinitialisation/${token}`, appUrl).toString(),
        expiresAt: expiresAt.toISOString(),
      };
    },

    /** F-02, RG-12: lets the page choose between the form and the message. */
    async check(token: string) {
      const record = await findUsable(token);
      return { expiresAt: record.expiresAt.toISOString() };
    },

    /**
     * F-02, RG-12, RG-03: changes the password once. No session is opened: the user signs in afterwards.
     */
    async reset(token: string, password: string, log: Logger) {
      const record = await findUsable(token);
      // Hashed before the transaction: argon2 takes tens of milliseconds
      const passwordHash = await hashPassword(password);
      const done = await repository.consume({
        tokenId: record.id,
        userId: record.user.id,
        passwordHash,
        usedAt: clock.now(),
        attemptKey: identifierHash(record.user.email, secret),
      });
      if (!done) throw new AppError('AUTH_RESET_LINK_INVALID');
      // security.md, section 4 (#81)
      log.info('password reset used', { userId: record.user.id });
    },
  };
}

export type PasswordResetService = ReturnType<typeof createPasswordResetService>;
