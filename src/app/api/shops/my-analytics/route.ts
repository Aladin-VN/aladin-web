// ALADIN Shop Owner Analytics API
// GET /api/shops/my-analytics — Comprehensive shop analytics for shop owners

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse, formatVND } from '@/lib/security';

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
    if (!hasRole(payload.role, ['SHOP_OWNER'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Shop owner access required'), { status: 403 });
    }

    const shopId = payload.shopId;
    if (!shopId) {
      return NextResponse.json(errorResponse('NO_SHOP', 'Tài khoản chưa liên kết cửa hàng'), { status: 400 });
    }

    // Get shop info
    const shop = await db.shop.findUnique({
      where: { id: shopId, deletedAt: null },
    });
    if (!shop) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shop not found'), { status: 404 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // ============================================
    // 1. Purchase trend (daily for last 30 days)
    // ============================================
    const dailyOrders = await db.order.groupBy({
      by: ['createdAt'],
      where: {
        shopId,
        createdAt: { gte: thirtyDaysAgo },
        status: { not: 'CANCELLED' },
      },
      _sum: { totalAmount: true },
      _count: true,
      orderBy: { createdAt: 'asc' },
    });

    // Aggregate into daily buckets
    const dailyMap = new Map<string, { amount: number; count: number }>();
    for (const d of dailyOrders) {
      const day = d.createdAt.toISOString().split('T')[0];
      const existing = dailyMap.get(day) || { amount: 0, count: 0 };
      existing.amount += d._sum.totalAmount || 0;
      existing.count += d._count;
      dailyMap.set(day, existing);
    }

    // Build daily trend array
    const purchaseTrend: { date: string; amount: number; orders: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      const entry = dailyMap.get(key);
      purchaseTrend.push({
        date: key,
        amount: entry?.amount || 0,
        orders: entry?.count || 0,
      });
    }

    // Weekly trend
    const weeklyTrend: { week: string; amount: number; orders: number }[] = [];
    for (let w = 3; w >= 0; w--) {
      const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      weekEnd.setHours(23, 59, 59, 999);

      const weekData = await db.order.aggregate({
        where: {
          shopId,
          createdAt: { gte: weekStart, lte: weekEnd },
          status: { not: 'CANCELLED' },
        },
        _sum: { totalAmount: true },
        _count: true,
      });

      weeklyTrend.push({
        week: `W${4 - w}`,
        amount: weekData._sum.totalAmount || 0,
        orders: weekData._count,
      });
    }

    // Monthly trend
    const monthlyTrend: { month: string; amount: number; orders: number }[] = [];
    for (let m = 5; m >= 0; m--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - m + 1, 0, 23, 59, 59, 999);

      const mData = await db.order.aggregate({
        where: {
          shopId,
          createdAt: { gte: mStart, lte: mEnd },
          status: { not: 'CANCELLED' },
        },
        _sum: { totalAmount: true },
        _count: true,
      });

      monthlyTrend.push({
        month: mStart.toLocaleDateString('vi-VN', { month: 'short' }),
        amount: mData._sum.totalAmount || 0,
        orders: mData._count,
      });
    }

    // ============================================
    // 2. Top categories by spend (30 days)
    // ============================================
    const categorySpendRaw = await db.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          shopId,
          createdAt: { gte: thirtyDaysAgo },
          status: { not: 'CANCELLED' },
        },
      },
      _sum: { totalPrice: true, quantity: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 20,
    });

    // Map productId -> category info
    const productIds = categorySpendRaw.map((c) => c.productId);
    const products = await db.product.findMany({
      where: { id: { in: productIds } },
      include: { category: { select: { id: true, name: true, nameEn: true } } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Aggregate by category
    const categoryAgg = new Map<string, { name: string; nameEn: string; amount: number; quantity: number }>();
    for (const item of categorySpendRaw) {
      const prod = productMap.get(item.productId);
      if (!prod) continue;
      const catId = prod.category.id;
      const existing = categoryAgg.get(catId) || { name: prod.category.name, nameEn: prod.category.nameEn || prod.category.name, amount: 0, quantity: 0 };
      existing.amount += item._sum.totalPrice || 0;
      existing.quantity += item._sum.quantity || 0;
      categoryAgg.set(catId, existing);
    }

    const topCategories = Array.from(categoryAgg.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
      .map((c) => ({
        category: c.name,
        categoryEn: c.nameEn,
        amount: c.amount,
        amountFormatted: formatVND(c.amount),
        quantity: c.quantity,
      }));

    // ============================================
    // 3. Order frequency (orders per week, 30 days)
    // ============================================
    const thirtyDayStats = await db.order.aggregate({
      where: {
        shopId,
        createdAt: { gte: thirtyDaysAgo },
        status: { not: 'CANCELLED' },
      },
      _count: true,
      _sum: { totalAmount: true },
      _avg: { totalAmount: true },
    });
    const orderFrequencyPerWeek = Math.round(((thirtyDayStats._count || 0) / 30) * 7 * 10) / 10;

    // ============================================
    // 4. Average order value trend (by week)
    // ============================================
    const avgOrderValueTrend: { week: string; avgValue: number }[] = [];
    for (let w = 3; w >= 0; w--) {
      const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 6 * 24 * 60 * 60 * 1000);
      weekStart.setHours(0, 0, 0, 0);
      weekEnd.setHours(23, 59, 59, 999);

      const weekData = await db.order.aggregate({
        where: {
          shopId,
          createdAt: { gte: weekStart, lte: weekEnd },
          status: { not: 'CANCELLED' },
        },
        _avg: { totalAmount: true },
      });

      avgOrderValueTrend.push({
        week: `W${4 - w}`,
        avgValue: weekData._avg.totalAmount ? Math.round(weekData._avg.totalAmount) : 0,
      });
    }

    // ============================================
    // 5. Credit utilization
    // ============================================
    const creditUsed = shop.creditBalance;
    const creditLimit = shop.creditLimit;
    const creditAvailable = Math.max(0, creditLimit - creditUsed);
    const creditUtilizationPercent = creditLimit > 0 ? Math.round((creditUsed / creditLimit) * 100) : 0;

    // ============================================
    // 6. Loyalty tier progress
    // ============================================
    const { LOYALTY_TIERS } = await import('@/lib/security');
    const tierOrder = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
    const currentTierIndex = tierOrder.indexOf(shop.loyaltyTier as typeof tierOrder[number]);
    const currentTierConfig = LOYALTY_TIERS[shop.loyaltyTier as keyof typeof LOYALTY_TIERS];
    const nextTier = currentTierIndex < tierOrder.length - 1 ? tierOrder[currentTierIndex + 1] : null;
    const nextTierConfig = nextTier ? LOYALTY_TIERS[nextTier] : null;

    const loyaltyProgress = {
      currentTier: shop.loyaltyTier,
      currentTierName: currentTierConfig?.name || shop.loyaltyTier,
      currentTierNameVi: currentTierConfig?.nameVi || shop.loyaltyTier,
      currentDiscount: currentTierConfig?.discount || 0,
      nextTier: nextTier,
      nextTierName: nextTierConfig?.name || null,
      nextTierNameVi: nextTierConfig?.nameVi || null,
      ordersNeeded: nextTierConfig ? Math.max(0, nextTierConfig.minOrders - shop.totalOrders) : 0,
      spendNeeded: nextTierConfig ? Math.max(0, nextTierConfig.minGmv - shop.totalGmv) : 0,
      progressPercent: nextTierConfig
        ? Math.min(
            Math.round(
              ((shop.totalOrders - (currentTierConfig?.minOrders || 0)) /
                (nextTierConfig.minOrders - (currentTierConfig?.minOrders || 0))) *
                100
            ),
            100
          )
        : 100,
    };

    // ============================================
    // 7. Favorite products (most ordered, 30 days)
    // ============================================
    const favoriteProductsRaw = await db.orderItem.groupBy({
      by: ['productId', 'productName', 'productSku'],
      where: {
        order: {
          shopId,
          createdAt: { gte: thirtyDaysAgo },
          status: { not: 'CANCELLED' },
        },
      },
      _sum: { quantity: true, totalPrice: true },
      _count: true,
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    });

    const favoriteProducts = favoriteProductsRaw.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      sku: p.productSku,
      totalQty: p._sum.quantity || 0,
      totalSpent: p._sum.totalPrice || 0,
      totalSpentFormatted: formatVND(p._sum.totalPrice || 0),
      orderCount: p._count,
    }));

    // ============================================
    // 8. Month-over-month comparison
    // ============================================
    const thisMonthData = await db.order.aggregate({
      where: {
        shopId,
        createdAt: { gte: thisMonthStart },
        status: { not: 'CANCELLED' },
      },
      _count: true,
      _sum: { totalAmount: true },
      _avg: { totalAmount: true },
    });

    const lastMonthData = await db.order.aggregate({
      where: {
        shopId,
        createdAt: { gte: lastMonthStart, lt: thisMonthStart },
        status: { not: 'CANCELLED' },
      },
      _count: true,
      _sum: { totalAmount: true },
      _avg: { totalAmount: true },
    });

    const momComparison = {
      thisMonth: {
        orders: thisMonthData._count,
        totalSpend: thisMonthData._sum.totalAmount || 0,
        totalSpendFormatted: formatVND(thisMonthData._sum.totalAmount || 0),
        avgOrderValue: thisMonthData._avg.totalAmount ? Math.round(thisMonthData._avg.totalAmount) : 0,
        avgOrderValueFormatted: formatVND(thisMonthData._avg.totalAmount ? Math.round(thisMonthData._avg.totalAmount) : 0),
      },
      lastMonth: {
        orders: lastMonthData._count,
        totalSpend: lastMonthData._sum.totalAmount || 0,
        totalSpendFormatted: formatVND(lastMonthData._sum.totalAmount || 0),
        avgOrderValue: lastMonthData._avg.totalAmount ? Math.round(lastMonthData._avg.totalAmount) : 0,
        avgOrderValueFormatted: formatVND(lastMonthData._avg.totalAmount ? Math.round(lastMonthData._avg.totalAmount) : 0),
      },
      ordersChange: lastMonthData._count > 0
        ? Math.round(((thisMonthData._count - lastMonthData._count) / lastMonthData._count) * 100)
        : thisMonthData._count > 0 ? 100 : 0,
      spendChange: (lastMonthData._sum.totalAmount || 0) > 0
        ? Math.round((((thisMonthData._sum.totalAmount || 0) - (lastMonthData._sum.totalAmount || 0)) / (lastMonthData._sum.totalAmount || 0)) * 100)
        : (thisMonthData._sum.totalAmount || 0) > 0 ? 100 : 0,
      aovChange: lastMonthData._avg.totalAmount
        ? Math.round(((thisMonthData._avg.totalAmount - lastMonthData._avg.totalAmount) / lastMonthData._avg.totalAmount) * 100)
        : thisMonthData._avg.totalAmount ? 100 : 0,
    };

    // ============================================
    // 9. Payment method breakdown (30 days)
    // ============================================
    const paymentBreakdown = await db.order.groupBy({
      by: ['paymentMethod'],
      where: {
        shopId,
        createdAt: { gte: thirtyDaysAgo },
        status: { not: 'CANCELLED' },
      },
      _count: true,
      _sum: { totalAmount: true },
    });

    const totalSpend30d = paymentBreakdown.reduce((sum, p) => sum + (p._sum.totalAmount || 0), 0);
    const paymentMethodBreakdown = paymentBreakdown.map((p) => ({
      method: p.paymentMethod,
      count: p._count,
      amount: p._sum.totalAmount || 0,
      amountFormatted: formatVND(p._sum.totalAmount || 0),
      percent: totalSpend30d > 0 ? Math.round(((p._sum.totalAmount || 0) / totalSpend30d) * 100) : 0,
    }));

    // ============================================
    // Summary KPIs
    // ============================================
    return NextResponse.json(successResponse({
      summary: {
        spendThisMonth: momComparison.thisMonth.totalSpend,
        spendThisMonthFormatted: momComparison.thisMonth.totalSpendFormatted,
        ordersThisMonth: momComparison.thisMonth.orders,
        avgOrderValue: momComparison.thisMonth.avgOrderValueFormatted,
        creditUsed: formatVND(creditUsed),
        orderFrequencyPerWeek,
      },
      purchaseTrend: {
        daily: purchaseTrend,
        weekly: weeklyTrend,
        monthly: monthlyTrend,
      },
      topCategories,
      orderFrequencyPerWeek,
      avgOrderValueTrend,
      creditUtilization: {
        used: creditUsed,
        usedFormatted: formatVND(creditUsed),
        limit: creditLimit,
        limitFormatted: formatVND(creditLimit),
        available: creditAvailable,
        availableFormatted: formatVND(creditAvailable),
        utilizationPercent: creditUtilizationPercent,
      },
      loyaltyProgress,
      favoriteProducts,
      momComparison,
      paymentMethodBreakdown,
    }));
  } catch (error) {
    console.error('[SHOP MY-ANALYTICS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch analytics'),
      { status: 500 }
    );
  }
}