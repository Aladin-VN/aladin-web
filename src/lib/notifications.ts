// Notification creation utility — with WebSocket real-time broadcast, push, and Zalo bridge
import { db } from '@/lib/db';
import { wsNotifyUser, wsNotifyDistributor, wsNotifyRole } from './ws-bridge';
import { pushNotificationEvent } from './push-sender';
import { bridgeInAppToZalo } from './zalo/notification-engine';

// ============================================
// CORE: Create notification + broadcast via WS + Push + Zalo
// ============================================

/**
 * Create an in-app notification and fan out to all channels.
 * Channels: DB persistence → WS real-time → Web Push → Zalo bridge
 *
 * All channels are fire-and-forget. Failure in any channel never breaks the main flow.
 */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
) {
  try {
    const notification = await db.notification.create({
      data: { userId, type, title, message, data: data as any },
    });

    // Channel 1: WebSocket for real-time in-app delivery
    wsNotifyUser(userId, {
      type: 'NOTIFICATION',
      payload: {
        notificationId: notification.id,
        type,
        title,
        message,
        data,
      },
    }).catch(() => {});

    // Channel 2: Web Push (for background/closed tabs)
    pushNotificationEvent(userId, type, title, message, {
      ...data,
      notificationId: notification.id,
    }).catch(() => {});

    // Channel 3: Zalo bridge (if user has Zalo linked + preferences enabled)
    bridgeInAppToZalo(userId, type, title, message, data).catch(() => {});

    return notification;
  } catch (error) {
    console.error('[NOTIFICATION CREATE ERROR]', error);
    // Never throw — notification failure must not break main flow
    return null;
  }
}

// ============================================
// ORDER STATUS NOTIFICATIONS
// ============================================

export async function notifyOrderStatus(orderId: string, newStatus: string, shopUserId: string, distUserId?: string) {
  const statusLabels: Record<string, string> = {
    CONFIRMED: 'Đơn hàng đã xác nhận',
    PROCESSING: 'Đơn hàng đang xử lý',
    PACKED: 'Đơn hàng đã đóng gói',
    OUT_FOR_DELIVERY: 'Đơn hàng đang giao',
    DELIVERED: 'Đơn hàng đã giao thành công',
    CANCELLED: 'Đơn hàng đã hủy',
  };
  const title = 'Cập nhật đơn hàng';
  const message = statusLabels[newStatus] || `Trạng thái: ${newStatus}`;

  const tasks = [
    createNotification(shopUserId, 'ORDER_STATUS', title, message, { orderId, status: newStatus }),
  ];
  if (distUserId) {
    tasks.push(createNotification(distUserId, 'ORDER_STATUS', title, message, { orderId, status: newStatus }));
  }

  // Also broadcast order update event (separate from notification for driver/dashboard listeners)
  const wsEvent = {
    type: 'ORDER_UPDATE',
    payload: { orderId, status: newStatus, title, message },
  };
  wsNotifyUser(shopUserId, wsEvent).catch(() => {});
  if (distUserId) wsNotifyUser(distUserId, wsEvent).catch(() => {});

  // Notify all drivers about new deliveries
  if (newStatus === 'OUT_FOR_DELIVERY' || newStatus === 'PACKED') {
    wsNotifyRole('DRIVER', {
      type: 'DELIVERY_UPDATE',
      payload: { orderId, status: newStatus },
    }).catch(() => {});
  }

  // Notify all sales reps about order status changes
  wsNotifyRole('SALES_REP', {
    type: 'ORDER_UPDATE',
    payload: { orderId, status: newStatus },
  }).catch(() => {});

  await Promise.all(tasks);
}

// ============================================
// INVENTORY ALERTS
// ============================================

export async function notifyLowStock(userId: string, productNames: string[]) {
  const notification = await createNotification(
    userId,
    'INVENTORY',
    'Cảnh báo tồn kho',
    `${productNames.length} sản phẩm dưới mức tối thiểu: ${productNames.join(', ')}`,
    { productNames }
  );

  if (notification) {
    wsNotifyUser(userId, {
      type: 'INVENTORY_ALERT',
      payload: { productNames, count: productNames.length },
    }).catch(() => {});
  }
}

// ============================================
// CREDIT REMINDERS
// ============================================

export async function notifyCreditReminder(shopId: string, userId: string) {
  const notification = await createNotification(
    userId,
    'CREDIT',
    'Nhắc nhở công nợ',
    'Cửa hàng của bạn có khoản công nợ quá hạn. Vui lòng thanh toán để tránh bị khóa tín dụng.',
    { shopId }
  );

  if (notification) {
    wsNotifyUser(userId, {
      type: 'CREDIT_REMINDER',
      payload: { shopId },
    }).catch(() => {});
  }
}

// ============================================
// SETTLEMENT NOTIFICATIONS
// ============================================

export async function notifySettlement(userId: string, settlementId: string, amount: number) {
  const formattedAmount = new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  const notification = await createNotification(
    userId,
    'SETTLEMENT',
    'Kỳ quyết toán mới',
    `Kỳ đối soát đã được tạo. Số tiền: ${formattedAmount}`,
    { settlementId, amount }
  );

  if (notification) {
    wsNotifyUser(userId, {
      type: 'SETTLEMENT_UPDATE',
      payload: { settlementId, amount },
    }).catch(() => {});
  }
}

