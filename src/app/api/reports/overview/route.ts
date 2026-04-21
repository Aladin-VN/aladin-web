import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { successResponse, errorResponse, formatVND } from '@/lib/security';

// ============================================
// Reports Overview API
// Platform-wide KPIs and summary data
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
    case 'thisMonth': {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      prevStart = firstOfPrev;
      break;
    }
    case 'lastMonth': {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { start, end: lastOfPrev, prevStart, prevEnd: new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999) };
    }
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

    // ---- Orders KPIs ----
    const [ordersCurrent, ordersPrevious] = await Promise.all([
      db.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { totalAmount: true, status: true, paymentMethod: true, id: true, createdAt: true },
      }),
      db.order.findMany({
        where: { createdAt: { gte: prevStart, lte: prevEnd } },
        select: { totalAmount: true, status: true, id: true },
      }),
    ]);

    const completedOrders = ordersCurrent.filter(o => !['CANCELLED', 'REFUNDED'].includes(o.status));
    const prevCompleted = ordersPrevious.filter(o => !['CANCELLED', 'REFUNDED'].includes(o.status));

    const totalRevenue = completedOrders.reduce((s, o) => s + o.totalAmount, 0);
    const prevRevenue = prevCompleted.reduce((s, o) => s + o.totalAmount, 0);
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null;

    const totalOrders = completedOrders.length;
    const prevOrders = prevCompleted.length;
    const orderGrowth = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : null;

    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // Order status distribution
    const statusDist: Record<string, number> = {};
    ordersCurrent.forEach(o => { statusDist[o.status] = (statusDist[o.status] || 0) + 1; });

    // Payment method distribution (revenue)
    const paymentDist: Record<string, number> = {};
    completedOrders.forEach(o => { paymentDist[o.paymentMethod] = (paymentDist[o.paymentMethod] || 0) + o.totalAmount; });

    // ---- Shops ----
    const shopStats = await db.shop.findMany({
      select: { id: true, status: true as any, loyaltyTier: true, creditStatus: true, totalGmv: true, totalOrders: true, creditBalance: true, createdAt: true },
    });

    // Map User status to Shop status since Shop doesn't have a status field
    const shopUsers = await db.user.findMany({
      where: { role: 'SHOP_OWNER' },
      select: { id: true, status: true },
    });
    const userStatusMap = new Map(shopUsers.map(u => [u.id, u.status]));

    const activeShops = shopStats.filter(s => userStatusMap.get(s.id) === 'ACTIVE').length;
    const newShops = shopStats.filter(s => s.createdAt >= start).length;
    const totalCreditExposure = shopStats.reduce((s, o) => s + o.creditBalance, 0);
    const overdueShops = shopStats.filter(s => s.creditStatus === 'OVERDUE').length;

    // Tier distribution
    const tierDist: Record<string, number> = {};
    shopStats.forEach(s => { tierDist[s.loyaltyTier] = (tierDist[s.loyaltyTier] || 0) + 1; });

    // ---- Shipments ----
    const [shipmentsCurrent, shipmentsPrevious] = await Promise.all([
      db.shipment.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { status: true, type: true, createdAt: true, deliveredAt: true },
      }),
      db.shipment.findMany({
        where: { createdAt: { gte: prevStart, lte: prevEnd } },
        select: { status: true },
      }),
    ]);

    const totalShipments = shipmentsCurrent.length;
    const deliveredShipments = shipmentsCurrent.filter(s => s.status === 'DELIVERED').length;
    const failedShipments = shipmentsCurrent.filter(s => s.status === 'FAILED').length;
    const successRate = totalShipments > 0 ? Math.round((deliveredShipments / totalShipments) * 100) : 0;

    const prevDelivered = shipmentsPrevious.filter(s => s.status === 'DELIVERED').length;
    const prevTotal = shipmentsPrevious.length;
    const prevSuccessRate = prevTotal > 0 ? Math.round((prevDelivered / prevTotal) * 100) : 0;
    const successRateDelta = successRate - prevSuccessRate;

    // Avg delivery time (hours)
    const deliveryTimes = shipmentsCurrent
      .filter(s => s.status === 'DELIVERED' && s.deliveredAt)
      .map(s => (s.deliveredAt!.getTime() - s.createdAt.getTime()) / 3600000);
    const avgDeliveryHours = deliveryTimes.length > 0
      ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length * 10) / 10
      : 0;

    // Shipment type distribution
    const typeDist: Record<string, number> = {};
    shipmentsCurrent.forEach(s => { typeDist[s.type] = (typeDist[s.type] || 0) + 1; });

    // ---- Group Buy ----
    const groupDeals = await db.groupDeal.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { originalPrice: true, discountPrice: true, currentQty: true, status: true, targetQty: true },
    });
    const completedDeals = groupDeals.filter(d => d.status === 'COMPLETED');
    const totalSavings = completedDeals.reduce((s, d) => s + (d.originalPrice - d.discountPrice) * d.currentQty, 0);

    // ---- Brokers ----
    const brokerStats = await db.broker.aggregate({
      _sum: { totalGmvGenerated: true, totalCommissionEarned: true, totalShopsReferred: true },
      _count: { id: true },
    });

    // ---- Daily Revenue Trend ----
    const dailyRevenue: { date: string; revenue: number; orders: number }[] = [];
    const trendDays = period === 'today' ? 1 : period === '7d' ? 7 : period === 'thisMonth' || period === 'lastMonth' ? 30 : 30;

    for (let i = trendDays - 1; i >= 0; i--) {
      const dayStart = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
      const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1);

      const dayOrders = ordersCurrent.filter(o =>
        o.createdAt >= dayStart && o.createdAt < dayEnd && !['CANCELLED', 'REFUNDED'].includes(o.status)
      );
      const dayRevenue = dayOrders.reduce((s, o) => s + o.totalAmount, 0);

      dailyRevenue.push({
        date: dayStart.toISOString().split('T')[0],
        revenue: dayRevenue,
        orders: dayOrders.length,
      });
    }

    // ---- Top Categories ----
    const orderItems = await db.orderItem.findMany({
      where: { order: { createdAt: { gte: start, lte: end }, status: { notIn: ['CANCELLED', 'REFUNDED'] } as any } },
      select: { totalPrice: true, productId: true },
    });

    const categoryRevenue = await db.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, category: { select: { name: true } } },
    });
    const catMap = new Map(categoryRevenue.map(p => [p.id, p.category?.name || 'Other']));
    const catRevenue: Record<string, number> = {};
    orderItems.forEach(oi => {
      const cat = catMap.get(oi.productId) || 'Other';
      catRevenue[cat] = (catRevenue[cat] || 0) + oi.totalPrice;
    });
    const topCategories = Object.entries(catRevenue)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, revenue]) => ({ name, revenue, revenueFormatted: formatVND(revenue) }));

    return NextResponse.json(successResponse({
      period,
      dateRange: { from: start.toISOString(), to: end.toISOString() },
      // KPIs
      kpis: {
        totalRevenue,
        totalRevenueFormatted: formatVND(totalRevenue),
        revenueGrowth,
        totalOrders,
        orderGrowth,
        avgOrderValue,
        avgOrderValueFormatted: formatVND(avgOrderValue),
        activeShops,
        newShops,
        totalCreditExposure,
        totalCreditExposureFormatted: formatVND(totalCreditExposure),
        overdueShops,
        totalShipments,
        deliveredShipments,
        successRate,
        successRateDelta,
        avgDeliveryHours,
        totalSavings,
        totalSavingsFormatted: formatVND(totalSavings),
        brokerGmv: brokerStats._sum.totalGmvGenerated || 0,
        brokerGmvFormatted: formatVND(brokerStats._sum.totalGmvGenerated || 0),
        brokerCommission: brokerStats._sum.totalCommissionEarned || 0,
        brokerCommissionFormatted: formatVND(brokerStats._sum.totalCommissionEarned || 0),
        totalBrokers: brokerStats._count.id,
        totalShops: shopStats.length,
      },
      // Distributions
      distributions: {
        orderStatus: statusDist,
        paymentMethod: paymentDist,
        loyaltyTier: tierDist,
        shipmentType: typeDist,
      },
      // Trends
      dailyRevenue,
      topCategories,
    }));
  } catch (error: any) {
    console.error('Reports overview error:', error);
    return NextResponse.json(errorResponse('REPORTS_ERROR', error.message || 'Failed to generate overview report'), { status: 500 });
  }
}
