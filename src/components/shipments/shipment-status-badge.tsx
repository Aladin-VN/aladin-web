'use client';

import { Badge } from '@/components/ui/badge';

// ============================================
// Shipment Status Badge
// ============================================

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
  PICKED_UP: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  IN_TRANSIT: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100',
  DELIVERED: 'bg-yellow-50 text-red-700 hover:bg-yellow-50',
  FAILED: 'bg-red-100 text-red-700 hover:bg-red-100',
};

const STATUS_LABELS_EN: Record<string, string> = {
  PENDING: 'Pending',
  PICKED_UP: 'Picked Up',
  IN_TRANSIT: 'In Transit',
  DELIVERED: 'Delivered',
  FAILED: 'Failed',
};

const STATUS_LABELS_VI: Record<string, string> = {
  PENDING: 'Chờ lấy hàng',
  PICKED_UP: 'Đã lấy hàng',
  IN_TRANSIT: 'Đang vận chuyển',
  DELIVERED: 'Đã giao',
  FAILED: 'Giao thất bại',
};

const STATUS_ICONS: Record<string, string> = {
  PENDING: '⏳',
  PICKED_UP: '📦',
  IN_TRANSIT: '🚛',
  DELIVERED: '✅',
  FAILED: '❌',
};

export function ShipmentStatusBadge({
  status,
  locale = 'vi',
  size = 'sm',
  showIcon = false,
}: {
  status: string;
  locale?: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
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
      {showIcon && STATUS_ICONS[status] && (
        <span className="mr-1">{STATUS_ICONS[status]}</span>
      )}
      {label}
    </Badge>
  );
}

// ============================================
// Shipment Type Badge
// ============================================

const TYPE_COLORS: Record<string, string> = {
  INTERNAL: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  THIRD_PARTY: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
};

const TYPE_LABELS_EN: Record<string, string> = {
  INTERNAL: 'Internal',
  THIRD_PARTY: '3rd Party',
};

const TYPE_LABELS_VI: Record<string, string> = {
  INTERNAL: 'Nội bộ',
  THIRD_PARTY: 'Bên thứ 3',
};

export function ShipmentTypeBadge({
  type,
  locale = 'vi',
}: {
  type: string;
  locale?: string;
}) {
  const label = locale === 'vi' ? (TYPE_LABELS_VI[type] || type) : (TYPE_LABELS_EN[type] || type);
  const colorClass = TYPE_COLORS[type] || '';

  return (
    <Badge
      variant="secondary"
      className={`text-[10px] font-medium px-2 py-0.5 ${colorClass}`}
    >
      {label}
    </Badge>
  );
}
