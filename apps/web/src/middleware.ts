import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth_token')?.value;

  // Let Next.js internal static assets and public static files pass through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/uploads') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Verify whether token is a valid, non-empty 3-part JWT structure
  const isValidJwt = Boolean(token && token.trim().length > 25 && token.split('.').length === 3);

  let userRole: string | null = null;
  if (isValidJwt && token) {
    try {
      const payloadBase64 = token.split('.')[1];
      const decodedJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(decodedJson);
      userRole = payload.role || null;
    } catch {
      userRole = null;
    }
  }

  // Public login route: ALWAYS permit viewing login page & wipe cookie on ?logout=true
  if (pathname === '/login') {
    const response = NextResponse.next();
    const isLogout = request.nextUrl.searchParams.get('logout') === 'true';
    if (isLogout) {
      response.cookies.delete('auth_token');
      response.cookies.set('auth_token', '', { path: '/', maxAge: 0, expires: new Date(0) });
    }
    return response;
  }

  // If user has NO valid auth token, wipe stale cookie and redirect to /login immediately
  if (!isValidJwt) {
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    if (token) {
      response.cookies.delete('auth_token');
    }
    return response;
  }

  // Root route "/" redirects authenticated users based on their active role
  if (pathname === '/') {
    if (userRole === 'manager') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  // Sales Executive (PIN session) cannot access manager dashboard/inventory/settings routes
  if (userRole !== 'manager' && pathname !== '/pos' && pathname !== '/cash') {
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
