import { getAuthService } from '@/modules/auth';
import { getMembersService } from '@/modules/members';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

export const GET = route({ auth: 'user' }, async ({ user }) => ({
  body: await getAuthService().getCurrentUser(user),
}));

// F-11, RG-11: the confirmation is the interface's job (openapi.yaml); the cookie is erased with the account.
export const DELETE = route({ auth: 'user' }, async ({ user }) => {
  await getMembersService().deleteAccount(user);
  return { status: 204, headers: { 'Set-Cookie': getAuthService().closeSession() } };
});
