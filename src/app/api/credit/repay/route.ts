// ALADIN Credit Repayment API
// POST /api/credit/repay — Record a repayment against shop credit

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';
import { repayCredit, getShopCreditInfo, formatRunningBalance } from '@/lib/credit-engine';

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    // Admin, Sales Rep, or Driver can record repayments
    if (!hasRole(payload.role, ['ADMIN', 'SALES_REP', 'DRIVER'])) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Admin, Sales Rep, or Driver access required'),
        { status: 403 }
      );
    }

    const body = await request.json();
    const { shopId, orderId, amount, paymentMethod, collectedBy } = body;

    // Validation
    const errors: string[] = [];
    if (!shopId) errors.push('shopId is required');
    if (!orderId) errors.push('orderId is required');
    if (!amount || amount <= 0) errors.push('amount must be a positive number');
    if (!paymentMethod) errors.push('paymentMethod is required (CASH, DIGITAL, etc.)');

    if (errors.length > 0) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Validation failed', { errors }),
        { status: 400 }
      );
    }

    // Record repayment
    const result = await repayCredit(
      shopId,
      orderId,
      Math.round(amount),
      paymentMethod,
      collectedBy || payload.userId
    );

    // Get updated credit info
    const creditInfo = await getShopCreditInfo(shopId);

    return NextResponse.json(
      successResponse({
        transaction: {
          id: result.transaction.id,
          type: result.transaction.type,
          amount: result.transaction.amount,
          runningBalance: result.transaction.runningBalance,
          formattedBalance: formatRunningBalance(result.transaction.runningBalance),
          paymentMethod: result.transaction.paymentMethod,
          description: result.transaction.description,
          createdAt: result.transaction.createdAt,
        },
        newBalance: result.newBalance,
        isFullRepayment: result.isFullRepayment,
        creditInfo,
        recordedBy: payload.userId,
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record repayment';
    console.error('[CREDIT REPAY ERROR]', error);

    if (
      message.includes('not found') ||
      message.includes('No outstanding')
    ) {
      return NextResponse.json(errorResponse('BAD_REQUEST', message), { status: 400 });
    }

    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', message),
      { status: 500 }
    );
  }
}
