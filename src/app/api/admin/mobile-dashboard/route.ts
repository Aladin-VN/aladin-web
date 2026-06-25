// ALADIN Admin Mobile Dashboard API
// Single GET endpoint serving all dashboard data for mobile admin oversight

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/get-auth-user';
import { successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

// ============================================
// Helpers
// ============================================

function fmt(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function formatMonth(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ============================================
// GET /api/admin/mobile-dashboard
// ============================================

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    if (!user || 'error' in user) {
      const err = user as { error: { code: string; message: string } };
      return Response.json(
        errorResponse(err.error.code, err.error.message),
        { status: 403 }
      );
    }

    // ---- Parallel queries ----
    const [
      totalOrdersResult,
      totalShopsResult,
      totalDistributorsResult,
      activeBrokersResult,
      pendingOrdersCount,
      deliveredRevenueResult,
      overdueDebtResult,
      userCountsResult,
      todayOrdersResult,
      todayRevenueResult,
      deliveredOrdersCount,
      cancelledOrdersCount,
      ordersWithDeliveryTime,
      recentPendingOrders,
      topShopsResult,
      lowStockResult,
    ] = await Promise.all([
      // Total orders (Order model has no deletedAt)
      db.order.count({}),
      // Total shops
      db.shop.count({ where: { deletedAt: null } }),
      // Total distributors
      db.distributor.count(),
      // Active brokers
      db.broker.count({ where: { user: { status: 'ACTIVE' } } }),
      // Pending orders count
      db.order.count({ where: { status: 'PENDING' } }),
      // Total revenue (delivered orders)
      db.order.aggregate({
        where: { status: 'DELIVERED' },
        _sum: { totalAmount: true },
      }),
      // Overdue debt: shops with credit usage > 7 days
      db.shop.findMany({
        where: {
          deletedAt: null,
          creditBalance: { gt: 0 },
          transactions: {
            some: {
              type: 'CREDIT_USED',
              createdAt: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
          },
        },
        select: { creditBalance: true },
      }),
      // User distribution by role
      db.user.groupBy({
        by: ['role'],
        where: { deletedAt: null },
        _count: { role: true },
      }),
      // Orders today
      db.order.count({
        where: {
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      // Revenue today
      db.order.aggregate({
        where: {
          status: 'DELIVERED',
          deliveredAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
        _sum: { totalAmount: true },
      }),
      // Delivered orders count (for returns rate)
      db.order.count({ where: { status: 'DELIVERED' } }),
      // Cancelled orders count
      db.order.count({ where: { status: 'CANCELLED' } }),
      // Orders with delivery time for avg delivery calculation
      db.order.findMany({
        where: {
          status: 'DELIVERED',
          deliveredAt: { not: null },
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
        select: { createdAt: true, deliveredAt: true },
        take: 200,
      }),
      // Recent pending orders (with shop name)
      db.order.findMany({
        where: { status: 'PENDING' },
        select: {
          id: true,
          orderNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          shop: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // Top shops by GMV
      db.shop.findMany({
        where: { deletedAt: null, totalGmv: { gt: 0 } },
        orderBy: { totalGmv: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          district: true,
          totalGmv: true,
          totalOrders: true,
        },
      }),
      // Low stock products
      db.distributorInventory.findMany({
        where: {
          quantity: { lte: 10 },
        },
        include: {
          product: {
            select: { id: true, name: true, sku: true, isActive: true },
          },
        },
        orderBy: { quantity: 'asc' },
        take: 10,
      }),
    ]);

    // ---- Revenue trend (last 6 months) ----
    // Use findMany + in-memory grouping (Prisma groupBy doesn't support date truncation in SQLite)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const recentDeliveredOrders = await db.order.findMany({
      where: {
        status: 'DELIVERED',
        createdAt: { gte: sixMonthsAgo },
      },
      select: { createdAt: true, totalAmount: true },
    });

    // Group by month
    const monthlyMap = new Map<string, { revenue: number; orders: number }>();
    for (const order of recentDeliveredOrders) {
      const month = formatMonth(order.createdAt);
      const existing = monthlyMap.get(month) || { revenue: 0, orders: 0 };
      existing.revenue += order.totalAmount;
      existing.orders += 1;
      monthlyMap.set(month, existing);
    }

    // Generate last 6 months labels
    const revenueTrend: Array<{ month: string; revenue: number; revenueFormatted: string; orders: number }> = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = formatMonth(d);
      const data = monthlyMap.get(key) || { revenue: 0, orders: 0 };
      revenueTrend.push({
        month: key,
        revenue: data.revenue,
        revenueFormatted: fmt(data.revenue),
        orders: data.orders,
      });
    }

    // ---- Compute values ----
    const totalRevenue = deliveredRevenueResult._sum?.totalAmount || 0;
    const overdueDebt = overdueDebtResult.reduce((sum, s) => sum + s.creditBalance, 0);
    const revenueToday = todayRevenueResult._sum?.totalAmount || 0;

    // User distribution
    const userDistribution = {
      admin: 0,
      shopOwner: 0,
      salesRep: 0,
      driver: 0,
      broker: 0,
      distributor: 0,
    };
    for (const row of userCountsResult) {
      switch (row.role) {
        case 'ADMIN': userDistribution.admin = row._count.role; break;
        case 'SHOP_OWNER': userDistribution.shopOwner = row._count.role; break;
        case 'SALES_REP': userDistribution.salesRep = row._count.role; break;
        case 'DRIVER': userDistribution.driver = row._count.role; break;
        case 'BROKER': userDistribution.broker = row._count.role; break;
        case 'DISTRIBUTOR': userDistribution.distributor = row._count.role; break;
      }
    }

    // Average delivery time (last 30 days)
    let avgDeliveryTime = 0;
    const deliveredWithTime = ordersWithDeliveryTime.filter(
      (o) => o.deliveredAt !== null
    );
    if (deliveredWithTime.length > 0) {
      const totalHours = deliveredWithTime.reduce((sum, o) => {
        return sum + (o.deliveredAt!.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60);
      }, 0);
      avgDeliveryTime = Math.round((totalHours / deliveredWithTime.length) * 10) / 10;
    }

    // Cancellation rate
    const returnsRate =
      deliveredOrdersCount + cancelledOrdersCount > 0
        ? Math.round((cancelledOrdersCount / (deliveredOrdersCount + cancelledOrdersCount)) * 1000) / 10
        : 0;

    // Pending orders list
    const pendingOrdersList = recentPendingOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      shopName: o.shop.name,
      totalAmount: o.totalAmount,
      totalAmountFormatted: fmt(o.totalAmount),
      createdAt: o.createdAt.toISOString(),
      status: o.status,
    }));

    // Top shops
    const topShops = topShopsResult.map((s) => ({
      id: s.id,
      name: s.name,
      district: s.district || '',
      totalGmv: s.totalGmv,
      totalGmvFormatted: fmt(s.totalGmv),
      orderCount: s.totalOrders,
    }));

    // Low stock products
    const lowStockProducts = lowStockResult
      .filter((inv) => inv.product.isActive)
      .slice(0, 10)
      .map((inv) => ({
        id: inv.product.id,
        name: inv.product.name,
        sku: inv.product.sku,
        currentStock: inv.quantity,
        minStock: inv.minStockLevel ?? 10,
      }));

    return Response.json(
      successResponse({
        totalRevenue,
        totalRevenueFormatted: fmt(totalRevenue),
        totalOrders: totalOrdersResult,
        totalShops: totalShopsResult,
        totalDistributors: totalDistributorsResult,
        activeBrokers: activeBrokersResult,
        pendingOrders: pendingOrdersCount,
        overdueDebt,
        revenueTrend,
        topShops,
        pendingOrdersList,
        userDistribution,
        lowStockProducts,
        platformHealth: {
          ordersToday: todayOrdersResult,
          revenueToday,
          revenueTodayFormatted: fmt(revenueToday),
          avgDeliveryTime,
          returnsRate,
        },
      })
    );
  } catch (error) {
    console.error('[admin/mobile-dashboard] Error:', error);
    return Response.json(
      errorResponse('INTERNAL_ERROR', 'Failed to load dashboard data'),
      { status: 500 }
    );
  }
}