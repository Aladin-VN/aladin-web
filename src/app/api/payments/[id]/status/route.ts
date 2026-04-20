// ALADIN Payment API — Payment Status
// GET /api/payments/[id]/status
// Returns payment status, gateway info, timestamps

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { getPaymentById, getPaymentStatus } from '@/lib/payment/payment-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);
    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } },
        { status: 401 }
      );
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired.' } },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Fetch payment record
    const payment = await getPaymentById(id);

    if (!payment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payment not found.' } },
        { status: 404 }
      );
    }

    // Optionally query live status from gateway if still pending
    let liveStatus = null;
    if (payment.status === 'PENDING' && payment.expiresAt && payment.expiresAt > new Date()) {
      liveStatus = await getPaymentStatus(payment.orderId);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: payment.id,
        orderId: payment.orderId,
        orderNumber: payment.order?.orderNumber,
        gateway: payment.gateway,
        gatewayTxId: payment.gatewayTxId,
        amount: payment.amount,
        status: payment.status,
        paymentUrl: payment.paymentUrl,
        qrCodeUrl: payment.qrCodeUrl,
        paidAt: payment.paidAt,
        expiresAt: payment.expiresAt,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
        order: payment.order,
        liveStatus,
      },
    });
  } catch (error) {
    console.error('[PAYMENT STATUS ERROR]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.' } },
      { status: 500 }
    );
  }
}
