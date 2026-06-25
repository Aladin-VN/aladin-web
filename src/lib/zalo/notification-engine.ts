// ALADIN Zalo Bot — Notification Engine (Wave 4 Enhanced)
// Sends proactive Zalo messages to shop owners on business events.
// Features:
//   - Preference-aware: checks NotificationPreference.zaloEnabled + per-type toggles
//   - Quiet hours: respects user-configured quiet hours (Vietnam timezone)
//   - Push integration: triggers web push alongside Zalo
//   - WS bridge: broadcasts via WebSocket for real-time in-app updates
//   - Bidirectional: can be called from in-app notification flow (bridgeInAppToZalo)

import { messageQueue } from './message-queue';
import { db } from '../db';
import { pushNotificationEvent } from '../push-sender';

// ============================================
// NOTIFICATION EVENT TYPES
// ============================================

export type NotificationEventType =
  | 'ORDER_CONFIRMED'
  | 'ORDER_PROCESSING'
  | 'ORDER_PACKED'
  | 'ORDER_OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'CREDIT_REMINDER'
  | 'CREDIT_LOCKED'
  | 'SHIPMENT_PICKED_UP'
  | 'SHIPMENT_IN_TRANSIT'
  | 'SHIPMENT_DELIVERED'
  | 'SHIPMENT_FAILED'
  | 'INVENTORY_LOW'
  | 'SETTLEMENT_READY'
  | 'PROMOTION'
  | 'DEBT_PAYMENT_RECEIVED';

// ============================================
// NOTIFICATION TEMPLATES (Vietnamese)
// ============================================

interface NotificationTemplate {
  getText: (data: NotificationData) => string;
  quickReplies: string[];
  /** Map to in-app notification type for preference checking */
  inAppType: 'ORDER_STATUS' | 'SHIPMENT' | 'CREDIT' | 'INVENTORY' | 'SETTLEMENT' | 'PROMOTION';
}

interface NotificationData {
  orderNumber?: string;
  status?: string;
  itemCount?: number;
  totalAmount?: number;
  paymentMethod?: string;
  cancelReason?: string;
  shopName?: string;
  creditDueDate?: string;
  creditBalance?: number;
  creditLimit?: number;
  shipmentId?: string;
  productNames?: string[];
  settlementId?: string;
  amount?: number;
  tripCount?: number;
  description?: string;
  promotionTitle?: string;
  orderCount?: number;
  // Generic fields for bridge messages
  title?: string;
  message?: string;
}

