import { AppError } from '@creno/validation';
import { describe, expect, it, vi } from 'vitest';
import type { MeRecord, MeRepository } from './me.repository';
import { createMeService } from './me.service';

const record: MeRecord = {
  id: 1,
  firstName: 'Léa',
  lastName: 'Bernard',
  email: 'lea@club.fr',
  role: 'USER',
  passwordHash: 'hash',
  createdAt: new Date('2027-01-01T00:00:00Z'),
};
const input = { firstName: 'Léa', lastName: 'Bernard', email: 'lea@club.fr' };

function setup(
  update: ReturnType<typeof vi.fn> = vi.fn(async (_id, change) => ({ ...record, ...change })),
) {
  const repository = { find: vi.fn(async () => record), update } as unknown as MeRepository;
  const verifyPassword = vi.fn(async (_hash: string, password: string) => password === 'right');
  const service = createMeService({ repository, verifyPassword, toUserView: (user) => user.email });
  return { service, update, verifyPassword };
}

const failure = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as AppError;
  }
  return undefined;
};

describe('updateProfile (F-20, RG-18)', () => {
  it('[F-20 S2] a new first name needs no password', async () => {
    const { service, update, verifyPassword } = setup();
    await service.updateProfile({ id: 1, role: 'USER' }, { ...input, firstName: 'Léana' });
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(1, { ...input, firstName: 'Léana' });
  });

  it('[F-20 S3] a new address with the right password is saved', async () => {
    const { service, update } = setup();
    const result = await service.updateProfile(
      { id: 1, role: 'USER' },
      { ...input, email: 'new@club.fr', currentPassword: 'right' },
    );
    expect(result).toBe('new@club.fr');
    expect(update).toHaveBeenCalledOnce();
  });

  it('[F-20 S4] a new address without the password, or with a wrong one, changes nothing', async () => {
    const { service, update } = setup();
    const missing = await failure(
      service.updateProfile({ id: 1, role: 'USER' }, { ...input, email: 'new@club.fr' }),
    );
    const wrong = await failure(
      service.updateProfile(
        { id: 1, role: 'USER' },
        { ...input, email: 'new@club.fr', currentPassword: 'nope' },
      ),
    );
    expect(missing?.details).toEqual({
      fields: [{ field: 'currentPassword', code: 'FIELD_REQUIRED' }],
    });
    expect(wrong?.details).toEqual({
      fields: [{ field: 'currentPassword', code: 'FIELD_PASSWORD_INCORRECT' }],
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('[F-20 S5] an address taken by someone else is USER_EMAIL_IN_USE', async () => {
    const { service } = setup(vi.fn(async () => 'email-taken'));
    const error = await failure(
      service.updateProfile(
        { id: 1, role: 'USER' },
        { ...input, email: 'Marie@Club.fr', currentPassword: 'right' },
      ),
    );
    expect(error?.code).toBe('USER_EMAIL_IN_USE');
  });
});
