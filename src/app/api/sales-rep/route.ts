// ALADIN Sales Rep API — Route for a specific date
// GET /api/sales-rep/route?date=YYYY-MM-DD

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

    const dateStr = request.nextUrl.searchParams.get('date');
    const targetDate = dateStr ? new Date(dateStr + 'T00:00:00.000Z') : new Date();
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    // ── Get all active shops ──
    const shops = await db.shop.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        address: true,
        district: true,
        lat: true,
        lng: true,
        user: { select: { phone: true } },
      },
      orderBy: { name: 'asc' },
    });

    // ── Get check-in logs for this date ──
    const checkins = await db.auditLog.findMany({
      where: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKIN',
        createdAt: { gte: targetDate, lt: dayEnd },
      },
      select: { entityId: true, details: true, createdAt: true },
    });

    // Build map: shopId → checkin info
    const checkinMap = new Map<string, { visitedAt: string; note?: string }>();
    for (const ci of checkins) {
      try {
        const d = JSON.parse(ci.details || '{}');
        if (d.shopId) {
          checkinMap.set(d.shopId, {
            visitedAt: ci.createdAt.toISOString(),
            note: d.note || undefined,
          });
        }
      } catch { /* skip */ }
    }

    // ── Get checkout logs for this date ──
    const checkouts = await db.auditLog.findMany({
      where: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKOUT',
        createdAt: { gte: targetDate, lt: dayEnd },
      },
      select: { details: true },
    });

    const checkoutMap = new Map<string, { orderPlaced: boolean; orderAmount?: number }>();
    for (const co of checkouts) {
      try {
        const d = JSON.parse(co.details || '{}');
        if (d.shopId) {
          checkoutMap.set(d.shopId, {
            orderPlaced: !!d.orderPlaced,
            orderAmount: d.orderAmount,
          });
        }
      } catch { /* skip */ }
    }

    // ── Build stops ──
    const visitedIds = new Set(checkinMap.keys());
    const visited: typeof shops = [];
    const planned: typeof shops = [];

    for (const shop of shops) {
      if (visitedIds.has(shop.id)) {
        visited.push(shop);
      } else {
        planned.push(shop);
      }
    }

    const buildStop = (shop: (typeof shops)[0]) => {
      const ci = checkinMap.get(shop.id);
      const co = checkoutMap.get(shop.id);
      return {
        shopId: shop.id,
        shopName: shop.name,
        shopPhone: shop.user?.phone || '',
        shopAddress: shop.address || '',
        shopDistrict: shop.district || '',
        latitude: shop.lat,
        longitude: shop.lng,
        visitStatus: ci ? 'VISITED' as const : 'PLANNED' as const,
        visitedAt: ci?.visitedAt || null,
        orderPlaced: co?.orderPlaced || false,
        orderAmount: co?.orderAmount || null,
      };
    };

    const stops = [
      ...visited.map(buildStop),
      ...planned.map(buildStop),
    ];

    return NextResponse.json(
      successResponse({
        date: targetDate.toISOString().slice(0, 10),
        totalStops: stops.length,
        completedStops: visited.length,
        stops,
      })
    );
  } catch (error) {
    console.error('[SALES_REP ROUTE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to load route'),
      { status: 500 }
    );
  }
}