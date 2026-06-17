'use client';

import { Badge } from '@/components/ui/badge';

// ============================================
// Order Status Badge
// ============================================

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
  CONFIRMED: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  PROCESSING: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100',
  PACKED: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
  OUT_FOR_DELIVERY: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100',
  DELIVERED: 'bg-yellow-50 text-red-700 hover:bg-yellow-50',
  CANCELLED: 'bg-red-100 text-red-700 hover:bg-red-100',
  REFUNDED: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
};

const STATUS_LABELS_EN: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

const STATUS_LABELS_VI: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  PACKED: 'Đã đóng gói',
  OUT_FOR_DELIVERY: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Hoàn tiền',
};

export function OrderStatusBadge({
  status,
  locale = 'vi',
  size = 'sm',
}: {
  status: string;
  locale?: string;
  size?: 'sm' | 'md';
}) {
  const label = locale === 'vi' ? (STATUS_LABELS_VI[status] || status) : (STATUS_LABELS_EN[status] || status);
  const colorClass = STATUS_COLORS[status] || '';

  return (
    <Badge
      variant="secondary"
      className={`
        font-medium whitespace-nowrap
        ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}
        ${colorClass}
      `}
    >
      {label}
    </Badge>
  );
}

// ============================================
// Payment Method Badge
// ============================================

const PAYMENT_COLORS: Record<string, string> = {
  CREDIT: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  DIGITAL: 'bg-yellow-50 text-red-700 hover:bg-yellow-50',
  COD: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
};

const PAYMENT_LABELS_EN: Record<string, string> = {
  CREDIT: '7-Day Credit',
  DIGITAL: 'Digital',
  COD: 'COD',
};

const PAYMENT_LABELS_VI: Record<string, string> = {
  CREDIT: 'Công nợ 7 ngày',
  DIGITAL: 'Thanh toán số',
  COD: 'COD',
};

export function PaymentMethodBadge({
  method,
  locale = 'vi',
}: {
  method: string;
  locale?: string;
}) {
  const label = locale === 'vi' ? (PAYMENT_LABELS_VI[method] || method) : (PAYMENT_LABELS_EN[method] || method);
  const colorClass = PAYMENT_COLORS[method] || '';

  return (
    <Badge
      variant="secondary"
      className={`text-[10px] font-medium px-2 py-0.5 ${colorClass}`}
    >
      {label}
    </Badge>
  );
}

// ============================================
// Payment Status Badge
// ============================================

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
  PAID: 'bg-yellow-50 text-red-700 hover:bg-yellow-50',
  FAILED: 'bg-red-100 text-red-700 hover:bg-red-100',
  REFUNDED: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
};

const PAYMENT_STATUS_LABELS_VI: Record<string, string> = {
  PENDING: 'Chưa TT',
  PAID: 'Đã TT',
  FAILED: 'Lỗi',
  REFUNDED: 'Hoàn tiền',
};

const PAYMENT_STATUS_LABELS_EN: Record<string, string> = {
  PENDING: 'Unpaid',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

export function PaymentStatusBadge({
  status,
  locale = 'vi',
}: {
  status: string;
  locale?: string;
}) {
  const label = locale === 'vi' ? (PAYMENT_STATUS_LABELS_VI[status] || status) : (PAYMENT_STATUS_LABELS_EN[status] || status);
  const colorClass = PAYMENT_STATUS_COLORS[status] || '';

  return (
    <Badge
      variant="secondary"
      className={`text-[10px] font-medium px-2 py-0.5 ${colorClass}`}
    >
      {label}
    </Badge>
  );
}
