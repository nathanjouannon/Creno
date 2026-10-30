import { describe, expect, it, vi } from 'vitest';
import { createLogger, fixedClock } from '@/modules/shared';
import type { AttemptState } from './login-attempt';
import type { LoginRepository, LoginUser } from './login.repository';
import { createLoginService } from './login.service';

const user: LoginUser = {
  id: 7,
  firstName: 'Alex',
  lastName: 'Martin',
  email: 'mail.ex@exemple.fr',
  role: 'USER',
  passwordHash: 'stored-hash',
  tokenVersion: 2,
  createdAt: new Date('2027-01-01T00:00:00Z'),
};
const log = createLogger({ write: () => {} });
const now = new Date('2027-01-14T09:00:00Z');

function build(
  options: { user?: LoginUser | null; attempt?: AttemptState | null; passwordOk?: boolean } = {},
) {
  const attempts = new Map<string, AttemptState>();
  const hasUser = options.user !== null;
  // Like the row lock of the repository: the transactions of one address run one after the other
  let queue: Promise<unknown> = Promise.resolve();
  const repository = {
    findUserByEmail: vi.fn(async () => (hasUser ? (options.user ?? user) : null)),
    clearAttempts: vi.fn(async () => {}),
    inAttemptTransaction: vi.fn((hash: string, work: (tx: unknown) => Promise<unknown>) => {
      const run = queue.then(() =>
        work({
          find: async () => attempts.get(hash) ?? options.attempt ?? null,
          save: async (state: AttemptState) => void attempts.set(hash, state),
        }),
      );
      queue = run.catch(() => {});
      return run;
    }),
  } as unknown as LoginRepository;
  const verifyPassword = vi.fn(async () => options.passwordOk ?? true);
  const service = createLoginService({
    repository,
    clock: fixedClock(now),
    secret: 'a'.repeat(32),
    hashPassword: async () => 'decoy-hash',
    verifyPassword,
    openSession: async (u) => `session-${u.id}-v${u.tokenVersion}`,
    toUserView: (u) => ({ id: u.id, firstName: u.firstName }),
  });
  return { service, repository, verifyPassword, attempts };
}

const input = { email: 'mail.ex@exemple.fr', password: 'whatever-it-is' };

