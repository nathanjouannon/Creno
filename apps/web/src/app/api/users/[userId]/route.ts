import { userIdParamsSchema } from '@creno/validation';
import { getMembersService } from '@/modules/members';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-10, RG-14: administrators only (route envelope).
export const GET = route({ auth: 'admin', params: userIdParamsSchema }, async ({ params }) => ({
  body: await getMembersService().get(params.userId),
}));
