import { eventIdParamsSchema, freeSlotInputSchema } from '@creno/validation';
import { getRegistrationsService } from '@/modules/registrations';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-22, RG-20: the caller's own free slot, administrators included; no other user's id is ever read.
export const POST = route(
  { auth: 'user', params: eventIdParamsSchema, body: freeSlotInputSchema },
  async ({ user, params, body }) => ({
    status: 201,
    body: await getRegistrationsService().createFreeSlot(user, params.eventId, body),
  }),
);
