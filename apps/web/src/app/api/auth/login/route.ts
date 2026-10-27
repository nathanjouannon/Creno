import { loginInputSchema } from '@creno/validation';
import { getLoginService } from '@/modules/auth';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-02, RG-03: public. The 10 requests a minute per address of security.md apply (route envelope).
export const POST = route({ auth: 'optional', body: loginInputSchema }, async ({ body, log }) => {
  const { user, sessionCookie } = await getLoginService().login(body, log);
  return { body: user, headers: { 'Set-Cookie': sessionCookie } };
});
