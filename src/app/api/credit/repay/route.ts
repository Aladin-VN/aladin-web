// ALADIN Credit Repayment API
// POST /api/credit/repay — Record a repayment against shop credit
// Extended in M5: SHOP_OWNER can record self-service repayments

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

    // Admin, Sales Rep, Driver, or Shop Owner (self-service) can record repayments
    if (!hasRole(payload.role, ['ADMIN', 'SALES_REP', 'DRIVER', 'SHOP_OWNER'])) {
      return NextResponse.json(
        errorResponse('FORBIDDEN', 'Access denied'),
        { status: 403 }
      );
    }

    const body = await request.json();
    const { shopId, orderId, amount, paymentMethod, collectedBy } = body;

    // For SHOP_OWNER: auto-derive shopId from token
    const effectiveShopId = payload.role === 'SHOP_OWNER'
      ? payload.shopId
      : shopId;

    // Validation
    const errors: string[] = [];
    if (!effectiveShopId) errors.push('shopId is required');
    if (!amount || amount <= 0) errors.push('amount must be a positive number');
    if (!paymentMethod) errors.push('paymentMethod is required (CASH, BANK_TRANSFER, DIGITAL, etc.)');

    // orderId is optional for self-service repayment (shop owner repays general credit, not tied to specific order)
    // But required for admin/driver (they collect for a specific order)
    if (payload.role !== 'SHOP_OWNER' && !orderId) {
      errors.push('orderId is required');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'Validation failed', { errors }),
        { status: 400 }
      );
    }

    // Record repayment
    const result = await repayCredit(
      effectiveShopId,
      orderId || 'SELF_SERVICE',
      Math.round(amount),
      paymentMethod,
      collectedBy || payload.userId
    );

    // Get updated credit info
    const creditInfo = await getShopCreditInfo(effectiveShopId);

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
