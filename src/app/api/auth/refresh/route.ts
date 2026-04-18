// ALADIN Auth API — Refresh Token
// POST /api/auth/refresh

import { NextRequest, NextResponse } from 'next/server';
import { refreshToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const cookieToken = request.cookies.get('aladin-refresh-token')?.value;
    const body = await request.json().catch(() => ({}));
    const bodyToken = body.refreshToken;
    const tokenString = cookieToken || bodyToken;

    if (!tokenString) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_TOKEN', message: 'Refresh token is required.' } },
        { status: 401 }
      );
    }

    const result = await refreshToken(tokenString);

    if (!result.success) {
      return NextResponse.json(result, { status: 401 });
    }

    const response = NextResponse.json(result, { status: 200 });
    if (result.data && 'refreshToken' in result.data) {
      response.cookies.set('aladin-refresh-token', (result.data as Record<string, unknown>).refreshToken as string, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });
    }

    return response;
  } catch (error) {
    console.error('[AUTH REFRESH ERROR]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.' } },
      { status: 500 }
    );
  }
}
