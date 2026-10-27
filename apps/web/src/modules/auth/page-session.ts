import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuthService } from './auth.container';

/**
 * Who is looking at this page, for server-rendered pages: the same check as for the API (signature, user read in
 * the database, token version), or null. Never trust a page's own cookie reading: it goes through the service.
 * Cached for the request: the layouts and the page of one render share a single read.
 */
export const getPageUser = cache(async () => {
  const cookie = (await headers()).get('cookie');
  if (!cookie) return null;
  const service = getAuthService();
  const session = await service.resolveSession(
    new Request('http://internal/', { headers: { cookie } }),
  );
  return session ? service.getCurrentUser(session) : null;
});

/**
 * Pages for signed-in users. The middleware already sends visitors to the sign-in page with the requested path
 * (flow 00); this is the second check, for a session that ended while the page was being rendered.
 */
export async function requirePageUser() {
  const user = await getPageUser();
  if (!user) redirect('/connexion');
  return user;
}