const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  // --- ORDER EVENTS ---
  ORDER_CONFIRMED: {
    inAppType: 'ORDER_STATUS',
    getText: (d) =>
      `✅ Đơn hàng đã xác nhận!\n\n` +
      `📌 ${d.orderNumber}\n` +
      `${d.itemCount ?? 0} sản phẩm | ${formatVND(d.totalAmount ?? 0)}\n\n` +
      `Đang chuẩn bị hàng...`,
    quickReplies: ['đơn hàng', 'tín dụng', 'menu'],
  },

  ORDER_PROCESSING: {
    inAppType: 'ORDER_STATUS',
    getText: (d) =>
      `⚙️ Đơn hàng đang xử lý!\n\n` +
      `📌 ${d.orderNumber}\n` +
      `Nhân viên đang lấy hàng từ kho...`,
    quickReplies: ['đơn hàng', 'menu'],
  },

  ORDER_PACKED: {
    inAppType: 'ORDER_STATUS',
    getText: (d) =>
      `📦 Đơn hàng đã đóng gói!\n\n` +
      `📌 ${d.orderNumber}\n` +
      `${d.itemCount ?? 0} sản phẩm | ${formatVND(d.totalAmount ?? 0)}\n\n` +
      `Chờ xe giao hàng...`,
    quickReplies: ['đơn hàng', 'menu'],
  },

  ORDER_OUT_FOR_DELIVERY: {
    inAppType: 'ORDER_STATUS',
    getText: (d) =>
      `🚚 Đơn hàng đang giao!\n\n` +
      `📌 ${d.orderNumber}\n` +
      `Xe đang trên đường đến ${d.shopName || 'cửa hàng'}...`,
    quickReplies: ['đơn hàng', 'menu'],
  },

  ORDER_DELIVERED: {
    inAppType: 'ORDER_STATUS',
    getText: (d) => {
      let msg =
        `🎉 Đơn hàng đã giao thành công!\n\n` +
        `📌 ${d.orderNumber}\n` +
        `${d.itemCount ?? 0} sản phẩm | ${formatVND(d.totalAmount ?? 0)}\n\n`;

      if (d.paymentMethod === 'CREDIT') {
        msg +=
          `💳 Thanh toán tín dụng:\n` +
          `Hạn thanh toán: 7 ngày\n` +
          `Gõ "tín dụng" để xem chi tiết.\n\n`;
      }

      msg += `Cảm ơn ${d.shopName || 'quý khách'} đã đặt hàng! 🙏`;
      return msg;
    },
    quickReplies: ['đơn hàng', 'tín dụng', 'menu', 'phổ biến'],
  },

  ORDER_CANCELLED: {
    inAppType: 'ORDER_STATUS',
    getText: (d) =>
      `❌ Đơn hàng đã bị hủy\n\n` +
      `📌 ${d.orderNumber}\n` +
      `${d.itemCount ?? 0} sản phẩm | ${formatVND(d.totalAmount ?? 0)}\n` +
      (d.cancelReason ? `Lý do: ${d.cancelReason}\n\n` : '\n') +
      `Nếu có thắc mắc, hãy liên hệ hỗ trợ.`,
    quickReplies: ['đơn hàng', 'menu', 'giúp đỡ'],
  },

  // --- CREDIT EVENTS ---
  CREDIT_REMINDER: {
    inAppType: 'CREDIT',
    getText: (d) =>
      `⏰ Nhắc nhở thanh toán tín dụng!\n\n` +
      `💰 Còn nợ: ${formatVND(d.creditBalance ?? 0)}\n` +
      `📊 Hạn mức: ${formatVND(d.creditLimit ?? 0)}\n` +
      `📅 Hạn thanh toán: ${d.creditDueDate || '7 ngày'}\n\n` +
      `Gõ "trả nợ" để thanh toán ngay.\n` +
      `Vượt quá hạn sẽ bị khóa tín dụng!`,
    quickReplies: ['trả nợ', 'tín dụng', 'đơn hàng'],
  },

  CREDIT_LOCKED: {
    inAppType: 'CREDIT',
    getText: (d) =>
      `🔒 Tín dụng đã bị khóa!\n\n` +
      `💰 Còn nợ: ${formatVND(d.creditBalance ?? 0)}\n` +
      `Quá hạn thanh toán — tài khoản tín dụng bị tạm khóa.\n\n` +
      `Gõ "trả nợ" để thanh toán và mở khóa ngay.`,
    quickReplies: ['trả nợ', 'tín dụng'],
  },

  // --- SHIPMENT EVENTS (Wave 4 new) ---
  SHIPMENT_PICKED_UP: {
    inAppType: 'SHIPMENT',
    getText: (d) =>
      `📦 Đã lấy hàng!\n\n` +
      `Tài xế đã lấy hàng từ kho.\n` +
      (d.orderNumber ? `Đơn: ${d.orderNumber}\n` : '') +
      `Đang lên đường giao...`,
    quickReplies: ['đơn hàng', 'menu'],
  },

  SHIPMENT_IN_TRANSIT: {
    inAppType: 'SHIPMENT',
    getText: (d) =>
      `🚚 Đang trên đường giao!\n\n` +
      (d.orderNumber ? `Đơn: ${d.orderNumber}\n` : '') +
      `Tài xế đang giao đến ${d.shopName || 'cửa hàng'}...`,
    quickReplies: ['đơn hàng', 'menu'],
  },

  SHIPMENT_DELIVERED: {
    inAppType: 'SHIPMENT',
    getText: (d) =>
      `✅ Giao hàng thành công!\n\n` +
      (d.orderNumber ? `Đơn: ${d.orderNumber}\n` : '') +
      `Cảm ơn ${d.shopName || 'quý khách'}!`,
    quickReplies: ['đơn hàng', 'menu', 'phổ biến'],
  },

  SHIPMENT_FAILED: {
    inAppType: 'SHIPMENT',
    getText: (d) =>
      `⚠️ Giao hàng thất bại!\n\n` +
      (d.orderNumber ? `Đơn: ${d.orderNumber}\n` : '') +
      (d.description ? `Lý do: ${d.description}\n` : '') +
      `Nhân viên sẽ liên hệ lại.`,
    quickReplies: ['đơn hàng', 'giúp đỡ'],
  },

  // --- INVENTORY (Wave 4 new) ---
  INVENTORY_LOW: {
    inAppType: 'INVENTORY',
    getText: (d) =>
      `📉 Cảnh báo tồn kho thấp!\n\n` +
      `${d.productNames?.length ?? 0} sản phẩm dưới mức tối thiểu:\n` +
      (d.productNames?.slice(0, 5).join(', ') || '') +
      (d.productNames && d.productNames.length > 5 ? `\nvà ${d.productNames.length - 5} sản phẩm khác...` : ''),
    quickReplies: ['tồn kho', 'phổ biến', 'menu'],
  },

  // --- SETTLEMENT (Wave 4 new) ---
  SETTLEMENT_READY: {
    inAppType: 'SETTLEMENT',
    getText: (d) =>
      `💰 Kỳ quyết toán mới!\n\n` +
      (d.amount ? `Số tiền: ${formatVND(d.amount)}\n` : '') +
      `Xem chi tiết trong ứng dụng.`,
    quickReplies: ['doanh thu', 'menu'],
  },

  // --- PROMOTION (Wave 4 new) ---
  PROMOTION: {
    inAppType: 'PROMOTION',
    getText: (d) =>
      `🎁 ${d.promotionTitle || 'Khuyến mãi mới!'}\n\n` +
      (d.message || 'Xem chi tiết trong ứng dụng.'),
    quickReplies: ['phổ biến', 'đơn hàng', 'menu'],
  },

  // --- DEBT PAYMENT (Wave 4 new) ---
  DEBT_PAYMENT_RECEIVED: {
    inAppType: 'CREDIT',
    getText: (d) =>
      `✅ Đã ghi nhận thanh toán!\n\n` +
      (d.amount ? `Số tiền: ${formatVND(d.amount)}\n` : '') +
      `Cảm ơn bạn đã thanh toán đúng hạn!`,
    quickReplies: ['tín dụng', 'đơn hàng', 'menu'],
  },
};

