// ALADIN Driver API — Report Delivery Issue
// POST /api/driver/deliveries/[id]/issue
// Body: { type, description?, photoUrl? }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/get-auth-user';
import { successResponse, errorResponse, ROLES, rateLimit, sanitizeInput } from '@/lib/security';

const VALID_ISSUE_TYPES = [
  'WRONG_ADDRESS',
  'CUSTOMER_ABSENT',
  'DAMAGED_GOODS',
  'SHORTAGE',
  'OTHER',
] as const;

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
    const rl = rateLimit(`driver-issue:${user.userId}`, { maxRequests: 30, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many issue reports'), { status: 429 });
    }

    const { id } = await params;
    const body = await request.json();
    const { type, description, photoUrl } = body as {
      type: string;
      description?: string;
      photoUrl?: string;
    };

    // Validate issue type
    if (!type || !VALID_ISSUE_TYPES.includes(type as typeof VALID_ISSUE_TYPES[number])) {
      return NextResponse.json(
        errorResponse('VALIDATION_ERROR', `Invalid issue type. Must be one of: ${VALID_ISSUE_TYPES.join(', ')}`),
        { status: 400 }
      );
    }

    // Get shipment
    const shipment = await db.shipment.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            shop: { select: { name: true } },
          },
        },
      },
    });

    if (!shipment) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shipment not found'), { status: 404 });
    }

    // Verify driver owns this shipment
    if (user.role === ROLES.DRIVER && shipment.assignedDriverId !== user.userId) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'This shipment is not assigned to you'), { status: 403 });
    }

    // Log to AuditLog
    await db.auditLog.create({
      data: {
        userId: user.userId,
        action: 'DRIVER_ISSUE_REPORTED',
        entity: 'Shipment',
        entityId: id,
        details: JSON.stringify({
          shipmentId: id,
          orderNumber: shipment.order.orderNumber,
          issueType: type,
          description: description ? sanitizeInput(description) : undefined,
          photoUrl: photoUrl || undefined,
          shopName: shipment.order.shop.name,
        }),
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    // Create Notification for all ADMIN users
    const admins = await db.user.findMany({
      where: { role: ROLES.ADMIN, status: 'ACTIVE' },
      select: { id: true },
    });

    if (admins.length > 0) {
      const typeLabels: Record<string, string> = {
        WRONG_ADDRESS: 'Sai địa chỉ',
        CUSTOMER_ABSENT: 'Khách hàng vắng mặt',
        DAMAGED_GOODS: 'Hàng hóa hư hỏng',
        SHORTAGE: 'Thiếu hàng',
        OTHER: 'Lỗi khác',
      };

      await db.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: 'SHIPMENT',
          title: `Báo cáo giao hàng: ${typeLabels[type] || type}`,
          message: `Tài xế ${user.name} báo cáo vấn đề cho đơn ${shipment.order.orderNumber} (${shipment.order.shop.name}). ${description || typeLabels[type] || ''}`,
          data: {
            shipmentId: id,
            orderId: shipment.order.id,
            orderNumber: shipment.order.orderNumber,
            issueType: type,
            reportedBy: user.userId,
            driverName: user.name,
          } as any,
        })),
      });
    }

    return NextResponse.json(
      successResponse({
        id,
        orderNumber: shipment.order.orderNumber,
        issueType: type,
        reportedAt: new Date().toISOString(),
        notifiedAdmins: admins.length,
        message: `Issue reported for order ${shipment.order.orderNumber}`,
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('[DRIVER ISSUE REPORT ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to report delivery issue'),
      { status: 500 }
    );
  }
}