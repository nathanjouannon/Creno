import { NextResponse, type NextRequest } from 'next/server';
import { contentSecurityPolicy, newNonce } from '@/lib/content-security-policy';
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
const PUBLIC_PAGES = ['/connexion', '/installation', '/mentions'];
// F-01, F-02: the invitation and password reset links, opened by someone who is not signed in
const PUBLIC_PREFIXES = ['/invitation/', '/reinitialisation/'];
const isPublicPage = (pathname: string) =>
  PUBLIC_PAGES.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

/**
 * Flow 00. Before the installation, every page leads to the installation page (flow 09). Afterwards, a visitor is
 * sent to the sign-in page, which remembers the page asked for (`suite`). The administrator check is done by the
 * `(admin)` layout and, for every action, by the API (RG-14).
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // T-021: the information notice is readable by anyone, installed or not
  if (pathname === '/mentions') return render(request);

  if (!(await getClubService().isInstalled())) {
    return pathname === '/installation' ? render(request) : redirectTo(request, '/installation');
  }
  if (isPublicPage(pathname)) return render(request);
  if (await getAuthService().resolveSession(request)) return render(request);

  const destination = safeDestination(`${pathname}${search}`);
  return redirectTo(request, '/connexion', destination ? { suite: destination } : undefined);
}

/**
 * Lets the page render under its own Content-Security-Policy (security.md, section 4, #80). Next.js reads the nonce
 * from the policy of the request and puts it on its scripts; the browser gets the same policy with the response.
 */
function render(request: NextRequest) {
  const policy = contentSecurityPolicy(newNonce(), process.env.NODE_ENV !== 'production');
  const headers = new Headers(request.headers);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

function redirectTo(request: NextRequest, pathname: string, query?: Record<string, string>) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = new URLSearchParams(query).toString();
  return NextResponse.redirect(url);
}
