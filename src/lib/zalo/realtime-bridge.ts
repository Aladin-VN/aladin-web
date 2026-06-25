// ALADIN Zalo ↔ In-App Real-Time Bridge
// Pushes events from Zalo chatbot interactions into the in-app WebSocket channel
// so shop owners see real-time updates when their Zalo orders are confirmed

import { wsNotifyUser, wsNotifyRole } from '../ws-bridge';
import { db } from '../db';
import { createNotification } from '../notifications';

// ============================================
// ORDER CREATED VIA ZALO
// ============================================

/**
 * Call this after an order is successfully created through the Zalo chatbot.
 * Notifies the in-app system so the shop owner sees the new order immediately.
 */
export async function bridgeZaloOrderCreated(
  userId: string,
  orderId: string,
  orderNumber: string
): Promise<void> {
  // Push via WebSocket for real-time in-app delivery
  wsNotifyUser(userId, {
    type: 'ORDER_UPDATE',
    payload: {
      title: 'Đơn hàng mới từ Zalo',
      message: `Đơn hàng ${orderNumber} đã được tạo qua Zalo`,
      orderId,
      orderNumber,
      source: 'zalo',
    },
  }).catch(() => {});

  // Also create a DB notification (for polling fallback)
  await createNotification(
    userId,
    'ORDER_STATUS',
    'Đơn hàng mới từ Zalo',
    `Đơn hàng ${orderNumber} đã được tạo qua Zalo. Xem chi tiết trong ứng dụng.`,
    { orderId, orderNumber, source: 'zalo' }
  );

  // Notify distributor staff
  try {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { distributorId: true },
    });
    if (order?.distributorId) {
      wsNotifyDistributorStaff(order.distributorId, {
        type: 'ORDER_UPDATE',
        payload: {
          title: 'Đơn hàng Zalo mới',
          message: `Đơn ${orderNumber} từ Zalo`,
          orderId,
          source: 'zalo',
        },
      });
    }
  } catch {}
}

// ============================================
// PAYMENT COMPLETED VIA ZALO
// ============================================

export async function bridgeZaloPaymentCompleted(
  userId: string,
  orderId: string,
  orderNumber: string,
  amount: number,
  method: string
): Promise<void> {
  const formattedAmount = new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  const methodLabel = method === 'ZALOPAY' ? 'ZaloPay' : method === 'MOMO' ? 'MoMo' : method;

  wsNotifyUser(userId, {
    type: 'PAYMENT_RECEIVED',
    payload: {
      title: 'Thanh toán thành công',
      message: `${formattedAmount} qua ${methodLabel} cho đơn ${orderNumber}`,
      orderId,
      amount,
      method,
      source: 'zalo',
    },
  }).catch(() => {});

  await createNotification(
    userId,
    'ORDER_STATUS',
    'Thanh toán thành công (Zalo)',
    `${formattedAmount} qua ${methodLabel} cho đơn ${orderNumber}`,
    { orderId, amount, method, source: 'zalo' }
  );
}

// ============================================
// ZALO CREDIT REPAYMENT
// ============================================

export async function bridgeZaloCreditRepayment(
  userId: string,
  amount: number,
  orderId?: string
): Promise<void> {
  const formattedAmount = new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';

  wsNotifyUser(userId, {
    type: 'PAYMENT_RECEIVED',
    payload: {
      title: 'Trả nợ thành công',
      message: `Đã trả ${formattedAmount} qua Zalo`,
      amount,
      source: 'zalo',
    },
  }).catch(() => {});

  await createNotification(
    userId,
    'CREDIT',
    'Trả nợ thành công (Zalo)',
    `Đã ghi nhận thanh toán ${formattedAmount} qua Zalo.`,
    { amount, orderId, source: 'zalo' }
  );
}

// ============================================
// ZALO LINK ACCOUNT
// ============================================

/**
 * Notify the user that their Zalo account has been linked to their ALADIN account.
 */
export async function bridgeZaloAccountLinked(
  userId: string,
  zaloUserId: string
): Promise<void> {
  wsNotifyUser(userId, {
    type: 'NOTIFICATION',
    payload: {
      title: 'Liên kết Zalo thành công',
      message: 'Tài khoản Zalo của bạn đã được liên kết. Bạn sẽ nhận thông báo qua Zalo.',
    },
  }).catch(() => {});
}

// ============================================
// HELPER: Notify all distributor staff
// ============================================

async function wsNotifyDistributorStaff(
  distributorId: string,
  event: { type: string; payload: Record<string, unknown> }
): Promise<void> {
  try {
    // Find all users belonging to this distributor
    const distUsers = await db.distributorUser.findMany({
      where: { distributorId },
      select: { userId: true },
    });

    for (const du of distUsers) {
      wsNotifyUser(du.userId, event).catch(() => {});
    }
  } catch {}
}