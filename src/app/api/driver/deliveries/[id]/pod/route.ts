// ALADIN Driver API — Upload Proof of Delivery
// POST /api/driver/deliveries/[id]/pod
// Body: { photoUrl, otpCode, signatureUrl?, note? }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/get-auth-user';
import { successResponse, errorResponse, ROLES, rateLimit } from '@/lib/security';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user || (user.role !== ROLES.DRIVER && user.role !== ROLES.ADMIN)) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Driver or Admin access required'), { status: 403 });
    }

    // Rate limit
    const rl = rateLimit(`driver-pod:${user.userId}`, { maxRequests: 60, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many POD uploads'), { status: 429 });
    }

    const { id } = await params;
    const body = await request.json();
    const { photoUrl, otpCode, signatureUrl, note } = body as {
      photoUrl: string;
      otpCode: string;
      signatureUrl?: string;
      note?: string;
    };

    if (!photoUrl) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'photoUrl is required'), { status: 400 });
    }

    // Get shipment
    const shipment = await db.shipment.findUnique({
      where: { id },
      include: {
        order: { select: { id: true, orderNumber: true } },
      },
    });

    if (!shipment) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shipment not found'), { status: 404 });
    }

    // Verify driver owns this shipment
    if (user.role === ROLES.DRIVER && shipment.assignedDriverId !== user.userId) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'This shipment is not assigned to you'), { status: 403 });
    }

    // Update POD data on shipment
    const updateData: Record<string, unknown> = {
      podPhotoUrl: photoUrl,
    };

    if (otpCode) updateData.podOtp = otpCode;
    if (signatureUrl) updateData.podSignatureUrl = signatureUrl;

    // If not yet delivered, mark as delivered
    if (shipment.status !== 'DELIVERED') {
      updateData.status = 'DELIVERED';
      updateData.deliveredAt = new Date();

      // Also update the order
      await db.order.update({
        where: { id: shipment.orderId },
        data: { status: 'DELIVERED', deliveredAt: new Date() },
      });
    }

    const updatedShipment = await db.shipment.update({
      where: { id },
      data: updateData,
    });

    // Log to AuditLog
    await db.auditLog.create({
      data: {
        userId: user.userId,
        action: 'DRIVER_POD_CAPTURED',
        entity: 'Shipment',
        entityId: id,
        details: JSON.stringify({
          shipmentId: id,
          orderNumber: shipment.order.orderNumber,
          photoUrl,
          otpCode: otpCode || undefined,
          signatureUrl: signatureUrl || undefined,
          note: note || undefined,
          autoDelivered: shipment.status !== 'DELIVERED',
        }),
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json(
      successResponse({
        id: updatedShipment.id,
        status: updatedShipment.status,
        podPhotoUrl: updatedShipment.podPhotoUrl,
        podOtp: updatedShipment.podOtp,
        deliveredAt: updatedShipment.deliveredAt?.toISOString() || null,
        message: `POD captured for order ${shipment.order.orderNumber}`,
      })
    );
  } catch (error) {
    console.error('[DRIVER POD ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to upload proof of delivery'),
      { status: 500 }
    );
  }
}