import { registrationIdParamsSchema } from '@creno/validation';
import { getRegistrationsService } from '@/modules/registrations';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-09, RG-08, RG-14: administrators only (route envelope); RG-15: past events are read only.
export const DELETE = route(
  { auth: 'admin', params: registrationIdParamsSchema },
  async ({ user, params }) => {
    await getRegistrationsService().removeRegistration(user, params.registrationId);
    return { status: 204 };
  },
);
