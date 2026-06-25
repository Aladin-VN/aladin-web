// POST /api/push/subscribe — Register web push subscription
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/get-auth-user';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    const { endpoint, keys } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_SUBSCRIPTION', message: 'Missing push subscription fields' } },
        { status: 400 }
      );
    }

    // Upsert the push subscription
    await db.pushSubscription.upsert({
      where: {
        userId_endpoint: { userId: user.userId, endpoint },
      },
      create: {
        userId: user.userId,
        endpoint,
        p256dhKey: keys.p256dh,
        authKey: keys.auth,
        userAgent: request.headers.get('user-agent') || '',
        createdAt: new Date(),
      },
      update: {
        p256dhKey: keys.p256dh,
        authKey: keys.auth,
        userAgent: request.headers.get('user-agent') || '',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, data: { subscribed: true } });
  } catch (error) {
    console.error('[PUSH SUBSCRIBE ERROR]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to register push subscription' } },
      { status: 500 }
    );
  }
}

// DELETE /api/push/subscribe — Unregister push subscription
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user instanceof NextResponse) return user;

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_REQUEST', message: 'Missing endpoint' } },
        { status: 400 }
      );
    }

    await db.pushSubscription.deleteMany({
      where: { userId: user.userId, endpoint },
    });

    return NextResponse.json({ success: true, data: { unsubscribed: true } });
  } catch (error) {
    console.error('[PUSH UNSUBSCRIBE ERROR]', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to unregister' } },
      { status: 500 }
    );
  }
}