import { AppError, type acceptInvitationInputSchema } from '@creno/validation';
import type { z } from 'zod';
import type { Clock } from '@/modules/shared';
import { generateInvitationToken, hashInvitationToken } from './invitation-token';
import type { CreatedUser, InvitationsRepository } from './invitations.repository';

type AcceptInput = z.output<typeof acceptInvitationInputSchema>;

interface Dependencies {
  repository: InvitationsRepository;
  clock: Clock;
  /** `APP_URL`: the link is built from it, never from the request. */
  appUrl: string;
  hashPassword: (password: string) => Promise<string>;
  /** `Set-Cookie` value that signs the new user in. */
  openSession: (user: { id: number; tokenVersion: number }) => Promise<string>;
  toUserView: (user: CreatedUser) => unknown;
}

/** RG-02: valid until the current start of the event (excluded); the start itself is already too late. */
export const isStillValid = (startsAt: Date, now: Date) => now < startsAt;

export function createInvitationsService({
  repository,
  clock,
  appUrl,
  hashPassword,
  openSession,
  toUserView,
}: Dependencies) {
  /** Unknown link, started event and deleted event (cascade) are the same answer (RG-02). */
  async function findValid(token: string) {
    const invitation = await repository.findByTokenHash(hashInvitationToken(token));
    if (!invitation || !isStillValid(invitation.event.startsAt, clock.now()))
      throw new AppError('INVITATION_INVALID');
    return invitation.event;
  }

  return {
    /**
     * F-01, RG-02: a new link on every call. The token is returned once, here; only its hash is stored. The validity
     * is not stored: it follows the start of the event, so a postponed event keeps its links.
     */
    async create(eventId: number) {
      const startsAt = await repository.findEventStart(eventId);
      if (!startsAt) throw new AppError('EVENT_NOT_FOUND');
      if (!isStillValid(startsAt, clock.now())) throw new AppError('EVENT_STARTED');

      const token = generateInvitationToken();
      await repository.create(eventId, hashInvitationToken(token));
      return {
        url: new URL(`/invitation/${token}`, appUrl).toString(),
        expiresAt: startsAt.toISOString(),
      };
    },

    /** F-01, RG-02: what the signup page shows. */
    async check(token: string) {
      const event = await findValid(token);
      const clubName = await repository.clubName();
      if (clubName === null) throw new AppError('INVITATION_INVALID');
      return { eventId: event.id, eventTitle: event.title, clubName };
    },

    /** F-01, RG-01, RG-02: creates an active `USER` and signs them in; `eventId` is where to send them. */
    async accept(token: string, input: AcceptInput) {
      const event = await findValid(token);
      // Hashed before the insert: argon2 takes tens of milliseconds
      const passwordHash = await hashPassword(input.password);
      const user = await repository.createUser({
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
      });
      if (!user) throw new AppError('USER_EMAIL_TAKEN');
      return {
        user: toUserView(user),
        eventId: event.id,
        sessionCookie: await openSession(user),
      };
    },
  };
}

export type InvitationsService = ReturnType<typeof createInvitationsService>;
