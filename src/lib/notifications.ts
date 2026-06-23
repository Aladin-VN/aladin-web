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

export async function notifySettlement(userId: string, settlementId: string, amount: number) {
  await createNotification(
    userId,
    'SETTLEMENT',
    'Kỳ quyết toán mới',
    `Kỳ đối soát đã được tạo. Số tiền: ${amount.toLocaleString('vi-VN')} ₫`,
    { settlementId, amount }
  );
}