// ALADIN Order API — Get Single Order Detail
// GET /api/orders/[id] — full order detail with items, shop, shipment, transactions

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, formatVND, ROLES } from '@/lib/security';

// ============================================
// GET /api/orders/[id] — Order Detail
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const { id } = await params;

    const order = await db.order.findUnique({
      where: { id },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            phone: true,
            address: true,
            district: true,
            province: true,
          },
        },
        items: true,
        shipment: {
          include: {
            assignedDriver: {
              select: { id: true, name: true, phone: true },
            },
          },
        },
        transactions: {
          where: { type: { in: ['CREDIT_USED', 'REFUND', 'REPAYMENT'] } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            type: true,
            amount: true,
            runningBalance: true,
            paymentMethod: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Order not found'), { status: 404 });
    }

    // RBAC: Shop owner can only see their own orders
    if (payload.role === 'SHOP_OWNER') {
      const userShop = await db.shop.findFirst({ where: { userId: payload.userId }, select: { id: true } });
      if (!userShop || userShop.id !== order.shopId) {
        return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only view your own orders.' } }, { status: 403 });
      }
    }
    // RBAC: Driver can only see orders assigned to them
    if (payload.role === 'DRIVER') {
      const isAssigned = order.assignedDriverId === payload.userId || 
        (order.shipment && order.shipment.assignedDriverId === payload.userId);
      if (!isAssigned) {
        return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only view orders assigned to you.' } }, { status: 403 });
      }
    }
    // RBAC: Broker can only see orders from their referred shops
    if (payload.role === 'BROKER') {
      const shop = await db.shop.findFirst({ where: { id: order.shopId, broker: { userId: payload.userId } }, select: { id: true } });
      if (!shop) {
        return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'You can only view orders from your referred shops.' } }, { status: 403 });
      }
    }

    // Parse shop snapshot for historical record
    let shopSnapshotData = null;
    try {
      shopSnapshotData = JSON.parse(order.shopSnapshot);
    } catch {
      shopSnapshotData = null;
    }

    // Build shipment summary if exists
    const shipment = order.shipment ? {
      id: order.shipment.id,
      type: order.shipment.type,
      status: order.shipment.status,
      assignedDriverName: order.shipment.assignedDriver?.name || null,
      assignedDriverPhone: order.shipment.assignedDriver?.phone || null,
      dropoffAddress: order.shipment.dropoffAddress,
      deliveredAt: order.shipment.deliveredAt,
      thirdPartyTrackingId: order.shipment.thirdPartyTrackingId,
      createdAt: order.shipment.createdAt,
    } : null;

    // Format transaction amounts
    const transactions = order.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      amountFormatted: formatVND(t.amount),
      runningBalance: t.runningBalance,
      runningBalanceFormatted: formatVND(t.runningBalance),
      paymentMethod: t.paymentMethod,
      description: t.description,
      createdAt: t.createdAt,
    }));

    return NextResponse.json(successResponse({
      id: order.id,
      orderNumber: order.orderNumber,
      shopId: order.shopId,
      shopName: order.shop.name,
      shopPhone: order.shop.phone,
      shopAddress: order.shop.address,
      shopDistrict: order.shop.district,
      shopProvince: order.shop.province,
      shopSnapshot: shopSnapshotData,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      subtotalAmount: order.subtotalAmount,
      subtotalAmountFormatted: formatVND(order.subtotalAmount),
      discountAmount: order.discountAmount,
      discountAmountFormatted: formatVND(order.discountAmount),
      deliveryFee: order.deliveryFee,
      deliveryFeeFormatted: formatVND(order.deliveryFee),
      totalAmount: order.totalAmount,
      totalAmountFormatted: formatVND(order.totalAmount),
      paidAmount: order.paidAmount,
      paidAmountFormatted: formatVND(order.paidAmount),
      creditUsed: order.creditUsed,
      creditUsedFormatted: formatVND(order.creditUsed),
      customerNotes: order.customerNotes,
      adminNotes: order.adminNotes,
      groupDealId: order.groupDealId,
      thirdPartyOrderId: order.thirdPartyOrderId,
      confirmedAt: order.confirmedAt,
      packedAt: order.packedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      cancelReason: order.cancelReason,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        unitPrice: item.unitPrice,
        unitPriceFormatted: formatVND(item.unitPrice),
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        totalPriceFormatted: formatVND(item.totalPrice),
        freeQty: item.freeQty,
      })),
      shipment,
      transactions,
    }));
  } catch (error) {
    console.error('[ORDER GET ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch order'),
      { status: 500 }
    );
  }
}
