import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, formatVND } from '@/lib/security';

// ============================================
// Shipments Analytics API
// Delivery performance, driver stats, success rates
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

    const [shipments, prevShipments] = await Promise.all([
      db.shipment.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: {
          id: true, status: true, type: true, createdAt: true,
          deliveredAt: true, assignedDriverId: true,
          order: {
            select: {
              totalAmount: true, orderNumber: true,
              shop: { select: { name: true, district: true } },
            },
          },
          assignedDriver: {
            select: { id: true, name: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      db.shipment.findMany({
        where: { createdAt: { gte: prevStart, lte: prevEnd } },
        select: { status: true, type: true, deliveredAt: true, createdAt: true },
      }),
    ]);

    // ---- Core KPIs ----
    const totalShipments = shipments.length;
    const prevTotal = prevShipments.length;
    const shipmentGrowth = prevTotal > 0 ? ((totalShipments - prevTotal) / prevTotal) * 100 : null;

    const pendingShipments = shipments.filter(s => s.status === 'PENDING').length;
    const inTransit = shipments.filter(s => s.status === 'IN_TRANSIT').length;
    const pickedUp = shipments.filter(s => s.status === 'PICKED_UP').length;
    const delivered = shipments.filter(s => s.status === 'DELIVERED').length;
    const failed = shipments.filter(s => s.status === 'FAILED').length;

    const successRate = totalShipments > 0 ? Math.round((delivered / totalShipments) * 1000) / 10 : 0;
    const failureRate = totalShipments > 0 ? Math.round((failed / totalShipments) * 1000) / 10 : 0;

    const prevDelivered = prevShipments.filter(s => s.status === 'DELIVERED').length;
    const prevSuccessRate = prevTotal > 0 ? Math.round((prevDelivered / prevTotal) * 1000) / 10 : 0;
    const successRateDelta = successRate - prevSuccessRate;

    // ---- Delivery Time Analytics ----
    const deliveryTimes = shipments
      .filter(s => s.status === 'DELIVERED' && s.deliveredAt)
      .map(s => (s.deliveredAt!.getTime() - s.createdAt.getTime()) / 3600000);

    const avgDeliveryHours = deliveryTimes.length > 0
      ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length * 10) / 10
      : 0;
    const minDeliveryHours = deliveryTimes.length > 0
      ? Math.round(Math.min(...deliveryTimes) * 10) / 10
      : 0;
    const maxDeliveryHours = deliveryTimes.length > 0
      ? Math.round(Math.max(...deliveryTimes) * 10) / 10
      : 0;

    // Delivery time distribution buckets
    const deliveryTimeBuckets: Record<string, number> = {
      under2h: 0, '2-4h': 0, '4-8h': 0, '8-24h': 0, over24h: 0,
    };
    deliveryTimes.forEach(t => {
      if (t < 2) deliveryTimeBuckets.under2h++;
      else if (t < 4) deliveryTimeBuckets['2-4h']++;
      else if (t < 8) deliveryTimeBuckets['4-8h']++;
      else if (t < 24) deliveryTimeBuckets['8-24h']++;
      else deliveryTimeBuckets.over24h++;
    });

    // ---- Shipment Value ----
    const totalValue = shipments
      .filter(s => s.status === 'DELIVERED')
      .reduce((s, sh) => s + sh.order.totalAmount, 0);
    const avgShipmentValue = delivered > 0 ? Math.round(totalValue / delivered) : 0;

    // ---- Type Distribution ----
    const internal = shipments.filter(s => s.type === 'INTERNAL').length;
    const thirdParty = shipments.filter(s => s.type === 'THIRD_PARTY').length;

    const internalDelivered = shipments.filter(s => s.type === 'INTERNAL' && s.status === 'DELIVERED').length;
    const thirdPartyDelivered = shipments.filter(s => s.type === 'THIRD_PARTY' && s.status === 'DELIVERED').length;

    const internalSuccessRate = internal > 0 ? Math.round((internalDelivered / internal) * 1000) / 10 : 0;
    const thirdPartySuccessRate = thirdParty > 0 ? Math.round((thirdPartyDelivered / thirdParty) * 1000) / 10 : 0;

    // ---- Status Distribution ----
    const statusDist: Record<string, number> = {};
    shipments.forEach(s => { statusDist[s.status] = (statusDist[s.status] || 0) + 1; });

    // ---- Daily Shipment Trend ----
    const trendDays = period === 'today' ? 1 : period === '7d' ? 7 : 30;
    const dailyTrend: { date: string; total: number; delivered: number; failed: number; inTransit: number }[] = [];

    for (let i = trendDays - 1; i >= 0; i--) {
      const dayStart = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const dayShipments = shipments.filter(s => s.createdAt >= dayStart && s.createdAt < dayEnd);
      dailyTrend.push({
        date: dayStart.toISOString().split('T')[0],
        total: dayShipments.length,
        delivered: dayShipments.filter(s => s.status === 'DELIVERED').length,
        failed: dayShipments.filter(s => s.status === 'FAILED').length,
        inTransit: dayShipments.filter(s => s.status === 'IN_TRANSIT' || s.status === 'PICKED_UP').length,
      });
    }

    // ---- Driver Performance ----
    const driverPerf: Record<string, {
      driverId: string; name: string; phone: string;
      totalShipments: number; delivered: number; failed: number; inTransit: number;
      successRate: number; avgDeliveryHours: number;
      totalValue: number; totalValueFormatted: string;
    }> = {};

    shipments.forEach(s => {
      const did = s.assignedDriverId || 'unassigned';
      if (!driverPerf[did]) {
        driverPerf[did] = {
          driverId: did, name: s.assignedDriver?.name || (did === 'unassigned' ? 'Unassigned' : 'Unknown'),
          phone: s.assignedDriver?.phone || '',
          totalShipments: 0, delivered: 0, failed: 0, inTransit: 0,
          successRate: 0, avgDeliveryHours: 0, totalValue: 0, totalValueFormatted: '0 ₫',
        };
      }
      driverPerf[did].totalShipments++;
      if (s.status === 'DELIVERED') {
        driverPerf[did].delivered++;
        driverPerf[did].totalValue += s.order.totalAmount;
      }
      if (s.status === 'FAILED') driverPerf[did].failed++;
      if (s.status === 'IN_TRANSIT' || s.status === 'PICKED_UP') driverPerf[did].inTransit++;
    });

    // Calculate success rates and avg delivery times
    Object.values(driverPerf).forEach(d => {
      d.successRate = d.totalShipments > 0 ? Math.round((d.delivered / d.totalShipments) * 1000) / 10 : 0;
      d.totalValueFormatted = formatVND(d.totalValue);
    });

    // Calculate driver avg delivery times
    const driverDeliveryTimes: Record<string, number[]> = {};
    shipments.forEach(s => {
      if (s.assignedDriverId && s.status === 'DELIVERED' && s.deliveredAt) {
        const hours = (s.deliveredAt.getTime() - s.createdAt.getTime()) / 3600000;
        if (!driverDeliveryTimes[s.assignedDriverId]) driverDeliveryTimes[s.assignedDriverId] = [];
        driverDeliveryTimes[s.assignedDriverId].push(hours);
      }
    });
    Object.entries(driverDeliveryTimes).forEach(([did, times]) => {
      if (driverPerf[did] && times.length > 0) {
        driverPerf[did].avgDeliveryHours = Math.round(times.reduce((a, b) => a + b, 0) / times.length * 10) / 10;
      }
    });

    const topDrivers = Object.values(driverPerf)
      .filter(d => d.driverId !== 'unassigned')
      .sort((a, b) => b.delivered - a.delivered)
      .slice(0, 15);

    // ---- District Delivery Performance ----
    const districtPerf: Record<string, { total: number; delivered: number; failed: number }> = {};
    shipments.forEach(s => {
      const district = s.order?.shop?.district || 'Unknown';
      if (!districtPerf[district]) districtPerf[district] = { total: 0, delivered: 0, failed: 0 };
      districtPerf[district].total++;
      if (s.status === 'DELIVERED') districtPerf[district].delivered++;
      if (s.status === 'FAILED') districtPerf[district].failed++;
    });
    const topDistricts = Object.entries(districtPerf)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 15)
      .map(([district, data]) => ({
        district,
        ...data,
        successRate: data.total > 0 ? Math.round((data.delivered / data.total) * 1000) / 10 : 0,
        failureRate: data.total > 0 ? Math.round((data.failed / data.total) * 1000) / 10 : 0,
      }));

    return NextResponse.json(successResponse({
      period,
      kpis: {
        totalShipments,
        shipmentGrowth,
        pendingShipments,
        inTransit: inTransit + pickedUp,
        delivered,
        failed,
        successRate,
        failureRate,
        successRateDelta,
        avgDeliveryHours,
        minDeliveryHours,
        maxDeliveryHours,
        totalValue,
        totalValueFormatted: formatVND(totalValue),
        avgShipmentValue: avgShipmentValue,
        avgShipmentValueFormatted: formatVND(avgShipmentValue),
        internal,
        thirdParty,
        internalSuccessRate,
        thirdPartySuccessRate,
      },
      distributions: {
        status: statusDist,
        deliveryTimeBuckets,
      },
      trends: {
        daily: dailyTrend,
      },
      rankings: {
        drivers: topDrivers,
        districts: topDistricts,
      },
    }));
  } catch (error: any) {
    console.error('Shipments analytics error:', error);
    return NextResponse.json(errorResponse('REPORTS_ERROR', error.message || 'Failed to generate shipments report'), { status: 500 });
  }
}
