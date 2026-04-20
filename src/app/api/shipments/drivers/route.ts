// ALADIN Shipment API — Available Drivers
// GET /api/shipments/drivers — list drivers (active, with current assignment count)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, SHIPMENT_STATUS } from '@/lib/security';

// ============================================
// GET /api/shipments/drivers — List Drivers
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

    // Get all active drivers
    const drivers = await db.user.findMany({
      where: {
        role: 'DRIVER',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        nameEn: true,
        phone: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
        DriverAssignments: {
          where: {
            status: { in: [SHIPMENT_STATUS.PENDING, SHIPMENT_STATUS.PICKED_UP, SHIPMENT_STATUS.IN_TRANSIT] },
          },
          select: { id: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const driversWithStats = drivers.map((driver) => ({
      id: driver.id,
      name: driver.name,
      nameEn: driver.nameEn,
      phone: driver.phone,
      avatarUrl: driver.avatarUrl,
      status: driver.status,
      activeShipments: driver.DriverAssignments.length,
      activeShipmentIds: driver.DriverAssignments.map((s) => s.id),
      isAvailable: driver.DriverAssignments.length < 5, // Max 5 active shipments per driver
    }));

    // Sort by: available first, then by fewest active shipments
    driversWithStats.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
      return a.activeShipments - b.activeShipments;
    });

    return NextResponse.json(successResponse({
      drivers: driversWithStats,
      totalDrivers: driversWithStats.length,
      availableDrivers: driversWithStats.filter((d) => d.isAvailable).length,
    }));
  } catch (error) {
    console.error('[DRIVERS LIST ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch drivers'),
      { status: 500 }
    );
  }
}
