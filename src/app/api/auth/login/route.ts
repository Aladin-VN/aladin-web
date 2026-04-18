// ALADIN Auth API — Login
// POST /api/auth/login

import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, password } = body;

    if (!phone || !password) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'Phone and password are required.' } },
        { status: 400 }
      );
    }

    const result = await loginUser(phone, password);

    if (!result.success) {
      const status = result.error?.code === 'RATE_LIMITED' ? 429 
                   : result.error?.code === 'ACCOUNT_SUSPENDED' ? 403 
                   : 401;
      return NextResponse.json(result, { status });
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
    console.error('[AUTH LOGIN ERROR]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.' } },
      { status: 500 }
    );
  }
}
