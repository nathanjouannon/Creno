import { userIdParamsSchema } from '@creno/validation';
import { getPasswordResetService } from '@/modules/auth';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-10, RG-12, RG-14: administrators only (route envelope).
export const POST = route({ auth: 'admin', params: userIdParamsSchema }, async ({ params }) => ({
  status: 201,
  body: await getPasswordResetService().create(params.userId),
}));
