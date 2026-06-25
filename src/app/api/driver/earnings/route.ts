// ALADIN Driver API — Earnings History
// GET /api/driver/earnings?from=&to=

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/get-auth-user';
import { successResponse, errorResponse, ROLES, SETTLEMENT_CONFIG } from '@/lib/security';

const DELIVERY_FEE = SETTLEMENT_CONFIG.DEFAULT_DELIVERY_FEE; // 20,000 VND per delivery

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || (user.role !== ROLES.DRIVER && user.role !== ROLES.ADMIN)) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Driver or Admin access required'), { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const fromStr = searchParams.get('from') || '';
    const toStr = searchParams.get('to') || '';

    // Default to current month
    const now = new Date();
    const from = fromStr
      ? new Date(fromStr + 'T00:00:00.000Z')
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = toStr
      ? new Date(toStr + 'T23:59:59.999Z')
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // ── Fetch all shipments in period ──
    const shipments = await db.shipment.findMany({
      where: {
        assignedDriverId: user.userId,
        createdAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        status: true,
        deliveredAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    let totalDeliveries = shipments.length;
    let successfulDeliveries = 0;
    let failedDeliveries = 0;
    let totalEarnings = 0;

    // ── Daily breakdown map ──
    const dailyMap = new Map<string, { deliveries: number; earnings: number; successful: number; total: number }>();

    for (const s of shipments) {
      const dayKey = s.createdAt.toISOString().slice(0, 10);

      if (!dailyMap.has(dayKey)) {
        dailyMap.set(dayKey, { deliveries: 0, earnings: 0, successful: 0, total: 0 });
      }

      const dayEntry = dailyMap.get(dayKey)!;
      dayEntry.deliveries++;
      dayEntry.total++;

      if (s.status === 'DELIVERED') {
        successfulDeliveries++;
        dayEntry.successful++;
        totalEarnings += DELIVERY_FEE;
        dayEntry.earnings += DELIVERY_FEE;
      } else if (s.status === 'FAILED') {
        failedDeliveries++;
      }
    }

    const dailyBreakdown = Array.from(dailyMap.entries()).map(([date, v]) => ({
      date,
      deliveries: v.deliveries,
      earnings: v.earnings,
      successRate: v.total > 0 ? Math.round((v.successful / v.total) * 100) / 100 : 0,
    }));

    const avgPerDelivery = successfulDeliveries > 0
      ? Math.round(totalEarnings / successfulDeliveries)
      : 0;

    return NextResponse.json(
      successResponse({
        period: {
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
        },
        summary: {
          totalDeliveries,
          successfulDeliveries,
          failedDeliveries,
          totalEarnings,
          avgPerDelivery,
        },
        dailyBreakdown,
      })
    );
  } catch (error) {
    console.error('[DRIVER EARNINGS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to load earnings'),
      { status: 500 }
    );
  }
}