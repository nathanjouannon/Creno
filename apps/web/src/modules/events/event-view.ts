import { toFreeSlotView } from '@/modules/registrations';
import { toSlotView } from '@/modules/slots';
import type { EventDetailRecord, EventSummaryRecord } from './events.repository';

export type EventStatus = 'upcoming' | 'ongoing' | 'past';

/**
 * Computed, never stored (glossary): `upcoming` before the start, `ongoing` from the start (included) until the end
 * (excluded), `past` from the end (included). The instant of the end belongs to "past" (RG-09).
 */
export function eventStatus(event: { startsAt: Date; endsAt: Date }, now: Date): EventStatus {
  if (now >= event.endsAt) return 'past';
  if (now >= event.startsAt) return 'ongoing';
  return 'upcoming';
}

/** The `EventSummary` schema of openapi.yaml. */
export function toEventSummaryView(event: EventSummaryRecord, now: Date) {
  return {
    id: event.id,
    title: event.title,
    location: event.location,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    status: eventStatus(event, now),
    registrationMode: event.registrationMode,
    slotCount: event._count.slots,
  };
}

/**
 * The `EventDetail` schema: slots with their computed state and attendees (`toSlotView`), then the free slots
 * (`toFreeSlotView`, RG-20).
 */
export function toEventDetailView(event: EventDetailRecord, now: Date, viewerId: number) {
  return {
    id: event.id,
    title: event.title,
    location: event.location,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    status: eventStatus(event, now),
    registrationMode: event.registrationMode,
    slotCount: event.slots.length,
    slots: event.slots.map((slot) => toSlotView(slot, now, viewerId)),
    freeSlots: event.freeSlots.map((freeSlot) => toFreeSlotView(freeSlot, now, viewerId)),
  };
}
