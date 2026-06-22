// POST /api/distributor/orders/[id]/fulfill — Order fulfillment actions
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, SETTLEMENT_CONFIG, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

const VALID_ACTIONS = ['CONFIRM', 'PACK', 'READY_FOR_PICKUP'] as const;
const STATUS_TRANSITIONS: Record<string, string> = {
  CONFIRM: 'CONFIRMED',
  PACK: 'PROCESSING',
  READY_FOR_PICKUP: 'PACKED',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Phân quyền nhà phân phối yêu cầu.'), { status: 403 });
    }

    const distId = getDistributorId(user);
    if (!distId) {
      return NextResponse.json(errorResponse('NO_DISTRIBUTOR', 'Tài khoản không liên kết nhà phân phối.'), { status: 400 });
    }

    const { id: orderId } = await params;
    const body = await request.json();
    const { action } = body as { action: string };

    if (!action || !VALID_ACTIONS.includes(action as typeof VALID_ACTIONS[number])) {
      return NextResponse.json(
        errorResponse('INVALID_ACTION', `Hành động không hợp lệ. Chấp nhận: ${VALID_ACTIONS.join(', ')}`),
        { status: 400 }
      );
    }

    // Fetch order with items
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        distributor: true,
      },
    });

    if (!order) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Không tìm thấy đơn hàng.'), { status: 404 });
    }
    if (order.distributorId !== distId) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Đơn hàng không thuộc nhà phân phối này.'), { status: 403 });
    }

    const newStatus = STATUS_TRANSITIONS[action];
    const now = new Date();
    const updateData: Record<string, unknown> = { status: newStatus };

    // CONFIRM
    if (action === 'CONFIRM') {
      if (order.status !== 'PENDING') {
        return NextResponse.json(errorResponse('INVALID_STATUS', 'Chỉ có thể xác nhận đơn hàng chờ xử lý.'), { status: 400 });
      }
      updateData.confirmedAt = now;
    }

    // PACK — deduct inventory
    if (action === 'PACK') {
      if (order.status !== 'CONFIRMED') {
        return NextResponse.json(errorResponse('INVALID_STATUS', 'Đơn hàng cần được xác nhận trước khi đóng gói.'), { status: 400 });
      }
      // Check and deduct inventory for each item
      for (const item of order.items) {
        const inv = await db.distributorInventory.findUnique({
          where: { distributorId_productId: { distributorId: distId, productId: item.productId } },
        });
        const availableQty = (inv?.quantity ?? 0) - (inv?.reservedQty ?? 0);
        if (availableQty < item.quantity) {
          return NextResponse.json(
            errorResponse('INSUFFICIENT_STOCK', `Sản phẩm "${item.productName}" không đủ tồn kho. Còn: ${availableQty}, Cần: ${item.quantity}`),
            { status: 400 }
          );
        }
      }
      // Deduct stock
      for (const item of order.items) {
        const inv = await db.distributorInventory.findUnique({
          where: { distributorId_productId: { distributorId: distId, productId: item.productId } },
        });
        if (inv) {
          const prevQty = inv.quantity;
          const newQty = prevQty - item.quantity;
          await db.distributorInventory.update({
            where: { id: inv.id },
            data: { quantity: newQty, reservedQty: Math.max(0, inv.reservedQty - item.quantity) },
          });
          await db.inventoryMovement.create({
            data: {
              distributorId: distId,
              productId: item.productId,
              type: 'ORDER_FULFILLMENT',
              quantity: -item.quantity,
              previousQty: prevQty,
              newQty,
              reason: `Đơn hàng ${order.orderNumber}`,
              orderId: order.id,
              performedBy: user.userId,
            },
          });
        }
      }
    }

    // READY_FOR_PICKUP
    if (action === 'READY_FOR_PICKUP') {
      if (order.status !== 'PROCESSING') {
        return NextResponse.json(errorResponse('INVALID_STATUS', 'Đơn hàng cần đang xử lý trước khi sẵn sàng.'), { status: 400 });
      }
      updateData.packedAt = now;
      updateData.fulfilledByDistributorAt = now;

      // Calculate payout
      const commissionRate = order.distributor?.commissionRate ?? SETTLEMENT_CONFIG.DEFAULT_PLATFORM_FEE;
      const platformFee = Math.round(order.totalAmount * commissionRate);
      const deliveryFee = order.deliveryFee || SETTLEMENT_CONFIG.DEFAULT_DELIVERY_FEE;
      const netPayout = order.totalAmount - platformFee - deliveryFee;

      // Update distributor stats
      await db.distributor.update({
        where: { id: distId },
        data: {
          totalOrdersFulfilled: { increment: 1 },
          totalRevenue: { increment: netPayout },
          pendingPayoutAmount: { increment: netPayout },
        },
      });
    }

    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: updateData,
    });

    return NextResponse.json(successResponse({
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      fulfilledByDistributorAt: updatedOrder.fulfilledByDistributorAt,
      packedAt: updatedOrder.packedAt,
    }));
  } catch (error) {
    console.error('[DISTRIBUTOR FULFILL ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}