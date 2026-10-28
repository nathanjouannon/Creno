import { getMembersService } from '@/modules/members';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-11 scenario 3: nothing is deleted here, the interface only learns whether the click is refused (RG-04).
export const GET = route({ auth: 'user' }, async ({ user }) => {
  await getMembersService().checkAccountDeletion(user);
  return { status: 204 };
});
