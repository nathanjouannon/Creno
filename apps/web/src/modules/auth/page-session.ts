import { headers } from 'next/headers';
import { getAuthService } from './auth.container';

/**
 * Who is looking at this page, for server-rendered pages: the same check as for the API (signature, user read in
 * the database, token version), or null. Never trust a page's own cookie reading: it goes through the service.
 */
export async function getPageUser() {
  const cookie = (await headers()).get('cookie');
  if (!cookie) return null;
  const service = getAuthService();
  const session = await service.resolveSession(
    new Request('http://internal/', { headers: { cookie } }),
  );
  return session ? service.getCurrentUser(session) : null;
}
