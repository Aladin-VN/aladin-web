'use client';

import { Badge } from '@/components/ui/badge';

// ============================================
// Loyalty Tier Badge
// ============================================

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'bg-orange-100 text-orange-700 hover:bg-orange-100',
  SILVER: 'bg-gray-200 text-gray-700 hover:bg-gray-200',
  GOLD: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
  PLATINUM: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
};

const TIER_LABELS_EN: Record<string, string> = {
  BRONZE: 'Bronze',
  SILVER: 'Silver',
  GOLD: 'Gold',
  PLATINUM: 'Platinum',
};

const TIER_LABELS_VI: Record<string, string> = {
  BRONZE: 'Dong',
  SILVER: 'Bac',
  GOLD: 'Vang',
  PLATINUM: 'Bach Kim',
};

export function LoyaltyTierBadge({
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
      {tier === 'PLATINUM' && <span className="mr-0.5">&#9670;</span>}
      {tier === 'GOLD' && <span className="mr-0.5">&#9733;</span>}
      {label}
    </Badge>
  );
}

// ============================================
// Credit Status Badge
// ============================================

const CREDIT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100',
  LOCKED: 'bg-red-100 text-red-700 hover:bg-red-100',
  OVERDUE: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
};

const CREDIT_STATUS_LABELS_VI: Record<string, string> = {
  ACTIVE: 'Hoat dong',
  LOCKED: 'Bi khoa',
  OVERDUE: 'Qua han',
};

const CREDIT_STATUS_LABELS_EN: Record<string, string> = {
  ACTIVE: 'Active',
  LOCKED: 'Locked',
  OVERDUE: 'Overdue',
};

export function CreditStatusBadge({
  status,
  locale = 'vi',
}: {
  status: string;
  locale?: string;
}) {
  const label = locale === 'vi' ? (CREDIT_STATUS_LABELS_VI[status] || status) : (CREDIT_STATUS_LABELS_EN[status] || status);
  const colorClass = CREDIT_STATUS_COLORS[status] || '';

  return (
    <Badge
      variant="secondary"
      className={`text-[10px] font-medium px-2 py-0.5 ${colorClass}`}
    >
      {status === 'OVERDUE' && <span className="mr-0.5">&#9888;</span>}
      {status === 'LOCKED' && <span className="mr-0.5">&#128274;</span>}
      {label}
    </Badge>
  );
}

// ============================================
// Shop Type Badge
// ============================================

const SHOP_TYPE_LABELS_VI: Record<string, string> = {
  TAPHOA: 'Tap hoa',
  CONVENIENCE: 'Tien loi',
  FACTORY: 'Cong nghiep',
};

const SHOP_TYPE_LABELS_EN: Record<string, string> = {
  TAPHOA: 'Mom-and-pop',
  CONVENIENCE: 'Convenience',
  FACTORY: 'Factory',
};

export function ShopTypeBadge({
  type,
  locale = 'vi',
}: {
  type: string;
  locale?: string;
}) {
  const label = locale === 'vi' ? (SHOP_TYPE_LABELS_VI[type] || type) : (SHOP_TYPE_LABELS_EN[type] || type);

  return (
    <Badge variant="outline" className="text-[10px] font-medium px-2 py-0.5">
      {label}
    </Badge>
  );
}

// ============================================
// Order Status Badge (re-export for convenience)
// ============================================

export { OrderStatusBadge, PaymentMethodBadge, PaymentStatusBadge } from '@/components/orders/order-status-badge';
