import { NextRequest, NextResponse } from 'next/server';

// POST /api/auth/logout — clear auth cookies
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('aladin-refresh-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  response.cookies.set('aladin-access-token', '', {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}