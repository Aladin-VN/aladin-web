'use client';

import { useState, useEffect, useCallback } from 'react';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { cn } from '@/lib/utils';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  DollarSign,
  ShoppingBag,
  Store,
  ShieldAlert,
  Truck,
  PiggyBank,
} from 'lucide-react';
import { MobileKpiCard } from '@/components/mobile/kpi-card';

// ============================================
// Period Selector
// ============================================

const PERIODS = [
  { key: '7d', vi: '7 ngày', en: '7 days' },
  { key: '30d', vi: '30 ngày', en: '30 days' },
  { key: '90d', vi: '90 ngày', en: '90 days' },
  { key: 'thisMonth', vi: 'Tháng này', en: 'This month' },
  { key: 'lastMonth', vi: 'Tháng trước', en: 'Last month' },
];

// ============================================
// Order Status Colors (stacked bar)
// ============================================

const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-400',
  CONFIRMED: 'bg-blue-400',
  PROCESSING: 'bg-indigo-400',
  PACKED: 'bg-purple-400',
  OUT_FOR_DELIVERY: 'bg-cyan-400',
  DELIVERED: 'bg-emerald-500',
  CANCELLED: 'bg-red-400',
  REFUNDED: 'bg-gray-400',
};

const ORDER_STATUS_LABELS: Record<string, { vi: string; en: string }> = {
  PENDING: { vi: 'Chờ xử lý', en: 'Pending' },
  CONFIRMED: { vi: 'Xác nhận', en: 'Confirmed' },
  PROCESSING: { vi: 'Đang xử lý', en: 'Processing' },
  PACKED: { vi: 'Đóng gói', en: 'Packed' },
  OUT_FOR_DELIVERY: { vi: 'Đang giao', en: 'Out for Delivery' },
  DELIVERED: { vi: 'Đã giao', en: 'Delivered' },
  CANCELLED: { vi: 'Đã hủy', en: 'Cancelled' },
  REFUNDED: { vi: 'Đã hoàn', en: 'Refunded' },
};

const PAYMENT_COLORS: Record<string, string> = {
  CREDIT: 'bg-amber-500',
  DIGITAL: 'bg-emerald-500',
  COD: 'bg-purple-500',
};

const PAYMENT_LABELS: Record<string, { vi: string; en: string }> = {
  CREDIT: { vi: 'Công nợ', en: 'Credit' },
  DIGITAL: { vi: 'Thanh toán số', en: 'Digital' },
  COD: { vi: 'COD', en: 'COD' },
};

// ============================================
// Types
// ============================================

interface OverviewKpis {
  totalRevenue: number;
  totalRevenueFormatted: string;
  revenueGrowth: number | null;
  totalOrders: number;
  orderGrowth: number | null;
  activeShops: number;
  newShops: number;
  totalCreditExposure: number;
  totalCreditExposureFormatted: string;
  overdueShops: number;
  successRate: number;
  totalSavings: number;
  totalSavingsFormatted: string;
}

interface OverviewData {
  kpis: OverviewKpis;
  distributions: {
    orderStatus: Record<string, number>;
    paymentMethod: Record<string, number>;
  };
  topCategories: Array<{ name: string; revenue: number; revenueFormatted: string }>;
}

// ============================================
// Stacked Bar Component
// ============================================