// ============================================
// SHIPMENT STATUS NOTIFICATIONS
// ============================================

export async function notifyShipmentStatus(shipmentId: string, newStatus: string, shopUserId: string, orderNumber?: string) {
  const statusLabels: Record<string, string> = {
    PICKED_UP: 'Đã lấy hàng từ kho',
    IN_TRANSIT: 'Đang trên đường giao',
    DELIVERED: 'Đã giao thành công',
    FAILED: 'Giao hàng thất bại',
  };
  const title = 'Cập nhật vận chuyển';
  const message = orderNumber
    ? `${orderNumber}: ${statusLabels[newStatus] || newStatus}`
    : (statusLabels[newStatus] || `Trạng thái: ${newStatus}`);

  const notification = await createNotification(shopUserId, 'SHIPMENT', title, message, { shipmentId, status: newStatus });

  if (notification) {
    wsNotifyUser(shopUserId, {
      type: 'SHIPMENT_UPDATE',
      payload: { shipmentId, status: newStatus, orderNumber },
    }).catch(() => {});
  }
}

// ============================================
// DEBT PAYMENT NOTIFICATIONS
// ============================================

export async function notifyDebtPayment(shopUserId: string, amount: number, paymentMethod: string) {
  const methodLabel = paymentMethod === 'CASH' ? 'tiền mặt' : 'chuyển khoản';
  const formattedAmount = new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  const notification = await createNotification(
    shopUserId,
    'CREDIT',
    'Thu hồi công nợ',
    `Đã ghi nhận thanh toán ${formattedAmount} (${methodLabel}). Cảm ơn bạn!`,
    { amount, paymentMethod }
  );

  if (notification) {
    wsNotifyUser(shopUserId, {
      type: 'PAYMENT_RECEIVED',
      payload: { amount, paymentMethod },
    }).catch(() => {});
  }
}

// ============================================
// DRIVER ISSUE NOTIFICATIONS
// ============================================

export async function notifyDriverIssue(shipmentId: string, issueType: string, description: string, adminUserIds: string[]) {
  const typeLabels: Record<string, string> = {
    WRONG_ADDRESS: 'Sai địa chỉ',
    CUSTOMER_ABSENT: 'Khách vắng mặt',
    DAMAGED_GOODS: 'Hàng hóa hỏng',
    SHORTAGE: 'Thiếu hàng',
    OTHER: 'Khác',
  };
  const title = 'Báo cáo giao hàng';
  const message = `${typeLabels[issueType] || issueType}: ${description || 'Không có mô tả'}`;

  const results = await Promise.all(
    adminUserIds.map(adminId =>
      createNotification(adminId, 'DELIVERY_ISSUE', title, message, { shipmentId, issueType })
    )
  );

  // Broadcast to all admins via WS
  wsNotifyRole('ADMIN', {
    type: 'DRIVER_ISSUE',
    payload: { shipmentId, issueType, description, title, message },
  }).catch(() => {});

  // Also notify distributor staff
  wsNotifyRole('DISTRIBUTOR', {
    type: 'DRIVER_ISSUE',
    payload: { shipmentId, issueType, description },
  }).catch(() => {});

  return results;
}

// ============================================
// DRIVER EARNINGS UPDATE
// ============================================

export async function notifyDriverEarning(driverUserId: string, amount: number, tripCount: number) {
  const formattedAmount = new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  await createNotification(
    driverUserId,
    'SETTLEMENT',
    'Cập nhật thu nhập',
    `Hoàn thành ${tripCount} chuyến. Thu nhập hôm nay: ${formattedAmount}`,
    { amount, tripCount }
  );

  wsNotifyUser(driverUserId, {
    type: 'EARNING_UPDATE',
    payload: { amount, tripCount },
  }).catch(() => {});
}

// ============================================
// BROKER COMMISSION UPDATE
// ============================================

export async function notifyBrokerCommission(brokerUserId: string, amount: number, orderId: string) {
  const formattedAmount = new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  await createNotification(
    brokerUserId,
    'SETTLEMENT',
    'Hoa hồng mới',
    `Đơn hàng mới — hoa hồng: ${formattedAmount}`,
    { amount, orderId }
  );

  wsNotifyUser(brokerUserId, {
    type: 'COMMISSION_UPDATE',
    payload: { amount, orderId },
  }).catch(() => {});
}

// ============================================
// PROMOTION NOTIFICATION (broadcast to all shop owners)
// ============================================

export async function broadcastPromotion(title: string, message: string, data?: Record<string, unknown>) {
  // Create DB notifications for all active shop owners (async, non-blocking)
  // Each createNotification also triggers push + Zalo bridge automatically
  db.user.findMany({
    where: { role: 'SHOP_OWNER', status: 'ACTIVE' },
    select: { id: true },
  }).then(users => {
    Promise.all(
      users.map(u => createNotification(u.id, 'PROMOTION', title, message, data))
    ).catch(() => {});
  }).catch(() => {});

  // Real-time broadcast via WS
  wsNotifyRole('SHOP_OWNER', {
    type: 'PROMOTION',
    payload: { title, message, ...data },
  }).catch(() => {});
}
