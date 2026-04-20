// ALADIN Order API — Cancel Order
// PATCH /api/orders/[id]/cancel — cancel a PENDING or CONFIRMED order
// Restores credit if CREDIT was used, restores product stock

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import {
  successResponse,
  errorResponse,
  rateLimit,
  formatVND,
  ORDER_STATUS,
  PAYMENT_METHOD,
  PAYMENT_STATUS,
  TRANSACTION_TYPES,
} from '@/lib/security';
import { notifyOrderCancellation } from '@/lib/zalo/notification-engine';

// Orders that can be cancelled
const CANCELLABLE_STATUSES = new Set([
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
]);

// ============================================
// PATCH /api/orders/[id]/cancel
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
    if (!payload || !hasRole(payload.role, ['ADMIN', 'SALES_REP'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin or Sales Rep access required'), { status: 403 });
    }

    // Rate limit
    const rl = rateLimit(`order:cancel:${payload.userId}`, { maxRequests: 30, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many requests'), { status: 429 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    // Fetch current order with items and shop
    const order = await db.order.findUnique({
      where: { id },
      include: {
        items: { select: { id: true, productId: true, quantity: true } },
        shop: { select: { id: true, creditBalance: true, creditLimit: true } },
      },
    });

    if (!order) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Order not found'), { status: 404 });
    }

    // Check if order can be cancelled
    if (!CANCELLABLE_STATUSES.has(order.status)) {
      return NextResponse.json(
        errorResponse('INVALID_STATUS', `Cannot cancel order in status "${order.status}". Only ${Array.from(CANCELLABLE_STATUSES).join(', ')} orders can be cancelled.`),
        { status: 409 }
      );
    }

    // Check if already cancelled
    if (order.status === ORDER_STATUS.CANCELLED) {
      return NextResponse.json(
        errorResponse('ALREADY_CANCELLED', 'Order has already been cancelled'),
        { status: 409 }
      );
    }

    // Execute cancellation in a transaction
    const updatedOrder = await db.$transaction(async (tx) => {
      // 1. Update order status
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: ORDER_STATUS.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason ? String(reason).substring(0, 500) : null,
          // If credit was used, mark payment status as refunded
          ...(order.paymentMethod === PAYMENT_METHOD.CREDIT ? { paymentStatus: PAYMENT_STATUS.REFUNDED } : {}),
        },
      });

      // 2. If credit was used: create REFUND transaction and restore shop creditBalance
      if (order.paymentMethod === PAYMENT_METHOD.CREDIT && order.creditUsed > 0) {
        const newBalance = order.shop.creditBalance - order.creditUsed;
        const clampedBalance = Math.max(0, newBalance);

        await tx.transaction.create({
          data: {
            shopId: order.shopId,
            orderId: order.id,
            type: TRANSACTION_TYPES.REFUND,
            amount: -order.creditUsed, // Negative = credit to shop
            runningBalance: clampedBalance,
            paymentMethod: PAYMENT_METHOD.CREDIT,
            description: `Order ${order.orderNumber} cancelled — credit refunded`,
          },
        });

        // Restore shop credit balance and unlock if needed
        await tx.shop.update({
          where: { id: order.shopId },
          data: {
            creditBalance: clampedBalance,
            creditStatus: 'ACTIVE', // Re-activate credit on cancellation
          },
        });
      }

      // 3. Restore product stock
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }

      // 4. Decrement shop totalOrders and recalculate GMV
      await tx.shop.update({
        where: { id: order.shopId },
        data: {
          totalOrders: { decrement: 1 },
          totalGmv: { decrement: order.totalAmount },
        },
      });

      // Recalculate avgOrderValue
      const updatedShop = await tx.shop.findUnique({ where: { id: order.shopId } });
      if (updatedShop && updatedShop.totalOrders > 0) {
        await tx.shop.update({
          where: { id: order.shopId },
          data: {
            avgOrderValue: Math.round(updatedShop.totalGmv / updatedShop.totalOrders),
          },
        });
      } else if (updatedShop && updatedShop.totalOrders <= 0) {
        await tx.shop.update({
          where: { id: order.shopId },
          data: {
            totalOrders: 0,
            totalGmv: 0,
            avgOrderValue: 0,
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
        cancelledAt: updatedOrder.cancelledAt,
        cancelReason: updatedOrder.cancelReason,
        updatedAt: updatedOrder.updatedAt,
      },
      message: `Order ${updatedOrder.orderNumber} has been cancelled`,
      refund: order.creditUsed > 0 && order.paymentMethod === PAYMENT_METHOD.CREDIT
        ? { creditRefunded: order.creditUsed, creditRefundedFormatted: formatVND(order.creditUsed) }
        : null,
      stockRestored: order.items.length,
    }));

    // Send Zalo cancellation notification to shop owner (async, non-blocking)
    notifyOrderCancellation(id, reason ? String(reason) : undefined).catch((err) => {
      console.error('[ORDER CANCEL] Notification error (non-blocking):', err);
    });
  } catch (error) {
    console.error('[ORDER CANCEL ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to cancel order'),
      { status: 500 }
    );
  }
}
