import { Prisma, type PrismaClient } from '@prisma/client';

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

/** A registration with the times the rules read: its slot (RG-08) and the event of that slot (RG-15). */
export interface RegistrationForRemoval {
  id: number;
  slotId: number;
  userId: number | null;
  slot: { startsAt: Date; event: { startsAt: Date; endsAt: Date } };
}

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

    findSlotForUnregistration: (slotId: number) =>
      prisma.slot.findUnique({
        where: { id: slotId },
        select: { id: true, startsAt: true, event: { select: { startsAt: true, endsAt: true } } },
      }),

    async deleteUserRegistration(slotId: number, userId: number): Promise<boolean> {
      const { count } = await prisma.registration.deleteMany({ where: { slotId, userId } });
      return count > 0;
    },

    findRegistration: (id: number): Promise<RegistrationForRemoval | null> =>
      prisma.registration.findUnique({
        where: { id },
        select: {
          id: true,
          slotId: true,
          userId: true,
          slot: {
            select: { startsAt: true, event: { select: { startsAt: true, endsAt: true } } },
          },
        },
      }),

    async deleteRegistration(id: number): Promise<boolean> {
      const { count } = await prisma.registration.deleteMany({ where: { id } });
      return count > 0;
    },
  };
}

export type RegistrationsRepository = ReturnType<typeof createRegistrationsRepository>;
