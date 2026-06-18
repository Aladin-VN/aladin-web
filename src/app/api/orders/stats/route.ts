// ALADIN Order API — Order Statistics
// GET /api/orders/stats — aggregated order metrics for dashboard

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { getOrderFilter, type AuthUser } from '@/lib/get-auth-user';
import { successResponse, errorResponse, formatVND, ORDER_STATUS, PAYMENT_METHOD } from '@/lib/security';

// ============================================
// GET /api/orders/stats — Order Statistics
// ============================================

export async function GET(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    // Build auth user for role filtering
    const authUser: AuthUser = {
      userId: payload.userId,
      phone: payload.phone,
      name: '',
      role: payload.role,
      shopId: payload.shopId,
    };
    const roleFilter = getOrderFilter(authUser);

    // Parse optional shop filter
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get('shopId') || '';

    // Base where clause — merge role filter
    const where: Record<string, unknown> = { ...roleFilter };
    if (shopId) {
      where.shopId = shopId;
    }

    // Today's date boundaries (UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    // This month boundaries (UTC)
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getUTCMonth(), 1);
    const monthEnd = new Date(todayStart.getFullYear(), todayStart.getUTCMonth() + 1, 0, 23, 59, 59, 999);

    // Run all queries in parallel for performance
    const [
      totalOrders,
      pendingOrders,
      todayOrdersResult,
      monthlyOrdersResult,
      monthlyGmvResult,
      allOrdersAvg,
      ordersByStatus,
      topPaymentMethods,
    ] = await Promise.all([
      // Total orders (non-cancelled)
      db.order.count({
        where: { ...where, status: { not: ORDER_STATUS.CANCELLED } },
      }),

      // Pending orders
      db.order.count({
        where: { ...where, status: ORDER_STATUS.PENDING },
      }),

      // Today's orders
      db.order.count({
        where: {
          ...where,
          createdAt: { gte: todayStart, lte: todayEnd },
          status: { not: ORDER_STATUS.CANCELLED },
        },
      }),

      // This month's orders
      db.order.count({
        where: {
          ...where,
          createdAt: { gte: monthStart, lte: monthEnd },
          status: { not: ORDER_STATUS.CANCELLED },
        },
      }),

      // Monthly GMV (sum of delivered orders this month)
      db.order.aggregate({
        where: {
          ...where,
          createdAt: { gte: monthStart, lte: monthEnd },
          status: ORDER_STATUS.DELIVERED,
        },
        _sum: { totalAmount: true },
      }),

      // Average order value (all non-cancelled orders)
      db.order.aggregate({
        where: {
          ...where,
          status: { not: ORDER_STATUS.CANCELLED },
        },
        _avg: { totalAmount: true },
        _count: true,
      }),

      // Orders by status breakdown
      db.order.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),

      // Top payment methods
      db.order.groupBy({
        by: ['paymentMethod'],
        where: { ...where, status: { not: ORDER_STATUS.CANCELLED } },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
    ]);

    const monthlyGmv = monthlyGmvResult._sum.totalAmount || 0;
    const todayOrders = todayOrdersResult;
    const monthlyOrders = monthlyOrdersResult;
    const avgOrderValue = allOrdersAvg._avg.totalAmount
      ? Math.round(allOrdersAvg._avg.totalAmount)
      : 0;

    // Build orders by status map
    const statusBreakdown: Record<string, number> = {};
    for (const s of Object.values(ORDER_STATUS)) {
      statusBreakdown[s] = 0;
    }
    for (const group of ordersByStatus) {
      statusBreakdown[group.status] = group._count.id;
    }

    // Build payment method breakdown
    const paymentBreakdown = topPaymentMethods.map((pm) => ({
      method: pm.paymentMethod,
      count: pm._count.id,
      totalAmount: pm._sum.totalAmount || 0,
      totalAmountFormatted: formatVND(pm._sum.totalAmount || 0),
    }));

    // Sort by count descending
    paymentBreakdown.sort((a, b) => b.count - a.count);

    return NextResponse.json(successResponse({
      totalOrders,
      pendingOrders,
      todayOrders,
      monthlyOrders,
      monthlyGmv,
      monthlyGmvFormatted: formatVND(monthlyGmv),
      avgOrderValue,
      avgOrderValueFormatted: formatVND(avgOrderValue),
      ordersByStatus: statusBreakdown,
      topPaymentMethods: paymentBreakdown,
    }));
  } catch (error) {
    console.error('[ORDER STATS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch order statistics'),
      { status: 500 }
    );
  }
}
