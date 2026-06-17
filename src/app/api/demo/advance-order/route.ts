// ALADIN Demo API — Advance Order Status
// POST /api/demo/advance-order
// Advances an order to its next status in the B2B pipeline
// PENDING → CONFIRMED → PROCESSING → PACKED → OUT_FOR_DELIVERY → DELIVERED

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============================================
// Status transition map
// ============================================

const STATUS_PIPELINE: Record<string, string> = {
  PENDING: 'CONFIRMED',
  CONFIRMED: 'PROCESSING',
  PROCESSING: 'PACKED',
  PACKED: 'OUT_FOR_DELIVERY',
  OUT_FOR_DELIVERY: 'DELIVERED',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  PACKED: 'Đã đóng gói',
  OUT_FOR_DELIVERY: 'Đang giao hàng',
  DELIVERED: 'Đã giao thành công',
};

const TRANSITION_MESSAGES: Record<string, string> = {
  CONFIRMED: '✅ Đơn hàng đã xác nhận! Đã gửi đến kho phân phối.',
  PROCESSING: '📦 Kho đang xử lý đơn hàng...',
  PACKED: '📦 Đã đóng gói xong! Đang chờ phân tài xế.',
  OUT_FOR_DELIVERY: '🚚 Tài xế đã nhận hàng, đang trên đường giao!',
  DELIVERED: '🎉 Đơn hàng đã giao thành công! Toàn bộ quy trình B2B hoàn tất.',
};

// ============================================
// POST /api/demo/advance-order
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'orderId is required' },
        { status: 400 }
      );
    }

    // 1. Fetch current order
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        shop: { select: { id: true, name: true, address: true, district: true, province: true } },
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Order not found' },
        { status: 404 }
      );
    }

    // 2. Determine next status
    const nextStatus = STATUS_PIPELINE[order.status];

    if (!nextStatus) {
      return NextResponse.json({
        success: true,
        data: {
          order,
          message: 'Đơn hàng đã ở trạng thái cuối cùng.',
          isComplete: true,
        },
      });
    }

    // 3. Build update data
    const updateData: Record<string, unknown> = { status: nextStatus };

    if (nextStatus === 'CONFIRMED') {
      updateData.confirmedAt = new Date();
    }

    if (nextStatus === 'PACKED') {
      updateData.packedAt = new Date();
    }

    if (nextStatus === 'DELIVERED') {
      updateData.deliveredAt = new Date();
      // If CREDIT payment, mark as needing repayment
      if (order.paymentMethod === 'CREDIT') {
        updateData.paymentStatus = 'PENDING';
      }
    }

    // 4. Execute in transaction
    const updatedOrder = await db.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: updateData,
      });

      // When advancing to OUT_FOR_DELIVERY: create/update shipment with IN_TRANSIT
      if (nextStatus === 'OUT_FOR_DELIVERY') {
        // Find an available driver
        const driver = await tx.user.findFirst({
          where: { role: 'DRIVER', status: 'ACTIVE' },
        });

        // Check if shipment already exists for this order
        const existingShipment = await tx.shipment.findUnique({
          where: { orderId },
        });

        if (existingShipment) {
          await tx.shipment.update({
            where: { orderId },
            data: {
              status: 'IN_TRANSIT',
              assignedDriverId: driver?.id || null,
              pickupAddress: 'Kho Phân Phối Miền Nam, Số 12, Đại lộ Bình Dương',
              dropoffAddress: order.shop.address || `${order.shop.name}, ${order.shop.district || ''}, ${order.shop.province}`,
            },
          });
        } else {
          await tx.shipment.create({
            data: {
              orderId,
              type: 'INTERNAL',
              status: 'IN_TRANSIT',
              assignedDriverId: driver?.id || null,
              pickupAddress: 'Kho Phân Phối Miền Nam, Số 12, Đại lộ Bình Dương',
              dropoffAddress: order.shop.address || `${order.shop.name}, ${order.shop.district || ''}, ${order.shop.province}`,
            },
          });
        }

        // Update order with driver assignment
        if (driver) {
          await tx.order.update({
            where: { id: orderId },
            data: { assignedDriverId: driver.id },
          });
        }
      }

      // When advancing to DELIVERED: update shipment to DELIVERED
      if (nextStatus === 'DELIVERED') {
        const shipment = await tx.shipment.findUnique({
          where: { orderId },
        });
        if (shipment) {
          await tx.shipment.update({
            where: { orderId },
            data: {
              status: 'DELIVERED',
              deliveredAt: new Date(),
              podPhotoUrl: 'https://placehold.co/600x400?text=POD+Demo',
            },
          });
        }

        // Update shop stats
        const deliveredOrders = await tx.order.findMany({
          where: {
            shopId: order.shopId,
            status: 'DELIVERED',
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

      // Fetch updated order with items
      return tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          shop: { select: { name: true, district: true, province: true } },
        },
      });
    });

    const message = TRANSITION_MESSAGES[nextStatus] || `Trạng thái chuyển sang: ${STATUS_LABELS[nextStatus]}`;

    return NextResponse.json({
      success: true,
      data: {
        order: updatedOrder,
        previousStatus: order.status,
        newStatus: nextStatus,
        newStatusLabel: STATUS_LABELS[nextStatus],
        message,
        isComplete: nextStatus === 'DELIVERED',
      },
    });
  } catch (error) {
    console.error('[DEMO ADVANCE ORDER ERROR]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to advance order status' },
      { status: 500 }
    );
  }
}