import { displayName } from '@/modules/slots';

/**
 * A free slot as read from the database: a registration without slot (ADR-0016). Its event and times are nullable
 * for Prisma, but always set for this form of registration (CHECK registrations_kind_check).
 */
export interface FreeSlotSource {
  id: number;
  eventId: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  userId: number | null;
  user: { firstName: string; lastName: string } | null;
}

function timesOf(freeSlot: FreeSlotSource) {
  const { eventId, startsAt, endsAt } = freeSlot;
  if (eventId === null || startsAt === null || endsAt === null)
    throw new Error(`registration ${freeSlot.id} is not a free slot`);
  return { eventId, startsAt, endsAt };
}

/** RG-08, RG-20: a free slot has started from its exact start (`now >= startsAt`). Computed, never stored. */
export const freeSlotStarted = (freeSlot: { startsAt: Date }, now: Date) =>
  now >= freeSlot.startsAt;

/** The `FreeSlot` schema of openapi.yaml: computed state (RG-20) and the name to display (RG-09, RG-11). */
export function toFreeSlotView(freeSlot: FreeSlotSource, now: Date, viewerId: number) {
  const { eventId, startsAt, endsAt } = timesOf(freeSlot);
  return {
    id: freeSlot.id,
    eventId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    started: freeSlotStarted({ startsAt }, now),
    // RG-11: a former member has no user any more
    displayName: freeSlot.user ? displayName(freeSlot.user) : null,
    isMe: freeSlot.userId === viewerId,
  };
}

export type FreeSlotView = ReturnType<typeof toFreeSlotView>;
