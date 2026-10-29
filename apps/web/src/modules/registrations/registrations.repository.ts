import { Prisma, type PrismaClient, type RegistrationMode } from '@prisma/client';
import { lockEvent } from '@/modules/shared';
import type { FreeSlotSource } from './free-slot-view';

// The slot as the view needs it, registrations in order (RG-09).
const slotInclude = {
  registrations: {
    orderBy: { id: 'asc' },
    select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } },
  },
} satisfies Prisma.SlotInclude;

export type RegisteredSlotRecord = Prisma.SlotGetPayload<{ include: typeof slotInclude }>;

/** A slot with what the registration rules need: its event times (RG-15) and who is registered (RG-07, RG-08). */
export interface SlotForRegistration {
  id: number;
  startsAt: Date;
  capacity: number | null;
  event: { startsAt: Date; endsAt: Date };
  registeredUserIds: (number | null)[];
}

type EventTimes = { startsAt: Date; endsAt: Date };

/** A registration (fixed or free slot) with the event the rules read (RG-15). */
export interface RegistrationForRemoval {
  id: number;
  userId: number | null;
  event: EventTimes;
}

/** An event with what the free slot rules need (RG-19, RG-20): its dates, its mode and the caller's free slots. */
export interface EventForFreeSlot extends EventTimes {
  registrationMode: RegistrationMode;
  userFreeSlots: { id: number; startsAt: Date; endsAt: Date }[];
}

/** A free slot with what its removal needs: owner, start (RG-08) and event (RG-15). */
export interface FreeSlotForRemoval {
  id: number;
  userId: number | null;
  startsAt: Date;
  event: EventTimes;
}

export interface NewFreeSlot {
  eventId: number;
  userId: number;
  startsAt: Date;
  endsAt: Date;
}

export interface FreeSlotTransaction {
  findEventForFreeSlot(eventId: number, userId: number): Promise<EventForFreeSlot | null>;
  createFreeSlot(freeSlot: NewFreeSlot): Promise<FreeSlotSource>;
}

// A free slot as the view needs it (RG-09)
const freeSlotSelect = {
  id: true,
  eventId: true,
  startsAt: true,
  endsAt: true,
  userId: true,
  user: { select: { firstName: true, lastName: true } },
} satisfies Prisma.RegistrationSelect;

export interface RegistrationTransaction {
  /** `null` when the slot does not exist. */
  findSlotForRegistration(slotId: number): Promise<SlotForRegistration | null>;
  /** `false` when the user is already registered (unique slot + user, RG-08). */
  createRegistration(slotId: number, userId: number): Promise<boolean>;
  findSlot(slotId: number): Promise<RegisteredSlotRecord>;
}

const isPrismaError = (error: unknown, code: string) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

