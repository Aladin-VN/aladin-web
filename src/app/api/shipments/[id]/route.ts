// ALADIN Shipment API — Get & Update Single Shipment
// GET /api/shipments/[id] — full shipment detail with order, driver
// PATCH /api/shipments/[id] — update shipment (assign driver, addresses, POD)

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import {
  sanitizeInput,
  successResponse,
  errorResponse,
  formatVND,
  SHIPMENT_STATUS,
} from '@/lib/security';

// ============================================
// GET /api/shipments/[id] — Shipment Detail
// ============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(errorResponse('INVALID_TOKEN', 'Token expired or invalid'), { status: 401 });
    }

    const { id } = await params;

    const shipment = await db.shipment.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            paymentMethod: true,
            items: {
              select: {
                productName: true,
                productSku: true,
                quantity: true,
                unitPrice: true,
                totalPrice: true,
              },
            },
            shop: {
              select: {
                id: true,
                name: true,
                address: true,
                district: true,
                province: true,
              },
            },
          },
        },
        assignedDriver: {
          select: { id: true, name: true, phone: true, avatarUrl: true },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shipment not found'), { status: 404 });
    }

    return NextResponse.json(successResponse({
      id: shipment.id,
      orderId: shipment.orderId,
      type: shipment.type,
      status: shipment.status,
      assignedDriver: shipment.assignedDriver,
      pickupAddress: shipment.pickupAddress,
      pickupLat: shipment.pickupLat,
      pickupLng: shipment.pickupLng,
      dropoffAddress: shipment.dropoffAddress,
      dropoffLat: shipment.dropoffLat,
      dropoffLng: shipment.dropoffLng,
      deliveredAt: shipment.deliveredAt,
      podPhotoUrl: shipment.podPhotoUrl,
      podSignatureUrl: shipment.podSignatureUrl,
      podOtp: shipment.podOtp,
      thirdPartyTrackingId: shipment.thirdPartyTrackingId,
      thirdPartyStatus: shipment.thirdPartyStatus,
      createdAt: shipment.createdAt,
      order: {
        id: shipment.order.id,
        orderNumber: shipment.order.orderNumber,
        orderStatus: shipment.order.status,
        orderTotal: shipment.order.totalAmount,
        orderTotalFormatted: formatVND(shipment.order.totalAmount),
        paymentMethod: shipment.order.paymentMethod,
        items: shipment.order.items.map((item) => ({
          productName: item.productName,
          productSku: item.productSku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitPriceFormatted: formatVND(item.unitPrice),
          totalPrice: item.totalPrice,
          totalPriceFormatted: formatVND(item.totalPrice),
        })),
        shop: shipment.order.shop,
      },
    }));
  } catch (error) {
    console.error('[SHIPMENT GET ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch shipment'),
      { status: 500 }
    );
  }
}

// ============================================
// PATCH /api/shipments/[id] — Update Shipment
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

    // Check shipment exists
    const shipment = await db.shipment.findUnique({ where: { id } });
    if (!shipment) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shipment not found'), { status: 404 });
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (body.assignedDriverId !== undefined) {
      if (body.assignedDriverId) {
        const driver = await db.user.findUnique({ where: { id: body.assignedDriverId } });
        if (!driver || driver.role !== 'DRIVER') {
          return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Assigned user must have DRIVER role'), { status: 400 });
        }
      }
      updateData.assignedDriverId = body.assignedDriverId || null;
    }

    if (body.pickupAddress !== undefined) {
      updateData.pickupAddress = body.pickupAddress ? sanitizeInput(body.pickupAddress) : null;
    }
    if (body.pickupLat !== undefined) updateData.pickupLat = body.pickupLat || null;
    if (body.pickupLng !== undefined) updateData.pickupLng = body.pickupLng || null;
    if (body.dropoffAddress !== undefined) {
      updateData.dropoffAddress = sanitizeInput(body.dropoffAddress);
    }
    if (body.dropoffLat !== undefined) updateData.dropoffLat = body.dropoffLat || null;
    if (body.dropoffLng !== undefined) updateData.dropoffLng = body.dropoffLng || null;
    if (body.podPhotoUrl !== undefined) updateData.podPhotoUrl = body.podPhotoUrl || null;
    if (body.podSignatureUrl !== undefined) updateData.podSignatureUrl = body.podSignatureUrl || null;
    if (body.podOtp !== undefined) updateData.podOtp = body.podOtp || null;
    if (body.thirdPartyTrackingId !== undefined) updateData.thirdPartyTrackingId = body.thirdPartyTrackingId || null;
    if (body.thirdPartyStatus !== undefined) updateData.thirdPartyStatus = body.thirdPartyStatus || null;
    if (body.type !== undefined && ['INTERNAL', 'THIRD_PARTY'].includes(body.type)) {
      updateData.type = body.type;
    }

    const updatedShipment = await db.shipment.update({
      where: { id },
      data: updateData,
      include: {
        order: { select: { orderNumber: true } },
        assignedDriver: { select: { id: true, name: true, phone: true } },
      },
    });

    return NextResponse.json(successResponse({
      shipment: updatedShipment,
      message: `Shipment for ${updatedShipment.order.orderNumber} updated`,
    }));
  } catch (error) {
    console.error('[SHIPMENT UPDATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to update shipment'),
      { status: 500 }
    );
  }
}

// ============================================
// DELETE /api/shipments/[id] — Delete Shipment
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !hasRole(payload.role, ['ADMIN'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }

    const { id } = await params;

    const shipment = await db.shipment.findUnique({ where: { id } });
    if (!shipment) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shipment not found'), { status: 404 });
    }

    // Only allow deletion of PENDING shipments
    if (shipment.status !== SHIPMENT_STATUS.PENDING) {
      return NextResponse.json(
        errorResponse('INVALID_STATUS', 'Only pending shipments can be deleted'),
        { status: 400 }
      );
    }

    await db.shipment.delete({ where: { id } });

    return NextResponse.json(successResponse({ message: 'Shipment deleted successfully' }));
  } catch (error) {
    console.error('[SHIPMENT DELETE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to delete shipment'),
      { status: 500 }
    );
  }
}
