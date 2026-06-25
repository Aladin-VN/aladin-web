// ALADIN Driver API — Today's Deliveries
// GET /api/driver/deliveries?date=YYYY-MM-DD&status=

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

    const { searchParams } = request.nextUrl;
    const dateStr = searchParams.get('date') || '';
    const statusFilter = searchParams.get('status') || '';

    // Parse date range
    const targetDate = dateStr ? new Date(dateStr + 'T00:00:00.000Z') : new Date();
    // If no timezone info, assume local
    if (!dateStr) {
      targetDate.setHours(0, 0, 0, 0);
    }
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    // Build WHERE
    const where: Record<string, unknown> = {
      assignedDriverId: user.userId,
      createdAt: { gte: targetDate, lt: dayEnd },
    };

    if (statusFilter) {
      where.status = statusFilter;
    }

    const shipments = await db.shipment.findMany({
      where,
      include: {
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
            status: true,
            shop: {
              select: {
                name: true,
                address: true,
                district: true,
                user: { select: { phone: true } },
              },
            },
            items: { select: { id: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const items = shipments.map((s) => ({
      id: s.id,
      orderNumber: s.order.orderNumber,
      status: s.status,
      shopName: s.order.shop.name,
      shopAddress: s.order.shop.address || s.dropoffAddress || '',
      shopPhone: s.order.shop.user?.phone || '',
      shopDistrict: s.order.shop.district || '',
      itemCount: s.order.items.length,
      totalAmount: s.order.totalAmount,
      pickupAddress: s.pickupAddress || '',
      scheduledTime: s.createdAt.toISOString(),
      pickedUpAt: s.status !== 'PENDING' ? s.updatedAt.toISOString() : null,
      deliveredAt: s.deliveredAt?.toISOString() || null,
      failedReason: (s as Record<string, unknown>).failedReason || null,
      podPhotoUrl: s.podPhotoUrl || null,
      podOtp: s.podOtp || null,
    }));

    return NextResponse.json(successResponse({ items }));
  } catch (error) {
    console.error('[DRIVER DELIVERIES ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to load deliveries'),
      { status: 500 }
    );
  }
}