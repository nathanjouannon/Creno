import { eventIdParamsSchema } from '@creno/validation';
import { getInvitationsService } from '@/modules/invitations';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-01, RG-02, RG-14: administrators only (route envelope).
export const POST = route({ auth: 'admin', params: eventIdParamsSchema }, async ({ params }) => ({
  status: 201,
  body: await getInvitationsService().create(params.eventId),
}));
