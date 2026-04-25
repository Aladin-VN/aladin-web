'use client';

import { useAppStore } from '@/stores/app.store';
import { Factory, Calendar, ShoppingCart, Tag, Percent } from 'lucide-react';

// ============================================
// Promo Card — Promotion card for list view
// ============================================

export interface PromoCardData {
  id: string;
  title: string;
  titleEn?: string | null;
  promoType: string;
  buyQty?: number | null;
  getQty?: number | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  manufacturerName: string;
  computedStatus: string;
  isActive: boolean;
  startsAt: string;
  expiresAt: string;
  totalRedemptions: number;
  budgetPercent?: number;
  productCount?: number;
}

interface PromoCardProps {
  promo: PromoCardData;
  onClick?: (id: string) => void;
}

function PromoTypeLabel({ type, promo, locale }: { type: string; promo: PromoCardData; locale: string }) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  switch (type) {
    case 'BUY_X_GET_Y':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-medium">
          <Tag className="h-2.5 w-2.5" />
          {promo.buyQty && promo.getQty
            ? (locale === 'vi' ? `Mua ${promo.buyQty} Tặng ${promo.getQty}` : `Buy ${promo.buyQty} Get ${promo.getQty}`)
            : t('Mua X Tặng Y', 'Buy X Get Y')}
        </span>
      );
    case 'PERCENT_OFF':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-[10px] font-medium">
          <Percent className="h-2.5 w-2.5" />
          {promo.discountPercent ? `-${promo.discountPercent}%` : t('Giảm theo %', 'Percent Off')}
        </span>
      );
    case 'FIXED_DISCOUNT':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-[10px] font-medium">
          <Tag className="h-2.5 w-2.5" />
          {promo.discountAmount
            ? `-${(promo.discountAmount / 1000).toFixed(0)}K`
            : t('Giảm cố định', 'Fixed Discount')}
        </span>
      );
    default:
      return null;
  }
}

function PromoStatusBadge({ status, isActive, locale }: { status: string; isActive: boolean; locale: string }) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const config: Record<string, { label: string; cls: string }> = {
    active: { label: t('Hoạt động', 'Active'), cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    upcoming: { label: t('Sắp diễn ra', 'Upcoming'), cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    expired: { label: isActive ? t('Tạm dừng', 'Paused') : t('Hết hạn', 'Expired'), cls: isActive ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
  };
  const c = config[status] || { label: status, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${c.cls}`}>
      {c.label}
    </span>
  );
}

function formatRelativeDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (locale === 'vi') {
    if (diffDays < 0) return 'Đã kết thúc';
    if (diffDays === 0) return 'Hôm nay';
    if (diffDays === 1) return 'Ngày mai';
    if (diffDays <= 7) return `${diffDays} ngày nữa`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } else {
    if (diffDays < 0) return 'Ended';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays <= 7) return `In ${diffDays} days`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

export function PromoCard({ promo, onClick }: PromoCardProps) {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  return (
    <button
      onClick={() => onClick?.(promo.id)}
      className="w-full text-left bg-card rounded-xl border border-border/60 p-4 active:scale-[0.98] transition-transform"
    >
      {/* Header: Status + Type */}
      <div className="flex items-center justify-between mb-2.5">
        <PromoStatusBadge status={promo.computedStatus} isActive={promo.isActive} locale={locale} />
        <PromoTypeLabel type={promo.promoType} promo={promo} locale={locale} />
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-foreground line-clamp-2 mb-1.5">
        {locale === 'en' && promo.titleEn ? promo.titleEn : promo.title}
      </h3>

      {/* Manufacturer */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <Factory className="h-3 w-3 shrink-0" />
        <span className="truncate">{promo.manufacturerName}</span>
      </div>

      {/* Budget progress (if has budget) */}
      {promo.budgetPercent !== undefined && promo.budgetPercent > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">
              {t('Ngân sách', 'Budget')}
            </span>
            <span className="text-[10px] font-medium">{promo.budgetPercent}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${promo.budgetPercent > 80 ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(100, promo.budgetPercent)}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer: Products count + Expiry + Redemptions */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-3">
          {promo.productCount !== undefined && promo.productCount > 0 && (
            <span className="flex items-center gap-0.5">
              <ShoppingCart className="h-3 w-3" />
              {promo.productCount} {t('SP', 'products')}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <ShoppingCart className="h-3 w-3" />
            {promo.totalRedemptions} {t('lần', 'uses')}
          </span>
        </div>
        <span className="flex items-center gap-0.5">
          <Calendar className="h-3 w-3" />
          {formatRelativeDate(promo.expiresAt, locale)}
        </span>
      </div>
    </button>
  );
}
