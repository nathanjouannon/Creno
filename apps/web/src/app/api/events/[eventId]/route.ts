import { eventIdParamsSchema, eventUpdateSchema } from '@creno/validation';
import { getEventsService } from '@/modules/events';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

export const GET = route(
  { auth: 'user', params: eventIdParamsSchema },
  async ({ user, params }) => ({
    body: await getEventsService().get(user, params.eventId),
  }),
);

// RG-14: the two writes are for administrators only (route envelope); RG-15: past events are read only.
export const PATCH = route(
  { auth: 'admin', params: eventIdParamsSchema, body: eventUpdateSchema },
  async ({ user, params, body }) => ({
    body: await getEventsService().update(user, params.eventId, body),
  }),
);

export const DELETE = route({ auth: 'admin', params: eventIdParamsSchema }, async ({ params }) => {
  await getEventsService().remove(params.eventId);
  return { status: 204 };
});
