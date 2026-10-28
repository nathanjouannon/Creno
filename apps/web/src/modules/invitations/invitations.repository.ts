import { Prisma, type PrismaClient, type UserRole } from '@prisma/client';

export interface InvitationRecord {
  event: { id: number; title: string; startsAt: Date };
}

export interface CreatedUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  tokenVersion: number;
  createdAt: Date;
}

export interface NewMember {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
}

export function createInvitationsRepository(prisma: PrismaClient) {
  return {
    findEventStart: (eventId: number): Promise<Date | null> =>
      prisma.event
        .findUnique({ where: { id: eventId }, select: { startsAt: true } })
        .then((event) => event?.startsAt ?? null),

    create: async (eventId: number, tokenHash: string): Promise<void> => {
      await prisma.invitation.create({ data: { eventId, token: tokenHash } });
    },

    /** The event is read with the link, so its current start decides the validity (RG-02). */
    findByTokenHash: (tokenHash: string): Promise<InvitationRecord | null> =>
      prisma.invitation.findUnique({
        where: { token: tokenHash },
        select: { event: { select: { id: true, title: true, startsAt: true } } },
      }),

    clubName: (): Promise<string | null> =>
      prisma.club
        .findUnique({ where: { id: 1 }, select: { name: true } })
        .then((club) => club?.name ?? null),

    /**
     * RG-01: the unique index on lower(email) decides between two simultaneous accounts with the same address;
     * the loser gets `null`.
     */
    async createUser(member: NewMember): Promise<CreatedUser | null> {
      try {
        return await prisma.user.create({
          data: { ...member, role: 'USER' },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            tokenVersion: true,
            createdAt: true,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          return null;
        throw error;
      }
    },
  };
}

export type InvitationsRepository = ReturnType<typeof createInvitationsRepository>;
