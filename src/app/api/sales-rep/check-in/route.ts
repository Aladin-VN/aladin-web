// ALADIN Sales Rep API — Check In
// POST /api/sales-rep/check-in
// Body: { shopId, note?, latitude?, longitude? }

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/get-auth-user';
import { successResponse, errorResponse, ROLES, rateLimit, sanitizeInput } from '@/lib/security';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || (user.role !== ROLES.SALES_REP && user.role !== ROLES.ADMIN)) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Sales Rep or Admin access required'), { status: 403 });
    }

    // Rate limit
    const rl = rateLimit(`sales-checkin:${user.userId}`, { maxRequests: 60, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many check-in requests'), { status: 429 });
    }

    const body = await request.json();
    const { shopId, note, latitude, longitude } = body as {
      shopId: string;
      note?: string;
      latitude?: number;
      longitude?: number;
    };

    if (!shopId) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'shopId is required'), { status: 400 });
    }

    // Verify shop exists
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, deletedAt: true },
    });

    if (!shop || shop.deletedAt) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shop not found'), { status: 404 });
    }

    // Check for existing open check-in (no checkout yet) for this shop today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const existingCheckin = await db.auditLog.findFirst({
      where: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKIN',
        createdAt: { gte: todayStart },
        details: { contains: shopId },
      },
      select: { id: true, createdAt: true },
    });

    // Check if there's already a checkout for this shop today
    const existingCheckout = await db.auditLog.findFirst({
      where: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKOUT',
        createdAt: { gte: todayStart },
        details: { contains: shopId },
      },
      select: { id: true },
    });

    // If already checked in and not checked out, return existing
    if (existingCheckin && !existingCheckout) {
      return NextResponse.json(
        successResponse({
          visitId: existingCheckin.id,
          shopName: shop.name,
          checkInTime: existingCheckin.createdAt.toISOString(),
          message: 'Already checked in. Use check-out to complete the visit.',
        })
      );
    }

    // If already completed (checked in + checked out), allow re-visit
    const details = JSON.stringify({
      shopId,
      timestamp: new Date().toISOString(),
      note: note ? sanitizeInput(note) : undefined,
      lat: latitude,
      lng: longitude,
    });

    const auditLog = await db.auditLog.create({
      data: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKIN',
        entity: 'Shop',
        entityId: shopId,
        details,
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json(
      successResponse({
        visitId: auditLog.id,
        shopName: shop.name,
        checkInTime: auditLog.createdAt.toISOString(),
      }),
      { status: 201 }
    );
  } catch (error) {
    console.error('[SALES_REP CHECK-IN ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to check in'),
      { status: 500 }
    );
  }
}