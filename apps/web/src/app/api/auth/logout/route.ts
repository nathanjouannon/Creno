import { getAuthService } from '@/modules/auth';
import { route } from '@/modules/shared';

export const dynamic = 'force-dynamic';

// F-02: answers 204 even when the session was already gone (openapi.yaml); the cookie is erased either way.
export const POST = route({ auth: 'optional' }, () => ({
  status: 204,
  headers: { 'Set-Cookie': getAuthService().closeSession() },
}));
