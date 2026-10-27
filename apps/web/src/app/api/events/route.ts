import { eventInputSchema, listEventsQuerySchema } from '@creno/validation';
import { getEventsService } from '@/modules/events';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-06, F-09: `scope=past` is refused to a user by the service (RG-09).
export const GET = route(
  { auth: 'user', query: listEventsQuerySchema },
  async ({ user, query }) => ({
    body: await getEventsService().list(user, query.scope),
  }),
);

// F-04, RG-14: administrators only (route envelope).
export const POST = route({ auth: 'admin', body: eventInputSchema }, async ({ user, body }) => ({
  status: 201,
  body: await getEventsService().create(user, body),
}));
