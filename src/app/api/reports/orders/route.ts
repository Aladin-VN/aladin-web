import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, formatVND } from '@/lib/security';

// ============================================
// Orders Analytics API
// Order status, payment method, trends, top shops
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
    const { start, end, prevStart, prevEnd } = getDateRange(request);
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    const [orders, prevOrders] = await Promise.all([
      db.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: {
          id: true, totalAmount: true, status: true, paymentMethod: true,
          paymentStatus: true, createdAt: true, deliveredAt: true,
          shopId: true, creditUsed: true,
          shop: { select: { name: true, loyaltyTier: true, district: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.order.findMany({
        where: { createdAt: { gte: prevStart, lte: prevEnd } },
        select: { id: true, status: true, totalAmount: true },
      }),
    ]);

    // ---- Core Order KPIs ----
    const totalOrders = orders.length;
    const prevTotal = prevOrders.length;
    const orderGrowth = prevTotal > 0 ? ((totalOrders - prevTotal) / prevTotal) * 100 : null;

    const completedOrders = orders.filter(o => o.status === 'DELIVERED');
    const cancelledOrders = orders.filter(o => o.status === 'CANCELLED');
    const pendingOrders = orders.filter(o => ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY'].includes(o.status));

    const cancellationRate = totalOrders > 0 ? Math.round((cancelledOrders.length / totalOrders) * 1000) / 10 : 0;
    const completionRate = totalOrders > 0 ? Math.round((completedOrders.length / totalOrders) * 1000) / 10 : 0;

    const totalRevenue = completedOrders.reduce((s, o) => s + o.totalAmount, 0);
    const avgOrderValue = totalOrders > 0 ? Math.round(orders.reduce((s, o) => s + o.totalAmount, 0) / totalOrders) : 0;
    const avgCompletedValue = completedOrders.length > 0 ? Math.round(totalRevenue / completedOrders.length) : 0;

    // Avg items per order
    const totalItems = orders.reduce((s, o) => s + o._count.items, 0);
    const avgItemsPerOrder = totalOrders > 0 ? Math.round((totalItems / totalOrders) * 10) / 10 : 0;

    // ---- Status Distribution ----
    const statusDist: Record<string, number> = {};
    orders.forEach(o => { statusDist[o.status] = (statusDist[o.status] || 0) + 1; });

    // ---- Payment Method Distribution ----
    const paymentDist: Record<string, { count: number; revenue: number; percentage: number }> = {};
    orders.forEach(o => {
      if (!paymentDist[o.paymentMethod]) paymentDist[o.paymentMethod] = { count: 0, revenue: 0, percentage: 0 };
      paymentDist[o.paymentMethod].count++;
      paymentDist[o.paymentMethod].revenue += o.totalAmount;
    });
    Object.values(paymentDist).forEach(pm => {
      pm.percentage = totalOrders > 0 ? Math.round((pm.count / totalOrders) * 1000) / 10 : 0;
    });

    // ---- Payment Status Distribution ----
    const payStatusDist: Record<string, number> = {};
    orders.forEach(o => { payStatusDist[o.paymentStatus] = (payStatusDist[o.paymentStatus] || 0) + 1; });

    // ---- Daily Order Trend ----
    const trendDays = period === 'today' ? 1 : period === '7d' ? 7 : 30;
    const dailyTrend: { date: string; orders: number; completed: number; cancelled: number; revenue: number }[] = [];

    for (let i = trendDays - 1; i >= 0; i--) {
      const dayStart = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const dayOrders = orders.filter(o => o.createdAt >= dayStart && o.createdAt < dayEnd);
      const dayCompleted = dayOrders.filter(o => o.status === 'DELIVERED').length;
      const dayCancelled = dayOrders.filter(o => o.status === 'CANCELLED').length;
      const dayRev = dayOrders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.totalAmount, 0);

      dailyTrend.push({
        date: dayStart.toISOString().split('T')[0],
        orders: dayOrders.length,
        completed: dayCompleted,
        cancelled: dayCancelled,
        revenue: dayRev,
      });
    }

    // ---- Top Ordering Shops ----
    const shopOrders: Record<string, { shopId: string; name: string; orders: number; revenue: number; tier: string }> = {};
    orders.forEach(o => {
      if (!shopOrders[o.shopId]) {
        shopOrders[o.shopId] = { shopId: o.shopId, name: o.shop?.name || 'Unknown', orders: 0, revenue: 0, tier: o.shop?.loyaltyTier || 'BRONZE' };
      }
      shopOrders[o.shopId].orders++;
      shopOrders[o.shopId].revenue += o.totalAmount;
    });
    const topShops = Object.values(shopOrders)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 10)
      .map(s => ({ ...s, revenueFormatted: formatVND(s.revenue) }));

    // ---- Largest Orders ----
    const largestOrders = orders
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10)
      .map(o => ({
        id: o.id,
        totalAmount: o.totalAmount,
        totalAmountFormatted: formatVND(o.totalAmount),
        shopName: o.shop?.name || 'Unknown',
        status: o.status,
        paymentMethod: o.paymentMethod,
        createdAt: o.createdAt.toISOString(),
        itemCount: o._count.items,
      }));

    // ---- Credit vs Digital vs COD breakdown ----
    const creditOrders = orders.filter(o => o.paymentMethod === 'CREDIT');
    const digitalOrders = orders.filter(o => o.paymentMethod === 'DIGITAL');
    const codOrders = orders.filter(o => o.paymentMethod === 'COD');

    const creditRevenue = creditOrders.reduce((s, o) => s + o.creditUsed, 0);
    const digitalRevenue = digitalOrders.reduce((s, o) => s + o.totalAmount, 0);
    const codRevenue = codOrders.reduce((s, o) => s + o.totalAmount, 0);

    // ---- Fulfillment Time (avg hours from created to delivered) ----
    const fulfillmentTimes = completedOrders
      .filter(o => o.deliveredAt)
      .map(o => (o.deliveredAt!.getTime() - o.createdAt.getTime()) / 3600000);
    const avgFulfillmentHours = fulfillmentTimes.length > 0
      ? Math.round(fulfillmentTimes.reduce((a, b) => a + b, 0) / fulfillmentTimes.length * 10) / 10
      : 0;

    return successResponse({
      period,
      kpis: {
        totalOrders,
        orderGrowth,
        completedOrders: completedOrders.length,
        pendingOrders: pendingOrders.length,
        cancelledOrders: cancelledOrders.length,
        cancellationRate,
        completionRate,
        totalRevenue,
        totalRevenueFormatted: formatVND(totalRevenue),
        avgOrderValue,
        avgOrderValueFormatted: formatVND(avgOrderValue),
        avgCompletedValue,
        avgCompletedValueFormatted: formatVND(avgCompletedValue),
        avgItemsPerOrder,
        avgFulfillmentHours,
        creditRevenue,
        creditRevenueFormatted: formatVND(creditRevenue),
        digitalRevenue,
        digitalRevenueFormatted: formatVND(digitalRevenue),
        codRevenue,
        codRevenueFormatted: formatVND(codRevenue),
      },
      distributions: {
        status: statusDist,
        paymentMethod: paymentDist,
        paymentStatus: payStatusDist,
      },
      trends: {
        daily: dailyTrend,
      },
      rankings: {
        topShops,
        largestOrders,
      },
    });
  } catch (error: any) {
    console.error('Orders report error:', error);
    return errorResponse('REPORTS_ERROR', error.message || 'Failed to generate orders report');
  }
}
