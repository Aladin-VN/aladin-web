// ALADIN Driver API — KPI Dashboard
// GET /api/driver/dashboard

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/get-auth-user';
import { successResponse, errorResponse, ROLES, SETTLEMENT_CONFIG } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || (user.role !== ROLES.DRIVER && user.role !== ROLES.ADMIN)) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Driver or Admin access required'), { status: 403 });
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // ── Today's shipments ──
    const todayShipments = await db.shipment.findMany({
      where: {
        assignedDriverId: user.userId,
        createdAt: { gte: todayStart },
      },
      select: { id: true, status: true, deliveredAt: true, order: { select: { orderNumber: true, totalAmount: true, shop: { select: { name: true, address: true } } } } },
      orderBy: { createdAt: 'asc' },
    });

    let todayDelivered = 0;
    let todayPending = 0;
    let todayFailed = 0;
    let todayEarnings = 0;

    for (const s of todayShipments) {
      if (s.status === 'DELIVERED') {
        todayDelivered++;
        todayEarnings += SETTLEMENT_CONFIG.DEFAULT_DELIVERY_FEE;
      } else if (s.status === 'FAILED') {
        todayFailed++;
      } else {
        todayPending++;
      }
    }

    // ── Month stats ──
    const [monthTotal, monthDelivered] = await Promise.all([
      db.shipment.count({
        where: {
          assignedDriverId: user.userId,
          createdAt: { gte: monthStart },
        },
      }),
      db.shipment.count({
        where: {
          assignedDriverId: user.userId,
          status: 'DELIVERED',
          createdAt: { gte: monthStart },
        },
      }),
    ]);

    const successRate = monthTotal > 0 ? Math.round((monthDelivered / monthTotal) * 100) / 100 : 0;

    // ── Active route: find next non-delivered, non-failed shipment ──
    const activeShipments = todayShipments.filter(
      (s) => s.status !== 'DELIVERED' && s.status !== 'FAILED'
    );
    const completedToday = todayShipments.filter((s) => s.status === 'DELIVERED').length;

    let nextStop: {
      shipmentId: string;
      orderNumber: string;
      shopName: string;
      shopAddress: string;
    } | null = null;

    const nextShipment = activeShipments[0];
    if (nextShipment) {
      nextStop = {
        shipmentId: nextShipment.id,
        orderNumber: nextShipment.order.orderNumber,
        shopName: nextShipment.order.shop.name,
        shopAddress: nextShipment.order.shop.address || '',
      };
    }

    // ── Recent activity: last 5 status changes ──
    const recentActivity = await db.auditLog.findMany({
      where: {
        userId: user.userId,
        action: 'DRIVER_STATUS_UPDATE',
      },
      select: { id: true, details: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const activityItems = recentActivity.map((a) => {
      let info = { shipmentId: '', fromStatus: '', toStatus: '' };
      try { info = JSON.parse(a.details || '{}'); } catch { /* skip */ }
      return {
        id: a.id,
        shipmentId: info.shipmentId || '',
        fromStatus: info.fromStatus || '',
        toStatus: info.toStatus || '',
        timestamp: a.createdAt.toISOString(),
      };
    });

    return NextResponse.json(
      successResponse({
        todayDeliveries: todayShipments.length,
        todayDelivered,
        todayPending,
        todayFailed,
        monthTotal,
        monthDelivered,
        successRate,
        todayEarnings,
        activeRoute: {
          totalStops: todayShipments.length,
          completedStops: completedToday,
          nextStop,
        },
        recentActivity: activityItems,
      })
    );
  } catch (error) {
    console.error('[DRIVER DASHBOARD ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to load driver dashboard'),
      { status: 500 }
    );
  }
}