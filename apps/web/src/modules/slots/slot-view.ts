/** What the view needs from a slot and its registrations, whatever the query that read it. */
export interface SlotViewSource {
  id: number;
  eventId: number;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  description: string | null;
  registrations: {
    id: number;
    userId: number | null;
    user: { firstName: string; lastName: string } | null;
  }[];
}

export interface SlotState {
  registeredCount: number;
  remainingPlaces: number | null;
  full: boolean;
  started: boolean;
}

/**
 * Computed, never stored (glossary). RG-07: `capacity: null` is unlimited, so never full and without a remaining
 * count. RG-08: the slot has started from its exact start (`now >= startsAt`).
 */
export function slotState(
  slot: { startsAt: Date; capacity: number | null },
  registeredCount: number,
  now: Date,
): SlotState {
  const { capacity } = slot;
  return {
    registeredCount,
    remainingPlaces: capacity === null ? null : Math.max(capacity - registeredCount, 0),
    full: capacity !== null && registeredCount >= capacity,
    started: now >= slot.startsAt,
  };
}

/** « Prénom N. » (RG-09). */
export function displayName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${[...user.lastName.trim()][0]?.toUpperCase() ?? ''}.`;
}

/** The `Slot` schema of openapi.yaml: computed state (RG-07, RG-08) and attendees (RG-09, RG-11). */
export function toSlotView(slot: SlotViewSource, now: Date, viewerId: number) {
  return {
    id: slot.id,
    eventId: slot.eventId,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    capacity: slot.capacity,
    description: slot.description,
    ...slotState(slot, slot.registrations.length, now),
    attendees: slot.registrations.map((registration) => ({
      registrationId: registration.id,
      // RG-11: a former member has no user any more
      displayName: registration.user ? displayName(registration.user) : null,
      isMe: registration.userId === viewerId,
    })),
  };
}

export type SlotView = ReturnType<typeof toSlotView>;
