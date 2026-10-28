import { resetPasswordInputSchema, tokenParamsSchema } from '@creno/validation';
import { getPasswordResetService } from '@/modules/auth';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-02, RG-12: public. The 10 requests a minute per address of security.md apply (route envelope).
export const GET = route({ auth: 'optional', params: tokenParamsSchema }, async ({ params }) => ({
  body: await getPasswordResetService().check(params.token),
}));

// No session is opened: the user signs in with the new password.
export const POST = route(
  { auth: 'optional', params: tokenParamsSchema, body: resetPasswordInputSchema },
  async ({ params, body }) => {
    await getPasswordResetService().reset(params.token, body.password);
    return { status: 204 };
  },
);
