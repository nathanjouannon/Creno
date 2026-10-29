import { Prisma, type PrismaClient, type RegistrationMode } from '@prisma/client';
import { lockEvent } from '@/modules/shared';

// Event with its slots and, for each slot, who is registered (RG-09: names are visible to everybody), then its free
// slots by start, end and id (RG-20).
const detailInclude = {
  freeSlots: {
    orderBy: [{ startsAt: 'asc' }, { endsAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      eventId: true,
      startsAt: true,
      endsAt: true,
      userId: true,
      user: { select: { firstName: true, lastName: true } },
    },
  },
  slots: {
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    include: {
      registrations: {
        orderBy: { id: 'asc' },
        select: {
          id: true,
          userId: true,
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  },
} satisfies Prisma.EventInclude;

const summaryInclude = { _count: { select: { slots: true } } } satisfies Prisma.EventInclude;

export type EventDetailRecord = Prisma.EventGetPayload<{ include: typeof detailInclude }>;
export type EventSummaryRecord = Prisma.EventGetPayload<{ include: typeof summaryInclude }>;

export interface NewEvent {
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  registrationMode: RegistrationMode;
  slots: { startsAt: Date; endsAt: Date; capacity: number | null; description: string | null }[];
}

export type EventChanges = Partial<Omit<NewEvent, 'slots'>>;

/** An event with what a change needs: its dates (RG-06, RG-15), its mode and what it contains (RG-19). */
export interface EventForChange {
  startsAt: Date;
  endsAt: Date;
  registrationMode: RegistrationMode;
  slotCount: number;
  freeSlotCount: number;
}

export interface EventTransaction {
  findForChange(id: number): Promise<EventForChange | null>;
  update(id: number, changes: EventChanges): Promise<EventDetailRecord>;
}

/** Prisma "record to update/delete does not exist": somebody deleted the event in between. */
const isMissing = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025';

export function createEventsRepository(prisma: PrismaClient) {
  return {
    /** RG-09: upcoming = not over yet (upcoming and ongoing), by start; past = over, most recent first. */
    listUpcoming: (now: Date): Promise<EventSummaryRecord[]> =>
      prisma.event.findMany({
        where: { endsAt: { gt: now } },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        include: summaryInclude,
      }),

    listPast: (now: Date): Promise<EventSummaryRecord[]> =>
      prisma.event.findMany({
        where: { endsAt: { lte: now } },
        orderBy: [{ endsAt: 'desc' }, { id: 'desc' }],
        include: summaryInclude,
      }),

    findDetail: (id: number): Promise<EventDetailRecord | null> =>
      prisma.event.findUnique({ where: { id }, include: detailInclude }),

    findTimes: (id: number): Promise<{ startsAt: Date; endsAt: Date } | null> =>
      prisma.event.findUnique({ where: { id }, select: { startsAt: true, endsAt: true } }),

    /** The event and its slots are written in one transaction: either all of it exists, or nothing (F-04). */
    create: ({ slots, ...event }: NewEvent): Promise<EventDetailRecord> =>
      prisma.event.create({
        data: { ...event, slots: { create: slots } },
        include: detailInclude,
      }),

    /**
     * RG-19 (ADR-0016): the event row lock comes first (`lockEvent`), as for the creation of a slot or a free slot,
     * so a mode change and a simultaneous creation are decided one after the other. Registrations are not touched
     * (F-04 S4). `null` when the event does not exist (any more). The decision stays in the service.
     */
    async inEventTransaction<T>(
      eventId: number,
      work: (tx: EventTransaction) => Promise<T>,
    ): Promise<T | null> {
      try {
        return await prisma.$transaction(async (client) => {
          if (!(await lockEvent(client, eventId))) return null;
          return work({
            async findForChange(id) {
              const event = await client.event.findUnique({
                where: { id },
                select: {
                  startsAt: true,
                  endsAt: true,
                  registrationMode: true,
                  _count: { select: { slots: true, freeSlots: true } },
                },
              });
              if (!event) return null;
              const { _count, ...rest } = event;
              return { ...rest, slotCount: _count.slots, freeSlotCount: _count.freeSlots };
            },
            update: (id, changes) =>
              client.event.update({ where: { id }, data: changes, include: detailInclude }),
          });
        });
      } catch (error) {
        if (isMissing(error)) return null;
        throw error;
      }
    },

    /** Slots, registrations and invitations go with it (RG-10, ON DELETE CASCADE). */
    async delete(id: number): Promise<boolean> {
      const { count } = await prisma.event.deleteMany({ where: { id } });
      return count > 0;
    },
  };
}

export type EventsRepository = ReturnType<typeof createEventsRepository>;