describe('login service (F-02, RG-03)', () => {
  it('[F-02 S1] opens the session and resets the counter on success', async () => {
    const { service, repository } = build();
    expect(await service.login(input, log)).toEqual({
      user: { id: 7, firstName: 'Alex' },
      sessionCookie: 'session-7-v2',
    });
    expect(repository.clearAttempts).toHaveBeenCalledOnce();
  });

  it('[F-02 S2] a wrong password is AUTH_INVALID_CREDENTIALS and counts one failure', async () => {
    const { service, attempts } = build({ passwordOk: false });
    await expect(service.login(input, log)).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    });
    expect([...attempts.values()]).toEqual([{ failedCount: 1, lockedUntil: null }]);
  });

  it('[F-02 S3 ter] RG-03: an address without account gets the same error and is counted the same way', async () => {
    const { service, attempts } = build({ user: null });
    await expect(service.login(input, log)).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    });
    expect([...attempts.values()]).toEqual([{ failedCount: 1, lockedUntil: null }]);
  });

  it('RG-03: an address without account still costs a password check, against a decoy hash', async () => {
    const { service, verifyPassword } = build({ user: null });
    await service.login(input, log).catch(() => {});
    expect(verifyPassword).toHaveBeenCalledWith('decoy-hash', 'whatever-it-is');
    const known = build({ passwordOk: false });
    await known.service.login(input, log).catch(() => {});
    expect(known.verifyPassword).toHaveBeenCalledWith('stored-hash', 'whatever-it-is');
  });

  it('[F-02 S3] RG-03: the fifth failure blocks for 15 minutes, still answering AUTH_INVALID_CREDENTIALS', async () => {
    const { service, attempts } = build({
      passwordOk: false,
      attempt: { failedCount: 4, lockedUntil: null },
    });
    await expect(service.login(input, log)).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    });
    expect([...attempts.values()]).toEqual([
      { failedCount: 5, lockedUntil: new Date('2027-01-14T09:15:00Z') },
    ]);
  });

  it('[F-02 S3] RG-03: while blocked, even the right password gets AUTH_ACCOUNT_LOCKED with the end of the block, and nothing is written or checked', async () => {
    const lockedUntil = new Date('2027-01-14T09:10:00Z');
    const { service, repository, verifyPassword, attempts } = build({
      attempt: { failedCount: 5, lockedUntil },
    });
    await expect(service.login(input, log)).rejects.toMatchObject({
      code: 'AUTH_ACCOUNT_LOCKED',
      details: { lockedUntil: '2027-01-14T09:10:00.000Z' },
    });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(attempts.size).toBe(0);
    expect(repository.clearAttempts).not.toHaveBeenCalled();
  });

  it('RG-03: of 10 simultaneous attempts, only 5 passwords are checked before the block (#78)', async () => {
    const { service, verifyPassword } = build({ passwordOk: false });
    const codes = await Promise.all(
      Array.from({ length: 10 }, () =>
        service.login(input, log).then(
          () => 'OK',
          (error: { code: string }) => error.code,
        ),
      ),
    );
    expect(verifyPassword).toHaveBeenCalledTimes(5);
    expect(codes.filter((c) => c === 'AUTH_INVALID_CREDENTIALS')).toHaveLength(5);
    expect(codes.filter((c) => c === 'AUTH_ACCOUNT_LOCKED')).toHaveLength(5);
  });

  it('RG-03: the attempt is counted before the password is checked, and a success removes the count', async () => {
    const { service, repository, verifyPassword, attempts } = build({
      attempt: { failedCount: 4, lockedUntil: null },
    });
    verifyPassword.mockImplementation(async () => {
      // Already counted while the password is being checked
      expect([...attempts.values()]).toEqual([
        { failedCount: 5, lockedUntil: new Date('2027-01-14T09:15:00Z') },
      ]);
      return true;
    });
    await expect(service.login(input, log)).resolves.toMatchObject({ sessionCookie: 'session-7-v2' });
    expect(repository.clearAttempts).toHaveBeenCalledOnce();
  });

  it('RG-03: the block is the same for an address without account', async () => {
    const lockedUntil = new Date('2027-01-14T09:10:00Z');
    const { service } = build({ user: null, attempt: { failedCount: 5, lockedUntil } });
    await expect(service.login(input, log)).rejects.toMatchObject({ code: 'AUTH_ACCOUNT_LOCKED' });
  });

  it('RG-03: once the 15 minutes have passed the right password works again', async () => {
    const lockedUntil = new Date('2027-01-14T08:59:59Z');
    const { service } = build({ attempt: { failedCount: 5, lockedUntil } });
    await expect(service.login(input, log)).resolves.toMatchObject({
      sessionCookie: 'session-7-v2',
    });
  });

  it('RG-11: a deleted account is AUTH_INVALID_CREDENTIALS like any unknown address', async () => {
    const { service } = build({ user: null });
    await expect(service.login(input, log)).rejects.toMatchObject({
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });

  it('looks the account up without case or surrounding spaces (RG-01)', async () => {
    const { service, repository } = build();
    await service.login({ email: '  Mail.EX@exemple.fr ', password: 'x' }, log);
    expect(repository.findUserByEmail).toHaveBeenCalledWith('mail.ex@exemple.fr');
  });

  it('writes the security events without the typed address or password', async () => {
    const lines: string[] = [];
    const logger = createLogger({ write: (l) => lines.push(l) });
    const { service } = build({
      passwordOk: false,
      attempt: { failedCount: 4, lockedUntil: null },
    });
    await service
      .login({ email: 'secret.person@exemple.fr', password: 'my-password-1234' }, logger)
      .catch(() => {});
    const logs = lines.join('');
    expect(logs).toContain('login failed');
    expect(logs).toContain('login blocked');
    expect(logs).not.toContain('secret.person');
    expect(logs).not.toContain('my-password-1234');
  });
});
