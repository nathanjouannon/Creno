import {
  AppError,
  FREE_SLOT_MIN_MINUTES,
  type ErrorCode,
  type FieldErrorCode,
  type freeSlotInputSchema,
} from '@creno/validation';
import type { z } from 'zod';
import { eventStatus } from '@/modules/events';
import type { Clock, SessionUser } from '@/modules/shared';
import { toSlotView } from '@/modules/slots';
import { freeSlotStarted, toFreeSlotView } from './free-slot-view';
import type {
  EventForFreeSlot,
  RegistrationsRepository,
  SlotForRegistration,
} from './registrations.repository';

interface Dependencies {
  repository: RegistrationsRepository;
  clock: Clock;
}

type EventTimes = { startsAt: Date; endsAt: Date };
type FreeSlotInput = z.output<typeof freeSlotInputSchema>;
type Range = { startsAt: Date; endsAt: Date };

/**
 * RG-09: a past event does not exist for a user, who gets `notFound`; RG-15: an administrator sees it, read only.
 * Shared by every write below.
 */
export function assertEventOpen(
  event: EventTimes,
  user: SessionUser,
  now: Date,
  notFound: ErrorCode = 'SLOT_NOT_FOUND',
): void {
  if (eventStatus(event, now) !== 'past') return;
  throw new AppError(user.role === 'ADMIN' ? 'EVENT_PAST' : notFound);
}

/** RG-20: two ranges overlap when each starts before the other ends; touching ranges do not. */
export const overlaps = (a: Range, b: Range) => a.startsAt < b.endsAt && b.startsAt < a.endsAt;

/**
 * RG-20: the field errors of a free slot that depend on its event and on the current time (the schema already
 * checked the format, the order and the length; they are checked again so the rule holds without it). At most one
 * code per field, the bounds of the event first.
 */
export function freeSlotFieldErrors(
  range: Range,
  event: EventTimes,
  now: Date,
): { field: 'startsAt' | 'endsAt'; code: FieldErrorCode }[] {
  const codes: { startsAt?: FieldErrorCode; endsAt?: FieldErrorCode } = {};
  const { startsAt, endsAt } = range;
  if (endsAt <= startsAt) codes.endsAt = 'FIELD_END_NOT_AFTER_START';
  // No tolerance outside the event, unlike a fixed slot (RG-07)
  if (startsAt < event.startsAt || startsAt >= event.endsAt)
    codes.startsAt = 'FIELD_FREE_SLOT_OUT_OF_EVENT';
  if (endsAt > event.endsAt || endsAt <= event.startsAt)
    codes.endsAt ??= 'FIELD_FREE_SLOT_OUT_OF_EVENT';
  // RG-08: the start must be strictly after the current time
  if (startsAt <= now) codes.startsAt ??= 'FIELD_START_NOT_IN_FUTURE';
  if (endsAt.getTime() - startsAt.getTime() < FREE_SLOT_MIN_MINUTES * 60_000)
    codes.endsAt ??= 'FIELD_FREE_SLOT_TOO_SHORT';
  return (['startsAt', 'endsAt'] as const).flatMap((field) => {
    const code = codes[field];
    return code ? [{ field, code }] : [];
  });
}

/** Rules of RG-09, RG-15, RG-19 and RG-20 for a new free slot; throws the catalog error that applies. */
export function assertCanCreateFreeSlot(
  event: EventForFreeSlot,
  range: Range,
  user: SessionUser,
  now: Date,
): void {
  assertEventOpen(event, user, now, 'EVENT_NOT_FOUND');
  // RG-19: only FREE and BOTH accept free slots
  if (event.registrationMode === 'FIXED') throw new AppError('EVENT_FREE_SLOTS_NOT_ALLOWED');
  const fields = freeSlotFieldErrors(range, event, now);
  if (fields.length > 0) throw new AppError('VALIDATION_ERROR', { fields });
  // RG-20: never two free slots of the same user over the same time in one event
  const overlapping = event.userFreeSlots.find((freeSlot) => overlaps(freeSlot, range));
  if (overlapping) throw new AppError('FREE_SLOT_OVERLAP', { freeSlotId: overlapping.id });
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
     * F-22, RG-19, RG-20: the caller's own free slot, administrators included. Decided after the event row lock,
     * so a simultaneous overlapping request or mode change is seen (ADR-0016).
     */
    async createFreeSlot(user: SessionUser, eventId: number, input: FreeSlotInput) {
      const range = { startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) };
      const freeSlot = await repository.inEventTransaction(eventId, async (tx) => {
        const event = await tx.findEventForFreeSlot(eventId, user.id);
        if (!event) throw new AppError('EVENT_NOT_FOUND');
        assertCanCreateFreeSlot(event, range, user, clock.now());
        return tx.createFreeSlot({ eventId, userId: user.id, ...range });
      });
      if (!freeSlot) throw new AppError('EVENT_NOT_FOUND');
      return toFreeSlotView(freeSlot, clock.now(), user.id);
    },

    /**
     * F-22, RG-08, RG-20: only one's own free slot, only before its start. Somebody else's free slot answers « not
     * found », whoever asks; an administrator removes it through `removeRegistration`.
     */
    async deleteFreeSlot(user: SessionUser, freeSlotId: number) {
      const freeSlot = await repository.findFreeSlot(freeSlotId);
      if (!freeSlot || freeSlot.userId !== user.id) throw new AppError('FREE_SLOT_NOT_FOUND');
      const now = clock.now();
      assertEventOpen(freeSlot.event, user, now, 'FREE_SLOT_NOT_FOUND');
      if (freeSlotStarted(freeSlot, now)) throw new AppError('FREE_SLOT_STARTED', { freeSlotId });
      if (!(await repository.deleteUserFreeSlot(freeSlotId, user.id))) {
        throw new AppError('FREE_SLOT_NOT_FOUND');
      }
    },

    /**
     * F-09, F-22, RG-08, RG-15: administrators only (route envelope, RG-14). Fixed or free slot, even started, as
     * long as the event is not past.
     */
    async removeRegistration(user: SessionUser, registrationId: number) {
      const registration = await repository.findRegistration(registrationId);
      if (!registration) throw new AppError('REGISTRATION_NOT_FOUND');
      assertEventOpen(registration.event, user, clock.now());
      if (!(await repository.deleteRegistration(registrationId))) {
        throw new AppError('REGISTRATION_NOT_FOUND');
      }
    },
  };
}

export type RegistrationsService = ReturnType<typeof createRegistrationsService>;
