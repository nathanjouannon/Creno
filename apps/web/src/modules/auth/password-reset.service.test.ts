import { AppError } from '@creno/validation';
import { describe, expect, it, vi } from 'vitest';
import { fixedClock, hashLinkToken } from '@/modules/shared';
import { identifierHash } from './login-attempt';
import type { PasswordResetRepository } from './password-reset.repository';
import { createPasswordResetService, RESET_VALIDITY_MS } from './password-reset.service';

const NOW = '2027-03-14T08:00:00Z';
const now = new Date(NOW);
const usable = {
  id: 4,
  expiresAt: new Date(now.getTime() + 1000),
  usedAt: null,
  user: { id: 7, email: 'Mail.Ex@exemple.fr' },
};

function build(
  overrides: Partial<PasswordResetRepository> = {},
  role: 'USER' | 'ADMIN' | null = 'USER',
) {
  const replaceTokens = vi.fn().mockResolvedValue(undefined);
  const repository = {
    inLinkTransaction: vi.fn(async (_userId: number, work: (tx: unknown) => Promise<unknown>) =>
      work({ findRole: async () => role, replaceTokens }),
    ),
    findUserIdByEmail: vi.fn().mockResolvedValue(7),
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
  return { service, repository, replaceTokens };
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
    const { service, repository, replaceTokens } = build();
    const link = await service.create(7);
    expect(link.expiresAt).toBe(new Date(now.getTime() + RESET_VALIDITY_MS).toISOString());
    expect(RESET_VALIDITY_MS).toBe(3 * 24 * 3600 * 1000);
    const token = link.url.replace('https://creno.example.org/reinitialisation/', '');
    expect(repository.inLinkTransaction).toHaveBeenCalledWith(7, expect.any(Function));
    expect(replaceTokens).toHaveBeenCalledWith(hashLinkToken(token), new Date(link.expiresAt));
  });

  it('refuses an unknown user', async () => {
    const { service, replaceTokens } = build({}, null);
    expect(await codeOf(service.create(7))).toBe('USER_NOT_FOUND');
    expect(replaceTokens).not.toHaveBeenCalled();
  });

  it('RG-12: never a link for an administrator, whoever asks (#82)', async () => {
    const { service, replaceTokens } = build({}, 'ADMIN');
    expect(await codeOf(service.create(7))).toBe('USER_RESET_FORBIDDEN');
    expect(replaceTokens).not.toHaveBeenCalled();
  });
});

describe('rescue link (#82)', () => {
  it('RG-12: the rescue command gives an administrator a link, found by address', async () => {
    const { service, repository, replaceTokens } = build({}, 'ADMIN');
    const link = await service.createRescueLink(' Admin@Exemple.fr ');
    expect(repository.findUserIdByEmail).toHaveBeenCalledWith(' Admin@Exemple.fr ');
    expect(link.url).toMatch(/^https:\/\/creno\.example\.org\/reinitialisation\/.+/);
    expect(replaceTokens).toHaveBeenCalledOnce();
  });

  it('refuses an address without account', async () => {
    const { service } = build({ findUserIdByEmail: vi.fn().mockResolvedValue(null) });
    expect(await codeOf(service.createRescueLink('nobody@exemple.fr'))).toBe('USER_NOT_FOUND');
  });
});

describe('check and reset', () => {
  it('[F-02 S6] RG-12: unknown, used, and expired links are the same refusal, at the exact expiry too', async () => {
    const cases = [null, { ...usable, usedAt: new Date(NOW) }, { ...usable, expiresAt: now }];
    for (const record of cases) {
      const { service, repository } = build({ findByTokenHash: vi.fn().mockResolvedValue(record) });
      expect(await codeOf(service.check('t'))).toBe('AUTH_RESET_LINK_INVALID');
      expect(await codeOf(service.reset('t', '0123456789'))).toBe('AUTH_RESET_LINK_INVALID');
      expect(repository.consume).not.toHaveBeenCalled();
    }
  });

  it('[F-02 S5] RG-12, RG-03: consumes the link with the new hash and the sign-in key of the address', async () => {
    const { service, repository } = build();
    await service.reset('t', '0123456789');
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
    expect(await codeOf(service.reset('t', '0123456789'))).toBe('AUTH_RESET_LINK_INVALID');
  });
});
