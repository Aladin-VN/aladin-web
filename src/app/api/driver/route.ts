// ALADIN Driver API — Optimized Route for Today
// GET /api/driver/route?date=YYYY-MM-DD

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/get-auth-user';
import { successResponse, errorResponse, ROLES } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || (user.role !== ROLES.DRIVER && user.role !== ROLES.ADMIN)) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Driver or Admin access required'), { status: 403 });
    }

    const dateStr = request.nextUrl.searchParams.get('date') || '';
    const targetDate = dateStr ? new Date(dateStr + 'T00:00:00.000Z') : new Date();
    if (!dateStr) {
      targetDate.setHours(0, 0, 0, 0);
    }
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    // Fetch all shipments for this driver on this date
    const shipments = await db.shipment.findMany({
      where: {
        assignedDriverId: user.userId,
        createdAt: { gte: targetDate, lt: dayEnd },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            shop: {
              select: {
                name: true,
                address: true,
                user: { select: { phone: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build stops with sequence
    const stops = shipments.map((s, idx) => ({
      sequence: idx + 1,
      shipmentId: s.id,
      orderNumber: s.order.orderNumber,
      shopName: s.order.shop.name,
      shopAddress: s.order.shop.address || s.dropoffAddress || '',
      shopPhone: s.order.shop.user?.phone || '',
      status: s.status,
      estimatedArrival: null, // Would be calculated by routing engine
      actualArrival: s.deliveredAt?.toISOString() || null,
    }));

    // Mock distance and duration estimates
    const totalStops = stops.length;
    const totalDistance = totalStops > 0 ? Math.round(totalStops * 3.5 * 10) / 10 : 0; // ~3.5 km per stop avg
    const estimatedDuration = totalStops > 0 ? totalStops * 18 : 0; // ~18 min per stop avg

    return NextResponse.json(
      successResponse({
        date: targetDate.toISOString().slice(0, 10),
        driverName: user.name,
        stops,
        totalDistance,
        estimatedDuration,
      })
    );
  } catch (error) {
    console.error('[DRIVER ROUTE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to load route'),
      { status: 500 }
    );
  }
}