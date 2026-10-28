import { AppError } from '@creno/validation';
import { describe, expect, it } from 'vitest';
import { assertAccountDeletable, decideRoleChange } from './members.service';

const codeOf = (action: () => unknown) => {
  try {
    action();
  } catch (error) {
    return (error as AppError).code;
  }
  return undefined;
};

const change = (
  actorId: number,
  target: { id: number; role: 'USER' | 'ADMIN' },
  requested: 'USER' | 'ADMIN',
  adminCount: number,
) => decideRoleChange({ actorId, target, requested, adminCount });

describe('decideRoleChange (RG-04)', () => {
  it('[F-10 S2] an administrator gives the right to a user', () => {
    expect(change(1, { id: 2, role: 'USER' }, 'ADMIN', 1)).toBe('ADMIN');
  });

  it('[F-10 S3] an administrator withdraws their own right when another one remains', () => {
    expect(change(1, { id: 1, role: 'ADMIN' }, 'USER', 2)).toBe('USER');
  });

  it('[F-10 S4] nobody withdraws the right of another administrator', () => {
    expect(codeOf(() => change(1, { id: 2, role: 'ADMIN' }, 'USER', 2))).toBe(
      'USER_ROLE_CHANGE_FORBIDDEN',
    );
  });

  it('[F-10 S5] the last administrator cannot withdraw their right', () => {
    expect(codeOf(() => change(1, { id: 1, role: 'ADMIN' }, 'USER', 1))).toBe('USER_LAST_ADMIN');
  });

  it('a role already held is a no-op, whoever asks', () => {
    expect(change(1, { id: 2, role: 'ADMIN' }, 'ADMIN', 2)).toBeNull();
    expect(change(1, { id: 2, role: 'USER' }, 'USER', 1)).toBeNull();
  });
});

describe('assertAccountDeletable (RG-04)', () => {
  it('[F-11 S3] the last administrator cannot delete their account', () => {
    expect(codeOf(() => assertAccountDeletable({ role: 'ADMIN' }, 1))).toBe('USER_LAST_ADMIN');
  });

  it('an administrator may leave when another remains, and a user always may', () => {
    expect(codeOf(() => assertAccountDeletable({ role: 'ADMIN' }, 2))).toBeUndefined();
    expect(codeOf(() => assertAccountDeletable({ role: 'USER' }, 1))).toBeUndefined();
  });
});
