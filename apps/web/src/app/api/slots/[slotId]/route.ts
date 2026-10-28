import { slotIdParamsSchema, slotUpdateSchema } from '@creno/validation';
import { getSlotsService } from '@/modules/slots';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-05, RG-14: the two writes are for administrators only (route envelope); RG-15: past events are read only.
export const PATCH = route(
  { auth: 'admin', params: slotIdParamsSchema, body: slotUpdateSchema },
  async ({ user, params, body }) => ({
    body: await getSlotsService().update(user, params.slotId, body),
  }),
);

export const DELETE = route({ auth: 'admin', params: slotIdParamsSchema }, async ({ params }) => {
  await getSlotsService().remove(params.slotId);
  return { status: 204 };
});
