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
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Receipt,
  Package,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MobileKpiCard } from '@/components/mobile/kpi-card';
import { StatusBadge } from '@/components/mobile/order-status-badge';
import { getPaymentMethodLabel } from '@/components/mobile/order-status-badge';

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

// ============================================
// Types
// ============================================

interface OrdersKpis {
  totalOrders: number;
  orderGrowth: number | null;
  completedOrders: number;
  completionRate: number;
  cancelledOrders: number;
  cancellationRate: number;
  totalRevenue: number;
  totalRevenueFormatted: string;
  avgOrderValue: number;
  avgOrderValueFormatted: string;
  avgItemsPerOrder: number;
  avgFulfillmentHours: number;
}

interface PaymentBreakdown {
  count: number;
  revenue: number;
  percentage: number;
}

interface TopShop {
  shopId: string;
  name: string;
  orders: number;
  revenue: number;
  revenueFormatted: string;
  tier: string;
}

interface LargestOrder {
  id: string;
  totalAmount: number;
  totalAmountFormatted: string;
  shopName: string;
  status: string;
  paymentMethod: string;
  createdAt: string;
  itemCount: number;
}

interface OrdersData {
  kpis: OrdersKpis;
  distributions: {
    status: Record<string, number>;
    paymentMethod: Record<string, PaymentBreakdown>;
  };
  rankings: {
    topShops: TopShop[];
    largestOrders: LargestOrder[];
  };
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
// Tier Badge
// ============================================

function TierBadge({ tier }: { tier: string }) {
  const tierStyles: Record<string, string> = {
    BRONZE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    SILVER: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    GOLD: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    PLATINUM: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-medium', tierStyles[tier] || 'bg-muted text-muted-foreground')}>
      {tier}
    </span>
  );
}

// ============================================
// Orders Report Page
// ============================================

export default function MobileOrdersReportPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<OrdersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Fetch data
  const fetchData = useCallback(async (p: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = await api.get<OrdersData>('/reports/orders', { period: p });
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
        <MobileHeader title={t('Đơn hàng', 'Orders')} showBack showNotifications={false} />
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
        <MobileHeader title={t('Đơn hàng', 'Orders')} showBack showNotifications={false} />
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
  const statusDist = data?.distributions?.status || {};
  const paymentMethodDist = data?.distributions?.paymentMethod || {};
  const topShops = data?.rankings?.topShops || [];
  const largestOrders = data?.rankings?.largestOrders || [];

  // Build stacked bar segments
  const statusSegments = Object.entries(statusDist).map(([status, count]) => ({
    label: ORDER_STATUS_LABELS[status]?.[locale === 'vi' ? 'vi' : 'en'] || status,
    value: count,
    color: ORDER_STATUS_COLORS[status] || 'bg-gray-400',
  }));

  // Payment method entries
  const paymentEntries = Object.entries(paymentMethodDist).sort((a, b) => b[1].count - a[1].count);

  return (
    <div
      className="min-h-screen bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <MobileHeader title={t('Đơn hàng', 'Orders')} showBack showNotifications={false} />

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
                period === p.key ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
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
                label="Total Orders"
                labelVi="Tổng đơn hàng"
                value={kpis.totalOrders.toLocaleString()}
                icon={<ShoppingBag className="h-4 w-4" />}
                trend={kpis.orderGrowth ?? undefined}
                trendLabel={t('vs trước đó', 'vs prev')}
                locale={locale}
              />
              <MobileKpiCard
                label="Completed / Rate"
                labelVi="Hoàn thành / Tỷ lệ"
                value={`${kpis.completedOrders} (${kpis.completionRate}%)`}
                icon={<CheckCircle2 className="h-4 w-4" />}
                variant={kpis.completionRate >= 80 ? 'success' : 'default'}
                locale={locale}
              />
              <MobileKpiCard
                label="Cancelled / Rate"
                labelVi="Đã hủy / Tỷ lệ"
                value={`${kpis.cancelledOrders} (${kpis.cancellationRate}%)`}
                icon={<XCircle className="h-4 w-4" />}
                variant={kpis.cancellationRate > 20 ? 'danger' : 'default'}
                locale={locale}
              />
              <MobileKpiCard
                label="Avg Order Value"
                labelVi="Giá trị TB đơn"
                value={kpis.avgOrderValueFormatted}
                icon={<Receipt className="h-4 w-4" />}
                locale={locale}
              />
              <MobileKpiCard
                label="Avg Items per Order"
                labelVi="TB sản phẩm/đơn"
                value={kpis.avgItemsPerOrder.toString()}
                icon={<Package className="h-4 w-4" />}
                locale={locale}
              />
              <MobileKpiCard
                label="Avg Fulfillment"
                labelVi="TB thời gian giao"
                value={`${kpis.avgFulfillmentHours}h`}
                icon={<Clock className="h-4 w-4" />}
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

        {/* Payment Method Breakdown */}
        <section className="mb-6">
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('Phương thức thanh toán', 'Payment Method Breakdown')}
            </h3>
            {paymentEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('Không có dữ liệu', 'No data')}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {paymentEntries.map(([method, pm]) => (
                  <div key={method} className="bg-muted/30 rounded-lg p-3 text-center">
                    <div className={cn('h-2 w-8 rounded-full mx-auto mb-2', PAYMENT_COLORS[method] || 'bg-gray-400')} />
                    <p className="text-[10px] text-muted-foreground">
                      {getPaymentMethodLabel(method, locale)}
                    </p>
                    <p className="text-sm font-bold mt-0.5">{pm.count}</p>
                    <p className="text-[10px] text-muted-foreground">{pm.percentage}%</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Top Ordering Shops */}
        <section className="mb-6">
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('Shop đặt hàng nhiều nhất', 'Top Ordering Shops')}
            </h3>
            {topShops.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('Không có dữ liệu', 'No data')}</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {topShops.map((shop, i) => (
                  <div key={shop.shopId} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold truncate">{shop.name}</p>
                        <TierBadge tier={shop.tier} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {shop.orders} {t('đơn', 'orders')} · {shop.revenueFormatted}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Largest Orders */}
        <section>
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('Đơn hàng lớn nhất', 'Largest Orders')}
            </h3>
            {largestOrders.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('Không có dữ liệu', 'No data')}</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {largestOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="py-2 border-b border-border/50 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          #{order.id.slice(-8).toUpperCase()}
                        </span>
                        <StatusBadge status={order.status} type="order" locale={locale} size="sm" />
                      </div>
                      <span className="text-xs font-bold">{order.totalAmountFormatted}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground truncate max-w-[60%]">
                        {order.shopName}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{order.itemCount} {t('SP', 'items')}</span>
                        <span>{new Date(order.createdAt).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit' })}</span>
                      </div>
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
