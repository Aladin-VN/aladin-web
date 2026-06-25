// ALADIN Notification Preferences Engine
// Server-side enforcement — checks preferences before sending notifications
// Integrates with WS bridge + push + Zalo channels

import { db } from './db';
import { wsNotifyUser } from './ws-bridge';
import { pushNotificationEvent } from './push-sender';
import { sendNotification as sendZaloNotification } from './zalo/notification-engine';

// ============================================
// TYPES
// ============================================

export type NotificationChannel = 'in_app' | 'push' | 'zalo';
export type NotificationType = 'ORDER_STATUS' | 'SHIPMENT' | 'CREDIT' | 'SETTLEMENT' | 'INVENTORY' | 'PROMOTION' | 'SYSTEM';

interface DeliveryConfig {
  title: string;
  message: string;
  data?: Record<string, unknown>;
  type: NotificationType;
}

// ============================================
// PREFERENCE HELPERS
// ============================================

async function getPreferences(userId: string) {
  return db.notificationPreference.findUnique({
    where: { userId },
  });
}

function isTypeEnabled(prefs: any, type: NotificationType): boolean {
  if (!prefs) return true; // No preferences = all enabled (default)
  switch (type) {
    case 'ORDER_STATUS': return prefs.orderUpdates;
    case 'SHIPMENT': return prefs.shipmentUpdates;
    case 'CREDIT': return prefs.creditAlerts;
    case 'PROMOTION': return prefs.promotions;
    case 'INVENTORY':
    case 'SYSTEM':
    case 'SETTLEMENT':
      return prefs.systemAlerts;
    default: return true;
  }
}

function isChannelEnabled(prefs: any, channel: NotificationChannel): boolean {
  if (!prefs) return true;
  switch (channel) {
    case 'in_app': return prefs.inAppEnabled;
    case 'push': return prefs.pushEnabled;
    case 'zalo': return prefs.zaloEnabled;
    default: return true;
  }
}

function isInQuietHours(prefs: any): boolean {
  if (!prefs?.quietHoursEnabled) return false;

  // Vietnam timezone (UTC+7)
  const now = new Date();
  const vnHour = (now.getUTCHours() + 7) % 24;
  const vnMinute = now.getUTCMinutes();
  const currentMinutes = vnHour * 60 + vnMinute;

  const [startH, startM] = (prefs.quietHoursStart || '22:00').split(':').map(Number);
  const [endH, endM] = (prefs.quietHoursEnd || '07:00').split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Same day range (e.g., 09:00 - 17:00)
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    // Overnight range (e.g., 22:00 - 07:00)
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

// ============================================
// MAIN: Multi-channel notification delivery
// ============================================

/**
 * Deliver a notification across all enabled channels.
 * Respects user preferences, quiet hours, and type filters.
 *
 * Channels:
 * - in_app: DB notification + WebSocket push
 * - push: Browser push notification
 * - zalo: Zalo OA message (requires zaloId)
 */
export async function deliverNotification(
  userId: string,
  config: DeliveryConfig,
  options?: {
    zaloUserId?: string;
    skipChannels?: NotificationChannel[];
    forceChannels?: NotificationChannel[];
  }
): Promise<void> {
  const prefs = await getPreferences(userId);
  const inQuietHours = isInQuietHours(prefs);
  const skip = new Set(options?.skipChannels || []);
  const force = new Set(options?.forceChannels || []);

  // Always allow forced channels (e.g., CREDIT_LOCKED bypasses quiet hours)
  // IN-APP: DB + WebSocket
  if (!skip.has('in_app') && (force.has('in_app') || (isChannelEnabled(prefs, 'in_app') && isTypeEnabled(prefs, config.type)))) {
    // Skip quiet hours for in-app (user will see when they open the app)
    const { createNotification } = await import('./notifications');
    await createNotification(userId, config.type, config.title, config.message, config.data);
    // WS is already handled inside createNotification
  }

  // PUSH: Browser push
  if (!skip.has('push') && !inQuietHours && (force.has('push') || (isChannelEnabled(prefs, 'push') && isTypeEnabled(prefs, config.type)))) {
    pushNotificationEvent(userId, config.type, config.title, config.message, config.data).catch(() => {});
  }

  // ZALO: OA message
  if (!skip.has('zalo') && !inQuietHours && options?.zaloUserId && (force.has('zalo') || (isChannelEnabled(prefs, 'zalo') && isTypeEnabled(prefs, config.type)))) {
    // Map type to Zalo event type
    const statusMap: Record<string, any> = {
      ORDER_STATUS: config.data?.status || 'CONFIRMED',
    };
    sendZaloNotification(options.zaloUserId, (statusMap[config.type] || 'ORDER_CONFIRMED') as any, {
      orderNumber: (config.data?.orderNumber as string) || '',
      status: (config.data?.status as string) || config.type,
      itemCount: config.data?.itemCount as number,
      totalAmount: config.data?.totalAmount as number,
      shopName: config.data?.shopName as string,
      paymentMethod: config.data?.paymentMethod as string,
    }).catch(() => {});
  }
}

// ============================================
// PREFERENCE INIT (auto-create on first login)
// ============================================

export async function ensurePreferenceExists(userId: string): Promise<void> {
  try {
    const existing = await db.notificationPreference.findUnique({ where: { userId } });
    if (!existing) {
      await db.notificationPreference.create({ data: { userId } });
    }
  } catch (error) {
    console.error('[PREF INIT ERROR]', error);
  }
}