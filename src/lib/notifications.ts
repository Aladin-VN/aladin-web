// Notification creation utility
import { db } from '@/lib/db';

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
) {
  try {
    await db.notification.create({
      data: { userId, type, title, message, data: data as any },
    });
  } catch (error) {
    console.error('[NOTIFICATION CREATE ERROR]', error);
    // Never throw — notification failure must not break main flow
  }
}

export async function notifyOrderStatus(orderId: string, newStatus: string, shopUserId: string, distUserId?: string) {
  const statusLabels: Record<string, string> = {
    CONFIRMED: 'Đơn hàng đã xác nhận',
    PROCESSING: 'Đơn hàng đang xử lý',
    PACKED: 'Đơn hàng đã đóng gói',
    OUT_FOR_DELIVERY: 'Đơn hàng đang giao',
    DELIVERED: 'Đơn hàng đã giao thành công',
    CANCELLED: 'Đơn hàng đã hủy',
  };
  const title = `Cập nhật đơn hàng`;
  const message = statusLabels[newStatus] || `Trạng thái: ${newStatus}`;

  const tasks = [createNotification(shopUserId, 'ORDER_STATUS', title, message, { orderId, status: newStatus })];
  if (distUserId) {
    tasks.push(createNotification(distUserId, 'ORDER_STATUS', title, message, { orderId, status: newStatus }));
  }
  await Promise.all(tasks);
}

export async function notifyLowStock(userId: string, productNames: string[]) {
  await createNotification(
    userId,
    'INVENTORY',
    'Cảnh báo tồn kho',
    `${productNames.length} sản phẩm dưới mức tối thiểu: ${productNames.join(', ')}`,
    { productNames }
  );
}

export async function notifyCreditReminder(shopId: string, userId: string) {
  await createNotification(
    userId,
    'CREDIT',
    'Nhắc nhở công nợ',
    'Cửa hàng của bạn có khoản công nợ quá hạn. Vui lòng thanh toán để tránh bị khóa tín dụng.',
    { shopId }
  );
}

export async function notifySettlement(userId: string, settlementId: string, amount: number) {
  await createNotification(
    userId,
    'SETTLEMENT',
    'Kỳ quyết toán mới',
    `Kỳ đối soát đã được tạo. Số tiền: ${amount.toLocaleString('vi-VN')} ₫`,
    { settlementId, amount }
  );
}

export async function notifyShipmentStatus(shipmentId: string, newStatus: string, shopUserId: string, orderNumber?: string) {
  const statusLabels: Record<string, string> = {
    PICKED_UP: 'Đã lấy hàng từ kho',
    IN_TRANSIT: 'Đang trên đường giao',
    DELIVERED: 'Đã giao thành công',
    FAILED: 'Giao hàng thất bại',
  };
  const title = `Cập nhật vận chuyển`;
  const message = orderNumber
    ? `${orderNumber}: ${statusLabels[newStatus] || newStatus}`
    : (statusLabels[newStatus] || `Trạng thái: ${newStatus}`);

  await createNotification(shopUserId, 'SHIPMENT', title, message, { shipmentId, status: newStatus });
}

export async function notifyDebtPayment(shopUserId: string, amount: number, paymentMethod: string) {
  const methodLabel = paymentMethod === 'CASH' ? 'tiền mặt' : 'chuyển khoản';
  await createNotification(
    shopUserId,
    'CREDIT',
    'Thu hồi công nợ',
    `Đã ghi nhận thanh toán ${amount.toLocaleString('vi-VN')} ₫ (${methodLabel}). Cảm ơn bạn!`,
    { amount, paymentMethod }
  );
}

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
  await Promise.all(
    adminUserIds.map(adminId =>
      createNotification(adminId, 'DELIVERY_ISSUE', title, message, { shipmentId, issueType })
    )
  );
}