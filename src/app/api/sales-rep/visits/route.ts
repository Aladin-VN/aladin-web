// ALADIN Sales Rep API — Visit History
// GET /api/sales-rep/visits?from=&to=&page=&limit=

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

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const fromStr = searchParams.get('from') || '';
    const toStr = searchParams.get('to') || '';

    // Default to last 30 days
    const now = new Date();
    const from = fromStr ? new Date(fromStr + 'T00:00:00.000Z') : new Date(now.getTime() - 30 * 86400000);
    const to = toStr ? new Date(toStr + 'T23:59:59.999Z') : now;

    // ── Fetch all check-ins in range ──
    const checkins = await db.auditLog.findMany({
      where: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKIN',
        createdAt: { gte: from, lte: to },
      },
      select: { id: true, details: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // For each check-in, find matching checkout
    const items: Array<Record<string, unknown>> = [];
    const seenShopDates = new Set<string>();

    for (const ci of checkins) {
      let shopId = '';
      let note = '';
      let lat: number | undefined;
      let lng: number | undefined;

      try {
        const d = JSON.parse(ci.details || '{}');
        shopId = d.shopId || '';
        note = d.note || '';
        lat = d.lat;
        lng = d.lng;
      } catch { continue; }

      if (!shopId) continue;

      const dateKey = `${shopId}-${ci.createdAt.toISOString().slice(0, 10)}`;
      if (seenShopDates.has(dateKey)) continue;
      seenShopDates.add(dateKey);

      // Find matching checkout (same user, same shopId, after this checkin, within 24h)
      const checkout = await db.auditLog.findFirst({
        where: {
          userId: user.userId,
          action: 'SALES_VISIT_CHECKOUT',
          createdAt: { gte: ci.createdAt },
          details: { contains: shopId },
        },
        select: { details: true, createdAt: true },
      });

      let orderPlaced = false;
      let orderAmount: number | null = null;
      let orderNumber: string | null = null;
      let visitNote = note;
      let duration: number | null = null;

      if (checkout) {
        try {
          const cd = JSON.parse(checkout.details || '{}');
          orderPlaced = !!cd.orderPlaced;
          orderAmount = cd.orderAmount || null;
          if (cd.orderId) {
            const order = await db.order.findUnique({
              where: { id: cd.orderId },
              select: { orderNumber: true },
            });
            orderNumber = order?.orderNumber || null;
          }
          if (cd.note) visitNote = visitNote ? `${visitNote}; ${cd.note}` : cd.note;
          duration = Math.round((checkout.createdAt.getTime() - ci.createdAt.getTime()) / 60000);
        } catch { /* skip */ }
      }

      // Get shop info
      const shop = await db.shop.findUnique({
        where: { id: shopId },
        select: { name: true, district: true, user: { select: { phone: true } } },
      });

      items.push({
        id: dateKey,
        shopId,
        shopName: shop?.name || 'Unknown',
        shopPhone: shop?.user?.phone || '',
        shopDistrict: shop?.district || '',
        visitDate: ci.createdAt.toISOString().slice(0, 10),
        visitStatus: checkout ? 'COMPLETED' : 'IN_PROGRESS',
        visitNote: visitNote || null,
        orderPlaced,
        orderAmount,
        orderNumber,
        duration,
      });
    }

    // Paginate
    const total = items.length;
    const start = (page - 1) * limit;
    const paged = items.slice(start, start + limit);

    return NextResponse.json(
      successResponse(paged, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      })
    );
  } catch (error) {
    console.error('[SALES_REP VISITS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to load visit history'),
      { status: 500 }
    );
  }
}