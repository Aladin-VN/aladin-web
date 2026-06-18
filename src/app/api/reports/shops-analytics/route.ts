import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, formatVND } from '@/lib/security';

// ============================================
// Shops Analytics API
// Shop performance ranking, credit health, geographic distribution
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

    // ---- Shop stats with user status ----
    const shops = await db.shop.findMany({
      where: { deletedAt: null },
      select: {
        id: true, name: true, district: true, province: true,
        loyaltyTier: true, creditStatus: true, creditLimit: true,
        creditBalance: true, totalOrders: true, totalGmv: true, avgOrderValue: true,
        shopType: true, createdAt: true, wardId: true,
        user: { select: { id: true, status: true, name: true, phone: true, createdAt: true } },
      },
    });

    const userStatusMap = new Map(shops.map(s => [s.id, s.user?.status || 'UNKNOWN']));

    // ---- Core KPIs ----
    const totalShops = shops.length;
    const activeShops = shops.filter(s => userStatusMap.get(s.id) === 'ACTIVE').length;
    const newShops = shops.filter(s => s.createdAt >= start).length;
    const prevNewShops = shops.filter(s => s.createdAt >= prevStart && s.createdAt < prevEnd).length;
    const newShopsGrowth = prevNewShops > 0 ? ((newShops - prevNewShops) / prevNewShops) * 100 : null;

    const totalGmv = shops.reduce((s, o) => s + o.totalGmv, 0);
    const totalCreditExposure = shops.reduce((s, o) => s + o.creditBalance, 0);
    const totalCreditLimit = shops.reduce((s, o) => s + o.creditLimit, 0);
    const creditUtilization = totalCreditLimit > 0 ? Math.round((totalCreditExposure / totalCreditLimit) * 1000) / 10 : 0;

    const overdueShops = shops.filter(s => s.creditStatus === 'OVERDUE').length;
    const lockedShops = shops.filter(s => s.creditStatus === 'LOCKED').length;
    const healthyShops = shops.filter(s => s.creditStatus === 'ACTIVE').length;

    // ---- Tier Distribution ----
    const tierDist: Record<string, { count: number; gmv: number; percentage: number }> = {};
    shops.forEach(s => {
      const tier = s.loyaltyTier || 'BRONZE';
      if (!tierDist[tier]) tierDist[tier] = { count: 0, gmv: 0, percentage: 0 };
      tierDist[tier].count++;
      tierDist[tier].gmv += s.totalGmv;
    });
    Object.values(tierDist).forEach(t => {
      t.percentage = totalShops > 0 ? Math.round((t.count / totalShops) * 1000) / 10 : 0;
    });

    // ---- Shop Type Distribution ----
    const typeDist: Record<string, number> = {};
    shops.forEach(s => { typeDist[s.shopType || 'TAPHOA'] = (typeDist[s.shopType || 'TAPHOA'] || 0) + 1; });

    // ---- Geographic Distribution ----
    const districtDist: Record<string, { count: number; gmv: number }> = {};
    shops.forEach(s => {
      const d = s.district || 'Unknown';
      if (!districtDist[d]) districtDist[d] = { count: 0, gmv: 0 };
      districtDist[d].count++;
      districtDist[d].gmv += s.totalGmv;
    });
    const topDistricts = Object.entries(districtDist)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
      .map(([district, data]) => ({ district, ...data, gmvFormatted: formatVND(data.gmv) }));

    // ---- Credit Health ----
    const creditHealth = {
      active: healthyShops,
      overdue: overdueShops,
      locked: lockedShops,
      utilizationPercent: creditUtilization,
      totalExposure: totalCreditExposure,
      totalExposureFormatted: formatVND(totalCreditExposure),
      totalLimit: totalCreditLimit,
      totalLimitFormatted: formatVND(totalCreditLimit),
      available: totalCreditLimit - totalCreditExposure,
      availableFormatted: formatVND(totalCreditLimit - totalCreditExposure),
    };

    // ---- Top Performing Shops ----
    const topByGmv = [...shops]
      .sort((a, b) => b.totalGmv - a.totalGmv)
      .slice(0, 15)
      .map(s => ({
        id: s.id,
        name: s.name,
        district: s.district,
        loyaltyTier: s.loyaltyTier,
        totalOrders: s.totalOrders,
        totalGmv: s.totalGmv,
        totalGmvFormatted: formatVND(s.totalGmv),
        avgOrderValue: s.avgOrderValue,
        avgOrderValueFormatted: formatVND(s.avgOrderValue),
        status: userStatusMap.get(s.id),
      }));

    const topByOrders = [...shops]
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 15)
      .map(s => ({
        id: s.id,
        name: s.name,
        district: s.district,
        loyaltyTier: s.loyaltyTier,
        totalOrders: s.totalOrders,
        totalGmv: s.totalGmv,
        totalGmvFormatted: formatVND(s.totalGmv),
        status: userStatusMap.get(s.id),
      }));

    // ---- Period orders per shop ----
    const periodOrders = await db.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { shopId: true, totalAmount: true, status: true, id: true },
    });

    const shopPeriodOrders: Record<string, { count: number; revenue: number }> = {};
    periodOrders.forEach(o => {
      if (!shopPeriodOrders[o.shopId]) shopPeriodOrders[o.shopId] = { count: 0, revenue: 0 };
      shopPeriodOrders[o.shopId].count++;
      if (!['CANCELLED', 'REFUNDED'].includes(o.status)) {
        shopPeriodOrders[o.shopId].revenue += o.totalAmount;
      }
    });

    const topByPeriodRevenue = Object.entries(shopPeriodOrders)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 15)
      .map(([shopId, data]) => {
        const shop = shops.find(s => s.id === shopId);
        return {
          shopId,
          name: shop?.name || 'Unknown',
          district: shop?.district,
          tier: shop?.loyaltyTier,
          ...data,
          revenueFormatted: formatVND(data.revenue),
        };
      });

    // ---- Dormant Shops (no orders in period) ----
    const activeShopIds = new Set(periodOrders.map(o => o.shopId));
    const dormantShops = shops.filter(s => userStatusMap.get(s.id) === 'ACTIVE' && !activeShopIds.has(s.id));

    // ---- New Shops Trend (daily for period) ----
    const trendDays = period === 'today' ? 1 : period === '7d' ? 7 : 30;
    const dailyNewShops: { date: string; count: number }[] = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const dayStart = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const count = shops.filter(s => s.createdAt >= dayStart && s.createdAt < dayEnd).length;
      dailyNewShops.push({ date: dayStart.toISOString().split('T')[0], count });
    }

    return NextResponse.json(successResponse({
      period,
      kpis: {
        totalShops,
        activeShops,
        newShops,
        newShopsGrowth,
        totalGmv,
        totalGmvFormatted: formatVND(totalGmv),
        dormantShops: dormantShops.length,
        creditHealth,
      },
      distributions: {
        tier: tierDist,
        shopType: typeDist,
        district: topDistricts,
      },
      rankings: {
        topByGmv,
        topByOrders,
        topByPeriodRevenue,
      },
      trends: {
        dailyNewShops,
      },
    }));
  } catch (error: any) {
    console.error('Shops analytics error:', error);
    return NextResponse.json(errorResponse('REPORTS_ERROR', error.message || 'Failed to generate shops report'), { status: 500 });
  }
}
