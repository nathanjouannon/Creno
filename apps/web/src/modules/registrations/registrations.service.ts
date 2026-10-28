import { AppError } from '@creno/validation';
import { eventStatus } from '@/modules/events';
import type { Clock, SessionUser } from '@/modules/shared';
import { toSlotView } from '@/modules/slots';
import type { RegistrationsRepository, SlotForRegistration } from './registrations.repository';

interface Dependencies {
  repository: RegistrationsRepository;
  clock: Clock;
}

type EventTimes = { startsAt: Date; endsAt: Date };

/**
 * RG-09: a past event does not exist for a user; RG-15: an administrator sees it, read only.
 * Shared by every write below.
 */
export function assertEventOpen(event: EventTimes, user: SessionUser, now: Date): void {
  if (eventStatus(event, now) !== 'past') return;
  throw new AppError(user.role === 'ADMIN' ? 'EVENT_PAST' : 'SLOT_NOT_FOUND');
}

/** RG-08: the slot has started from its exact start (`now >= startsAt`). */
export function assertSlotNotStarted(slot: { id: number; startsAt: Date }, now: Date): void {
  if (now >= slot.startsAt) throw new AppError('SLOT_STARTED', { slotId: slot.id });
}

/** Rules of RG-07, RG-08, RG-09 and RG-15 for a registration; throws the catalog error that applies. */
export function assertCanRegister(slot: SlotForRegistration, user: SessionUser, now: Date): void {
  assertEventOpen(slot.event, user, now);
  assertSlotNotStarted(slot, now);
  if (slot.registeredUserIds.includes(user.id)) {
    throw new AppError('REGISTRATION_ALREADY_EXISTS', { slotId: slot.id });
  }
  // RG-07: an unlimited slot (capacity null) is never full
  if (slot.capacity !== null && slot.registeredUserIds.length >= slot.capacity) {
    throw new AppError('SLOT_FULL', { slotId: slot.id });
  }
}

export function createRegistrationsService({ repository, clock }: Dependencies) {
  return {
    /** F-07, RG-07, RG-08: administrators register like any user (F-07 S4 ter). */
    async register(user: SessionUser, slotId: number) {
      const slot = await repository.inSlotTransaction(slotId, async (tx) => {
        const current = await tx.findSlotForRegistration(slotId);
        if (!current) throw new AppError('SLOT_NOT_FOUND');
        assertCanRegister(current, user, clock.now());

        // The unique (slot, user) pair is the last guard against a double registration (RG-08)
        if (!(await tx.createRegistration(slotId, user.id))) {
          throw new AppError('REGISTRATION_ALREADY_EXISTS', { slotId });
        }
        return tx.findSlot(slotId);
      });
      if (!slot) throw new AppError('SLOT_NOT_FOUND');
      return toSlotView(slot, clock.now(), user.id);
    },

    /** F-08, RG-08: only before the start. The confirmation belongs to the interface. */
    async unregister(user: SessionUser, slotId: number) {
      const slot = await repository.findSlotForUnregistration(slotId);
      if (!slot) throw new AppError('SLOT_NOT_FOUND');
      const now = clock.now();
      assertEventOpen(slot.event, user, now);
      assertSlotNotStarted(slot, now);
      if (!(await repository.deleteUserRegistration(slotId, user.id))) {
        throw new AppError('REGISTRATION_NOT_FOUND');
      }
    },

    /**
     * F-09, RG-08, RG-15: administrators only (route envelope, RG-14). Allowed on a started slot, as long as the
     * event is not past.
     */
    async removeRegistration(user: SessionUser, registrationId: number) {
      const registration = await repository.findRegistration(registrationId);
      if (!registration) throw new AppError('REGISTRATION_NOT_FOUND');
      assertEventOpen(registration.slot.event, user, clock.now());
      if (!(await repository.deleteRegistration(registrationId))) {
        throw new AppError('REGISTRATION_NOT_FOUND');
      }
    },
  };
}

export type RegistrationsService = ReturnType<typeof createRegistrationsService>;