// ============================================
// PREFERENCE CHECK — Quiet Hours
// ============================================

/**
 * Check if the current time is within the user's quiet hours.
 * Uses Vietnam timezone (Asia/Ho_Chi_Minh, UTC+7).
 * Returns true if we SHOULD NOT send (i.e., currently in quiet hours).
 */
function isInQuietHours(
  quietHoursEnabled: boolean,
  quietHoursStart: string,
  quietHoursEnd: string
): boolean {
  if (!quietHoursEnabled) return false;

  // Get current time in Vietnam timezone
  const now = new Date();
  const vietnamTime = new Date(
    now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' })
  );
  const currentMinutes = vietnamTime.getHours() * 60 + vietnamTime.getMinutes();

  const [startH, startM] = quietHoursStart.split(':').map(Number);
  const [endH, endM] = quietHoursEnd.split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (startMinutes > endMinutes) {
    // Spans midnight: e.g., 22:00 → 07:00
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  // Same-day quiet hours: e.g., 13:00 → 14:00
  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Check if a specific notification type is enabled in user preferences.
 * Maps Zalo event types to in-app preference toggles.
 */
function isTypeEnabled(
  eventType: string,
  prefs: {
    orderUpdates: boolean;
    shipmentUpdates: boolean;
    creditAlerts: boolean;
    promotions: boolean;
    systemAlerts: boolean;
  }
): boolean {
  const template = NOTIFICATION_TEMPLATES[eventType];
  if (!template) return true; // Unknown types default to allowed

  switch (template.inAppType) {
    case 'ORDER_STATUS': return prefs.orderUpdates;
    case 'SHIPMENT': return prefs.shipmentUpdates;
    case 'CREDIT': return prefs.creditAlerts;
    case 'INVENTORY':
    case 'SETTLEMENT': return prefs.systemAlerts;
    case 'PROMOTION': return prefs.promotions;
    default: return true;
  }
}

// ============================================
// PREFERENCE-AWARE SEND (Core)
// ============================================

/**
 * Get user's notification preferences (with cache-friendly defaults).
 * Returns null if user not found.
 */
async function getUserPrefs(
  userId: string
): Promise<{
  inAppEnabled: boolean;
  pushEnabled: boolean;
  zaloEnabled: boolean;
  orderUpdates: boolean;
  shipmentUpdates: boolean;
  creditAlerts: boolean;
  promotions: boolean;
  systemAlerts: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
} | null> {
  try {
    const prefs = await db.notificationPreference.findUnique({
      where: { userId },
    });
    if (!prefs) {
      // Default preferences (all enabled)
      return {
        inAppEnabled: true,
        pushEnabled: true,
        zaloEnabled: true,
        orderUpdates: true,
        shipmentUpdates: true,
        creditAlerts: true,
        promotions: true,
        systemAlerts: true,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
      };
    }
    return prefs;
  } catch {
    return null;
  }
}

// ============================================
// SEND NOTIFICATION (Enhanced)
// ============================================

/**
 * Send a notification to a shop owner via Zalo.
 * Uses the async message queue — non-blocking.
 * Does NOT check preferences here — callers should check first.
 */
export function sendNotification(
  zaloUserId: string,
  eventType: NotificationEventType,
  data: NotificationData
): { enqueued: boolean; messageId?: string } {
  const template = NOTIFICATION_TEMPLATES[eventType];
  if (!template) {
    console.error(`[ZALO NOTIFICATION] Unknown event type: ${eventType}`);
    return { enqueued: false };
  }

  const text = template.getText(data);

  // Use the message queue to send asynchronously
  const result = messageQueue.enqueue({
    type: 'EVENT_CALLBACK',
    userId: zaloUserId,
    payload: {
      notificationEvent: eventType,
      notificationText: text,
      quickReplies: template.quickReplies,
      orderNumber: data.orderNumber || '',
    },
    priority: 3, // Higher than general events, lower than direct messages
    maxAttempts: 2,
    dedupKey: `notif-${eventType}-${data.orderNumber || data.shipmentId || ''}-${Date.now()}`,
  });

  if (result.enqueued) {
    console.log(`[ZALO NOTIFICATION] Queued ${eventType} for ${zaloUserId}`);
  }

  return { enqueued: result.enqueued, messageId: result.messageId };
}

// ============================================
// UNIFIED NOTIFICATION SENDER (Wave 4)
// ============================================

/**
 * Send a notification through all enabled channels (Zalo + Push + WS).
 * This is the main entry point for business-event notifications.
 * It checks preferences, quiet hours, and fans out to all channels.
 *
 * @param userId - ALADIN user ID
 * @param eventType - Zalo notification event type
 * @param data - Template data
 * @param pushData - Optional extra data for push notification
 */
export async function sendMultiChannelNotification(
  userId: string,
  eventType: NotificationEventType,
  data: NotificationData,
  pushData?: { orderId?: string; shipmentId?: string; settlementId?: string }
): Promise<void> {
  try {
    // Fetch preferences + zaloId in parallel
    const [prefs, user] = await Promise.all([
      getUserPrefs(userId),
      db.user.findUnique({
        where: { id: userId },
        select: { zaloId: true, role: true },
      }),
    ]);

    if (!user || !prefs) return;

    const template = NOTIFICATION_TEMPLATES[eventType];

    // Check quiet hours for Zalo and Push (in-app is always delivered)
    const inQuietHours = isInQuietHours(
      prefs.quietHoursEnabled,
      prefs.quietHoursStart,
      prefs.quietHoursEnd
    );

    // --- ZALO CHANNEL ---
    if (prefs.zaloEnabled && user.zaloId) {
      // Check per-type preference
      if (template && isTypeEnabled(eventType, prefs) && !inQuietHours) {
        sendNotification(user.zaloId, eventType, data);
      }
    }

    // --- PUSH CHANNEL ---
    if (prefs.pushEnabled && template && !inQuietHours) {
      const pushTitle = data.title || (
        eventType.startsWith('ORDER_') ? 'Cập nhật đơn hàng' :
        eventType.startsWith('SHIPMENT_') ? 'Cập nhật vận chuyển' :
        eventType.startsWith('CREDIT_') ? 'Cảnh báo công nợ' :
        eventType === 'PROMOTION' ? 'Khuyến mãi' :
        eventType === 'INVENTORY_LOW' ? 'Cảnh báo tồn kho' :
        eventType === 'SETTLEMENT_READY' ? 'Quyết toán' :
        'Thông báo mới'
      );
      const pushMessage = data.message || (template ? template.getText(data).replace(/\n/g, ' ').substring(0, 120) : '');

      pushNotificationEvent(
        userId,
        template.inAppType,
        pushTitle,
        pushMessage,
        { ...pushData, source: 'multi-channel', eventType }
      ).catch(() => {});
    }
  } catch (error) {
    // Notifications must never fail the main flow
    console.error('[MULTI-CHANNEL NOTIF ERROR]', error);
  }
}

// ============================================
// IN-APP → ZALO BRIDGE (Wave 4 Bidirectional)
// ============================================

/**
 * Bridge an in-app notification to Zalo.
 * Call this from the central notification system when a notification is created,
 * so users who prefer Zalo also receive the notification there.
 *
 * @param userId - ALADIN user ID
 * @param type - In-app notification type (ORDER_STATUS, SHIPMENT, CREDIT, etc.)
 * @param title - Notification title
 * @param message - Notification message body
 * @param data - Notification data payload
 */
export async function bridgeInAppToZalo(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const [prefs, user] = await Promise.all([
      getUserPrefs(userId),
      db.user.findUnique({
        where: { id: userId },
        select: { zaloId: true },
      }),
    ]);

    if (!user?.zaloId || !prefs) return;

    // Check if Zalo is enabled and type is enabled
    if (!prefs.zaloEnabled) return;

    // Map in-app type to preference check
    const typePrefMap: Record<string, boolean> = {
      ORDER_STATUS: prefs.orderUpdates,
      SHIPMENT: prefs.shipmentUpdates,
      CREDIT: prefs.creditAlerts,
      INVENTORY: prefs.systemAlerts,
      SETTLEMENT: prefs.systemAlerts,
      PROMOTION: prefs.promotions,
      SYSTEM: prefs.systemAlerts,
    };

    if (typePrefMap[type] === false) return;

    // Check quiet hours
    if (isInQuietHours(prefs.quietHoursEnabled, prefs.quietHoursStart, prefs.quietHoursEnd)) {
      return;
    }

    // Send via Zalo message queue
    messageQueue.enqueue({
      type: 'EVENT_CALLBACK',
      userId: user.zaloId,
      payload: {
        notificationEvent: type,
        notificationText: `${title}\n\n${message}`,
        quickReplies: ['đơn hàng', 'menu'],
        bridgedFrom: 'in-app',
      },
      priority: 3,
      maxAttempts: 2,
      dedupKey: `bridge-${type}-${data?.orderId || data?.shipmentId || ''}-${Date.now()}`,
    });

    console.log(`[ZALO BRIDGE] In-app → Zalo: ${type} for ${userId}`);
  } catch (error) {
    console.error('[ZALO BRIDGE ERROR]', error);
  }
}

// ============================================
// ORDER STATUS CHANGE HOOK
// ============================================

/**
 * Hook to call after order status changes.
 * Sends via multi-channel (Zalo + Push) in addition to existing in-app WS.
 */
export async function notifyOrderStatusChange(
  orderId: string,
  newStatus: string
): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            userId: true,
            user: { select: { zaloId: true, id: true } },
          },
        },
        items: { select: { id: true } },
      },
    });

    if (!order?.shop?.user) return;

    const shopUserId = order.shop.user.id;
    const shopName = order.shop.name;

    // Map order status to notification event
    const statusToEvent: Record<string, NotificationEventType> = {
      CONFIRMED: 'ORDER_CONFIRMED',
      PROCESSING: 'ORDER_PROCESSING',
      PACKED: 'ORDER_PACKED',
      OUT_FOR_DELIVERY: 'ORDER_OUT_FOR_DELIVERY',
      DELIVERED: 'ORDER_DELIVERED',
      CANCELLED: 'ORDER_CANCELLED',
    };

    const eventType = statusToEvent[newStatus];
    if (!eventType) return;

    // Multi-channel: Zalo + Push (preference-aware)
    await sendMultiChannelNotification(shopUserId, eventType, {
      orderNumber: order.orderNumber,
      status: newStatus,
      itemCount: order.items.length,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      shopName,
    }, { orderId });
  } catch (error) {
    console.error('[ZALO NOTIFICATION] Error sending order status notification:', error);
  }
}

