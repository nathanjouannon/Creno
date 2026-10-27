import { setupInputSchema } from '@creno/validation';
import { getClubService } from '@/modules/club';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-19, RG-17: public, and answers 404 as soon as a user exists.
export const POST = route({ auth: 'optional', body: setupInputSchema }, async ({ body }) => {
  const { user, sessionCookie } = await getClubService().install(body);
  return { status: 201, body: user, headers: { 'Set-Cookie': sessionCookie } };
});
