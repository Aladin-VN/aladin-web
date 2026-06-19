// ALADIN Shipment API — List & Create
// GET /api/shipments — paginated list with search, filter, sort
// POST /api/shipments — create shipment for an order

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractBearerToken, verifyAccessToken, hasRole } from '@/lib/auth';
import { getShipmentFilter, type AuthUser } from '@/lib/get-auth-user';
import {
  sanitizeInput,
  successResponse,
  errorResponse,
  rateLimit,
  formatVND,
  ROLES,
  SHIPMENT_STATUS,
  ORDER_STATUS,
} from '@/lib/security';

// ============================================
// GET /api/shipments — List Shipments (role-filtered)
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

    // Build auth user for role filtering
    const authUser: AuthUser = {
      userId: payload.userId,
      phone: payload.phone,
      name: '',
      role: payload.role,
      shopId: payload.shopId,
    };

    // Parse query params
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const type = searchParams.get('type') || '';
    const driverId = searchParams.get('driverId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Build WHERE clause — start with role filter
    const roleFilter = getShipmentFilter(authUser);
    const where: Record<string, unknown> = { ...roleFilter };

    if (search) {
      where.OR = [
        { order: { orderNumber: { contains: search } } },
        { order: { shop: { name: { contains: search } } } },
        { dropoffAddress: { contains: search } },
        { assignedDriver: { name: { contains: search } } },
      ];
    }

    if (status && Object.values(SHIPMENT_STATUS).includes(status as typeof SHIPMENT_STATUS[keyof typeof SHIPMENT_STATUS])) {
      where.status = status;
    }

    if (type && ['INTERNAL', 'THIRD_PARTY'].includes(type)) {
      where.type = type;
    }

    if (driverId) {
      where.assignedDriverId = driverId;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        (where.createdAt as Record<string, unknown>).lt = endDate;
      }
    }

    // Build ORDER BY
    const orderBy: Record<string, string> = {};
    if (sortBy === 'status') {
      orderBy.status = sortOrder;
    } else if (sortBy === 'dropoffAddress') {
      orderBy.dropoffAddress = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    // Parallel queries for performance
    const [shipments, total] = await Promise.all([
      db.shipment.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order: {
            select: {
              orderNumber: true,
              totalAmount: true,
              shop: { select: { name: true, province: true } },
            },
          },
          assignedDriver: {
            select: { id: true, name: true, phone: true },
          },
        },
      }),
      db.shipment.count({ where }),
    ]);

    return NextResponse.json(
      successResponse({
        items: shipments.map((s) => ({
          id: s.id,
          orderId: s.orderId,
          orderNumber: s.order.orderNumber,
          orderTotal: s.order.totalAmount,
          orderTotalFormatted: formatVND(s.order.totalAmount),
          shopName: s.order.shop.name,
          shopProvince: s.order.shop.province,
          type: s.type,
          status: s.status,
          driverName: s.assignedDriver?.name || null,
          driverPhone: s.assignedDriver?.phone || null,
          driverId: s.assignedDriverId || null,
          dropoffAddress: s.dropoffAddress,
          pickupAddress: s.pickupAddress,
          deliveredAt: s.deliveredAt,
          thirdPartyTrackingId: s.thirdPartyTrackingId,
          createdAt: s.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    );
  } catch (error) {
    console.error('[SHIPMENTS LIST ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to fetch shipments'),
      { status: 500 }
    );
  }
}

// ============================================
// POST /api/shipments — Create Shipment
// ============================================

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !hasRole(payload.role, ['ADMIN', 'SALES_REP'])) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin or Sales Rep access required'), { status: 403 });
    }

    // Rate limit
    const rl = rateLimit(`shipment:create:${payload.userId}`, { maxRequests: 30, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many requests'), { status: 429 });
    }

    const body = await request.json();
    const { orderId, type, assignedDriverId, pickupAddress, pickupLat, pickupLng, dropoffAddress, dropoffLat, dropoffLng } = body;

    // Validation
    const errors: string[] = [];

    if (!orderId) errors.push('orderId is required');
    if (!type || !['INTERNAL', 'THIRD_PARTY'].includes(type)) errors.push('type must be INTERNAL or THIRD_PARTY');
    if (!dropoffAddress) errors.push('dropoffAddress is required');

    if (errors.length > 0) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Validation failed', { errors }), { status: 400 });
    }

    // Check order exists and doesn't already have a shipment
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { shop: true },
    });

    if (!order) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Order not found'), { status: 404 });
    }

    // Check order is in a valid state for shipping (not PENDING, not CANCELLED, not REFUNDED)
    const validOrderStatuses = [ORDER_STATUS.CONFIRMED, ORDER_STATUS.PROCESSING, ORDER_STATUS.PACKED, ORDER_STATUS.OUT_FOR_DELIVERY];
    if (!validOrderStatuses.includes(order.status as typeof ORDER_STATUS[keyof typeof ORDER_STATUS])) {
      return NextResponse.json(
        errorResponse('INVALID_ORDER_STATUS', `Cannot create shipment for order in ${order.status} status. Order must be confirmed, processing, or packed.`),
        { status: 400 }
      );
    }

    // Check no existing shipment
    const existingShipment = await db.shipment.findUnique({ where: { orderId } });
    if (existingShipment) {
      return NextResponse.json(errorResponse('CONFLICT', 'Shipment already exists for this order'), { status: 409 });
    }

    // Validate driver if provided
    if (assignedDriverId) {
      const driver = await db.user.findUnique({
        where: { id: assignedDriverId },
      });
      if (!driver || driver.role !== 'DRIVER') {
        errors.push('Assigned user must have DRIVER role');
      }
      if (errors.length > 0) {
        return NextResponse.json(errorResponse('VALIDATION_ERROR', 'Validation failed', { errors }), { status: 400 });
      }
    }

    // Auto-set dropoff from shop if not provided
    const finalDropoff = dropoffAddress || order.shop?.address || '';
    const finalDropoffLat = dropoffLat || order.shop?.lat || null;
    const finalDropoffLng = dropoffLng || order.shop?.lng || null;

    // Create shipment
    const shipment = await db.shipment.create({
      data: {
        orderId,
        type: type || 'INTERNAL',
        status: SHIPMENT_STATUS.PENDING,
        assignedDriverId: assignedDriverId || null,
        pickupAddress: pickupAddress ? sanitizeInput(pickupAddress) : null,
        pickupLat: pickupLat || null,
        pickupLng: pickupLng || null,
        dropoffAddress: sanitizeInput(finalDropoff),
        dropoffLat: finalDropoffLat,
        dropoffLng: finalDropoffLng,
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            totalAmount: true,
            shop: { select: { name: true } },
          },
        },
        assignedDriver: {
          select: { id: true, name: true, phone: true },
        },
      },
    });

    return NextResponse.json(
      successResponse({
        shipment,
        message: `Shipment created for order ${shipment.order.orderNumber}`,
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('[SHIPMENT CREATE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to create shipment'),
      { status: 500 }
    );
  }
}
