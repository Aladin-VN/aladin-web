// ALADIN Process Overdue Shops API
// POST /api/credit/process-overdue — Admin endpoint to trigger auto-lock

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyAccessToken, isAdmin } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';
import { checkAndLockOverdueShops } from '@/lib/credit-engine';

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !isAdmin(payload.role)) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }

    // Run the overdue check
    const result = await checkAndLockOverdueShops();

    return NextResponse.json(
      successResponse({
        lockedCount: result.lockedCount,
        alreadyOverdue: result.alreadyOverdue,
        details: result.details,
        processedAt: new Date(),
        processedBy: payload.userId,
      })
    );
  } catch (error) {
    console.error('[PROCESS OVERDUE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to process overdue shops'),
      { status: 500 }
    );
  }
}
