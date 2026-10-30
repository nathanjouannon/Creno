import { AppError } from '@creno/validation';
import { generateLinkToken, hashLinkToken, type Clock } from '@/modules/shared';
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

  /** RG-12: a link valid 3 days that replaces the earlier ones; the token is returned once, only its hash is stored. */
  async function createLink(userId: number, { forAdministrator }: { forAdministrator: boolean }) {
    const token = generateLinkToken();
    const expiresAt = new Date(clock.now().getTime() + RESET_VALIDITY_MS);
    await repository.inLinkTransaction(userId, async (tx) => {
      const role = await tx.findRole();
      if (!role) throw new AppError('USER_NOT_FOUND');
      // RG-12 (#82): otherwise an administrator could open the link themselves and act as another one
      if (role === 'ADMIN' && !forAdministrator) throw new AppError('USER_RESET_FORBIDDEN');
      await tx.replaceTokens(hashLinkToken(token), expiresAt);
    });
    return {
      url: new URL(`/reinitialisation/${token}`, appUrl).toString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  return {
    /** F-10, RG-12: from the member's page, never for an administrator (#82). */
    create(userId: number) {
      return createLink(userId, { forAdministrator: false });
    },

    /**
     * RG-12 (#82): the rescue procedure, run on the server by someone who has access to it, for an administrator who
     * forgot their password (README.md). Same link and same rules, without the role check of a request.
     */
    async createRescueLink(email: string) {
      const userId = await repository.findUserIdByEmail(email);
      if (userId === null) throw new AppError('USER_NOT_FOUND');
      return createLink(userId, { forAdministrator: true });
    },

    /** F-02, RG-12: lets the page choose between the form and the message. */
    async check(token: string) {
      const record = await findUsable(token);
      return { expiresAt: record.expiresAt.toISOString() };
    },

    /**
     * F-02, RG-12, RG-03: changes the password once. No session is opened: the user signs in afterwards.
     */
    async reset(token: string, password: string) {
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
    },
  };
}

export type PasswordResetService = ReturnType<typeof createPasswordResetService>;
