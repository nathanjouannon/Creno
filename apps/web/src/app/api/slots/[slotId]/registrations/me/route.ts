import { slotIdParamsSchema } from '@creno/validation';
import { getRegistrationsService } from '@/modules/registrations';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-08, RG-08: the caller can only remove their own registration, so no other user's id is ever read.
export const DELETE = route(
  { auth: 'user', params: slotIdParamsSchema },
  async ({ user, params }) => {
    await getRegistrationsService().unregister(user, params.slotId);
    return { status: 204 };
  },
);
