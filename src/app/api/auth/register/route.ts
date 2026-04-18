// ALADIN Auth API — Register
// POST /api/auth/register

import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone, password, name, role } = body;

    if (!phone || !password || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'Phone, password, and name are required.' } },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters.' } },
        { status: 400 }
      );
    }

    const result = await registerUser({ phone, password, name, role });

    if (!result.success) {
      const status = result.error?.code === 'RATE_LIMITED' ? 429 
                   : result.error?.code === 'USER_EXISTS' ? 409 
                   : 400;
      return NextResponse.json(result, { status });
    }

    const response = NextResponse.json(result, { status: 201 });
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
    console.error('[AUTH REGISTER ERROR]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.' } },
      { status: 500 }
    );
  }
}