function StackedBar({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  return (
    <div className="flex h-3 rounded-full overflow-hidden">
      {segments.map((seg, i) => (
        <div
          key={i}
          className={cn(seg.color, 'transition-all')}
          style={{ width: `${(seg.value / total) * 100}%` }}
          title={`${seg.label}: ${seg.value}`}
        />
      ))}
    </div>
  );
}

// ============================================
// Overview Report Page
// ============================================

export default function MobileOverviewReportPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Fetch data
  const fetchData = useCallback(async (p: string, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const res = await api.get<OverviewData>('/reports/overview', { period: p });
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error?.message || t('Lỗi tải dữ liệu', 'Failed to load data'));
      }
    } catch {
      setError(t('Lỗi kết nối mạng', 'Network error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locale, t]);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  // Pull-to-refresh
  const [pullState, setPullState] = useState<'idle' | 'pulling' | 'ready'>('idle');
  const [startY, setStartY] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
      setPullState('pulling');
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullState === 'idle') return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 80) setPullState('ready');
    else if (diff < 20) setPullState('idle');
  };

  const handleTouchEnd = () => {
    if (pullState === 'ready') fetchData(period, true);
    setPullState('idle');
    setStartY(0);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Tổng quan', 'Overview')} showBack showNotifications={false} />
        <main className="px-4 pb-4 pt-3">
          <div className="flex gap-2 mb-4">
            {PERIODS.map((_, i) => (
              <div key={i} className="h-8 w-20 rounded-full bg-muted/50 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-muted/50 rounded-xl p-3 animate-pulse">
                <div className="h-3 w-20 bg-muted rounded mb-2" />
                <div className="h-5 w-24 bg-muted rounded" />
              </div>
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-muted/50 rounded-xl p-4 mb-4 animate-pulse">
              <div className="h-4 w-32 bg-muted rounded mb-3" />
              <div className="h-3 w-full bg-muted rounded" />
            </div>
          ))}
        </main>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Tổng quan', 'Overview')} showBack showNotifications={false} />
        <main className="px-4 pb-4 pt-3">
          <div className="text-center py-16">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive/50" />
            <h3 className="text-lg font-semibold mb-2">{t('Lỗi tải dữ liệu', 'Failed to Load')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => fetchData(period, true)}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium"
            >
              {t('Thử lại', 'Retry')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  const kpis = data?.kpis;
  const orderStatus = data?.distributions?.orderStatus || {};
  const paymentMethod = data?.distributions?.paymentMethod || {};
  const topCategories = data?.topCategories || [];
  const maxCatRevenue = topCategories.length > 0 ? topCategories[0].revenue : 1;

  // Build stacked bar segments
  const statusSegments = Object.entries(orderStatus).map(([status, count]) => ({
    label: ORDER_STATUS_LABELS[status]?.[locale === 'vi' ? 'vi' : 'en'] || status,
    value: count,
    color: ORDER_STATUS_COLORS[status] || 'bg-gray-400',
  }));

  const totalPaymentRevenue = Object.values(paymentMethod).reduce((s, v) => s + v, 0);
  const paymentBars = Object.entries(paymentMethod)
    .sort((a, b) => b[1] - a[1])
    .map(([method, revenue]) => ({
      method,
      label: PAYMENT_LABELS[method]?.[locale === 'vi' ? 'vi' : 'en'] || method,
      revenue,
      percentage: totalPaymentRevenue > 0 ? Math.round((revenue / totalPaymentRevenue) * 1000) / 10 : 0,
      color: PAYMENT_COLORS[method] || 'bg-gray-400',
    }));

  return (
    <div
      className="min-h-screen bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <MobileHeader title={t('Tổng quan', 'Overview')} showBack showNotifications={false} />

      <main className="px-4 pb-4 pt-3">
        {/* Pull-to-refresh */}
        {pullState === 'ready' && (
          <div className="flex justify-center py-2 mb-2">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        )}

        {/* Refresh */}
        <div className="flex justify-end mb-3">
          <button
            onClick={() => fetchData(period, true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {t('Làm mới', 'Refresh')}
          </button>
        </div>

        {/* Period selector */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar mb-4">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                period === p.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground'
              )}
            >
              {t(p.vi, p.en)}
            </button>
          ))}
        </div>

        {/* KPI Grid (2x3) */}
        {kpis && (
          <section className="mb-6">
            <div className="grid grid-cols-2 gap-3">
              <MobileKpiCard
                label="Total Revenue"
                labelVi="Tổng doanh thu"
                value={kpis.totalRevenueFormatted}
                icon={<DollarSign className="h-4 w-4" />}
                trend={kpis.revenueGrowth ?? undefined}
                trendLabel={t('vs trước đó', 'vs prev')}
                locale={locale}
              />
              <MobileKpiCard
                label="Total Orders"
                labelVi="Tổng đơn hàng"
                value={kpis.totalOrders.toLocaleString()}
                icon={<ShoppingBag className="h-4 w-4" />}
                trend={kpis.orderGrowth ?? undefined}
                trendLabel={t('vs trước đó', 'vs prev')}
                locale={locale}
              />
              <MobileKpiCard
                label="Active / New Shops"
                labelVi="Shop hoạt động / mới"
                value={`${kpis.activeShops} / ${kpis.newShops}`}
                icon={<Store className="h-4 w-4" />}
                locale={locale}
              />
              <MobileKpiCard
                label="Credit Exposure"
                labelVi="Công nợ"
                value={kpis.totalCreditExposureFormatted}
                icon={<ShieldAlert className="h-4 w-4" />}
                variant={kpis.overdueShops > 0 ? 'warning' : 'default'}
                trendLabel={t(`${kpis.overdueShops} quá hạn`, `${kpis.overdueShops} overdue`)}
                locale={locale}
              />
              <MobileKpiCard
                label="Delivery Success"
                labelVi="Giao hàng thành công"
                value={`${kpis.successRate}%`}
                icon={<Truck className="h-4 w-4" />}
                variant={kpis.successRate >= 90 ? 'success' : kpis.successRate >= 70 ? 'default' : 'danger'}
                locale={locale}
              />
              <MobileKpiCard
                label="Total Savings"
                labelVi="Tổng tiết kiệm"
                value={kpis.totalSavingsFormatted}
                icon={<PiggyBank className="h-4 w-4" />}
                variant="success"
                trendLabel={t('từ mua chung', 'from group buys')}
                locale={locale}
              />
            </div>
          </section>
        )}

        {/* Order Status Distribution */}
        <section className="mb-6">
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('Phân trạng đơn hàng', 'Order Status Distribution')}
            </h3>
            <StackedBar segments={statusSegments} />
            <div className="mt-3 space-y-1.5">
              {statusSegments.map((seg, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn('h-2.5 w-2.5 rounded-full', seg.color)} />
                    <span className="text-xs text-muted-foreground">{seg.label}</span>
                  </div>
                  <span className="text-xs font-medium">{seg.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Payment Method Distribution */}
        <section className="mb-6">
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('Phương thức thanh toán', 'Payment Methods')}
            </h3>
            {paymentBars.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {t('Không có dữ liệu', 'No data')}
              </p>
            ) : (
              <div className="space-y-3">
                {paymentBars.map((pm) => (
                  <div key={pm.method}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{pm.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{pm.percentage}%</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', pm.color)}
                        style={{ width: `${pm.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Top Categories */}
        <section>
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('Danh mục hàng đầu', 'Top Categories')}
            </h3>
            {topCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {t('Không có dữ liệu', 'No data')}
              </p>
            ) : (
              <div className="space-y-3">
                {topCategories.slice(0, 5).map((cat, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate max-w-[60%]">{cat.name}</span>
                      <span className="text-xs font-semibold">{cat.revenueFormatted}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${maxCatRevenue > 0 ? (cat.revenue / maxCatRevenue) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
