import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, formatVND } from '@/lib/security';

// ============================================
// Revenue Analytics API
// Revenue breakdown, trends, and growth metrics
// ============================================

function getDateRange(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || '30d';
  const now = new Date();
  let start: Date;
  let prevStart: Date;

  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      prevStart = new Date(start.getTime() - 86400000);
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 86400000);
      prevStart = new Date(now.getTime() - 14 * 86400000);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 86400000);
      prevStart = new Date(now.getTime() - 60 * 86400000);
      break;
    case '90d':
      start = new Date(now.getTime() - 90 * 86400000);
      prevStart = new Date(now.getTime() - 180 * 86400000);
      break;
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    default:
      start = new Date(now.getTime() - 30 * 86400000);
      prevStart = new Date(now.getTime() - 60 * 86400000);
  }

  return { start, end: now, prevStart, prevEnd: start };
}

export async function GET(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }, { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Token expired or invalid.' } }, { status: 401 });
    }

    const { start, end, prevStart, prevEnd } = getDateRange(request);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    // Fetch orders in range with shop info
    const orders = await db.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      select: {
        totalAmount: true,
        subtotalAmount: true,
        discountAmount: true,
        deliveryFee: true,
        creditUsed: true,
        paymentMethod: true,
        shopId: true,
        createdAt: true,
        shop: { select: { loyaltyTier: true, district: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const prevOrders = await db.order.findMany({
      where: {
        createdAt: { gte: prevStart, lte: prevEnd },
        status: { notIn: ['CANCELLED', 'REFUNDED'] },
      },
      select: { totalAmount: true, paymentMethod: true },
    });

    // ---- Core Revenue KPIs ----
    const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
    const prevRevenue = prevOrders.reduce((s, o) => s + o.totalAmount, 0);
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null;

    const totalDiscounts = orders.reduce((s, o) => s + o.discountAmount, 0);
    const totalDeliveryFees = orders.reduce((s, o) => s + o.deliveryFee, 0);
    const totalCreditUsed = orders.reduce((s, o) => s + o.creditUsed, 0);

    const avgOrderValue = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

    // ---- Revenue by Payment Method ----
    const byPaymentMethod: Record<string, { revenue: number; count: number; percentage: number }> = {};
    orders.forEach(o => {
      if (!byPaymentMethod[o.paymentMethod]) {
        byPaymentMethod[o.paymentMethod] = { revenue: 0, count: 0, percentage: 0 };
      }
      byPaymentMethod[o.paymentMethod].revenue += o.totalAmount;
      byPaymentMethod[o.paymentMethod].count++;
    });
    Object.values(byPaymentMethod).forEach(pm => {
      pm.percentage = totalRevenue > 0 ? Math.round((pm.revenue / totalRevenue) * 1000) / 10 : 0;
    });

    // ---- Revenue by Shop Tier ----
    const byTier: Record<string, { revenue: number; count: number; percentage: number }> = {};
    orders.forEach(o => {
      const tier = o.shop?.loyaltyTier || 'UNKNOWN';
      if (!byTier[tier]) byTier[tier] = { revenue: 0, count: 0, percentage: 0 };
      byTier[tier].revenue += o.totalAmount;
      byTier[tier].count++;
    });
    Object.values(byTier).forEach(t => {
      t.percentage = totalRevenue > 0 ? Math.round((t.revenue / totalRevenue) * 1000) / 10 : 0;
    });

    // ---- Revenue by District ----
    const byDistrict: Record<string, number> = {};
    orders.forEach(o => {
      const district = o.shop?.district || 'Unknown';
      byDistrict[district] = (byDistrict[district] || 0) + o.totalAmount;
    });
    const topDistricts = Object.entries(byDistrict)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([district, revenue]) => ({ district, revenue, revenueFormatted: formatVND(revenue), percentage: totalRevenue > 0 ? Math.round(revenue / totalRevenue * 1000) / 10 : 0 }));

    // ---- Daily Revenue Trend ----
    const trendDays = period === 'today' ? 1 : period === '7d' ? 7 : 30;
    const dailyTrend: { date: string; revenue: number; orders: number; avgOrderValue: number }[] = [];

    for (let i = trendDays - 1; i >= 0; i--) {
      const dayStart = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const dayOrders = orders.filter(o => o.createdAt >= dayStart && o.createdAt < dayEnd);
      const dayRev = dayOrders.reduce((s, o) => s + o.totalAmount, 0);

      dailyTrend.push({
        date: dayStart.toISOString().split('T')[0],
        revenue: dayRev,
        orders: dayOrders.length,
        avgOrderValue: dayOrders.length > 0 ? Math.round(dayRev / dayOrders.length) : 0,
      });
    }

    // ---- Weekly Revenue (for trend) ----
    const weeklyTrend: { weekStart: string; revenue: number; orders: number }[] = [];
    const weeks = Math.ceil(trendDays / 7);
    for (let w = weeks - 1; w >= 0; w--) {
      const wStart = new Date(end.getFullYear(), end.getMonth(), end.getDate() - w * 7);
      const wEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (w - 1) * 7);
      const wOrders = orders.filter(o => o.createdAt >= wStart && o.createdAt < wEnd);
      const wRev = wOrders.reduce((s, o) => s + o.totalAmount, 0);
      weeklyTrend.push({ weekStart: wStart.toISOString().split('T')[0], revenue: wRev, orders: wOrders.length });
    }

    // ---- Top Revenue Shops ----
    const shopRevenue: Record<string, { shopId: string; name: string; revenue: number; orders: number }> = {};
    orders.forEach(o => {
      const key = o.shopId;
      if (!shopRevenue[key]) {
        shopRevenue[key] = { shopId: o.shopId, name: o.shop?.name || 'Unknown', revenue: 0, orders: 0 };
      }
      shopRevenue[key].revenue += o.totalAmount;
      shopRevenue[key].orders++;
    });
    const topShops = Object.values(shopRevenue)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(s => ({ ...s, revenueFormatted: formatVND(s.revenue) }));

    // ---- Monthly comparison (this month vs last month) ----
    const now2 = new Date();
    const thisMonthStart = new Date(now2.getFullYear(), now2.getMonth(), 1);
    const lastMonthStart = new Date(now2.getFullYear(), now2.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now2.getFullYear(), now2.getMonth(), 0, 23, 59, 59, 999);

    const [thisMonthOrders, lastMonthOrders] = await Promise.all([
      db.order.findMany({
        where: { createdAt: { gte: thisMonthStart }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
        select: { totalAmount: true, id: true },
      }),
      db.order.findMany({
        where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
        select: { totalAmount: true, id: true },
      }),
    ]);

    const thisMonthRevenue = thisMonthOrders.reduce((s, o) => s + o.totalAmount, 0);
    const lastMonthRevenue = lastMonthOrders.reduce((s, o) => s + o.totalAmount, 0);
    const monthOverMonth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : null;

    return NextResponse.json(successResponse({
      period,
      kpis: {
        totalRevenue,
        totalRevenueFormatted: formatVND(totalRevenue),
        revenueGrowth,
        totalDiscounts,
        totalDiscountsFormatted: formatVND(totalDiscounts),
        totalDeliveryFees,
        totalDeliveryFeesFormatted: formatVND(totalDeliveryFees),
        totalCreditUsed,
        totalCreditUsedFormatted: formatVND(totalCreditUsed),
        avgOrderValue,
        avgOrderValueFormatted: formatVND(avgOrderValue),
        totalOrders: orders.length,
        thisMonthRevenue,
        thisMonthRevenueFormatted: formatVND(thisMonthRevenue),
        lastMonthRevenue,
        lastMonthRevenueFormatted: formatVND(lastMonthRevenue),
        monthOverMonth,
      },
      breakdown: {
        byPaymentMethod,
        byTier,
        byDistrict: topDistricts,
      },
      trends: {
        daily: dailyTrend,
        weekly: weeklyTrend,
      },
      topShops,
    }));
  } catch (error: any) {
    console.error('Revenue report error:', error);
    return NextResponse.json(errorResponse('REPORTS_ERROR', error.message || 'Failed to generate revenue report'), { status: 500 });
  }
}
