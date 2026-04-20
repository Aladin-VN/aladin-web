// ALADIN Payment API — MoMo Callback (IPN)
// POST /api/payments/momo/callback
// Receives payment result callback from MoMo (no auth — signed by MoMo)

import { NextRequest, NextResponse } from 'next/server';
import { verifyMoMoCallback } from '@/lib/payment/momo';
import { handlePaymentCallback } from '@/lib/payment/payment-service';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json() as Record<string, string>;

    console.log('[MOMO CALLBACK] Received:', JSON.stringify(data));

    // Verify callback signature
    const callback = verifyMoMoCallback(data);

    if (!callback.orderId) {
      // Signature verification failed
      return NextResponse.json({
        resultCode: -1,
        message: 'Invalid signature',
      });
    }

    // Process the callback (async but we don't await — MoMo expects quick response)
    handlePaymentCallback(callback).catch((err) => {
      console.error('[MOMO CALLBACK] Processing error:', err);
    });

    // Return success to MoMo immediately
    return NextResponse.json({
      resultCode: 0,
      message: 'Success',
    });
  } catch (error) {
    console.error('[MOMO CALLBACK ERROR]', error);
    return NextResponse.json({
      resultCode: -1,
      message: 'Internal error',
    });
  }
}
