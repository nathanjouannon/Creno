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

/** « Prénom N. » (RG-09). */
export function displayName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${[...user.lastName.trim()][0]?.toUpperCase() ?? ''}.`;
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
    slotCount: event._count.slots,
  };
}

/** The `EventDetail` schema: slots with their computed state (RG-07, RG-08) and attendees (RG-09, RG-11). */
export function toEventDetailView(event: EventDetailRecord, now: Date, viewerId: number) {
  return {
    id: event.id,
    title: event.title,
    location: event.location,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    status: eventStatus(event, now),
    slotCount: event.slots.length,
    slots: event.slots.map((slot) => {
      const registeredCount = slot.registrations.length;
      const limited = slot.capacity !== null;
      return {
        id: slot.id,
        eventId: slot.eventId,
        startsAt: slot.startsAt.toISOString(),
        endsAt: slot.endsAt.toISOString(),
        capacity: slot.capacity,
        registeredCount,
        remainingPlaces: limited ? Math.max(slot.capacity! - registeredCount, 0) : null,
        full: limited && registeredCount >= slot.capacity!,
        started: now >= slot.startsAt,
        attendees: slot.registrations.map((registration) => ({
          registrationId: registration.id,
          // RG-11: a former member has no user any more
          displayName: registration.user ? displayName(registration.user) : null,
          isMe: registration.userId === viewerId,
        })),
      };
    }),
  };
}
