'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import {
  Factory, Calendar, ShoppingCart, Package, Tag, CheckCircle,
  Clock, AlertTriangle, XCircle, Percent, Gift,
} from 'lucide-react';

// ============================================
// Promotion Detail Page — /m/promotions/[id]
// ============================================

interface PromoDetail {
  id: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  promoType: string;
  buyQty?: number | null;
  getQty?: number | null;
  discountPercent?: number | null;
  discountAmount?: number | null;
  startsAt: string;
  expiresAt: string;
  totalBudget: number | null;
  usedBudget: number;
  totalRedemptions: number;
  isActive: boolean;
  computedStatus: string;
  budgetPercent: number;
  budgetRemainingFormatted: string;
  usedBudgetFormatted: string;
  totalBudgetFormatted: string | null;
  manufacturer: {
    id: string;
    name: string;
    province?: string | null;
    commissionRate: number;
  };
  items: Array<{
    product: {
      id: string;
      name: string;
      sku: string;
      basePrice: number;
      imageUrl?: string | null;
      isActive: boolean;
    };
  }>;
  orderItems: Array<{
    id: string;
    productName: string;
    quantity: number;
    freeQty: number;
    totalPrice: number;
    order: {
      id: string;
      orderNumber: string;
      status: string;
      shop: { name: string; district: string | null };
    };
  }>;
}

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function PromoTypeLabel({ promo, locale }: { promo: PromoDetail; locale: string }) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const { promoType, buyQty, getQty, discountPercent, discountAmount } = promo;
  switch (promoType) {
    case 'BUY_X_GET_Y':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 text-xs font-semibold">
          <Gift className="h-4 w-4" />
          {buyQty && getQty
            ? (locale === 'vi' ? `Mua ${buyQty} Tặng ${getQty}` : `Buy ${buyQty} Get ${getQty}`)
            : t('Mua X Tặng Y', 'Buy X Get Y')
          }
        </span>
      );
    case 'PERCENT_OFF':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 text-xs font-semibold">
          <Percent className="h-4 w-4" />
          {discountPercent ? `-${discountPercent}%` : t('Giảm theo %', 'Percent Off')}
        </span>
      );
    case 'FIXED_DISCOUNT':
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-700 text-xs font-semibold">
          <Tag className="h-4 w-4" />
          {discountAmount ? formatVND(discountAmount) : t('Giảm cố định', 'Fixed Discount')}
        </span>
      );
    default:
      return null;
  }
}

function PromoStatusBadge({ status, locale }: { status: string; locale: string }) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const config: Record<string, { icon: typeof CheckCircle; cls: string; label: string }> = {
    active: { icon: CheckCircle, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: t('Hoạt động', 'Active') },
    upcoming: { icon: Clock, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: t('Sắp diễn ra', 'Upcoming') },
    expired: { icon: AlertTriangle, cls: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400', label: t('Hết hạn', 'Expired') },
  };
  const c = config[status] || { icon: XCircle, cls: 'bg-gray-100 text-gray-700', label: status };
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${c.cls}`}>
      <Icon className="h-3 w-3" />{c.label}
    </span>
  );
}

export default function MobilePromotionDetailPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const params = useParams();
  const router = useRouter();
  const promoId = params.id as string;

  const [promo, setPromo] = useState<PromoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders'>('overview');

  useEffect(() => {
    if (!promoId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(`/promotions/${promoId}`);
        if (!cancelled && res.success && res.data) setPromo(res.data as PromoDetail);
      } catch {
        if (!cancelled) setError(t('Không thể tải khuyến mãi', 'Failed to load promotion'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [promoId, t]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Chi tiết KM', 'Promotion Detail')} showBack />
        <div className="px-4 pt-4 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse h-24 rounded-xl border bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !promo) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Chi tiết KM', 'Promotion Detail')} showBack />
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">{error || t('Không tìm thấy khuyến mãi', 'Promotion not found')}</p>
          <button onClick={() => router.back()} className="mt-4 px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground">
            {t('Quay lại', 'Go Back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Chi tiết KM', 'Promotion Detail')} showBack />

      <main className="px-4 pb-4 pt-3 space-y-4">
        {/* Title + badges */}
        <div>
          <div className="flex flex-wrap gap-2 mb-2">
            <PromoStatusBadge status={promo.computedStatus} locale={locale} />
            <PromoTypeLabel promo={promo} locale={locale} />
          </div>
          <h1 className="text-lg font-bold text-foreground mb-1">
            {locale === 'en' && promo.titleEn ? promo.titleEn : promo.title}
          </h1>
          {promo.description && (
            <p className="text-sm text-muted-foreground">{promo.description}</p>
          )}
        </div>

        {/* Manufacturer */}
        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
              <Factory className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{promo.manufacturer.name}</p>
              <p className="text-xs text-muted-foreground">
                {t('Hoa hồng', 'Commission')}: {(promo.manufacturer.commissionRate * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border p-3">
            <p className="text-[10px] text-muted-foreground">{t('Đã áp dụng', 'Redemptions')}</p>
            <p className="text-xl font-bold mt-0.5">{promo.totalRedemptions}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-[10px] text-muted-foreground">{t('Ngân sách đã dùng', 'Budget Used')}</p>
            <p className="text-sm font-bold mt-1">{promo.usedBudgetFormatted}</p>
            {promo.totalBudget && (
              <div className="mt-1.5">
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${promo.budgetPercent > 80 ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, promo.budgetPercent)}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{promo.budgetPercent}%</p>
              </div>
            )}
          </div>
        </div>

        {/* Validity */}
        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Calendar className="h-3.5 w-3.5" />
            {t('Thời gian hiệu lực', 'Validity Period')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground">{t('Từ', 'From')}</p>
              <p className="text-sm font-medium">
                {new Date(promo.startsAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">{t('Đến', 'To')}</p>
              <p className="text-sm font-medium">
                {new Date(promo.expiresAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {(['overview', 'products', 'orders'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'overview' && t('Tổng quan', 'Overview')}
              {tab === 'products' && t('Sản phẩm', 'Products')}
              {tab === 'orders' && t('Đơn hàng', 'Orders')}
            </button>
          ))}
        </div>

        {/* Products tab */}
        {activeTab === 'products' && (
          <div className="space-y-2">
            {promo.items.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">{t('Chưa có sản phẩm', 'No products linked')}</p>
              </div>
            ) : (
              promo.items.map((item) => (
                <div key={item.product.id} className="flex items-center gap-3 p-3 rounded-xl border">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-[10px] text-muted-foreground">{item.product.sku} · {formatVND(item.product.basePrice)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Orders tab */}
        {activeTab === 'orders' && (
          <div className="space-y-2">
            {promo.orderItems.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">{t('Chưa có đơn hàng', 'No orders yet')}</p>
              </div>
            ) : (
              promo.orderItems.map((oi) => (
                <div key={oi.id} className="flex items-center gap-3 p-3 rounded-xl border">
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                    <ShoppingCart className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{oi.order.orderNumber}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {oi.order.shop.name}{oi.order.shop.district ? ` · ${oi.order.shop.district}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatVND(oi.totalPrice)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      x{oi.quantity}{oi.freeQty > 0 ? ` (+${oi.freeQty})` : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Overview (budget remaining) */}
        {activeTab === 'overview' && promo.totalBudgetFormatted && (
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground mb-1">{t('Ngân sách còn lại', 'Budget Remaining')}</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {promo.budgetRemainingFormatted}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {t('trong tổng', 'of total')}: {promo.totalBudgetFormatted}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
