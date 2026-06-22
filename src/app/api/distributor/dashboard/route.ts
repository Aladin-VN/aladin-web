// GET /api/distributor/dashboard — Distributor dashboard KPIs
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, SETTLEMENT_CONFIG, formatVND, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [
      pendingOrders,
      todayOrders,
      todayDelivered,
      weekFulfilled,
      distributor,
      lowStockCount,
      totalProducts,
    ] = await Promise.all([
      // Pending orders (PENDING, CONFIRMED, PROCESSING)
      db.order.count({
        where: { distributorId: distId, status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING'] } },
      }),
      // Today's orders
      db.order.count({
        where: { distributorId: distId, createdAt: { gte: today } },
      }),
      // Today's delivered orders (for revenue)
      db.order.findMany({
        where: { distributorId: distId, status: 'DELIVERED', deliveredAt: { gte: today } },
        select: { totalAmount: true },
      }),
      // Fulfilled this week
      db.order.count({
        where: { distributorId: distId, fulfilledByDistributorAt: { gte: weekAgo } },
      }),
      // Distributor info
      db.distributor.findUnique({ where: { id: distId } }),
      // Low stock items
      db.distributorInventory.count({
        where: { distributorId: distId, quantity: { lte: db.distributorInventory.fields.minStockLevel } },
      }),
      // Total products in inventory
      db.distributorInventory.count({ where: { distributorId: distId } }),
    ]);

    const todayRevenue = todayDelivered.reduce((sum, o) => sum + o.totalAmount, 0);
    const platformFee = Math.round(todayRevenue * (distributor?.commissionRate ?? SETTLEMENT_CONFIG.DEFAULT_PLATFORM_FEE));

    return NextResponse.json(successResponse({
      pendingOrders,
      todayOrders,
      todayRevenue,
      todayNetPayout: todayRevenue - platformFee,
      platformFeeToday: platformFee,
      pendingPayout: distributor?.pendingPayoutAmount ?? 0,
      totalPayouts: distributor?.totalPayouts ?? 0,
      lowStockCount,
      totalProducts,
      weekFulfilled,
      commissionRate: distributor?.commissionRate ?? SETTLEMENT_CONFIG.DEFAULT_PLATFORM_FEE,
    }));
  } catch (error) {
    console.error('[DISTRIBUTOR DASHBOARD ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}