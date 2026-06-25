// ALADIN Sales Rep API — KPI Dashboard
// GET /api/sales-rep/dashboard

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/get-auth-user';
import { successResponse, errorResponse, ROLES } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || (user.role !== ROLES.SALES_REP && user.role !== ROLES.ADMIN)) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Sales Rep or Admin access required'), { status: 403 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Today's visits (check-in AuditLogs) ──
    const todayCheckins = await db.auditLog.findMany({
      where: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKIN',
        createdAt: { gte: todayStart },
      },
      select: { id: true, entityId: true, details: true, createdAt: true },
    });

    const todayVisitedShopIds = new Set(
      todayCheckins.map((c) => {
        try { return JSON.parse(c.details || '{}').shopId; } catch { return null; }
      }).filter(Boolean)
    );

    // ── Month visits ──
    const monthCheckins = await db.auditLog.findMany({
      where: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKIN',
        createdAt: { gte: monthStart },
      },
      select: { id: true, entityId: true, details: true, createdAt: true },
    });

    const monthVisitedShopIds = new Set(
      monthCheckins.map((c) => {
        try { return JSON.parse(c.details || '{}').shopId; } catch { return null; }
      }).filter(Boolean)
    );

    // ── Month orders & revenue (from checkout logs where orderPlaced=true) ──
    const monthCheckouts = await db.auditLog.findMany({
      where: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKOUT',
        createdAt: { gte: monthStart },
      },
      select: { details: true },
    });

    let monthOrders = 0;
    let monthRevenue = 0;
    for (const co of monthCheckouts) {
      try {
        const d = JSON.parse(co.details || '{}');
        if (d.orderPlaced) {
          monthOrders++;
          monthRevenue += d.orderAmount || 0;
        }
      } catch { /* skip malformed */ }
    }

    // ── Total assigned shops ──
    const totalShops = await db.shop.count({
      where: { deletedAt: null },
    });

    // ── Visit rate ──
    const visitRate = totalShops > 0 ? Math.round((monthVisitedShopIds.size / totalShops) * 100) : 0;

    // ── Avg order value ──
    const avgOrderValue = monthOrders > 0 ? Math.round(monthRevenue / monthOrders) : 0;

    // ── Today's route (planned + visited) ──
    // Show all active shops; mark those visited today
    const allShops = await db.shop.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, address: true, district: true },
      orderBy: { name: 'asc' },
    });

    const todayRoute = allShops.map((shop) => {
      const isVisited = todayVisitedShopIds.has(shop.id);
      return {
        shopId: shop.id,
        name: shop.name,
        address: shop.address || '',
        visitStatus: isVisited ? 'VISITED' as const : 'PLANNED' as const,
        orderPlaced: false, // filled below
      };
    });

    // Check which visited shops had orders
    const todayCheckouts = await db.auditLog.findMany({
      where: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKOUT',
        createdAt: { gte: todayStart },
      },
      select: { details: true },
    });

    const orderPlacedShopIds = new Set<string>();
    for (const co of todayCheckouts) {
      try {
        const d = JSON.parse(co.details || '{}');
        if (d.orderPlaced && d.shopId) orderPlacedShopIds.add(d.shopId);
      } catch { /* skip */ }
    }

    for (const stop of todayRoute) {
      if (orderPlacedShopIds.has(stop.shopId)) stop.orderPlaced = true;
    }

    return NextResponse.json(
      successResponse({
        todayVisits: todayCheckins.length,
        monthVisits: monthCheckins.length,
        monthOrders,
        monthRevenue,
        visitRate,
        avgOrderValue,
        todayRoute,
      })
    );
  } catch (error) {
    console.error('[SALES_REP DASHBOARD ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to load sales rep dashboard'),
      { status: 500 }
    );
  }
}