/**
 * Hook to call after order cancellation.
 */
export async function notifyOrderCancellation(
  orderId: string,
  cancelReason?: string
): Promise<void> {
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            userId: true,
            user: { select: { zaloId: true, id: true } },
          },
        },
        items: { select: { id: true } },
      },
    });

    if (!order?.shop?.user) return;

    await sendMultiChannelNotification(order.shop.user.id, 'ORDER_CANCELLED', {
      orderNumber: order.orderNumber,
      status: 'CANCELLED',
      itemCount: order.items.length,
      totalAmount: order.totalAmount,
      cancelReason,
      shopName: order.shop.name,
    }, { orderId });
  } catch (error) {
    console.error('[ZALO NOTIFICATION] Error sending cancellation notification:', error);
  }
}

// ============================================
// CREDIT NOTIFICATIONS
// ============================================

/**
 * Send credit payment reminder via multi-channel.
 */
export async function sendCreditReminder(shopId: string): Promise<void> {
  try {
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      include: {
        user: { select: { zaloId: true, id: true } },
      },
    });

    if (!shop?.user || shop.creditBalance <= 0) return;

    const lastCreditTx = await db.transaction.findFirst({
      where: { shopId, type: 'CREDIT_USED' },
      orderBy: { createdAt: 'desc' },
    });

    let dueDate = '7 ngày';
    if (lastCreditTx) {
      const due = new Date(lastCreditTx.createdAt);
      due.setDate(due.getDate() + 7);
      const now = new Date();
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0) dueDate = `${daysLeft} ngày nữa`;
      else if (daysLeft === 0) dueDate = 'Hôm nay!';
      else dueDate = `Quá hạn ${Math.abs(daysLeft)} ngày`;
    }

    await sendMultiChannelNotification(shop.user.id, 'CREDIT_REMINDER', {
      orderNumber: '',
      creditBalance: shop.creditBalance,
      creditLimit: shop.creditLimit,
      creditDueDate: dueDate,
      shopName: shop.name,
    }, { shopId });
  } catch (error) {
    console.error('[ZALO NOTIFICATION] Error sending credit reminder:', error);
  }
}

