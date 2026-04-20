// ALADIN Order API — Status Transition
// PATCH /api/orders/[id]/status — advance order status through the fulfillment pipeline
// Valid: PENDING → CONFIRMED → PROCESSING → PACKED → OUT_FOR_DELIVERY → DELIVERED

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse, rateLimit, ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from '@/lib/security';
import { notifyOrderStatusChange } from '@/lib/zalo/notification-engine';

// ============================================
// Valid status transition map
// ============================================

const VALID_TRANSITIONS: Record<string, string> = {
  [ORDER_STATUS.PENDING]: ORDER_STATUS.CONFIRMED,
  [ORDER_STATUS.CONFIRMED]: ORDER_STATUS.PROCESSING,
  [ORDER_STATUS.PROCESSING]: ORDER_STATUS.PACKED,
  [ORDER_STATUS.PACKED]: ORDER_STATUS.OUT_FOR_DELIVERY,
  [ORDER_STATUS.OUT_FOR_DELIVERY]: ORDER_STATUS.DELIVERED,
};

const VALID_STATUSES = Object.values(VALID_TRANSITIONS);

// ============================================
// PATCH /api/orders/[id]/status
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !hasRole(payload.role, ['ADMIN', 'SALES_REP', 'DRIVER'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin, Sales Rep, or Driver access required'), { status: 403 });
    }

    // Rate limit
    const rl = rateLimit(`order:status:${payload.userId}`, { maxRequests: 60, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many requests'), { status: 429 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status || !Object.values(ORDER_STATUS).includes(status)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Invalid status. Must be one of: ${Object.values(ORDER_STATUS).join(', ')}`),
        { status: 400 }
      );
    }

    // Fetch current order with shop info
    const order = await db.order.findUnique({
      where: { id },
      include: { shop: { select: { id: true, totalOrders: true, totalGmv: true } } },
    });

    if (!order) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Order not found'), { status: 404 });
    }

    // Validate the transition is legal
    const expectedNext = VALID_TRANSITIONS[order.status];
    if (!expectedNext) {
      return NextResponse.json(
        errorResponse('INVALID_TRANSITION', `Order in status "${order.status}" cannot be advanced further`),
        { status: 409 }
      );
    }

    if (status !== expectedNext) {
      return NextResponse.json(
        errorResponse('INVALID_TRANSITION', `Invalid transition. Expected "${expectedNext}", got "${status}". Current: "${order.status}"`),
        { status: 409 }
      );
    }

    // Build update data based on new status
    const updateData: Record<string, unknown> = { status };

    if (status === ORDER_STATUS.CONFIRMED) {
      updateData.confirmedAt = new Date();
    }

    if (status === ORDER_STATUS.PACKED) {
      updateData.packedAt = new Date();
    }

    if (status === ORDER_STATUS.DELIVERED) {
      updateData.deliveredAt = new Date();
      // If CREDIT payment, set paymentStatus to PENDING (7-day timer starts)
      if (order.paymentMethod === PAYMENT_METHOD.CREDIT) {
        updateData.paymentStatus = PAYMENT_STATUS.PENDING;
      }
    }

    // Execute status update in transaction
    const updatedOrder = await db.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: updateData,
      });

      // On DELIVERED: update shop stats
      if (status === ORDER_STATUS.DELIVERED) {
        // Re-calculate shop stats from all delivered orders
        const deliveredOrders = await tx.order.findMany({
          where: {
            shopId: order.shopId,
            status: ORDER_STATUS.DELIVERED,
          },
          select: { totalAmount: true },
        });

        const totalDelivered = deliveredOrders.length;
        const totalDeliveredGmv = deliveredOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const avgValue = totalDelivered > 0 ? Math.round(totalDeliveredGmv / totalDelivered) : 0;

        await tx.shop.update({
          where: { id: order.shopId },
          data: {
            totalGmv: totalDeliveredGmv,
            avgOrderValue: avgValue,
          },
        });
      }

      return updated;
    });

    return NextResponse.json(successResponse({
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
        confirmedAt: updatedOrder.confirmedAt,
        packedAt: updatedOrder.packedAt,
        deliveredAt: updatedOrder.deliveredAt,
        updatedAt: updatedOrder.updatedAt,
      },
      message: `Order ${updatedOrder.orderNumber} status updated to ${status}`,
    }));

    // Send Zalo notification to shop owner (async, non-blocking)
    notifyOrderStatusChange(id, status).catch((err) => {
      console.error('[ORDER STATUS] Notification error (non-blocking):', err);
    });
  } catch (error) {
    console.error('[ORDER STATUS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to update order status'),
      { status: 500 }
    );
  }
}
