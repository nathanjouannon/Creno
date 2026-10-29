import { Prisma, type PrismaClient, type RegistrationMode } from '@prisma/client';
import { lockEvent } from '@/modules/shared';

// Registrations in order, with the name to display (RG-09).
const slotInclude = {
  registrations: {
    orderBy: { id: 'asc' },
    select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } },
  },
} satisfies Prisma.SlotInclude;

export type SlotRecord = Prisma.SlotGetPayload<{ include: typeof slotInclude }>;

/** A slot with what the rules need: the dates of its event (RG-15) and its number of registrations (RG-07). */
export interface SlotForChange {
  id: number;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  registeredCount: number;
  event: { startsAt: Date; endsAt: Date };
}

export interface NewSlot {
  eventId: number;
  startsAt: Date;
  endsAt: Date;
  capacity: number | null;
  description: string | null;
}

export type SlotChanges = Partial<
  Pick<NewSlot, 'startsAt' | 'endsAt' | 'capacity' | 'description'>
>;

/** The event of a new slot: its dates (RG-15) and its mode (RG-19). */
export interface EventForSlot {
  startsAt: Date;
  endsAt: Date;
  registrationMode: RegistrationMode;
}

export interface SlotCreationTransaction {
  findEvent(eventId: number): Promise<EventForSlot | null>;
  create(slot: NewSlot): Promise<SlotRecord>;
}

export interface SlotTransaction {
  findForChange(id: number): Promise<SlotForChange | null>;
  update(id: number, changes: SlotChanges): Promise<SlotRecord>;
}

const RETRIES = 6;

const isPrismaError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

function findForChange(client: Prisma.TransactionClient | PrismaClient, id: number) {
  return client.slot
    .findUnique({
      where: { id },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        capacity: true,
        event: { select: { startsAt: true, endsAt: true } },
        _count: { select: { registrations: true } },
      },
    })
    .then(
      (slot): SlotForChange | null =>
        slot && {
          id: slot.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          capacity: slot.capacity,
          registeredCount: slot._count.registrations,
          event: slot.event,
        },
    );
}

export function createSlotsRepository(prisma: PrismaClient) {
  return {
    findForChange: (id: number) => findForChange(prisma, id),

    /**
     * RG-19 (ADR-0016): the event row lock comes first (`lockEvent`), as for a mode change, so a slot is never
     * created in a mode that no longer accepts it. `null` when the event does not exist (any more). The decision
     * stays in the service.
     */
    async inEventTransaction<T>(
      eventId: number,
      work: (tx: SlotCreationTransaction) => Promise<T>,
    ): Promise<T | null> {
      return prisma.$transaction(async (client) => {
        if (!(await lockEvent(client, eventId))) return null;
        return work({
          findEvent: (id) =>
            client.event.findUnique({
              where: { id },
              select: { startsAt: true, endsAt: true, registrationMode: true },
            }),
          create: (slot) => client.slot.create({ data: slot, include: slotInclude }),
        });
      });
    },

    /**
     * Read, decide and write as one serializable unit, replayed on a serialization failure: a registration
     * committed meanwhile is counted before the new limit is accepted (RG-07). The decision stays in the service.
     */
    async inSlotTransaction<T>(work: (tx: SlotTransaction) => Promise<T>): Promise<T> {
      for (let attempt = 1; ; attempt++) {
        try {
          return await prisma.$transaction(
            (client) =>
              work({
                findForChange: (id) => findForChange(client, id),
                update: (id, changes) =>
                  client.slot.update({ where: { id }, data: changes, include: slotInclude }),
              }),
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          );
        } catch (error) {
          if (!isPrismaError(error, 'P2034') || attempt >= RETRIES) throw error;
        }
      }
    },

    /** Registrations go with it (RG-10, ON DELETE CASCADE); the event is kept (RG-06). */
    async delete(id: number): Promise<boolean> {
      const { count } = await prisma.slot.deleteMany({ where: { id } });
      return count > 0;
    },
  };
}

export type SlotsRepository = ReturnType<typeof createSlotsRepository>;
