// ALADIN Shipment API — Status Transitions
// PATCH /api/shipments/[id]/status — advance shipment status

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { successResponse, errorResponse, SHIPMENT_STATUS } from '@/lib/security';
import { notifyOrderStatus, notifyShipmentStatus } from '@/lib/notifications';

// Valid status transitions
const STATUS_TRANSITIONS: Record<string, string[]> = {
  [SHIPMENT_STATUS.PENDING]: [SHIPMENT_STATUS.PICKED_UP, SHIPMENT_STATUS.FAILED],
  [SHIPMENT_STATUS.PICKED_UP]: [SHIPMENT_STATUS.IN_TRANSIT, SHIPMENT_STATUS.FAILED],
  [SHIPMENT_STATUS.IN_TRANSIT]: [SHIPMENT_STATUS.DELIVERED, SHIPMENT_STATUS.FAILED],
  [SHIPMENT_STATUS.DELIVERED]: [], // Terminal state
  [SHIPMENT_STATUS.FAILED]: [SHIPMENT_STATUS.PENDING], // Can retry from failed
};

// ============================================
// PATCH /api/shipments/[id]/status — Update Status
// ============================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !hasRole(payload.role, ['ADMIN', 'SALES_REP', 'DRIVER'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin, Sales Rep, or Driver access required'), { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, deliveredAt, podPhotoUrl, podSignatureUrl, podOtp, note } = body;

    if (!status) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Status is required'), { status: 400 });
    }

    if (!Object.values(SHIPMENT_STATUS).includes(status)) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Invalid status. Must be one of: ${Object.values(SHIPMENT_STATUS).join(', ')}`),
        { status: 400 }
      );
    }

    // Get current shipment
    const shipment = await db.shipment.findUnique({ where: { id } });
    if (!shipment) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shipment not found'), { status: 404 });
    }

    // Validate transition
    const allowedTransitions = STATUS_TRANSITIONS[shipment.status] || [];
    if (!allowedTransitions.includes(status)) {
      return NextResponse.json(
        errorResponse('INVALID_TRANSITION', `Cannot transition from ${shipment.status} to ${status}. Allowed: ${allowedTransitions.join(', ') || 'none (terminal state)'}`),
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { status };

    if (status === SHIPMENT_STATUS.DELIVERED) {
      updateData.deliveredAt = deliveredAt ? new Date(deliveredAt) : new Date();

      // When delivered, also update order status
      if (shipment.status !== SHIPMENT_STATUS.DELIVERED) {
        await db.order.update({
          where: { id: shipment.orderId },
          data: { status: 'DELIVERED', deliveredAt: updateData.deliveredAt },
        });
      }
    }

    // POD data
    if (podPhotoUrl !== undefined) updateData.podPhotoUrl = podPhotoUrl;
    if (podSignatureUrl !== undefined) updateData.podSignatureUrl = podSignatureUrl;
    if (podOtp !== undefined) updateData.podOtp = podOtp;

    const updatedShipment = await db.shipment.update({
      where: { id },
      data: updateData,
      include: {
        order: { select: { id: true, orderNumber: true, status: true, shopId: true, shop: { select: { userId: true } } } },
        assignedDriver: { select: { id: true, name: true, phone: true } },
      },
    });

    // Send notification to shop owner on shipment status change (non-blocking)
    if (updatedShipment.order?.shop?.userId) {
      notifyShipmentStatus(
        id,
        status,
        updatedShipment.order.shop.userId,
        updatedShipment.order.orderNumber || undefined
      ).catch((err: unknown) => console.error('[SHIPMENT STATUS] Notification error (non-blocking):', err));

      // When delivered, also notify order status change
      if (status === SHIPMENT_STATUS.DELIVERED) {
        notifyOrderStatus(
          shipment.orderId,
          'DELIVERED',
          updatedShipment.order.shop.userId
        ).catch((err: unknown) => console.error('[SHIPMENT STATUS] Order notification error (non-blocking):', err));
      }
    }

    return NextResponse.json(successResponse({
      shipment: updatedShipment,
      previousStatus: shipment.status,
      newStatus: status,
      message: `Shipment ${id} updated from ${shipment.status} to ${status}`,
    }));
  } catch (error) {
    console.error('[SHIPMENT STATUS ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to update shipment status'),
      { status: 500 }
    );
  }
}
