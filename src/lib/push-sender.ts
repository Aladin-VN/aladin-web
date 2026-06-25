// ALADIN Web Push Sender
// Sends push notifications via web-push to subscribed browsers
// Fire-and-forget — never blocks main operations

import webpush from 'web-push';

// ============================================
// CONFIGURATION
// ============================================

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return false;
  }
  webpush.setVapidDetails(
    'mailto:admin@aladin.vn',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
  configured = true;
  return true;
}

// ============================================
// PUBLIC KEY EXPORT (for client-side)
// ============================================

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

// ============================================
// SEND PUSH NOTIFICATION
// ============================================

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  tag?: string;
  renotify?: boolean;
  actions?: Array<{ action: string; title: string }>;
}

/**
 * Send a web push notification to a user.
 * Fetches their subscriptions from DB and sends to all active endpoints.
 * Invalid/expired subscriptions are automatically cleaned up.
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureConfigured()) {
    // VAPID not configured — skip silently
    return { sent: 0, failed: 0 };
  }

  try {
    const { db } = await import('./db');
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) return { sent: 0, failed: 0 };

    let sent = 0;
    let failed = 0;
    const staleIds: string[] = [];

    const pushPayload: webpush.PushSubscriptionJson = {
      endpoint: '', // filled per-subscription
      keys: { p256dh: '', auth: '' }, // filled per-subscription
    };

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const result = await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dhKey,
                auth: sub.authKey,
              },
            },
            JSON.stringify(payload),
            {
              TTL: 86400, // 24 hours
              urgency: 'normal',
            }
          );
          if (result.statusCode >= 200 && result.statusCode < 300) {
            sent++;
          } else {
            failed++;
            if (result.statusCode === 404 || result.statusCode === 410) {
              staleIds.push(sub.id);
            }
          }
        } catch (err: any) {
          failed++;
          // Clean up stale subscriptions
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            staleIds.push(sub.id);
          }
        }
      })
    );

    // Clean up stale subscriptions in background
    if (staleIds.length > 0) {
      db.pushSubscription.deleteMany({
        where: { id: { in: staleIds } },
      }).catch(() => {});
    }

    return { sent, failed };
  } catch (error) {
    console.error('[PUSH SEND ERROR]', error);
    return { sent: 0, failed: 0 };
  }
}

// ============================================
// CONVENIENCE: Send push for notification types
// ============================================

export async function pushNotificationEvent(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
) {
  const actionUrl = data?.orderId ? `/m/orders/${data.orderId}`
    : data?.shipmentId ? `/m/shipments`
    : data?.settlementId ? `/m/distributor/settlements/${data.settlementId}`
    : undefined;

  return sendPushNotification(userId, {
    title,
    body: message,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    tag: `aladin-${type}-${data?.orderId || data?.shipmentId || Date.now()}`,
    renotify: true,
    data: {
      url: actionUrl,
      notificationType: type,
      ...data,
    },
    actions: actionUrl ? [
      { action: 'view', title: 'Xem chi tiết' },
    ] : [],
  });
}