// ALADIN Dashboard Stats API — Role-filtered
// GET /api/dashboard/stats
// ADMIN: sees all shops, all orders, all revenue
// SHOP_OWNER: sees only their shop's data
// SALES_REP: sees all shops (territory-wide)
// DRIVER: sees only their assigned shipments/orders
// BROKER: sees their referred shops' data

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { formatVND, ROLES } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Token expired or invalid.' } }, { status: 401 });
    }

    const role = payload.role;
    const userId = payload.userId;
    const shopId = payload.shopId;

    // Build role-specific filters
    const orderWhere: Record<string, unknown> = {};
    const shopWhere: Record<string, unknown> = { deletedAt: null };

    if (role === ROLES.SHOP_OWNER && shopId) {
      orderWhere.shopId = shopId;
      shopWhere.id = shopId;
    } else if (role === ROLES.DRIVER) {
      orderWhere.OR = [
        { assignedDriverId: userId },
        { shipments: { some: { assignedDriverId: userId } } },
      ];
    } else if (role === ROLES.BROKER) {
      // Broker sees shops they referred
      const brokerShops = await db.shop.findMany({
        where: { broker: { userId } },
        select: { id: true },
      });
      const brokerShopIds = brokerShops.map((s) => s.id);
      shopWhere.id = { in: brokerShopIds };
      if (brokerShopIds.length > 0) {
        orderWhere.shopId = { in: brokerShopIds };
      }
    }
    // ADMIN and SALES_REP see everything (no filter)

    // Run all queries in parallel
    const [
      totalShops,
      activeShops,
      monthlyOrders,
      totalTransactions,
      pendingShipments,
      activeGroupDeals,
    ] = await Promise.all([
      // Total shops
      db.shop.count({ where: shopWhere }),
      // Active shops
      db.shop.count({
        where: {
          ...shopWhere,
          orders: {
            some: {
              createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
              status: { not: 'CANCELLED' },
            },
          },
        },
      }),
      // Monthly orders & GMV (role-filtered)
      db.order.findMany({
        where: {
          ...orderWhere,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          status: { not: 'CANCELLED' },
        },
        select: { totalAmount: true },
      }),
      // Credit exposure
      db.transaction.aggregate({
        where: { type: 'CREDIT_USED' },
        _sum: { amount: true },
      }),
      // Pending shipments (role-filtered)
      db.shipment.count({
        where: {
          status: { in: ['PENDING', 'IN_TRANSIT'] },
          ...(role === ROLES.DRIVER ? { assignedDriverId: userId } : {}),
        },
      }),
      // Active group deals
      db.groupDeal.count({
        where: { status: 'ACTIVE' },
      }),
    ]);

    const monthlyGmv = monthlyOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const creditExposure = totalTransactions._sum.amount || 0;
    const overdueAccounts = await db.shop.count({
      where: { ...shopWhere, creditStatus: 'OVERDUE' },
    });
    const totalOrders = await db.order.count({ where: orderWhere });

    const avgOrderValue = monthlyOrders.length > 0 ? monthlyGmv / monthlyOrders.length : 0;

    // Retention rate
    const thisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const lastMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const lastMonthEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 0, 23, 59, 59);

    const [shopsThisMonth, shopsLastMonth, shopsBoth] = await Promise.all([
      db.shop.count({
        where: {
          ...shopWhere,
          orders: { some: { createdAt: { gte: thisMonth }, status: { not: 'CANCELLED' } } },
        },
      }),
      db.shop.count({
        where: {
          ...shopWhere,
          orders: { some: { createdAt: { gte: lastMonth, lte: lastMonthEnd }, status: { not: 'CANCELLED' } } },
        },
      }),
      db.shop.count({
        where: {
          AND: [
            { ...shopWhere, orders: { some: { createdAt: { gte: thisMonth }, status: { not: 'CANCELLED' } } } },
            { ...shopWhere, orders: { some: { createdAt: { gte: lastMonth, lte: lastMonthEnd }, status: { not: 'CANCELLED' } } } },
          ],
        },
      }),
    ]);

    const retentionRate = shopsLastMonth > 0 ? Math.round((shopsBoth / shopsLastMonth) * 100) : 0;

    // Recent orders (role-filtered, last 10)
    const recentOrders = await db.order.findMany({
      where: orderWhere,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        shop: { select: { name: true } },
        items: { select: { id: true } },
      },
    });

    // Top products by revenue this month (role-filtered)
    const topProducts = await db.orderItem.groupBy({
      by: ['productId', 'productName', 'productSku'],
      where: {
        order: {
          ...orderWhere,
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