export function createRegistrationsRepository(prisma: PrismaClient) {
  return {
    /**
     * RG-07: the first statement updates the slot row without changing it (`capacity + 0`), which takes its row lock until the
     * transaction ends. Concurrent registrations to the same slot queue behind it, and each one counts the
     * registrations committed by the previous one (read committed re-reads after the wait). No retry loop, so
     * no request fails for contention, and no raw SQL (security.md, section 4). The decision stays in the service.
     */
    async inSlotTransaction<T>(
      slotId: number,
      work: (tx: RegistrationTransaction) => Promise<T>,
    ): Promise<T | null> {
      try {
        return await prisma.$transaction(async (client) => {
          await client.slot.update({
            where: { id: slotId },
            data: { capacity: { increment: 0 } },
            select: { id: true },
          });
          return work({
            async findSlotForRegistration(id) {
              const slot = await client.slot.findUnique({
                where: { id },
                select: {
                  id: true,
                  startsAt: true,
                  capacity: true,
                  event: { select: { startsAt: true, endsAt: true } },
                  registrations: { select: { userId: true } },
                },
              });
              return (
                slot && {
                  id: slot.id,
                  startsAt: slot.startsAt,
                  capacity: slot.capacity,
                  event: slot.event,
                  registeredUserIds: slot.registrations.map((r) => r.userId),
                }
              );
            },
            async createRegistration(id, userId) {
              try {
                await client.registration.create({ data: { slotId: id, userId } });
                return true;
              } catch (error) {
                if (isPrismaError(error, 'P2002')) return false;
                throw error;
              }
            },
            findSlot: (id) =>
              client.slot.findUniqueOrThrow({ where: { id }, include: slotInclude }),
          });
        });
      } catch (error) {
        // P2025: the slot was deleted before the lock was taken
        if (isPrismaError(error, 'P2025')) return null;
        throw error;
      }
    },

    /**
     * RG-19, RG-20 (ADR-0016): the event row lock comes first (`lockEvent`), so two free slots of one user, or a free
     * slot and a mode change, are decided one after the other on committed data. `null` when the event does not
     * exist. The decision stays in the service.
     */
    async inEventTransaction<T>(
      eventId: number,
      work: (tx: FreeSlotTransaction) => Promise<T>,
    ): Promise<T | null> {
      return prisma.$transaction(async (client) => {
        if (!(await lockEvent(client, eventId))) return null;
        return work({
          async findEventForFreeSlot(id, userId) {
            const event = await client.event.findUnique({
              where: { id },
              select: {
                startsAt: true,
                endsAt: true,
                registrationMode: true,
                freeSlots: {
                  where: { userId },
                  select: { id: true, startsAt: true, endsAt: true },
                },
              },
            });
            if (!event) return null;
            const { freeSlots, ...rest } = event;
            return {
              ...rest,
              // CHECK registrations_kind_check: a free slot always has its times
              userFreeSlots: freeSlots.flatMap(({ id: freeSlotId, startsAt, endsAt }) =>
                startsAt && endsAt ? [{ id: freeSlotId, startsAt, endsAt }] : [],
              ),
            };
          },
          createFreeSlot: (freeSlot) =>
            client.registration.create({ data: freeSlot, select: freeSlotSelect }),
        });
      });
    },

    async findFreeSlot(id: number): Promise<FreeSlotForRemoval | null> {
      const freeSlot = await prisma.registration.findFirst({
        where: { id, slotId: null },
        select: {
          id: true,
          userId: true,
          startsAt: true,
          event: { select: { startsAt: true, endsAt: true } },
        },
      });
      if (!freeSlot?.startsAt || !freeSlot.event) return null;
      return { ...freeSlot, startsAt: freeSlot.startsAt, event: freeSlot.event };
    },

    async deleteUserFreeSlot(id: number, userId: number): Promise<boolean> {
      const { count } = await prisma.registration.deleteMany({
        where: { id, userId, slotId: null },
      });
      return count > 0;
    },

    findSlotForUnregistration: (slotId: number) =>
      prisma.slot.findUnique({
        where: { id: slotId },
        select: { id: true, startsAt: true, event: { select: { startsAt: true, endsAt: true } } },
      }),

    async deleteUserRegistration(slotId: number, userId: number): Promise<boolean> {
      const { count } = await prisma.registration.deleteMany({ where: { slotId, userId } });
      return count > 0;
    },

    /** A registration on a fixed slot (event of its slot) or a free slot (its own event). */
    async findRegistration(id: number): Promise<RegistrationForRemoval | null> {
      const times = { select: { startsAt: true, endsAt: true } };
      const registration = await prisma.registration.findUnique({
        where: { id },
        select: { id: true, userId: true, slot: { select: { event: times } }, event: times },
      });
      const event = registration?.slot?.event ?? registration?.event;
      return registration && event
        ? { id: registration.id, userId: registration.userId, event }
        : null;
    },

    async deleteRegistration(id: number): Promise<boolean> {
      const { count } = await prisma.registration.deleteMany({ where: { id } });
      return count > 0;
    },
  };
}

export type RegistrationsRepository = ReturnType<typeof createRegistrationsRepository>;
