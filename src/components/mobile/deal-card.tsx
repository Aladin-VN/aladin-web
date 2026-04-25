'use client';

import { useAppStore } from '@/stores/app.store';
import { Package, Users, Clock, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Deal Card — Group deal card for list view
// ============================================

export interface DealCardData {
  id: string;
  title: string;
  titleEn?: string | null;
  status: string;
  product: { id: string; name: string; sku: string; basePrice: number };
  originalPriceFormatted: string;
  discountPriceFormatted: string;
  savingsPercent: number;
  progressPercent: number;
  currentQty: number;
  targetQty: number;
  participantCount: number;
  timeRemaining: string;
  expiresAt: string;
  ward?: { name: string } | null;
}

interface DealCardProps {
  deal: DealCardData;
  onClick?: (id: string) => void;
}

function DealStatusBadge({ status, locale }: { status: string; locale: string }) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const config: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: t('Hoạt động', 'Active'), cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    COMPLETED: { label: t('Hoàn thành', 'Completed'), cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    EXPIRED: { label: t('Hết hạn', 'Expired'), cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    CANCELLED: { label: t('Đã hủy', 'Cancelled'), cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  };
  const c = config[status] || { label: status, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium', c.cls)}>
      {status === 'ACTIVE' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />}
      {c.label}
    </span>
  );
}

export function DealCard({ deal, onClick }: DealCardProps) {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const progressColor = deal.progressPercent >= 100
    ? 'bg-emerald-500'
    : deal.progressPercent >= 50
      ? 'bg-blue-500'
      : 'bg-amber-500';

  return (
    <button
      onClick={() => onClick?.(deal.id)}
      className="w-full text-left bg-card rounded-xl border border-border/60 p-4 active:scale-[0.98] transition-transform"
    >
      {/* Header: Status + Time */}
      <div className="flex items-center justify-between mb-2.5">
        <DealStatusBadge status={deal.status} locale={locale} />
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {deal.timeRemaining}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-foreground line-clamp-2 mb-1">
        {locale === 'en' && deal.titleEn ? deal.titleEn : deal.title}
      </h3>

      {/* Product info */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <Package className="h-3 w-3 shrink-0" />
        <span className="truncate">{deal.product.name}</span>
        <span className="text-border">·</span>
        <span>{deal.product.sku}</span>
      </div>

      {/* Pricing */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
          {deal.discountPriceFormatted}
        </span>
        <span className="text-sm text-muted-foreground line-through">
          {deal.originalPriceFormatted}
        </span>
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-semibold">
          <TrendingDown className="h-2.5 w-2.5" />
          -{deal.savingsPercent}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground">
            {t('Tiến độ', 'Progress')}
          </span>
          <span className="text-xs font-semibold">{deal.progressPercent}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', progressColor)}
            style={{ width: `${Math.min(100, deal.progressPercent)}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {deal.currentQty.toLocaleString()} / {deal.targetQty.toLocaleString()} {t('sản phẩm', 'units')}
        </p>
      </div>

      {/* Footer: Participants + Ward */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {deal.participantCount} {t('cửa hàng', 'shops')}
        </span>
        {deal.ward && (
          <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
            {deal.ward.name}
          </span>
        )}
      </div>
    </button>
  );
}
