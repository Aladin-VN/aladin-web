import { NextRequest, NextResponse } from 'next/server';

// ============================================
// ALADIN Middleware
// - Protects admin pages: redirect to /auth/login
// - Allows public paths: login, setup, static assets
// - Mobile auth: client-side hydrate() handles redirect
// ============================================

// Paths that don't require authentication
const PUBLIC_PATHS = [
  '/auth/login',
  '/m/login',
  '/m/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/setup',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Always allow API auth routes
  if (pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // ============================================
  // Admin routes (everything except /m/ and /api/)
  // If no access token cookie AND no Bearer token header, redirect to login
  // ============================================
  if (!pathname.startsWith('/m') && !pathname.startsWith('/api/')) {
    const token = request.cookies.get('aladin-access-token')?.value;

    // If there's a token cookie, allow through
    // (Client-side AuthGuard does the real JWT validation with localStorage)
    if (!token) {
      const loginUrl = new URL('/auth/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  // ============================================
  // Mobile auth guard: set flag for client-side
  // ============================================
  if (pathname.startsWith('/m')) {
    const response = NextResponse.next();
    response.headers.set('x-auth-required', 'true');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except _next/static, _next/image, favicon, etc.
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|manifest.json|sw.js|workbox-*.js|icons/).*)',
  ],
};