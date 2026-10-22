import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/admin-token';

/**
 * Edge gate for /admin: unauthenticated visitors never reach the page code, and the admin is never cached or indexed.
 * (Pages and API routes verify the session again; this is defence in depth, not the only check.)
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const prod = process.env.NODE_ENV === 'production';
  const cookie = req.cookies.get(prod ? '__Host-mk_admin' : 'mk_admin')?.value;
  const secret = process.env.ADMIN_SESSION_SECRET || (prod ? '' : 'dev-only-secret-' + (process.env.ADMIN_PASSWORD ?? ''));
  const ok = await verifySession(secret, cookie, process.env.ADMIN_SESSION_EPOCH || '1');

  if (pathname !== '/admin/login' && !ok) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
export const config = { matcher: ['/admin', '/admin/:path*'] };
