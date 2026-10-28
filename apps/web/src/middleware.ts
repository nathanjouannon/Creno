import { NextResponse, type NextRequest } from 'next/server';
import { safeDestination } from '@/lib/destination';
import { getAuthService } from '@/modules/auth';
import { getClubService } from '@/modules/club';

// Node.js runtime: the checks read the database (RG-17, ADR-0012, ADR-0006).
export const config = {
  runtime: 'nodejs',
  // Pages only: the API answers by itself, and /health must keep working before the installation
  matcher: ['/((?!api|_next|health|favicon.ico).*)'],
};

// Pages a visitor may open (flow 00). Every other page, even one that does not exist, needs a session: a new
// public page (invitation, password reset) is added here by the ticket that creates it.
const PUBLIC_PAGES = ['/connexion', '/installation'];
// F-01: the invitation link, opened by someone without an account
const isPublicPage = (pathname: string) =>
  PUBLIC_PAGES.includes(pathname) || pathname.startsWith('/invitation/');

/**
 * Flow 00. Before the installation, every page leads to the installation page (flow 09). Afterwards, a visitor is
 * sent to the sign-in page, which remembers the page asked for (`suite`). The administrator check is done by the
 * `(admin)` layout and, for every action, by the API (RG-14).
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!(await getClubService().isInstalled())) {
    return pathname === '/installation'
      ? NextResponse.next()
      : redirectTo(request, '/installation');
  }
  if (isPublicPage(pathname)) return NextResponse.next();
  if (await getAuthService().resolveSession(request)) return NextResponse.next();

  const destination = safeDestination(`${pathname}${search}`);
  return redirectTo(request, '/connexion', destination ? { suite: destination } : undefined);
}

function redirectTo(request: NextRequest, pathname: string, query?: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = new URLSearchParams(query).toString();
  return NextResponse.redirect(url);
}
