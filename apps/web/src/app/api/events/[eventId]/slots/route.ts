import { eventIdParamsSchema, slotInputSchema } from '@creno/validation';
import { getSlotsService } from '@/modules/slots';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-05, RG-14: administrators only (route envelope); RG-15: past events are read only.
export const POST = route(
  { auth: 'admin', params: eventIdParamsSchema, body: slotInputSchema },
  async ({ user, params, body }) => ({
    status: 201,
    body: await getSlotsService().create(user, params.eventId, body),
  }),
);
