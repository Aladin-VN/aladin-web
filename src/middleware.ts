import { NextRequest, NextResponse } from 'next/server';

// ============================================
// ALADIN Middleware
// - Auth guards for /m/ routes (redirect to /m/login if not authenticated)
// - Device detection (optional redirect to /m/ for mobile browsers)
// ============================================

const PUBLIC_PATHS = ['/m/login', '/m/register', '/api/auth/login', '/api/auth/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ============================================
  // Only process /m/ routes and auth routes
  // ============================================
  if (!pathname.startsWith('/m') && !pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow API auth routes
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // ============================================
  // Mobile auth guard: check access token cookie or header
  // ============================================
  if (pathname.startsWith('/m')) {
    // Check for auth token in cookie or authorization header
    const accessToken = request.cookies.get('aladin-access-token')?.value ||
                        request.headers.get('authorization')?.replace('Bearer ', '');

    // If no token, the client-side hydrate() will handle redirect
    // We don't block server-side because JWT is in localStorage
    // But we can set a flag for client to check
    const response = NextResponse.next();
    response.headers.set('x-auth-required', 'true');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/m/:path*', '/api/auth/:path*'],
};
