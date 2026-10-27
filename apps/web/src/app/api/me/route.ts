import { getAuthService } from '@/modules/auth';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

export const GET = route({ auth: 'user' }, async ({ user }) => ({
  body: await getAuthService().getCurrentUser(user),
}));