/**
 * Send credit lock notification via multi-channel.
 */
export async function sendCreditLockedNotification(shopId: string): Promise<void> {
  try {
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      include: {
        user: { select: { zaloId: true, id: true } },
      },
    });

    if (!shop?.user) return;

    await sendMultiChannelNotification(shop.user.id, 'CREDIT_LOCKED', {
      orderNumber: '',
      creditBalance: shop.creditBalance,
      creditLimit: shop.creditLimit,
      shopName: shop.name,
    }, { shopId });
  } catch (error) {
    console.error('[ZALO NOTIFICATION] Error sending credit locked notification:', error);
  }
}

// ============================================
// SHIPMENT NOTIFICATIONS (Wave 4 new)
// ============================================

/**
 * Notify shop owner about shipment status change via Zalo + Push.
 */
export async function notifyShipmentStatusChange(
  orderId: string,
  newStatus: string
): Promise<void> {
  try {
    const statusToEvent: Record<string, NotificationEventType> = {
      PICKED_UP: 'SHIPMENT_PICKED_UP',
      IN_TRANSIT: 'SHIPMENT_IN_TRANSIT',
      DELIVERED: 'SHIPMENT_DELIVERED',
      FAILED: 'SHIPMENT_FAILED',
    };

    const eventType = statusToEvent[newStatus];
    if (!eventType) return;

    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        shop: {
          select: {
            name: true,
            userId: true,
          },
        },
      },
    });

    if (!order?.shop) return;

    await sendMultiChannelNotification(order.shop.userId, eventType, {
      orderNumber: order.orderNumber,
      shopName: order.shop.name,
    }, { orderId });
  } catch (error) {
    console.error('[ZALO SHIPMENT NOTIF ERROR]', error);
  }
}

