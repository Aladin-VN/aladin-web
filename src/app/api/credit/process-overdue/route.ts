// ALADIN Process Overdue Shops API
// POST /api/credit/process-overdue — Admin endpoint to trigger auto-lock

import { NextRequest, NextResponse } from 'next/server';
import { extractBearerToken, verifyAccessToken, isAdmin } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/security';
import { checkAndLockOverdueShops } from '@/lib/credit-engine';
import { sendCreditLockedNotification } from '@/lib/zalo/notification-engine';
import { notifyCreditReminder } from '@/lib/notifications';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get('authorization'));
    if (!token) {
      return NextResponse.json(errorResponse('UNAUTHORIZED', 'Authentication required'), { status: 401 });
    }
    const payload = verifyAccessToken(token);
    if (!payload || !isAdmin(payload.role)) {
      return NextResponse.json(errorResponse('FORBIDDEN', 'Admin access required'), { status: 403 });
    }

    // Run the overdue check
    const result = await checkAndLockOverdueShops();

    // Send Zalo credit locked notification to newly locked shops (async, non-blocking)
    for (const detail of result.details) {
      sendCreditLockedNotification(detail.shopId).catch((err) => {
        console.error(`[PROCESS OVERDUE] Notification error for shop ${detail.shopId}:`, err);
      });

      // Send in-app credit reminder notification (async, non-blocking)
      try {
        const shop = await db.shop.findUnique({
          where: { id: detail.shopId },
          select: { userId: true },
        });
        if (shop?.userId) {
          notifyCreditReminder(detail.shopId, shop.userId).catch(() => {});
        }
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json(
      successResponse({
        lockedCount: result.lockedCount,
        alreadyOverdue: result.alreadyOverdue,
        details: result.details,
        processedAt: new Date(),
        processedBy: payload.userId,
      })
    );
  } catch (error) {
    console.error('[PROCESS OVERDUE ERROR]', error);
    return NextResponse.json(
      errorResponse('INTERNAL_ERROR', 'Failed to process overdue shops'),
      { status: 500 }
    );
  }
}
