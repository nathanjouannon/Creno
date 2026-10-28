import { setUserRoleInputSchema, userIdParamsSchema } from '@creno/validation';
import { getMembersService } from '@/modules/members';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-10, RG-04, RG-14: administrators only (route envelope); the rule of who may withdraw a right is in the service.
export const PUT = route(
  { auth: 'admin', params: userIdParamsSchema, body: setUserRoleInputSchema },
  async ({ user, params, body }) => ({
    body: await getMembersService().setRole(user, params.userId, body.role),
  }),
);
