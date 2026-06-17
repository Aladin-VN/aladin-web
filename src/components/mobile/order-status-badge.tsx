'use client';

import { cn } from '@/lib/utils';
import type { OrderStatus, PaymentMethod, PaymentStatus } from '@/types';

// ============================================
// Config
// ============================================

const ORDER_STATUS_CONFIG: Record<OrderStatus, { vi: string; en: string; bg: string; text: string; dot: string }> = {
  PENDING:          { vi: 'Chờ xử lý',         en: 'Pending',          bg: 'bg-amber-100 dark:bg-amber-900/30',   text: 'text-amber-700 dark:text-amber-400',   dot: 'bg-amber-500' },
  CONFIRMED:        { vi: 'Đã xác nhận',        en: 'Confirmed',        bg: 'bg-blue-100 dark:bg-blue-900/30',     text: 'text-blue-700 dark:text-blue-400',     dot: 'bg-blue-500' },
  PROCESSING:       { vi: 'Đang xử lý',         en: 'Processing',       bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500' },
  PACKED:           { vi: 'Đóng gói',           en: 'Packed',           bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  OUT_FOR_DELIVERY: { vi: 'Đang giao',          en: 'Out for Delivery', bg: 'bg-cyan-100 dark:bg-cyan-900/30',     text: 'text-cyan-700 dark:text-cyan-400',     dot: 'bg-cyan-500' },
  DELIVERED:        { vi: 'Đã giao',            en: 'Delivered',        bg: 'bg-yellow-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-yellow-500', dot: 'bg-red-500' },
  CANCELLED:        { vi: 'Đã hủy',             en: 'Cancelled',        bg: 'bg-red-100 dark:bg-red-900/30',       text: 'text-red-700 dark:text-red-400',       dot: 'bg-red-500' },
  REFUNDED:         { vi: 'Đã hoàn',            en: 'Refunded',         bg: 'bg-gray-100 dark:bg-gray-800',        text: 'text-gray-600 dark:text-gray-400',     dot: 'bg-gray-500' },
};

const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { vi: string; en: string; bg: string; text: string }> = {
  PENDING:           { vi: 'Chờ thanh toán', en: 'Pending',       bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  PAID:              { vi: 'Đã thanh toán', en: 'Paid',          bg: 'bg-yellow-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-yellow-500' },
  FAILED:            { vi: 'Thất bại',     en: 'Failed',        bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  REFUNDED:          { vi: 'Đã hoàn',      en: 'Refunded',      bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
  PARTIALLY_REFUNDED:{ vi: 'Hoàn 1 phần',  en: 'Partial',       bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { vi: string; en: string }> = {
  CREDIT: { vi: 'Công nợ',     en: 'Credit' },
  DIGITAL: { vi: 'Thanh toán số', en: 'Digital' },
  COD: { vi: 'COD',           en: 'COD' },
};

// ============================================
// Components
// ============================================

interface StatusBadgeProps {
  status: OrderStatus | PaymentStatus | string;
  type: 'order' | 'payment';
  locale: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, type, locale, size = 'sm' }: StatusBadgeProps) {
  const isEn = locale === 'en';

  if (type === 'payment') {
    const config = PAYMENT_STATUS_CONFIG[status as PaymentStatus];
    if (!config) return null;
    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium', config.bg, config.text, size === 'sm' ? 'text-[10px]' : 'text-xs')}>
        {isEn ? config.en : config.vi}
      </span>
    );
  }

  const config = ORDER_STATUS_CONFIG[status as OrderStatus];
  if (!config) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium', config.bg, config.text, size === 'sm' ? 'text-[10px]' : 'text-xs')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {isEn ? config.en : config.vi}
    </span>
  );
}

export function PaymentMethodLabel({ method, locale }: { method: PaymentMethod; locale: string }) {
  const label = PAYMENT_METHOD_LABELS[method];
  if (!label) return method;
  return locale === 'en' ? label.en : label.vi;
}

export function getPaymentMethodLabel(method: string, locale: string): string {
  const label = PAYMENT_METHOD_LABELS[method as PaymentMethod];
  return label ? (locale === 'en' ? label.en : label.vi) : method;
}

export { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG, PAYMENT_METHOD_LABELS };
