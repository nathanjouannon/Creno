import {
  AppError,
  type eventInputSchema,
  type eventUpdateSchema,
  type listEventsQuerySchema,
} from '@creno/validation';
import type { z } from 'zod';
import type { Clock, SessionUser } from '@/modules/shared';
import { eventStatus, toEventDetailView, toEventSummaryView } from './event-view';
import type { EventChanges, EventsRepository } from './events.repository';

interface Dependencies {
  repository: EventsRepository;
  clock: Clock;
}

type EventInput = z.output<typeof eventInputSchema>;
type EventUpdate = z.output<typeof eventUpdateSchema>;
type Scope = z.output<typeof listEventsQuerySchema>['scope'];

export function createEventsService({ repository, clock }: Dependencies) {
  /** Administrators only reach this: unknown event, or past one (RG-15, read only). */
  async function assertEditable(eventId: number) {
    const times = await repository.findTimes(eventId);
    if (!times) throw new AppError('EVENT_NOT_FOUND');
    if (eventStatus(times, clock.now()) === 'past') throw new AppError('EVENT_PAST');
    return times;
  }

  return {
    /** F-06, F-09, RG-09: `past` is for administrators only. */
    async list(user: SessionUser, scope: Scope) {
      if (scope === 'past' && user.role !== 'ADMIN') throw new AppError('FORBIDDEN');
      const now = clock.now();
      const events =
        scope === 'past' ? await repository.listPast(now) : await repository.listUpcoming(now);
      return events.map((event) => toEventSummaryView(event, now));
    },

    /** RG-09: a past event does not exist for a user; an administrator sees it (read only, RG-15). */
    async get(user: SessionUser, eventId: number) {
      const event = await repository.findDetail(eventId);
      const now = clock.now();
      if (!event || (eventStatus(event, now) === 'past' && user.role !== 'ADMIN'))
        throw new AppError('EVENT_NOT_FOUND');
      return toEventDetailView(event, now, user.id);
    },

    /** F-04, RG-06: slots are optional. The dates of a slot may exceed the event's (RG-07). */
    async create(user: SessionUser, input: EventInput) {
      const event = await repository.create({
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        slots: input.slots.map((slot) => ({
          startsAt: new Date(slot.startsAt),
          endsAt: new Date(slot.endsAt),
          capacity: slot.capacity,
          description: slot.description || null, // RG-07: blank = none
        })),
      });
      return toEventDetailView(event, clock.now(), user.id);
    },

    /** F-04, RG-06, RG-15. Registrations are kept. */
    async update(user: SessionUser, eventId: number, input: EventUpdate) {
      const current = await assertEditable(eventId);

      // RG-06 with the stored value for the date that is not sent
      const startsAt = input.startsAt ? new Date(input.startsAt) : current.startsAt;
      const endsAt = input.endsAt ? new Date(input.endsAt) : current.endsAt;
      if (endsAt <= startsAt) {
        throw new AppError('VALIDATION_ERROR', {
          fields: [{ field: 'endsAt', code: 'FIELD_END_NOT_AFTER_START' }],
        });
      }

      const changes: EventChanges = {};
      if (input.title !== undefined) changes.title = input.title;
      if (input.description !== undefined) changes.description = input.description;
      if (input.location !== undefined) changes.location = input.location;
      if (input.startsAt) changes.startsAt = startsAt;
      if (input.endsAt) changes.endsAt = endsAt;

      const event = await repository.update(eventId, changes);
      if (!event) throw new AppError('EVENT_NOT_FOUND');
      return toEventDetailView(event, clock.now(), user.id);
    },

    /** F-04, RG-10, RG-15. The confirmation with the number of registrations belongs to the interface. */
    async remove(eventId: number) {
      await assertEditable(eventId);
      if (!(await repository.delete(eventId))) throw new AppError('EVENT_NOT_FOUND');
    },
  };
}

export type EventsService = ReturnType<typeof createEventsService>;
