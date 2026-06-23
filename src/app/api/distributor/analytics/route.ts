// GET /api/distributor/analytics — Comprehensive distributor analytics
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDistributorId } from '@/lib/get-auth-user';
import { ROLES, SETTLEMENT_CONFIG, successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;
    if (user.role !== ROLES.DISTRIBUTOR) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Yêu cầu quyền nhà phân phối.'), { status: 403 });
    }
    const distId = getDistributorId(user);
    if (!distId) {
      return NextResponse.json(errorResponse('NO_DISTRIBUTOR', 'Tài khoản không liên kết.'), { status: 400 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const lastWeekStart = new Date(sevenDaysAgo); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const [salesTrend, topProducts, topShops, categoryBreakdown, orderStatusDist,
      thisWeekOrders, lastWeekOrders, thisMonthOrders, lastMonthOrders,
      distributor, inventoryItems, totalInventoryValue
    ] = await Promise.all([
      // 1. Sales trend (30 days)
      db.order.findMany({
        where: { distributorId: distId, status: 'DELIVERED', deliveredAt: { gte: thirtyDaysAgo } },
        select: { deliveredAt: true, totalAmount: true, commissionRate: true },
        orderBy: { deliveredAt: 'asc' },
      }),
      // 2. Top 10 products by revenue
      db.orderItem.groupBy({
        by: ['productId'],
        where: { order: { distributorId: distId, status: 'DELIVERED' } },
        _sum: { totalPrice: true, quantity: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 10,
      }),
      // 3. Top 10 shops
      db.order.groupBy({
        by: ['shopId'],
        where: { distributorId: distId, status: 'DELIVERED' },
        _sum: { totalAmount: true },
        _count: true,
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 10,
      }),
      // 4. Category breakdown
      db.$queryRaw`
        SELECT c."name" as category, COALESCE(SUM(oi."totalPrice"), 0) as revenue, COUNT(DISTINCT o.id) as orders
        FROM "OrderItem" oi
        JOIN "Order" o ON oi."orderId" = o.id
        JOIN "Product" p ON oi."productId" = p.id
        JOIN "Category" c ON p."categoryId" = c.id
        WHERE o."distributorId" = ${distId} AND o."status" = 'DELIVERED'
        GROUP BY c."name"
        ORDER BY revenue DESC
      `,
      // 5. Order status distribution
      db.order.groupBy({
        by: ['status'],
        where: { distributorId: distId },
        _count: true,
      }),
      // 6. This week orders
      db.order.findMany({ where: { distributorId: distId, createdAt: { gte: sevenDaysAgo } }, select: { totalAmount: true } }),
      // 7. Last week orders
      db.order.findMany({ where: { distributorId: distId, createdAt: { gte: lastWeekStart, lt: sevenDaysAgo } }, select: { totalAmount: true } }),
      // 8. This month orders
      db.order.findMany({ where: { distributorId: distId, createdAt: { gte: thisMonthStart } }, select: { totalAmount: true } }),
      // 9. Last month orders
      db.order.findMany({ where: { distributorId: distId, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } }, select: { totalAmount: true } }),
      // 10. Distributor info
      db.distributor.findUnique({ where: { id: distId } }),
      // 11. Inventory items (for turnover)
      db.distributorInventory.findMany({
        where: { distributorId: distId },
        include: { product: { select: { name: true, sku: true, categoryId: true, basePrice: true } } },
      }),
      // 12. Total inventory value
      db.distributorInventory.aggregate({
        where: { distributorId: distId },
        _sum: { quantity: true },
      }),
    ]);

    // Process sales trend into daily buckets
    const dailyMap = new Map<string, { revenue: number; orders: number; netPayout: number }>();
    for (const o of salesTrend) {
      const day = o.deliveredAt?.toISOString().slice(0, 10) || 'unknown';
      const existing = dailyMap.get(day) || { revenue: 0, orders: 0, netPayout: 0 };
      existing.revenue += o.totalAmount;
      existing.orders += 1;
      existing.netPayout += o.totalAmount * (1 - (distributor?.commissionRate ?? SETTLEMENT_CONFIG.DEFAULT_PLATFORM_FEE));
      dailyMap.set(day, existing);
    }
    const salesTrendData = Array.from(dailyMap.entries()).map(([date, d]) => ({ date, ...d }));

    // Enrich top products with names
    const productIds = topProducts.map(p => p.productId);
    const products = productIds.length > 0 ? await db.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true, imageUrl: true },
    }) : [];
    const productMap = new Map(products.map(p => [p.id, p]));
    const topProductsData = topProducts.map(p => {
      const info = productMap.get(p.productId);
      return {
        productId: p.productId,
        productName: info?.name || 'Unknown',
        sku: info?.sku || '',
        revenue: p._sum.totalPrice,
        quantity: p._sum.quantity,
      };
    });

    // Enrich top shops
    const shopIds = topShops.map(s => s.shopId);
    const shops = shopIds.length > 0 ? await db.shop.findMany({
      where: { id: { in: shopIds } },
      select: { id: true, name: true, district: true, province: true },
    }) : [];
    const shopMap = new Map(shops.map(s => [s.id, s]));
    const topShopsData = topShops.map(s => {
      const info = shopMap.get(s.shopId);
      return {
        shopId: s.shopId,
        shopName: info?.name || 'Unknown',
        district: info?.district || '',
        province: info?.province || '',
        revenue: s._sum.totalPrice,
        orderCount: s._count,
      };
    });

    // Period comparisons
    const sumOrders = (arr: { totalAmount: number }[]) => arr.reduce((s, o) => s + o.totalAmount, 0);
    const thisWeekRev = sumOrders(thisWeekOrders);
    const lastWeekRev = sumOrders(lastWeekOrders);
    const thisMonthRev = sumOrders(thisMonthOrders);
    const lastMonthRev = sumOrders(lastMonthOrders);

    // Inventory turnover (simple: delivered qty / avg stock)
    const totalDelivered30 = await db.orderItem.count({
      where: { order: { distributorId: distId, status: 'DELIVERED', deliveredAt: { gte: thirtyDaysAgo } } },
    });
    const avgStock = totalInventoryValue._sum.quantity || 1;
    const turnoverRate = (totalDelivered30 / avgStock / 30).toFixed(2);

    // Margin analysis (per inventory item: basePrice - costPrice)
    const marginData = inventoryItems.map(inv => ({
      productId: inv.productId,
      productName: inv.product.name,
      sku: inv.product.sku,
      costPrice: inv.costPrice,
      sellingPrice: inv.product.basePrice,
      margin: inv.costPrice ? ((inv.product.basePrice - inv.costPrice) / inv.product.basePrice * 100).toFixed(1) : '0',
      stock: inv.quantity,
    })).sort((a, b) => parseFloat(b.margin as string) - parseFloat(a.margin as string));

    return NextResponse.json(successResponse({
      salesTrend: salesTrendData,
      topProducts: topProductsData,
      topShops: topShopsData,
      categoryBreakdown: categoryBreakdown as any[],
      orderStatusDistribution: orderStatusDist.map(s => ({ status: s.status, count: s._count })),
      comparison: {
        thisWeek: { revenue: thisWeekRev, orders: thisWeekOrders.length },
        lastWeek: { revenue: lastWeekRev, orders: lastWeekOrders.length },
        weekGrowth: lastWeekRev > 0 ? ((thisWeekRev - lastWeekRev) / lastWeekRev * 100).toFixed(1) : '0',
        thisMonth: { revenue: thisMonthRev, orders: thisMonthOrders.length },
        lastMonth: { revenue: lastMonthRev, orders: lastMonthOrders.length },
        monthGrowth: lastMonthRev > 0 ? ((thisMonthRev - lastMonthRev) / lastMonthRev * 100).toFixed(1) : '0',
      },
      inventory: {
        turnoverRate,
        totalProducts: inventoryItems.length,
        totalValue: totalInventoryValue._sum.quantity,
        lowStock: inventoryItems.filter(i => i.quantity <= i.minStockLevel).length,
      },
      marginAnalysis: marginData.slice(0, 20),
      commissionRate: distributor?.commissionRate ?? SETTLEMENT_CONFIG.DEFAULT_PLATFORM_FEE,
    }));
  } catch (error) {
    console.error('[DISTRIBUTOR ANALYTICS ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', 'Lỗi hệ thống.'), { status: 500 });
  }
}