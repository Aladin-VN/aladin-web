// ALADIN Zalo Bot — Notification Engine
// Sends proactive Zalo messages to shop owners on order status changes.
// Uses the async message queue to ensure notifications don't block API responses.

import { messageQueue } from './message-queue';
import { db } from '../db';

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
  | 'CREDIT_LOCKED';

// ============================================
// NOTIFICATION TEMPLATES (Vietnamese)
// ============================================

interface NotificationTemplate {
  getText: (data: NotificationData) => string;
  quickReplies: string[];
}

interface NotificationData {
  orderNumber: string;
  status: string;
  itemCount?: number;
  totalAmount?: number;
  paymentMethod?: string;
  cancelReason?: string;
  shopName?: string;
  creditDueDate?: string;
  creditBalance?: number;
  creditLimit?: number;
}

const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  ORDER_CONFIRMED: {
    getText: (d) =>
      `✅ Đơn hàng đã xác nhận!\n\n` +
      `📌 ${d.orderNumber}\n` +
      `${d.itemCount ?? 0} sản phẩm | ${formatVND(d.totalAmount ?? 0)}\n\n` +
      `Đang chuẩn bị hàng...`,
    quickReplies: ['đơn hàng', 'tín dụng', 'menu'],
  },

  ORDER_PROCESSING: {
    getText: (d) =>
      `⚙️ Đơn hàng đang xử lý!\n\n` +
      `📌 ${d.orderNumber}\n` +
      `Nhân viên đang lấy hàng từ kho...`,
    quickReplies: ['đơn hàng', 'menu'],
  },

  ORDER_PACKED: {
    getText: (d) =>
      `📦 Đơn hàng đã đóng gói!\n\n` +
      `📌 ${d.orderNumber}\n` +
      `${d.itemCount ?? 0} sản phẩm | ${formatVND(d.totalAmount ?? 0)}\n\n` +
      `Chờ xe giao hàng...`,
    quickReplies: ['đơn hàng', 'menu'],
  },

  ORDER_OUT_FOR_DELIVERY: {
    getText: (d) =>
      `🚚 Đơn hàng đang giao!\n\n` +
      `📌 ${d.orderNumber}\n` +
      `Xe đang trên đường đến ${d.shopName || 'cửa hàng'}...`,
    quickReplies: ['đơn hàng', 'menu'],
  },

  ORDER_DELIVERED: {
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
    getText: (d) =>
      `❌ Đơn hàng đã bị hủy\n\n` +
      `📌 ${d.orderNumber}\n` +
      `${d.itemCount ?? 0} sản phẩm | ${formatVND(d.totalAmount ?? 0)}\n` +
      (d.cancelReason ? `Lý do: ${d.cancelReason}\n\n` : '\n') +
      `Nếu có thắc mắc, hãy liên hệ hỗ trợ.`,
    quickReplies: ['đơn hàng', 'menu', 'giúp đỡ'],
  },

  CREDIT_REMINDER: {
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
    getText: (d) =>
      `🔒 Tín dụng đã bị khóa!\n\n` +
      `💰 Còn nợ: ${formatVND(d.creditBalance ?? 0)}\n` +
      `Quá hạn thanh toán — tài khoản tín dụng bị tạm khóa.\n\n` +
      `Gõ "trả nợ" để thanh toán và mở khóa ngay.`,
    quickReplies: ['trả nợ', 'tín dụng'],
  },
};

// ============================================
// SEND NOTIFICATION
// ============================================

/**
 * Send a notification to a shop owner via Zalo.
 * Uses the async message queue — non-blocking.
 */
export function sendNotification(
  zaloUserId: string,
  eventType: NotificationEventType,
  data: NotificationData
): { enqueued: boolean; messageId?: string } {
  const template = NOTIFICATION_TEMPLATES[eventType];
  if (!template) {
    console.error(`[NOTIFICATION] Unknown event type: ${eventType}`);
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
      orderNumber: data.orderNumber,
    },
    priority: 3, // Notifications are higher priority than general events but lower than messages
    maxAttempts: 2,
    dedupKey: `notif-${eventType}-${data.orderNumber}-${Date.now()}`,
  });

  if (result.enqueued) {
    console.log(`[NOTIFICATION] Queued ${eventType} for ${zaloUserId} (order: ${data.orderNumber})`);
  }

  return { enqueued: result.enqueued, messageId: result.messageId };
}

