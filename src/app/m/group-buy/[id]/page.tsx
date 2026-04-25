'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import {
  Package, Users, Clock, TrendingDown, MapPin, Calendar,
  ShoppingCart, Store, Loader2, CheckCircle, AlertTriangle, XCircle, Gift,
} from 'lucide-react';

// ============================================
// Group Buy Detail Page — /m/group-buy/[id]
// ============================================

interface DealDetail {
  id: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  status: string;
  productId: string;
  targetQty: number;
  currentQty: number;
  originalPrice: number;
  discountPrice: number;
  maxParticipants: number | null;
  startsAt: string;
  expiresAt: string;
  progressPercent: number;
  savingsPercent: number;
  savingsPerUnitFormatted: string;
  originalPriceFormatted: string;
  discountPriceFormatted: string;
  totalPotentialSavingsFormatted: string;
  timeRemaining: string;
  participantCount: number;
  activeParticipantCount: number;
  product: {
    id: string;
    name: string;
    sku: string;
    basePrice: number;
    imageUrl?: string | null;
    isActive: boolean;
  };
  ward?: { id: string; name: string; district: string } | null;
  participants: Array<{
    id: string;
    committedQty: number;
    isActive: boolean;
    createdAt: string;
    shop: { id: string; name: string; district: string | null; loyaltyTier: string };
  }>;
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: string;
  }>;
}

// ============================================
// Status Badge (defined outside component)
// ============================================

function DealStatusBadge({ status, locale }: { status: string; locale: string }) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const config: Record<string, { icon: typeof CheckCircle; cls: string; label: string }> = {
    ACTIVE: { icon: CheckCircle, cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: t('Hoạt động', 'Active') },
    COMPLETED: { icon: CheckCircle, cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: t('Hoàn thành', 'Completed') },
    EXPIRED: { icon: AlertTriangle, cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: t('Hết hạn', 'Expired') },
    CANCELLED: { icon: XCircle, cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: t('Đã hủy', 'Cancelled') },
  };
  const c = config[status] || { icon: Clock, cls: 'bg-gray-100 text-gray-700', label: status };
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${c.cls}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

export default function MobileGroupBuyDetailPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;

  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'orders'>('overview');

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get(`/group-deals/${dealId}`);
        if (!cancelled && res.success && res.data) setDeal(res.data as DealDetail);
      } catch {
        if (!cancelled) setError(t('Không thể tải thông tin deal', 'Failed to load deal details'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [dealId, t]);

  const progressColor = deal?.progressPercent && deal.progressPercent >= 100
    ? 'bg-emerald-500'
    : deal?.progressPercent && deal.progressPercent >= 50
      ? 'bg-blue-500'
      : 'bg-amber-500';

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Chi tiết deal', 'Deal Detail')} showBack />
        <div className="px-4 pt-4 space-y-4">
          <div className="animate-pulse space-y-3">
            <div className="h-6 w-3/4 bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
            <div className="h-3 w-1/2 bg-muted rounded" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse h-24 rounded-xl border bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Chi tiết deal', 'Deal Detail')} showBack />
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <AlertTriangle className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">{error || t('Không tìm thấy deal', 'Deal not found')}</p>
          <button onClick={() => router.back()} className="mt-4 px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground">
            {t('Quay lại', 'Go Back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Chi tiết deal', 'Deal Detail')} showBack />

      <main className="px-4 pb-28 pt-3 space-y-4">
        {/* Title + Status */}
        <div>
          <h1 className="text-lg font-bold text-foreground mb-1">
            {locale === 'en' && deal.titleEn ? deal.titleEn : deal.title}
          </h1>
          {deal.description && (
            <p className="text-sm text-muted-foreground">{deal.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <DealStatusBadge status={deal.status} locale={locale} />
            {deal.ward && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px]">
                <MapPin className="h-2.5 w-2.5" />{deal.ward.name}
              </span>
            )}
          </div>
        </div>

        {/* Pricing card */}
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-end gap-3">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {deal.discountPriceFormatted}
            </span>
            <span className="text-sm text-muted-foreground line-through pb-0.5">
              {deal.originalPriceFormatted}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-semibold">
              <TrendingDown className="h-3 w-3" />
              -{deal.savingsPercent}%
            </span>
            <span className="text-xs text-muted-foreground">
              {t('Tiết kiệm', 'Save')}: {deal.savingsPerUnitFormatted}/{t('sp', 'unit')}
            </span>
          </div>
        </div>

        {/* Progress */}
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{t('Tiến độ', 'Progress')}</span>
            <span className="text-sm font-bold">{deal.progressPercent}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden mb-1.5">
            <div
              className={`h-full rounded-full transition-all ${progressColor}`}
              style={{ width: `${Math.min(100, deal.progressPercent)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {deal.currentQty.toLocaleString()} / {deal.targetQty.toLocaleString()} {t('sản phẩm', 'units')}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
              <Package className="h-3 w-3" />
              {t('Sản phẩm', 'Product')}
            </div>
            <p className="text-xs font-medium truncate">{deal.product.name}</p>
            <p className="text-[10px] text-muted-foreground">{deal.product.sku}</p>
          </div>
          <div className="rounded-xl border p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
              <Users className="h-3 w-3" />
              {t('Tham gia', 'Participants')}
            </div>
            <p className="text-lg font-bold">{deal.activeParticipantCount}</p>
            <p className="text-[10px] text-muted-foreground">
              {deal.maxParticipants ? `/ ${deal.maxParticipants} ${t('tối đa', 'max')}` : t('Không giới hạn', 'Unlimited')}
            </p>
          </div>
          <div className="rounded-xl border p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              {t('Thời gian còn lại', 'Time Remaining')}
            </div>
            <p className="text-sm font-semibold">{deal.timeRemaining}</p>
          </div>
          <div className="rounded-xl border p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
              {t('Hết hạn', 'Expires')}
            </div>
            <p className="text-xs font-medium">
              {new Date(deal.expiresAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-xl p-1">
          {(['overview', 'participants', 'orders'] as const).map((tab) => (
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
              {tab === 'participants' && t('Tham gia', 'Participants')}
              {tab === 'orders' && t('Đơn hàng', 'Orders')}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'participants' && (
          <div className="space-y-2">
            {deal.participants.length === 0 ? (
              <div className="text-center py-8">
                <Store className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">{t('Chưa có cửa hàng tham gia', 'No shops joined yet')}</p>
              </div>
            ) : (
              deal.participants.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border">
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                    <Store className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.shop.name}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      {p.shop.district && <><MapPin className="h-2.5 w-2.5" />{p.shop.district} · </>}
                      {new Date(p.createdAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{p.committedQty.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">{t('sp', 'units')}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-2">
            {deal.orders.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">{t('Chưa có đơn hàng', 'No orders yet')}</p>
              </div>
            ) : (
              deal.orders.map((order) => (
                <Link key={order.id} href={`/m/orders/${order.id}`} className="block">
                  <div className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                      <ShoppingCart className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{order.orderNumber}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{new Intl.NumberFormat('vi-VN').format(order.totalAmount)} ₫</p>
                      <span className={`text-[10px] font-medium ${
                        order.status === 'DELIVERED' ? 'text-emerald-600' : 'text-muted-foreground'
                      }`}>{order.status}</span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground mb-2">{t('Tiềm năng tiết kiệm', 'Potential Savings')}</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {deal.totalPotentialSavingsFormatted}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {t('nếu đạt mục tiêu', 'if target is reached')}
            </p>
          </div>
        )}
      </main>

      {/* Sticky bottom action */}
      {deal.status === 'ACTIVE' && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t px-4 py-3 safe-area-bottom">
          <Link
            href={`/m/products?groupBuy=${deal.productId}`}
            className="block w-full py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold text-center hover:bg-emerald-700 transition-colors"
          >
            {t('Tham gia mua chung', 'Join Group Buy')}
          </Link>
        </div>
      )}
    </div>
  );
}
