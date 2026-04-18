// ALADIN Credit Limit Adjustment API
// POST /api/credit/adjust — Admin-only credit limit adjustment

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyAccessToken, isAdmin } from '@/lib/auth';
import { isValidCreditLimit, successResponse, errorResponse } from '@/lib/security';
import { adjustCreditLimit, getShopCreditInfo } from '@/lib/credit-engine';

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

    const body = await request.json();
    const { shopId, newLimit, reason } = body;

    // Validation
    if (!shopId) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'shopId is required'),
        { status: 400 }
      );
    }

    if (!newLimit || !Number.isInteger(newLimit)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'newLimit must be a valid integer'),
        { status: 400 }
      );
    }

    if (!isValidCreditLimit(newLimit)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Credit limit must be between 500,000 ₫ and 10,000,000 ₫`),
        { status: 400 }
      );
    }

    // Adjust credit limit
    const result = await adjustCreditLimit(shopId, newLimit, payload.userId);

    // Get updated credit info
    const creditInfo = await getShopCreditInfo(shopId);

    return NextResponse.json(
      successResponse({
        transaction: result.transaction,
        oldLimit: result.oldLimit,
        newLimit: result.newLimit,
        reason: reason || null,
        adjustedBy: payload.userId,
        creditInfo,
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to adjust credit limit';
    console.error('[CREDIT ADJUST ERROR]', error);

    if (message.includes('not found')) {
      return NextResponse.json(errorResponse('NOT_FOUND', message), { status: 404 });
    }

    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', message),
      { status: 500 }
    );
  }
}
