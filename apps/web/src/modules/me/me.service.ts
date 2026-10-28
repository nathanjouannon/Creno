import { AppError, type UpdateProfileInput } from '@creno/validation';
import type { SessionUser } from '@/modules/shared';
import type { MeRecord, MeRepository } from './me.repository';

interface Dependencies {
  repository: MeRepository;
  verifyPassword: (hash: string, password: string) => Promise<boolean>;
  toUserView: (user: MeRecord) => unknown;
}

const fieldError = (field: string, code: string) =>
  new AppError('VALIDATION_ERROR', { fields: [{ field, code }] });

export function createMeService({ repository, verifyPassword, toUserView }: Dependencies) {
  return {
    /**
     * F-20, RG-18: the owner changes their name, first name or address. Only a new address asks for the current
     * password (nothing is sent by e-mail, RG-13). The name shown on slots follows at once, nothing is copied (RG-09).
     */
    async updateProfile(actor: SessionUser, input: UpdateProfileInput) {
      const current = await repository.find(actor.id);
      // Deleted between the session check and this read (RG-11)
      if (!current) throw new AppError('AUTH_REQUIRED');

      if (input.email !== current.email) {
        if (!input.currentPassword) throw fieldError('currentPassword', 'FIELD_REQUIRED');
        if (!(await verifyPassword(current.passwordHash, input.currentPassword)))
          throw fieldError('currentPassword', 'FIELD_PASSWORD_INCORRECT');
      }

      const updated = await repository.update(actor.id, {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
      });
      if (updated === 'email-taken') throw new AppError('USER_EMAIL_IN_USE');
      if (!updated) throw new AppError('AUTH_REQUIRED');
      return toUserView(updated);
    },
  };
}

export type MeService = ReturnType<typeof createMeService>;
