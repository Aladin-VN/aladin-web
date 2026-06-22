// ALADIN Admin Settlement Pay API
// POST /api/settlements/[id]/pay — mark settlement as PAID

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/get-auth-user';
import { successResponse, errorResponse, rateLimit } from '@/lib/security';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;

    // Rate limit
    const rl = rateLimit(`admin:pay:${user.userId}`, { maxRequests: 30, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Quá nhiều yêu cầu'), { status: 429 });
    }

    const { id: settlementId } = await params;
    const body = await request.json();
    const { paymentRef } = body as { paymentRef?: string };

    // Fetch settlement
    const settlement = await db.settlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      return NextResponse.json(
        errorResponse('NOT_FOUND', 'Không tìm thấy kỳ đối soát'),
        { status: 404 }
      );
    }

    if (settlement.status === 'PAID') {
      return NextResponse.json(
        errorResponse('ALREADY_PAID', 'Kỳ đối soát này đã được thanh toán'),
        { status: 409 }
      );
    }

    if (settlement.status !== 'PENDING' && settlement.status !== 'PROCESSING') {
      return NextResponse.json(
        errorResponse('INVALID_STATUS', `Không thể thanh toán kỳ đối soát ở trạng thái "${settlement.status}"`),
        { status: 409 }
      );
    }

    // Process payment in transaction
    const updated = await db.$transaction(async (tx) => {
      // Update settlement status
      const paid = await tx.settlement.update({
        where: { id: settlementId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paymentRef: paymentRef || null,
        },
      });

      // Update distributor stats
      await tx.distributor.update({
        where: { id: settlement.distributorId },
        data: {
          totalPayouts: { increment: settlement.distributorPayout },
          pendingPayoutAmount: { decrement: settlement.distributorPayout },
        },
      });

      return paid;
    });

    return NextResponse.json(
      successResponse({
        settlement: {
          id: updated.id,
          settlementNumber: updated.settlementNumber,
          distributorId: updated.distributorId,
          distributorPayout: updated.distributorPayout,
          status: updated.status,
          paidAt: updated.paidAt,
          paymentRef: updated.paymentRef,
        },
        message: `Đã thanh toán kỳ đối soát ${updated.settlementNumber}`,
      })
    );
  } catch (error) {
    console.error('[SETTLEMENT PAY ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Không thể thanh toán kỳ đối soát'),
      { status: 500 }
    );
  }
}