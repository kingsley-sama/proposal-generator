import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';

// Anything not listed here (and not a static asset) requires a valid session.
const PUBLIC_PATHS = ['/', '/sign-in'];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isPublic(pathname: string) {
  return PUBLIC_PATHS.includes(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api');
  const sessionCookie = request.cookies.get('session');

  let session = null;
  if (sessionCookie) {
    try {
      session = await verifyToken(sessionCookie.value);
    } catch {
      session = null;
    }
  }

  // Not authenticated
  if (!session) {
    if (isPublic(pathname)) return NextResponse.next();
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const signInUrl = new URL('/sign-in', request.url);
    if (pathname !== '/') signInUrl.searchParams.set('redirect', pathname);
    const res = NextResponse.redirect(signInUrl);
    if (sessionCookie) res.cookies.delete('session');
    return res;
  }

  // Authenticated: refresh sliding session on safe requests.
  const res = NextResponse.next();
  if (request.method === 'GET') {
    try {
      const expires = new Date(Date.now() + ONE_DAY_MS);
      res.cookies.set({
        name: 'session',
        value: await signToken({ ...session, expires: expires.toISOString() }),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires,
      });
    } catch {
      // Non-fatal: keep the existing cookie if re-signing fails.
    }
  }
  return res;
}

export const config = {
  // Run on everything except Next internals and static files (anything with a dot).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.).*)'],
  runtime: 'nodejs',
};
