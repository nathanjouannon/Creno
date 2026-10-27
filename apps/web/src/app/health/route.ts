import { getHealthService, route } from '@/modules/shared';

// Public, no rate limit: used by Docker and by the deployment (openapi.yaml, /health).
export const dynamic = 'force-dynamic';

export const GET = route({ auth: 'optional' }, async () => ({
  body: await getHealthService().check(),
}));
