// ALADIN Payment API — Mock Confirm (Dev Only)
// POST /api/payments/mock/confirm
// Simulates successful payment for development testing

import { NextRequest, NextResponse } from 'next/server';
import { handlePaymentCallback } from '@/lib/payment/payment-service';

export async function POST(request: NextRequest) {
  try {
    // Dev-only guard
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Mock payments only available in development.' } },
        { status: 403 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId') || '';
    const txId = searchParams.get('txId') || `mock_tx_${Date.now()}`;
    const amount = parseInt(searchParams.get('amount') || '0', 10);
    const gateway = searchParams.get('gateway') || 'MOCK';
    const status = searchParams.get('status') || 'SUCCESS';

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'orderId is required.' } },
        { status: 400 }
      );
    }

    console.log(`[MOCK PAYMENT] Confirming ${status} for order ${orderId} (${amount}d)`);

    // Process mock callback
    const callback = {
      orderId,
      transactionId: txId,
      amount,
      status: status as 'SUCCESS' | 'FAILED' | 'PENDING',
      gateway: gateway as 'ZALOPAY' | 'MOMO' | 'MOCK',
      rawData: { mock: true, timestamp: Date.now() },
    };

    await handlePaymentCallback(callback);

    return NextResponse.json({
      success: true,
      data: {
        message: `Mock payment ${status} for order ${orderId}`,
        orderId,
        transactionId: txId,
        amount,
        gateway,
      },
    });
  } catch (error) {
    console.error('[MOCK PAYMENT ERROR]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.' } },
      { status: 500 }
    );
  }
}