// ============================================
// ORDER STATUS CHANGE HOOK
// ============================================

/**
 * Hook to call after order status changes.
 * Determines the notification type from the new status and sends it.
 * Call this from the order status API after successful status update.
 */
export async function notifyOrderStatusChange(
  orderId: string,
  newStatus: string
): Promise<void> {
  try {
    // Fetch order with shop owner's Zalo ID
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        shop: {
          select: {
            name: true,
            user: { select: { zaloId: true } },
          },
        },
        items: { select: { id: true } },
      },
    });

    if (!order?.shop?.user?.zaloId) {
      // No Zalo ID linked — can't send notification
      return;
    }

    const zaloUserId = order.shop.user.zaloId;
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
    if (!eventType) {
      // PENDING and REFUNDED don't trigger notifications
      return;
    }

    sendNotification(zaloUserId, eventType, {
      orderNumber: order.orderNumber,
      status: newStatus,
      itemCount: order.items.length,
      totalAmount: order.totalAmount,
      paymentMethod: order.paymentMethod,
      shopName,
    });
  } catch (error) {
    // Notifications should never fail the main operation
    console.error('[NOTIFICATION] Error sending order status notification:', error);
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
            name: true,
            user: { select: { zaloId: true } },
          },
        },
        items: { select: { id: true } },
      },
    });

    if (!order?.shop?.user?.zaloId) return;

    sendNotification(order.shop.user.zaloId, 'ORDER_CANCELLED', {
      orderNumber: order.orderNumber,
      status: 'CANCELLED',
      itemCount: order.items.length,
      totalAmount: order.totalAmount,
      cancelReason,
      shopName: order.shop.name,
    });
  } catch (error) {
    console.error('[NOTIFICATION] Error sending cancellation notification:', error);
  }
}

// ============================================
// CREDIT NOTIFICATIONS
// ============================================

/**
 * Send credit payment reminder to a shop.
 */
export async function sendCreditReminder(shopId: string): Promise<void> {
  try {
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      include: { user: { select: { zaloId: true } } },
    });

    if (!shop?.user?.zaloId || shop.creditBalance <= 0) return;

    // Calculate due date (7 days from last credit use)
    const lastCreditTx = await db.transaction.findFirst({
      where: {
        shopId,
        type: 'CREDIT_USED',
      },
      orderBy: { createdAt: 'desc' },
    });

    let dueDate = '7 ngày';
    if (lastCreditTx) {
      const due = new Date(lastCreditTx.createdAt);
      due.setDate(due.getDate() + 7);
      const now = new Date();
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0) {
        dueDate = `${daysLeft} ngày nữa`;
      } else if (daysLeft === 0) {
        dueDate = 'Hôm nay!';
      } else {
        dueDate = `Quá hạn ${Math.abs(daysLeft)} ngày`;
      }
    }

    sendNotification(shop.user.zaloId, 'CREDIT_REMINDER', {
      orderNumber: '',
      status: '',
      creditBalance: shop.creditBalance,
      creditLimit: shop.creditLimit,
      creditDueDate: dueDate,
      shopName: shop.name,
    });
  } catch (error) {
    console.error('[NOTIFICATION] Error sending credit reminder:', error);
  }
}

/**
 * Send credit lock notification to a shop.
 */
export async function sendCreditLockedNotification(shopId: string): Promise<void> {
  try {
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      include: { user: { select: { zaloId: true } } },
    });

    if (!shop?.user?.zaloId) return;

    sendNotification(shop.user.zaloId, 'CREDIT_LOCKED', {
      orderNumber: '',
      status: '',
      creditBalance: shop.creditBalance,
      creditLimit: shop.creditLimit,
      shopName: shop.name,
    });
  } catch (error) {
    console.error('[NOTIFICATION] Error sending credit locked notification:', error);
  }
}

// ============================================
// HELPERS
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'd';
}
