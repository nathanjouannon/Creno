import { AppError } from '@creno/validation';
import type { Clock, SessionUser } from '@/modules/shared';
import type { MemberRecord, MembersRepository } from './members.repository';

type Role = 'USER' | 'ADMIN';

interface Dependencies {
  repository: MembersRepository;
  clock: Clock;
  toUserView: (user: MemberRecord) => unknown;
}

/**
 * RG-04: what a role change becomes. `null` means nothing to do (the role is already held). An administrator gives
 * the right to anyone; only the person concerned withdraws their own, and never when they are the last one.
 */
export function decideRoleChange(input: {
  actorId: number;
  target: { id: number; role: Role };
  requested: Role;
  adminCount: number;
}): Role | null {
  const { actorId, target, requested, adminCount } = input;
  if (target.role === requested) return null;
  if (requested === 'ADMIN') return 'ADMIN';
  if (actorId !== target.id) throw new AppError('USER_ROLE_CHANGE_FORBIDDEN');
  if (adminCount <= 1) throw new AppError('USER_LAST_ADMIN');
  return 'USER';
}

/** RG-04: the last administrator cannot delete their account. */
export function assertAccountDeletable(user: { role: Role }, adminCount: number): void {
  if (user.role === 'ADMIN' && adminCount <= 1) throw new AppError('USER_LAST_ADMIN');
}

export function createMembersService({ repository, clock, toUserView }: Dependencies) {
  return {
    /** F-10, RG-14: the route envelope has checked the administrator. */
    async list() {
      return (await repository.list()).map(toUserView);
    },

    async get(userId: number) {
      const member = await repository.find(userId);
      if (!member) throw new AppError('USER_NOT_FOUND');
      return toUserView(member);
    },

    /** F-10, RG-04: read and write in one serializable transaction, so the last administrator cannot disappear. */
    async setRole(actor: SessionUser, userId: number, role: Role) {
      const member = await repository.inRoleTransaction(async (tx) => {
        const target = await tx.find(userId);
        if (!target) throw new AppError('USER_NOT_FOUND');
        const decided = decideRoleChange({
          actorId: actor.id,
          target,
          requested: role,
          adminCount: await tx.countAdmins(),
        });
        return decided === null ? target : tx.setRole(userId, decided);
      });
      return toUserView(member);
    },

    /** F-11 scenario 3: lets the interface refuse the last administrator at the click, before any confirmation. */
    async checkAccountDeletion(actor: SessionUser) {
      await repository.inDeletionTransaction(async (tx) => {
        const self = await tx.find(actor.id);
        if (!self) throw new AppError('AUTH_REQUIRED');
        assertAccountDeletable(self, await tx.countAdmins());
      });
    },

    /**
     * F-11, RG-11: unstarted registrations are freed, the others lose their owner ("ancien membre"), then the whole
     * `User` row goes, so no personal data survives. Serializable, so two administrators cannot both leave (RG-04).
     */
    async deleteAccount(actor: SessionUser) {
      await repository.inDeletionTransaction(async (tx) => {
        const self = await tx.find(actor.id);
        if (!self) throw new AppError('AUTH_REQUIRED');
        assertAccountDeletable(self, await tx.countAdmins());
        await tx.deleteRegistrationsOfUnstartedSlots(actor.id, clock.now());
        await tx.anonymizeRegistrations(actor.id);
        await tx.deleteResetTokens(actor.id);
        await tx.deleteUser(actor.id);
      });
    },
  };
}

export type MembersService = ReturnType<typeof createMembersService>;
