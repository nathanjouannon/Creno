import { freeSlotIdParamsSchema } from '@creno/validation';
import { getRegistrationsService } from '@/modules/registrations';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-22, RG-08, RG-20: the caller removes only their own free slot; an administrator removes another's through
// DELETE /registrations/{registrationId}.
export const DELETE = route(
  { auth: 'user', params: freeSlotIdParamsSchema },
  async ({ user, params }) => {
    await getRegistrationsService().deleteFreeSlot(user, params.freeSlotId);
    return { status: 204 };
  },
);
