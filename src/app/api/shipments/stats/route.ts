// ALADIN Shipment API — Aggregated Stats
// GET /api/shipments/stats — shipment dashboard metrics

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, formatVND, SHIPMENT_STATUS } from '@/lib/security';

// ============================================
// GET /api/shipments/stats — Shipment Statistics
// ============================================

export async function GET(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Parallel queries for all stats
    const [
      totalShipments,
      pendingShipments,
      inTransitShipments,
      deliveredToday,
      deliveredWeek,
      failedShipments,
      statusBreakdown,
      typeBreakdown,
      totalDeliveredValue,
      activeDrivers,
      unassignedShipments,
      avgDeliveryTime,
    ] = await Promise.all([
      // Total shipments
      db.shipment.count(),

      // Pending
      db.shipment.count({ where: { status: SHIPMENT_STATUS.PENDING } }),

      // In transit
      db.shipment.count({ where: { status: { in: [SHIPMENT_STATUS.PICKED_UP, SHIPMENT_STATUS.IN_TRANSIT] } } }),

      // Delivered today
      db.shipment.count({
        where: {
          status: SHIPMENT_STATUS.DELIVERED,
          deliveredAt: { gte: today, lt: tomorrow },
        },
      }),

      // Delivered this week
      db.shipment.count({
        where: {
          status: SHIPMENT_STATUS.DELIVERED,
          deliveredAt: { gte: weekAgo },
        },
      }),

      // Failed
      db.shipment.count({ where: { status: SHIPMENT_STATUS.FAILED } }),

      // Status breakdown
      db.shipment.groupBy({
        by: ['status'],
        _count: true,
      }),

      // Type breakdown
      db.shipment.groupBy({
        by: ['type'],
        _count: true,
      }),

      // Total delivered value (sum of order totals for delivered shipments)
      db.shipment.aggregate({
        where: { status: SHIPMENT_STATUS.DELIVERED },
        _count: true,
      }),

      // Active drivers (drivers with non-delivered/non-failed shipments)
      db.user.count({
        where: {
          role: 'DRIVER',
          status: 'ACTIVE',
          DriverAssignments: {
            some: {
              status: { in: [SHIPMENT_STATUS.PENDING, SHIPMENT_STATUS.PICKED_UP, SHIPMENT_STATUS.IN_TRANSIT] },
            },
          },
        },
      }),

      // Unassigned shipments
      db.shipment.count({
        where: {
          status: { in: [SHIPMENT_STATUS.PENDING, SHIPMENT_STATUS.PICKED_UP] },
          assignedDriverId: null,
        },
      }),

      // Average delivery time (hours from created to delivered for recent deliveries)
      db.shipment.findMany({
        where: {
          status: SHIPMENT_STATUS.DELIVERED,
          deliveredAt: { not: null },
          createdAt: { gte: weekAgo },
        },
        select: { createdAt: true, deliveredAt: true },
        take: 100,
      }),
    ]);

    // Calculate average delivery time in hours
    let avgHours = 0;
    if (avgDeliveryTime.length > 0) {
      const totalHours = avgDeliveryTime.reduce((sum, s) => {
        if (s.deliveredAt) {
          return sum + (s.deliveredAt.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60);
        }
        return sum;
      }, 0);
      avgHours = Math.round(totalHours / avgDeliveryTime.length);
    }

    // Build status breakdown map
    const shipmentsByStatus: Record<string, number> = {};
    for (const item of statusBreakdown) {
      shipmentsByStatus[item.status] = item._count;
    }

    // Build type breakdown map
    const shipmentsByType: Record<string, number> = {};
    for (const item of typeBreakdown) {
      shipmentsByType[item.type] = item._count;
    }

    return NextResponse.json(successResponse({
      totalShipments,
      pendingShipments,
      inTransitShipments,
      deliveredToday,
      deliveredThisWeek: deliveredWeek,
      failedShipments,
      activeDrivers,
      unassignedShipments,
      avgDeliveryHours: avgHours,
      shipmentsByStatus,
      shipmentsByType,
      // Delivery rate
      deliveryRate: totalShipments > 0
        ? Math.round(((statusBreakdown.find(s => s.status === SHIPMENT_STATUS.DELIVERED)?._count || 0) / totalShipments) * 100)
        : 0,
      // Failure rate
      failureRate: totalShipments > 0
        ? Math.round(((statusBreakdown.find(s => s.status === SHIPMENT_STATUS.FAILED)?._count || 0) / totalShipments) * 100)
        : 0,
    }));
  } catch (error) {
    console.error('[SHIPMENT STATS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch shipment stats'),
      { status: 500 }
    );
  }
}
