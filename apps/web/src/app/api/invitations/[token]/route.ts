import { acceptInvitationInputSchema, tokenParamsSchema } from '@creno/validation';
import { getInvitationsService } from '@/modules/invitations';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-01, RG-02: public. The 10 requests a minute per address of security.md apply (route envelope).
export const GET = route({ auth: 'optional', params: tokenParamsSchema }, async ({ params }) => ({
  body: await getInvitationsService().check(params.token),
}));

export const POST = route(
  { auth: 'optional', params: tokenParamsSchema, body: acceptInvitationInputSchema },
  async ({ params, body }) => {
    const { user, eventId, sessionCookie } = await getInvitationsService().accept(
      params.token,
      body,
    );
    return { status: 201, body: { user, eventId }, headers: { 'Set-Cookie': sessionCookie } };
  },
);
