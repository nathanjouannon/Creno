import { AppError, type slotInputSchema, type slotUpdateSchema } from '@creno/validation';
import type { z } from 'zod';
import { eventStatus } from '@/modules/events';
import type { Clock, SessionUser } from '@/modules/shared';
import { toSlotView } from './slot-view';
import type { SlotChanges, SlotsRepository } from './slots.repository';

interface Dependencies {
  repository: SlotsRepository;
  clock: Clock;
}

type SlotInput = z.output<typeof slotInputSchema>;
type SlotUpdate = z.output<typeof slotUpdateSchema>;

export function createSlotsService({ repository, clock }: Dependencies) {
  /** Administrators only reach this (route envelope, RG-14): a past event is read only (RG-15). */
  function assertEventEditable(event: { startsAt: Date; endsAt: Date }) {
    if (eventStatus(event, clock.now()) === 'past') throw new AppError('EVENT_PAST');
  }

  return {
    /** F-05, RG-07: the slot may exceed the dates of its event; the warning belongs to the interface. */
    async create(user: SessionUser, eventId: number, input: SlotInput) {
      const event = await repository.findEventTimes(eventId);
      if (!event) throw new AppError('EVENT_NOT_FOUND');
      assertEventEditable(event);

      const slot = await repository.create({
        eventId,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        capacity: input.capacity,
      });
      if (!slot) throw new AppError('EVENT_NOT_FOUND');
      return toSlotView(slot, clock.now(), user.id);
    },

    /** F-05, RG-07, RG-15. Registrations are kept; `capacity: null` makes the slot unlimited. */
    async update(user: SessionUser, slotId: number, input: SlotUpdate) {
      const slot = await repository.inSlotTransaction(async (tx) => {
        const current = await tx.findForChange(slotId);
        if (!current) throw new AppError('SLOT_NOT_FOUND');
        assertEventEditable(current.event);

        // RG-07 with the stored value for the date that is not sent
        const startsAt = input.startsAt ? new Date(input.startsAt) : current.startsAt;
        const endsAt = input.endsAt ? new Date(input.endsAt) : current.endsAt;
        if (endsAt <= startsAt) {
          throw new AppError('VALIDATION_ERROR', {
            fields: [{ field: 'endsAt', code: 'FIELD_END_NOT_AFTER_START' }],
          });
        }

        // RG-07: the limit is never lowered under the registrations, counted in the same transaction
        const { capacity } = input;
        if (capacity !== undefined && capacity !== null && capacity < current.registeredCount) {
          throw new AppError('SLOT_CAPACITY_BELOW_REGISTRATIONS', {
            registeredCount: current.registeredCount,
          });
        }

        const changes: SlotChanges = {};
        if (input.startsAt) changes.startsAt = startsAt;
        if (input.endsAt) changes.endsAt = endsAt;
        if (capacity !== undefined) changes.capacity = capacity;
        return tx.update(slotId, changes);
      });
      return toSlotView(slot, clock.now(), user.id);
    },

    /** F-05, RG-10, RG-15. The confirmation with the number of registrations belongs to the interface. */
    async remove(slotId: number) {
      const slot = await repository.findForChange(slotId);
      if (!slot) throw new AppError('SLOT_NOT_FOUND');
      assertEventEditable(slot.event);
      // RG-06: deleting the last slot keeps the event
      if (!(await repository.delete(slotId))) throw new AppError('SLOT_NOT_FOUND');
    },
  };
}

export type SlotsService = ReturnType<typeof createSlotsService>;
