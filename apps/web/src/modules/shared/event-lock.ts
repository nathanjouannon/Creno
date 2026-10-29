import type { Prisma, RegistrationMode } from '@prisma/client';

/**
 * RG-19, RG-20 (ADR-0016, decision 9): first statement of the transactions that create a free slot, a fixed slot, or
 * change the mode of an event. It takes the row lock of the event until the transaction ends, so these writes queue
 * per event and each one reads the mode and the free slots committed by the previous one.
 *
 * Prisma sends no SQL for an update without data, so the lock is an update that writes back the mode just read, only
 * if it is still that mode: nothing changes, and a mode changed in between is read again. No raw SQL
 * (security.md, section 4). Used by repositories only. `null` when the event does not exist (any more).
 */
export async function lockEvent(
  client: Prisma.TransactionClient,
  eventId: number,
): Promise<RegistrationMode | null> {
  for (;;) {
    const event = await client.event.findUnique({
      where: { id: eventId },
      select: { registrationMode: true },
    });
    if (!event) return null;
    const { registrationMode } = event;
    const { count } = await client.event.updateMany({
      where: { id: eventId, registrationMode },
      data: { registrationMode },
    });
    if (count === 1) return registrationMode;
  }
}
