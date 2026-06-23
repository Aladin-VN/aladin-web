// GET|PATCH /api/notifications — Server-side notifications
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/get-auth-user';
import { successResponse, errorResponse } from '@/lib/security';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where: Record<string, unknown> = { userId: user.userId };
    if (unreadOnly) where.isRead = false;

    const [notifications, unreadCount, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.notification.count({ where: { userId: user.userId, isRead: false } }),
      db.notification.count({ where: { userId: user.userId } }),
    ]);

    return NextResponse.json(successResponse({
      items: notifications,
      unreadCount,
      pagination: { page, totalPages: Math.ceil(total / limit), total },
    }));
  } catch (error) {
    console.error('[NOTIFICATIONS GET ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', ''), { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    if (body.all) {
      await db.notification.updateMany({
        where: { userId: user.userId, isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
    } else if (body.ids?.length) {
      await db.notification.updateMany({
        where: { id: { in: body.ids }, userId: user.userId },
        data: { isRead: true, readAt: new Date() },
      });
    }

    return NextResponse.json(successResponse({ marked: true }));
  } catch (error) {
    console.error('[NOTIFICATIONS PATCH ERROR]', error);
    return NextResponse.json(errorResponse('INTERNAL_ERROR', ''), { status: 500 });
  }
}