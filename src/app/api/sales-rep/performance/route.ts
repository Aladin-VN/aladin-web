// ALADIN Sales Rep API — Performance Metrics
// GET /api/sales-rep/performance?period=7d|30d|90d

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/get-auth-user';
import { successResponse, errorResponse, ROLES } from '@/lib/security';

function parsePeriod(period: string): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let days = 30;
  if (period === '7d') days = 7;
  else if (period === '90d') days = 90;
  else if (period === '30d') days = 30;

  const start = new Date(now.getTime() - days * 86400000);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || (user.role !== ROLES.SALES_REP && user.role !== ROLES.ADMIN)) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Sales Rep or Admin access required'), { status: 403 });
    }

    const period = request.nextUrl.searchParams.get('period') || '30d';
    const { start, end } = parsePeriod(period);

    // ── Fetch all check-ins in period ──
    const checkins = await db.auditLog.findMany({
      where: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKIN',
        createdAt: { gte: start, lte: end },
      },
      select: { id: true, details: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalVisits = checkins.length;

    // Unique shops visited
    const uniqueShopsVisited = new Set<string>();
    for (const ci of checkins) {
      try {
        const d = JSON.parse(ci.details || '{}');
        if (d.shopId) uniqueShopsVisited.add(d.shopId);
      } catch { /* skip */ }
    }

    // ── Fetch all check-outs in period ──
    const checkouts = await db.auditLog.findMany({
      where: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKOUT',
        createdAt: { gte: start, lte: end },
      },
      select: { details: true, createdAt: true },
    });

    let visitsWithOrders = 0;
    let totalOrders = 0;
    let totalRevenue = 0;
    const orderIds: string[] = [];

    for (const co of checkouts) {
      try {
        const d = JSON.parse(co.details || '{}');
        if (d.orderPlaced) {
          visitsWithOrders++;
          totalOrders++;
          totalRevenue += d.orderAmount || 0;
          if (d.orderId) orderIds.push(d.orderId);
        }
      } catch { /* skip */ }
    }

    const conversionRate = totalVisits > 0 ? Math.round((visitsWithOrders / totalVisits) * 100) / 100 : 0;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // ── Top 5 products from orders placed during visits ──
    let topProducts: Array<{ productId: string; productName: string; sku: string; quantitySold: number }> = [];
    if (orderIds.length > 0) {
      const orderItems = await db.orderItem.findMany({
        where: { orderId: { in: orderIds } },
        select: { productId: true, productName: true, productSku: true, quantity: true },
      });

      const productMap = new Map<string, { productName: string; sku: string; qty: number }>();
      for (const item of orderItems) {
        const existing = productMap.get(item.productId);
        if (existing) {
          existing.qty += item.quantity;
        } else {
          productMap.set(item.productId, {
            productName: item.productName,
            sku: item.productSku,
            qty: item.quantity,
          });
        }
      }

      topProducts = Array.from(productMap.entries())
        .map(([productId, v]) => ({
          productId,
          productName: v.productName,
          sku: v.sku,
          quantitySold: v.qty,
        }))
        .sort((a, b) => b.quantitySold - a.quantitySold)
        .slice(0, 5);
    }

    // ── Daily breakdown ──
    const dailyMap = new Map<string, { visits: number; orders: number; revenue: number }>();

    // Init all days in range
    const cursor = new Date(start);
    while (cursor <= end) {
      const dayKey = cursor.toISOString().slice(0, 10);
      dailyMap.set(dayKey, { visits: 0, orders: 0, revenue: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Fill visits
    for (const ci of checkins) {
      const dayKey = ci.createdAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(dayKey);
      if (entry) entry.visits++;
    }

    // Fill orders & revenue
    for (const co of checkouts) {
      try {
        const d = JSON.parse(co.details || '{}');
        if (d.orderPlaced) {
          const dayKey = co.createdAt.toISOString().slice(0, 10);
          const entry = dailyMap.get(dayKey);
          if (entry) {
            entry.orders++;
            entry.revenue += d.orderAmount || 0;
          }
        }
      } catch { /* skip */ }
    }

    const dailyBreakdown = Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .filter((d) => d.visits > 0 || d.orders > 0 || d.revenue > 0);

    return NextResponse.json(
      successResponse({
        period,
        totalVisits,
        uniqueShopsVisited: uniqueShopsVisited.size,
        conversionRate,
        totalOrders,
        totalRevenue,
        avgOrderValue,
        topProducts,
        dailyBreakdown,
      })
    );
  } catch (error) {
    console.error('[SALES_REP PERFORMANCE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to load performance metrics'),
      { status: 500 }
    );
  }
}