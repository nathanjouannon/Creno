import { NextResponse, type NextRequest } from 'next/server';
import { getClubService } from '@/modules/club';

// Node.js runtime: the check reads the database (RG-17, ADR-0012).
export const config = {
  runtime: 'nodejs',
  // Pages only: the API answers by itself, and /health must keep working before the installation
  matcher: ['/((?!api|_next|health|favicon.ico).*)'],
};

/** Before the installation, every page leads to the installation page (flow 09). */
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/installation') return NextResponse.next();
  if (await getClubService().isInstalled()) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/installation';
  url.search = '';
  return NextResponse.redirect(url);
}
