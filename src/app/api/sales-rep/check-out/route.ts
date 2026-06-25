// ALADIN Sales Rep API — Check Out
// POST /api/sales-rep/check-out
// Body: { shopId, note?, orderPlaced: boolean, orderAmount?, orderId? }

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
    const rl = rateLimit(`sales-checkout:${user.userId}`, { maxRequests: 60, windowMs: 60 * 1000 });
    if (!rl.allowed) {
      return NextResponse.json(errorResponse('RATE_LIMITED', 'Too many check-out requests'), { status: 429 });
    }

    const body = await request.json();
    const { shopId, note, orderPlaced, orderAmount, orderId } = body as {
      shopId: string;
      note?: string;
      orderPlaced?: boolean;
      orderAmount?: number;
      orderId?: string;
    };

    if (!shopId) {
      return NextResponse.json(errorResponse('VALIDATION_ERROR', 'shopId is required'), { status: 400 });
    }

    // Find matching check-in (today, same user, same shop)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Make sure no existing checkout for this shop today
    const existingCheckout = await db.auditLog.findFirst({
      where: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKOUT',
        createdAt: { gte: todayStart },
        details: { contains: shopId },
      },
      select: { id: true },
    });

    if (existingCheckout) {
      return NextResponse.json(
        errorResponse('ALREADY_CHECKED_OUT', 'Already checked out from this shop today'),
        { status: 400 }
      );
    }

    // Find the check-in
    const checkin = await db.auditLog.findFirst({
      where: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKIN',
        createdAt: { gte: todayStart },
        details: { contains: shopId },
      },
      select: { id: true, createdAt: true },
    });

    if (!checkin) {
      return NextResponse.json(
        errorResponse('NO_CHECKIN', 'No active check-in found for this shop today. Check in first.'),
        { status: 400 }
      );
    }

    // Verify shop exists
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true },
    });

    if (!shop) {
      return NextResponse.json(errorResponse('NOT_FOUND', 'Shop not found'), { status: 404 });
    }

    // Calculate duration in minutes
    const duration = Math.round((Date.now() - checkin.createdAt.getTime()) / 60000);

    const details = JSON.stringify({
      shopId,
      timestamp: new Date().toISOString(),
      note: note ? sanitizeInput(note) : undefined,
      orderPlaced: !!orderPlaced,
      orderAmount: orderAmount || null,
      orderId: orderId || null,
    });

    await db.auditLog.create({
      data: {
        userId: user.userId,
        action: 'SALES_VISIT_CHECKOUT',
        entity: 'Shop',
        entityId: shopId,
        details,
        ipAddress: request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    return NextResponse.json(
      successResponse({
        visitId: checkin.id,
        duration,
        shopName: shop.name,
      })
    );
  } catch (error) {
    console.error('[SALES_REP CHECK-OUT ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to check out'),
      { status: 500 }
    );
  }
}