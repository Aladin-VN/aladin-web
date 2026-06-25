// ALADIN Driver API — Update Delivery Status
// PUT /api/driver/deliveries/[id]/status
// Body: { status, podPhotoUrl?, podOtp?, failedReason?, note?, latitude?, longitude? }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/get-auth-user';
import { successResponse, errorResponse, ROLES, SHIPMENT_STATUS, rateLimit } from '@/lib/security';

// Valid status transitions for driver
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PICKED_UP', 'FAILED'],
  PICKED_UP: ['IN_TRANSIT', 'FAILED'],
  IN_TRANSIT: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: ['PENDING'],
};

const VALID_STATUSES = new Set(Object.keys(VALID_TRANSITIONS));

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user || (user.role !== ROLES.DRIVER && user.role !== ROLES.ADMIN)) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Driver or Admin access required'), { status: 403 });
    }

    // Rate limit
    const rl = rateLimit(`driver-status:${user.userId}`, { maxRequests: 120, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many status updates'), { status: 429 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      status,
      podPhotoUrl,
      podOtp,
      failedReason,
      note,
      latitude,
      longitude,
    } = body as {
      status: string;
      podPhotoUrl?: string;
      podOtp?: string;
      failedReason?: string;
      note?: string;
      latitude?: number;
      longitude?: number;
    };

    // Validate status
    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Invalid status. Must be one of: ${Array.from(VALID_STATUSES).join(', ')}`),
        { status: 400 }
      );
    }

    // FAILED requires failedReason
    if (status === 'FAILED' && !failedReason) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', 'failedReason is required when marking delivery as FAILED'),
        { status: 400 }
      );
    }

    // Get shipment
    const shipment = await db.shipment.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, orderNumber: true, status: true } },
      },
    });

    if (!shipment) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shipment not found'), { status: 404 });
    }

    // Verify driver owns this shipment
    if (user.role === ROLES.DRIVER && shipment.assignedDriverId !== user.userId) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'This shipment is not assigned to you'), { status: 403 });
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[shipment.status] || [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        errorResponse('INVALID_TRANSITION', `Cannot transition from ${shipment.status} to ${status}. Allowed: ${allowed.join(', ') || 'none (terminal state)'}`),
        { status: 400 }
      );
    }

    const previousStatus = shipment.status;

    // Build update data
    const updateData: Record<string, unknown> = { status };

    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
      if (podPhotoUrl) updateData.podPhotoUrl = podPhotoUrl;
      if (podOtp) updateData.podOtp = podOtp;
    }

    if (status === 'FAILED') {
      updateData.details = JSON.stringify({ failedReason, note, latitude, longitude });
    }

    // Update shipment
    const updatedShipment = await db.shipment.update({
      where: { id },
      data: updateData,
      include: {
        order: { select: { id: true, orderNumber: true, status: true } },
      },
    });

    // When DELIVERED: update related Order status
    if (status === 'DELIVERED') {
      await db.order.update({
        where: { id: shipment.orderId },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
        },
      });
    }

    // Log to AuditLog
    await db.auditLog.create({
      data: {
        userId: user.userId,
        action: 'DRIVER_STATUS_UPDATE',
        entity: 'Shipment',
        entityId: id,
        details: JSON.stringify({
          shipmentId: id,
          orderNumber: shipment.order.orderNumber,
          fromStatus: previousStatus,
          toStatus: status,
          failedReason: status === 'FAILED' ? failedReason : undefined,
          note: note || undefined,
          latitude,
          longitude,
        }),
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json(
      successResponse({
        id: updatedShipment.id,
        status: updatedShipment.status,
        previousStatus,
        deliveredAt: updatedShipment.deliveredAt?.toISOString() || null,
        orderStatus: status === 'DELIVERED' ? 'DELIVERED' : shipment.order.status,
        message: `Shipment ${shipment.order.orderNumber} updated: ${previousStatus} → ${status}`,
      })
    );
  } catch (error) {
    console.error('[DRIVER STATUS UPDATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to update delivery status'),
      { status: 500 }
    );
  }
}