'use client';

import { Badge } from '@/components/ui/badge';

// ============================================
// Broker Tier Badge
// ============================================

const TIER_COLORS: Record<string, string> = {
  WARD_LEVEL: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  CATEGORY_SPECIALIST: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
  FACTORY_GATE: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
};

const TIER_LABELS_VI: Record<string, string> = {
  WARD_LEVEL: 'Cap Phuong',
  CATEGORY_SPECIALIST: 'Chuyen gia Danh muc',
  FACTORY_GATE: 'Cong Nhap',
};

const TIER_LABELS_EN: Record<string, string> = {
  WARD_LEVEL: 'Ward Level',
  CATEGORY_SPECIALIST: 'Category Specialist',
  FACTORY_GATE: 'Factory Gate',
};

export function BrokerTierBadge({
  tier,
  locale = 'vi',
  size = 'sm',
}: {
  tier: string;
  locale?: string;
  size?: 'sm' | 'md';
}) {
  const label = locale === 'vi' ? (TIER_LABELS_VI[tier] || tier) : (TIER_LABELS_EN[tier] || tier);
  const colorClass = TIER_COLORS[tier] || '';

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
// User Status Badge (reused for broker)
// ============================================

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  INACTIVE: 'bg-gray-200 text-gray-700 hover:bg-gray-200',
  LOCKED: 'bg-red-100 text-red-700 hover:bg-red-100',
  SUSPENDED: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
};

const STATUS_LABELS_VI: Record<string, string> = {
  ACTIVE: 'Hoat dong',
  INACTIVE: 'Ngung',
  LOCKED: 'Bi khoa',
  SUSPENDED: 'Tam dinh chi',
};

const STATUS_LABELS_EN: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  LOCKED: 'Locked',
  SUSPENDED: 'Suspended',
};

export function UserStatusBadge({
  status,
  locale = 'vi',
}: {
  status: string;
  locale?: string;
}) {
  const label = locale === 'vi' ? (STATUS_LABELS_VI[status] || status) : (STATUS_LABELS_EN[status] || status);
  const colorClass = STATUS_COLORS[status] || '';

  return (
    <Badge
      variant="secondary"
      className={`text-[10px] font-medium px-2 py-0.5 ${colorClass}`}
    >
      {label}
    </Badge>
  );
}
