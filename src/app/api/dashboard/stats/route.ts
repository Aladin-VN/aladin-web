// ALADIN Dashboard Stats API — Role-filtered
// GET /api/dashboard/stats
// Shows ALL-TIME data from the platform (no month filter)
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
    const orderWhere: Record<string, unknown> = { status: { not: 'CANCELLED' } };
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
      const brokerRecord = await db.broker.findFirst({
        where: { userId },
        select: { wardId: true },
      });
      if (brokerRecord?.wardId) {
        const wardShops = await db.shop.findMany({
          where: { wardId: brokerRecord.wardId },
          select: { id: true },
        });
        const brokerShopIds = wardShops.map((s) => s.id);
        shopWhere.id = { in: brokerShopIds };
        if (brokerShopIds.length > 0) {
          orderWhere.shopId = { in: brokerShopIds };
        }
      } else {
        shopWhere.id = 'NONE';
        orderWhere.shopId = 'NONE';
      }
    }

    // Run all queries in parallel — ALL-TIME data
    const [
      totalShops,
      activeShops,
      allOrders,
      totalTransactions,
      pendingShipments,
      activeGroupDeals,
      totalProducts,
      totalOrderCount,
    ] = await Promise.all([
      // Total shops
      db.shop.count({ where: shopWhere }),
      // Active shops (have at least one order)
      db.shop.count({
        where: {
          ...shopWhere,
          orders: { some: { status: { not: 'CANCELLED' } } },
        },
      }),
      // ALL non-cancelled orders (for GMV, avg, etc.)
      db.order.findMany({
        where: orderWhere,
        select: { totalAmount: true, createdAt: true, paymentMethod: true, status: true, shopId: true },
      }),
      // Credit exposure
      db.transaction.aggregate({
        where: { type: 'CREDIT_USED' },
        _sum: { amount: true },
      }),
      // Pending shipments
      db.shipment.count({
        where: {
          status: { in: ['PENDING', 'IN_TRANSIT'] },
          ...(role === ROLES.DRIVER ? { assignedDriverId: userId } : {}),
        },
      }),
      // Active group deals
      db.groupDeal.count({ where: { status: 'ACTIVE' } }),
      // Total active products
      db.product.count({ where: { deletedAt: null, isActive: true } }),
      // Total order count (including cancelled)
      db.order.count({ where: role === ROLES.SHOP_OWNER && shopId ? { shopId } : role === ROLES.DRIVER ? { OR: [{ assignedDriverId: userId }] } : {} }),
    ]);

    // Calculate KPIs from real data
    const totalGmv = allOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const creditExposure = totalTransactions._sum.amount || 0;
    const avgOrderValue = allOrders.length > 0 ? Math.round(totalGmv / allOrders.length) : 0;

    // Delivered orders
    const deliveredOrders = allOrders.filter(o => o.status === 'DELIVERED');
    const deliveredGmv = deliveredOrders.reduce((s, o) => s + o.totalAmount, 0);

    // Retention: shops that ordered in 2+ different months / shops that ever ordered
    const shopMonths = new Map<string, Set<string>>();
    allOrders.forEach(o => {
      const month = o.createdAt.toISOString().slice(0, 7); // "2025-01"
      if (!shopMonths.has(o.shopId)) shopMonths.set(o.shopId, new Set());
      shopMonths.get(o.shopId)!.add(month);
    });
    const shopsWithMultipleMonths = [...shopMonths.values()].filter(months => months.size >= 2).length;
    const shopsThatOrdered = shopMonths.size;
    const retentionRate = shopsThatOrdered > 0 ? Math.round((shopsWithMultipleMonths / shopsThatOrdered) * 100) : 0;

    // Overdue accounts
    const overdueAccounts = await db.shop.count({
      where: { ...shopWhere, creditStatus: 'OVERDUE' },
    });

    // Payment method breakdown
    const paymentBreakdown: Record<string, { count: number; revenue: number }> = {};
    allOrders.forEach(o => {
      if (!paymentBreakdown[o.paymentMethod]) paymentBreakdown[o.paymentMethod] = { count: 0, revenue: 0 };
      paymentBreakdown[o.paymentMethod].count++;
      paymentBreakdown[o.paymentMethod].revenue += o.totalAmount;
    });

    // Monthly trend (last 6 months that have data)
    const monthMap = new Map<string, { orders: number; gmv: number }>();
    allOrders.forEach(o => {
      const month = o.createdAt.toISOString().slice(0, 7);
      const entry = monthMap.get(month) || { orders: 0, gmv: 0 };
      entry.orders++;
      entry.gmv += o.totalAmount;
      monthMap.set(month, entry);
    });
    const monthlyTrend = [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, data]) => ({ month, ...data }));

    // Recent orders (last 10)
    const recentOrders = await db.order.findMany({
      where: orderWhere,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        shop: { select: { name: true } },
        items: { select: { id: true } },
      },
    });

    // Top products by revenue ALL-TIME
    const topProducts = await db.orderItem.groupBy({
      by: ['productId', 'productName', 'productSku'],
      where: {
        order: {
          ...orderWhere,
          status: { not: 'CANCELLED' },
        },
      },
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 5,
    });

    // Pipeline: count orders by status (all non-cancelled orders)
    const pipelineRaw = await db.order.groupBy({
      by: ['status'],
      where: orderWhere,
      _count: { id: true },
    });

    const PIPELINE_ORDER = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const pipeline = PIPELINE_ORDER.map((status) => ({
      status,
      count: pipelineRaw.find((p) => p.status === status)?._count.id || 0,
    }));

    // Top ordering shops ALL-TIME
    const topShops = await db.order.groupBy({
      by: ['shopId'],
      where: orderWhere,
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 5,
    });
    const topShopIds = topShops.map(s => s.shopId);
    const shopNames = await db.shop.findMany({
      where: { id: { in: topShopIds } },
      select: { id: true, name: true },
    });
    const shopNameMap = new Map(shopNames.map(s => [s.id, s.name]));

    // Category breakdown
    const categoryBreakdown = await db.orderItem.groupBy({
      by: ['productId'],
      where: { order: { ...orderWhere } },
      _sum: { totalPrice: true, quantity: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 20,
    });
    const catProductIds = categoryBreakdown.map(c => c.productId);
    const catProducts = await db.product.findMany({
      where: { id: { in: catProductIds } },
      select: { id: true, categoryId: true, category: { select: { name: true } } },
    });
    const catMap = new Map(catProducts.map(p => [p.id, p.category?.name || 'Other']));
    const categoryTotals: Record<string, { revenue: number; qty: number }> = {};
    categoryBreakdown.forEach(c => {
      const cat = catMap.get(c.productId) || 'Other';
      if (!categoryTotals[cat]) categoryTotals[cat] = { revenue: 0, qty: 0 };
      categoryTotals[cat].revenue += c._sum.totalPrice || 0;
      categoryTotals[cat].qty += c._sum.quantity || 0;
    });
    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        revenueFormatted: formatVND(data.revenue),
        qty: data.qty,
      }));

    return NextResponse.json({
      success: true,
      data: {
        totalShops,
        activeShops,
        totalOrders: allOrders.length,
        monthlyOrderCount: allOrders.length,
        monthlyGmv: totalGmv,
        monthlyGmvFormatted: formatVND(totalGmv),
        avgOrderValue,
        avgOrderValueFormatted: formatVND(avgOrderValue),
        retentionRate,
        creditExposure,
        creditExposureFormatted: formatVND(creditExposure),
        overdueAccounts,
        pendingShipments,
        activeGroupDeals,
        totalProducts,
        deliveredOrders: deliveredOrders.length,
        deliveredGmv,
        deliveredGmvFormatted: formatVND(deliveredGmv),
        pipeline,
        monthlyTrend,
        paymentBreakdown: Object.fromEntries(
          Object.entries(paymentBreakdown).map(([method, data]) => [
            method,
            { ...data, revenueFormatted: formatVND(data.revenue) },
          ])
        ),
        topShops: topShops.map(s => ({
          shopId: s.shopId,
          shopName: shopNameMap.get(s.shopId) || 'Unknown',
          orderCount: s._count.id,
          totalRevenue: s._sum.totalAmount || 0,
          totalRevenueFormatted: formatVND(s._sum.totalAmount || 0),
        })),
        topCategories,
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