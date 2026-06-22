// GET /api/settlements — Admin: list all settlements
// POST /api/settlements — Admin: generate a new settlement
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/get-auth-user';
import { SETTLEMENT_CONFIG, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;

    const { searchParams } = new URL(request.url);
    const distributorId = searchParams.get('distributorId');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: Record<string, unknown> = {};
    if (distributorId) where.distributorId = distributorId;
    if (status) where.status = status;

    const [settlements, total] = await Promise.all([
      db.settlement.findMany({
        where,
        include: { distributor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.settlement.count({ where }),
    ]);

    return NextResponse.json(successResponse({
      items: settlements,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }));
  } catch (error) {
    console.error('[SETTLEMENTS LIST ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    const { distributorId, periodStart, periodEnd } = body as {
      distributorId: string; periodStart: string; periodEnd: string;
    };

    if (!distributorId || !periodStart || !periodEnd) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'Thiếu thông tin bắt buộc.'), { status: 400 });
    }

    // Get delivered orders in period for this distributor
    const orders = await db.order.findMany({
      where: {
        distributorId,
        status: 'DELIVERED',
        deliveredAt: { gte: new Date(periodStart), lte: new Date(periodEnd) },
      },
      include: { shipment: { select: { assignedDriverId: true } } },
    });

    if (orders.length === 0) {
      return NextResponse.json(errorResponse('NO_ORDERS', 'Không có đơn hàng đã giao trong kỳ này.'), { status: 400 });
    }

    const distributor = await db.distributor.findUnique({ where: { id: distributorId } });
    if (!distributor) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Không tìm thấy nhà phân phối.'), { status: 404 });
    }

    const commissionRate = distributor.commissionRate;
    let totalOrderValue = 0;
    let totalPlatformFee = 0;
    let totalDeliveryFee = 0;
    let totalDriverPayout = 0;
    let distributorPayout = 0;

    const lineItems = orders.map((order) => {
      const platformFee = Math.round(order.totalAmount * commissionRate);
      const deliveryFee = order.deliveryFee || SETTLEMENT_CONFIG.DEFAULT_DELIVERY_FEE;
      const distAmount = order.totalAmount - platformFee - deliveryFee;
      const driverAmount = deliveryFee;

      totalOrderValue += order.totalAmount;
      totalPlatformFee += platformFee;
      totalDeliveryFee += deliveryFee;
      totalDriverPayout += driverAmount;
      distributorPayout += distAmount;

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderAmount: order.totalAmount,
        platformFee,
        deliveryFee,
        distributorAmount: distAmount,
        driverAmount,
        driverId: order.shipment?.assignedDriverId ?? null,
      };
    });

    // Generate settlement number
    const startDate = new Date(periodStart);
    const weekNum = Math.ceil((startDate.getDate()) / 7);
    const settlementNumber = `STL-${startDate.getFullYear()}${String(startDate.getMonth() + 1).padStart(2, '0')}-W${String(weekNum).padStart(2, '0')}`;

    const settlement = await db.settlement.create({
      data: {
        settlementNumber,
        distributorId,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        totalOrders: orders.length,
        totalOrderValue,
        totalPlatformFee,
        totalDeliveryFee,
        distributorPayout,
        driverPayouts: totalDriverPayout,
        status: 'PENDING',
        lineItems: { create: lineItems },
      },
    });

    return NextResponse.json(successResponse(settlement));
  } catch (error) {
    console.error('[SETTLEMENT CREATE ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}