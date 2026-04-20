// ALADIN Payment API — ZaloPay Callback (IPN)
// POST /api/payments/zalopay/callback
// Receives payment result callback from ZaloPay (no auth — signed by ZaloPay)

import { NextRequest, NextResponse } from 'next/server';
import { verifyZaloPayCallback } from '@/lib/payment/zalopay';
import { handlePaymentCallback } from '@/lib/payment/payment-service';

export async function POST(request: NextRequest) {
  try {
    // ZaloPay sends form data
    const formData = await request.formData();
    const data: Record<string, string> = {};

    for (const [key, value] of formData.entries()) {
      data[key] = value as string;
    }

    console.log('[ZALOPAY CALLBACK] Received:', JSON.stringify(data));

    // Verify callback signature
    const callback = verifyZaloPayCallback(data);

    if (!callback.orderId) {
      // MAC verification failed
      return NextResponse.json({
        return_code: -1,
        return_message: 'Invalid signature',
      });
    }

    // Process the callback (async but we don't await — ZaloPay expects quick response)
    handlePaymentCallback(callback).catch((err) => {
      console.error('[ZALOPAY CALLBACK] Processing error:', err);
    });

    // Return success to ZaloPay immediately
    return NextResponse.json({
      return_code: 1,
      return_message: 'Success',
    });
  } catch (error) {
    console.error('[ZALOPAY CALLBACK ERROR]', error);
    return NextResponse.json({
      return_code: -1,
      return_message: 'Internal error',
    });
  }
}
