import { AppError } from '@creno/validation';
import type { Clock, Logger } from '@/modules/shared';
import { afterFailure, identifierHash, isLocked, normalizeEmail } from './login-attempt';
import type { LoginRepository, LoginUser } from './login.repository';

interface Dependencies {
  repository: LoginRepository;
  clock: Clock;
  secret: string;
  hashPassword: (password: string) => Promise<string>;
  verifyPassword: (hash: string, password: string) => Promise<boolean>;
  /** `Set-Cookie` value that opens the session of a user. */
  openSession: (user: { id: number; tokenVersion: number }) => Promise<string>;
  toUserView: (user: LoginUser) => unknown;
}

export interface LoginInput {
  email: string;
  password: string;
}

export function createLoginService(deps: Dependencies) {
  const { repository, clock, secret, hashPassword, verifyPassword, openSession, toUserView } = deps;

  // Hash checked for an address without account, so that it costs the same time as a real one (security.md)
  let decoy: Promise<string> | undefined;
  const decoyHash = () => (decoy ??= hashPassword('creno-decoy-password'));

  return {
    /**
     * F-02, RG-03, ADR-0013. The block applies to the typed address, with or without an account, and the answer is
     * identical in both cases: the wrong password, the unknown address and the deleted account (RG-11) are the same
     * `AUTH_INVALID_CREDENTIALS`.
     */
    async login(input: LoginInput, log: Logger) {
      const key = identifierHash(input.email, secret);
      const now = clock.now();

      // RG-03: blocked even with the right password; attempts during the block do not extend it
      const attempt = await repository.findAttempt(key);
      if (isLocked(attempt, now) && attempt?.lockedUntil) {
        log.warn('login refused: address blocked');
        throw new AppError('AUTH_ACCOUNT_LOCKED', {
          lockedUntil: attempt.lockedUntil.toISOString(),
        });
      }

      const user = await repository.findUserByEmail(normalizeEmail(input.email));
      const correct = await verifyPassword(
        user?.passwordHash ?? (await decoyHash()),
        input.password,
      );

      if (!user || !correct) {
        const state = await repository.inAttemptTransaction(async (tx) => {
          const next = afterFailure(await tx.find(key), clock.now());
          await tx.save(key, next);
          return next;
        });
        log.warn('login failed', { userId: user?.id, failedCount: state.failedCount });
        if (state.lockedUntil) log.warn('login blocked for 15 minutes', { userId: user?.id });
        throw new AppError('AUTH_INVALID_CREDENTIALS');
      }

      // RG-03: a success starts the count again
      await repository.clearAttempts(key);
      log.info('login succeeded', { userId: user.id });
      return { user: toUserView(user), sessionCookie: await openSession(user) };
    },
  };
}

export type LoginService = ReturnType<typeof createLoginService>;
