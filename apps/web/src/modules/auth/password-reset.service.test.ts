import { AppError } from '@creno/validation';
import { describe, expect, it, vi } from 'vitest';
import { createLogger, fixedClock, hashLinkToken } from '@/modules/shared';
import { identifierHash } from './login-attempt';
import type { PasswordResetRepository } from './password-reset.repository';
import { createPasswordResetService, RESET_VALIDITY_MS } from './password-reset.service';

const NOW = '2027-03-14T08:00:00Z';
const admin = { id: 2, role: 'ADMIN' as const };
const log = createLogger({ write: () => {} });
const now = new Date(NOW);
const usable = {
  id: 4,
  expiresAt: new Date(now.getTime() + 1000),
  usedAt: null,
  user: { id: 7, email: 'Mail.Ex@exemple.fr' },
};

function build(overrides: Partial<PasswordResetRepository> = {}) {
  const repository = {
    userExists: vi.fn().mockResolvedValue(true),
    replaceTokens: vi.fn().mockResolvedValue(undefined),
    findByTokenHash: vi.fn().mockResolvedValue(usable),
    consume: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as PasswordResetRepository;
  const service = createPasswordResetService({
    repository,
    clock: fixedClock(NOW),
    appUrl: 'https://creno.example.org',
    secret: 'secret',
    hashPassword: async (password) => `hash:${password}`,
  });
  return { service, repository };
}

const codeOf = async (action: Promise<unknown>) => {
  try {
    await action;
  } catch (error) {
    return (error as AppError).code;
  }
  return undefined;
};

describe('create', () => {
  it('[F-10 S7] RG-12: a link valid 3 days, token stored hashed', async () => {
    const { service, repository } = build();
    const link = await service.create(admin, 7, log);
    expect(link.expiresAt).toBe(new Date(now.getTime() + RESET_VALIDITY_MS).toISOString());
    expect(RESET_VALIDITY_MS).toBe(3 * 24 * 3600 * 1000);
    const token = link.url.replace('https://creno.example.org/reinitialisation/', '');
    expect(repository.replaceTokens).toHaveBeenCalledWith(
      7,
      hashLinkToken(token),
      new Date(link.expiresAt),
    );
  });

  it('refuses an unknown user', async () => {
    const { service } = build({ userExists: vi.fn().mockResolvedValue(false) });
    expect(await codeOf(service.create(admin, 7, log))).toBe('USER_NOT_FOUND');
  });
});

describe('check and reset', () => {
  it('[F-02 S6] RG-12: unknown, used, and expired links are the same refusal, at the exact expiry too', async () => {
    const cases = [null, { ...usable, usedAt: new Date(NOW) }, { ...usable, expiresAt: now }];
    for (const record of cases) {
      const { service, repository } = build({ findByTokenHash: vi.fn().mockResolvedValue(record) });
      expect(await codeOf(service.check('t'))).toBe('AUTH_RESET_LINK_INVALID');
      expect(await codeOf(service.reset('t', '0123456789', log))).toBe('AUTH_RESET_LINK_INVALID');
      expect(repository.consume).not.toHaveBeenCalled();
    }
  });

  it('[F-02 S5] RG-12, RG-03: consumes the link with the new hash and the sign-in key of the address', async () => {
    const { service, repository } = build();
    await service.reset('t', '0123456789', log);
    expect(repository.consume).toHaveBeenCalledWith({
      tokenId: 4,
      userId: 7,
      passwordHash: 'hash:0123456789',
      usedAt: now,
      attemptKey: identifierHash('mail.ex@exemple.fr', 'secret'),
    });
  });

  it('RG-12: when another request used the link first, this one is refused', async () => {
    const { service } = build({ consume: vi.fn().mockResolvedValue(false) });
    expect(await codeOf(service.reset('t', '0123456789', log))).toBe('AUTH_RESET_LINK_INVALID');
  });
});

describe('security events (security.md, section 4, #81)', () => {
  const capture = () => {
    const lines: Record<string, unknown>[] = [];
    return { lines, log: createLogger({ write: (line) => lines.push(JSON.parse(line)) }) };
  };

  it('logs who generated a link for whom, never the token', async () => {
    const { service } = build();
    const { lines, log: logger } = capture();
    const link = await service.create(admin, 7, logger);
    expect(lines).toEqual([
      expect.objectContaining({ msg: 'password reset link created', actorId: 2, userId: 7 }),
    ]);
    expect(JSON.stringify(lines)).not.toContain(link.url.split('/').at(-1));
  });

  it('logs a link used, with the user id only', async () => {
    const { service } = build();
    const { lines, log: logger } = capture();
    await service.reset('secret-token', '0123456789', logger);
    expect(lines).toEqual([expect.objectContaining({ msg: 'password reset used', userId: 7 })]);
    expect(JSON.stringify(lines)).not.toMatch(/secret-token|0123456789|exemple/);
  });

  it('logs nothing for a refused link', async () => {
    const { service } = build({ consume: vi.fn().mockResolvedValue(false) });
    const { lines, log: logger } = capture();
    await service.reset('t', '0123456789', logger).catch(() => {});
    expect(lines).toEqual([]);
  });
});
