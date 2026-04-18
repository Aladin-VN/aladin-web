// ALADIN Dashboard Stats API
// GET /api/dashboard/stats

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { formatVND } from '@/lib/security';

export async function GET() {
  try {
    // Run all queries in parallel for performance
    const [
      totalShops,
      activeShops,
      totalOrders,
      monthlyOrders,
      totalTransactions,
      pendingShipments,
      activeGroupDeals,
    ] = await Promise.all([
      // Total shops
      db.shop.count({ where: { deletedAt: null } }),
      // Active shops (ordered in last 30 days)
      db.shop.count({
        where: {
          deletedAt: null,
          orders: {
            some: {
              createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
              status: { not: 'CANCELLED' },
            },
          },
        },
      }),
      // Total orders (all time)
      db.order.count(),
      // Monthly orders & GMV
      db.order.findMany({
        where: {
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          status: { not: 'CANCELLED' },
        },
        select: { totalAmount: true },
      }),
      // Credit exposure (total outstanding)
      db.transaction.aggregate({
        where: { type: 'CREDIT_USED' },
        _sum: { amount: true },
      }),
      // Pending shipments
      db.shipment.count({
        where: { status: { in: ['PENDING', 'IN_TRANSIT'] } },
      }),
      // Active group deals
      db.groupDeal.count({
        where: { status: 'ACTIVE' },
      }),
    ]);

    const monthlyGmv = monthlyOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const creditExposure = totalTransactions._sum.amount || 0;
    const overdueAccounts = await db.shop.count({ where: { creditStatus: 'OVERDUE' } });

    // Average order value (monthly)
    const avgOrderValue = monthlyOrders.length > 0 ? monthlyGmv / monthlyOrders.length : 0;

    // Retention rate (simplified: shops that ordered this month AND last month)
    const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59);

    const [shopsThisMonth, shopsLastMonth, shopsBoth] = await Promise.all([
      db.shop.count({
        where: { orders: { some: { createdAt: { gte: thisMonth }, status: { not: 'CANCELLED' } } } },
      }),
      db.shop.count({
        where: { orders: { some: { createdAt: { gte: lastMonth, lte: lastMonthEnd }, status: { not: 'CANCELLED' } } } },
      }),
      db.shop.count({
        where: {
          AND: [
            { orders: { some: { createdAt: { gte: thisMonth }, status: { not: 'CANCELLED' } } } },
            { orders: { some: { createdAt: { gte: lastMonth, lte: lastMonthEnd }, status: { not: 'CANCELLED' } } } },
          ],
        },
      }),
    ]);

    const retentionRate = shopsLastMonth > 0 ? Math.round((shopsBoth / shopsLastMonth) * 100) : 0;

    // Recent orders (last 10)
    const recentOrders = await db.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        shop: { select: { name: true } },
        items: { select: { id: true } },
      },
    });

    // Top products by revenue this month
    const topProducts = await db.orderItem.groupBy({
      by: ['productId', 'productName', 'productSku'],
      where: {
        order: {
          createdAt: { gte: thisMonth },
          status: { not: 'CANCELLED' },
        },
      },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      data: {
        totalShops,
        activeShops,
        totalOrders,
        monthlyOrderCount: monthlyOrders.length,
        monthlyGmv,
        monthlyGmvFormatted: formatVND(monthlyGmv),
        avgOrderValue: Math.round(avgOrderValue),
        avgOrderValueFormatted: formatVND(Math.round(avgOrderValue)),
        retentionRate,
        creditExposure,
        creditExposureFormatted: formatVND(creditExposure),
        overdueAccounts,
        pendingShipments,
        activeGroupDeals,
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          shopName: o.shop.name,
          status: o.status,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          totalAmount: o.totalAmount,
          totalAmountFormatted: formatVND(o.totalAmount),
          itemCount: o.items.length,
          createdAt: o.createdAt,
        })),
        topProducts: topProducts.map((p) => ({
          productId: p.productId,
          productName: p.productName,
          productSku: p.productSku,
          totalQty: p._sum.quantity || 0,
          totalRevenue: p._sum.totalPrice || 0,
          totalRevenueFormatted: formatVND(p._sum.totalPrice || 0),
        })),
      },
    });
  } catch (error) {
    console.error('[DASHBOARD STATS ERROR]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load dashboard stats.' } },
      { status: 500 }
    );
  }
}
