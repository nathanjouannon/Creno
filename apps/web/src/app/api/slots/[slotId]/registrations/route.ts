import { slotIdParamsSchema } from '@creno/validation';
import { getRegistrationsService } from '@/modules/registrations';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-07, RG-07, RG-08: any signed-in user, administrators included; the rules live in the service.
export const POST = route(
  { auth: 'user', params: slotIdParamsSchema },
  async ({ user, params }) => ({
    status: 201,
    body: await getRegistrationsService().register(user, params.slotId),
  }),
);
