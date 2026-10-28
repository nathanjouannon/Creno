import { updateProfileInputSchema } from '@creno/validation';
import { getAuthService } from '@/modules/auth';
import { getMembersService } from '@/modules/members';
import { getMeService } from '@/modules/me';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

export const GET = route({ auth: 'user' }, async ({ user }) => ({
  body: await getAuthService().getCurrentUser(user),
}));

// F-20, RG-18: the owner only; the new address asks for the current password (the service decides).
export const PATCH = route(
  { auth: 'user', body: updateProfileInputSchema },
  async ({ user, body }) => ({
    body: await getMeService().updateProfile(user, body),
  }),
);

// F-11, RG-11: the confirmation is the interface's job (openapi.yaml); the cookie is erased with the account.
export const DELETE = route({ auth: 'user' }, async ({ user }) => {
  await getMembersService().deleteAccount(user);
  return { status: 204, headers: { 'Set-Cookie': getAuthService().closeSession() } };
});