// ============================================
// PROMOTION BROADCAST (Wave 4 new)
// ============================================

/**
 * Broadcast a promotion to all shop owners via Zalo + Push.
 * Runs in background — never blocks.
 */
export async function broadcastPromotionViaZalo(
  title: string,
  message: string,
  promotionData?: { productNames?: string[]; discountPercent?: number }
): Promise<{ zaloQueued: number; pushSent: number }> {
  let zaloQueued = 0;
  let pushSent = 0;

  try {
    const users = await db.user.findMany({
      where: {
        role: 'SHOP_OWNER',
        status: 'ACTIVE',
        zaloId: { not: null },
      },
      select: {
        id: true,
        zaloId: true,
        notificationPreference: {
          select: {
            zaloEnabled: true,
            pushEnabled: true,
            promotions: true,
            quietHoursEnabled: true,
            quietHoursStart: true as const,
            quietHoursEnd: true as const,
          },
        },
      },
    });

    for (const user of users) {
      const prefs = user.notificationPreference;
      const quietHours = prefs && isInQuietHours(
        prefs.quietHoursEnabled,
        prefs.quietHoursStart,
        prefs.quietHoursEnd
      );

      // Zalo
      if (user.zaloId && prefs?.zaloEnabled !== false && prefs?.promotions !== false && !quietHours) {
        sendNotification(user.zaloId, 'PROMOTION', {
          promotionTitle: title,
          message,
          productNames: promotionData?.productNames,
        });
        zaloQueued++;
      }

      // Push
      if (prefs?.pushEnabled !== false && prefs?.promotions !== false && !quietHours) {
        const result = await pushNotificationEvent(
          user.id,
          'PROMOTION',
          title,
          message.substring(0, 120),
          { source: 'zalo-broadcast' }
        );
        pushSent += result.sent;
      }
    }

    console.log(`[ZALO BROADCAST] Promotion queued for ${zaloQueued} Zalo users, push sent to ${pushSent}`);
  } catch (error) {
    console.error('[ZALO BROADCAST ERROR]', error);
  }

  return { zaloQueued, pushSent };
}

// ============================================
// HELPERS
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'd';
}