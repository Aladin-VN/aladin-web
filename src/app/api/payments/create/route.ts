// ALADIN Payment API — Create Payment
// POST /api/payments/create
// Creates a payment for a DIGITAL order via ZaloPay/MoMo

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { createPaymentForOrder } from '@/lib/payment/payment-service';
import type { PaymentGatewayType } from '@/lib/payment/config';
import { successResponse, errorResponse, rateLimit } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);
    if (!token) {
      return NextResponse.json(
        errorResponse('UNAUTHORIZED', 'Authentication required.'),
        { status: 401 }
      );
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(
        errorResponse('INVALID_TOKEN', 'Token is invalid or expired.'),
        { status: 401 }
      );
    }

    // Rate limit
    const rl = rateLimit(`payment:create:${payload.userId}`, { maxRequests: 10, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(
        errorResponse('RATE_LIMITED', 'Too many payment requests. Please try again later.'),
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { orderId, gateway } = body as { orderId?: string; gateway?: PaymentGatewayType };

    if (!orderId) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'orderId is required.'),
        { status: 400 }
      );
    }

    if (!gateway || !['ZALOPAY', 'MOMO'].includes(gateway)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'gateway must be ZALOPAY or MOMO.'),
        { status: 400 }
      );
    }

    // Create payment
    const result = await createPaymentForOrder(orderId, gateway);

    if (!result.success) {
      return NextResponse.json(
        errorResponse('PAYMENT_FAILED', result.error || 'Payment creation failed.'),
        { status: 400 }
      );
    }

    return NextResponse.json(successResponse({
      paymentUrl: result.paymentUrl,
      transactionId: result.transactionId,
    }));
  } catch (error) {
    console.error('[PAYMENT CREATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'An internal error occurred.'),
      { status: 500 }
    );
  }
}
