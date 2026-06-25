// GET|PUT /api/notifications/preferences — User notification preference management
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/get-auth-user';
import { successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    let prefs = await db.notificationPreference.findUnique({
      where: { userId: user.userId },
    });

    // Auto-create if not exists
    if (!prefs) {
      prefs = await db.notificationPreference.create({
        data: { userId: user.userId },
      });
    }

    return NextResponse.json(successResponse({
      id: prefs.id,
      inAppEnabled: prefs.inAppEnabled,
      pushEnabled: prefs.pushEnabled,
      zaloEnabled: prefs.zaloEnabled,
      orderUpdates: prefs.orderUpdates,
      shipmentUpdates: prefs.shipmentUpdates,
      creditAlerts: prefs.creditAlerts,
      promotions: prefs.promotions,
      systemAlerts: prefs.systemAlerts,
      quietHoursEnabled: prefs.quietHoursEnabled,
      quietHoursStart: prefs.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd,
      // Computed
      pushSupported: true, // Client can check Notification API
      zaloLinked: !!(await db.user.findUnique({
        where: { id: user.userId },
        select: { zaloId: true },
      }))?.zaloId,
    }));
  } catch (error) {
    console.error('[NOTIF PREFS GET ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', ''), { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    const body = await request.json();

    // Validate boolean fields
    const booleanFields = [
      'inAppEnabled', 'pushEnabled', 'zaloEnabled',
      'orderUpdates', 'shipmentUpdates', 'creditAlerts',
      'promotions', 'systemAlerts', 'quietHoursEnabled',
    ];
    const updates: Record<string, unknown> = {};
    for (const field of booleanFields) {
      if (field in body && typeof body[field] === 'boolean') {
        updates[field] = body[field];
      }
    }

    // Validate time fields
    if (body.quietHoursStart && /^\d{2}:\d{2}$/.test(body.quietHoursStart)) {
      updates.quietHoursStart = body.quietHoursStart;
    }
    if (body.quietHoursEnd && /^\d{2}:\d{2}$/.test(body.quietHoursEnd)) {
      updates.quietHoursEnd = body.quietHoursEnd;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(errorResponse('INVALID_INPUT', 'No valid fields to update'), { status: 400 });
    }

    // Upsert
    const prefs = await db.notificationPreference.upsert({
      where: { userId: user.userId },
      create: { userId: user.userId, ...updates },
      update: updates,
    });

    return NextResponse.json(successResponse({
      id: prefs.id,
      inAppEnabled: prefs.inAppEnabled,
      pushEnabled: prefs.pushEnabled,
      zaloEnabled: prefs.zaloEnabled,
      orderUpdates: prefs.orderUpdates,
      shipmentUpdates: prefs.shipmentUpdates,
      creditAlerts: prefs.creditAlerts,
      promotions: prefs.promotions,
      systemAlerts: prefs.systemAlerts,
      quietHoursEnabled: prefs.quietHoursEnabled,
      quietHoursStart: prefs.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd,
    }));
  } catch (error) {
    console.error('[NOTIF PREFS PUT ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', ''), { status: 500 });
  }
}