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
  Percent,
  CreditCard,
  Receipt,
  TrendingUp,
  TrendingDown,
  MapPin,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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
// Tier Colors
// ============================================

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'bg-amber-600',
  SILVER: 'bg-gray-400',
  GOLD: 'bg-yellow-500',
  PLATINUM: 'bg-slate-300',
};

const TIER_LABELS: Record<string, { vi: string; en: string }> = {
  BRONZE: { vi: 'Đồng', en: 'Bronze' },
  SILVER: { vi: 'Bạc', en: 'Silver' },
  GOLD: { vi: 'Vàng', en: 'Gold' },
  PLATINUM: { vi: 'Bạch kim', en: 'Platinum' },
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

interface RevenueKpis {
  totalRevenue: number;
  totalRevenueFormatted: string;
  revenueGrowth: number | null;
  totalDiscounts: number;
  totalDiscountsFormatted: string;
  totalCreditUsed: number;
  totalCreditUsedFormatted: string;
  avgOrderValue: number;
  avgOrderValueFormatted: string;
  thisMonthRevenue: number;
  thisMonthRevenueFormatted: string;
  lastMonthRevenue: number;
  lastMonthRevenueFormatted: string;
  monthOverMonth: number | null;
  totalOrders: number;
}

interface PaymentBreakdown {
  revenue: number;
  count: number;
  percentage: number;
}

interface TierBreakdown {
  revenue: number;
  count: number;
  percentage: number;
}

interface TopShop {
  shopId: string;
  name: string;
  revenue: number;
  revenueFormatted: string;
  orders: number;
}

interface DailyTrend {
  date: string;
  revenue: number;
  orders: number;
}

interface RevenueData {
  kpis: RevenueKpis;
  breakdown: {
    byPaymentMethod: Record<string, PaymentBreakdown>;
    byTier: Record<string, TierBreakdown>;
  };
  trends: {
    daily: DailyTrend[];
  };
  topShops: TopShop[];
}

// ============================================
// Mini Bar Chart (pure CSS)
// ============================================

function MiniBarChart({ data, locale }: { data: DailyTrend[]; locale: string }) {
  const maxValue = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="flex items-end gap-[2px] h-24 mt-2">
      {data.map((d, i) => {
        const height = maxValue > 0 ? (d.revenue / maxValue) * 80 : 0;
        const dateLabel = d.date.slice(-2);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-primary/20 rounded-t relative min-h-[2px]"
              style={{ height: `${Math.max(height, 2)}px` }}
            >
              <div className="absolute inset-0 bg-primary rounded-t opacity-80" />
            </div>
            <span className="text-[8px] text-muted-foreground leading-none">{dateLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Revenue Report Page
// ============================================

export default function MobileRevenueReportPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Fetch data
  const fetchData = useCallback(async (p: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = await api.get<RevenueData>('/reports/revenue', { period: p });
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
        <MobileHeader title={t('Doanh thu', 'Revenue')} showBack showNotifications={false} />
        <main className="px-4 pb-4 pt-3">
          <div className="flex gap-2 mb-4">
            {PERIODS.map((_, i) => (
              <div key={i} className="h-8 w-20 rounded-full bg-muted/50 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
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
        <MobileHeader title={t('Doanh thu', 'Revenue')} showBack showNotifications={false} />
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
  const byPaymentMethod = data?.breakdown?.byPaymentMethod || {};
  const byTier = data?.breakdown?.byTier || {};
  const dailyTrend = data?.trends?.daily || [];
  const topShops = data?.topShops || [];

  // Payment method bars
  const paymentEntries = Object.entries(byPaymentMethod).sort((a, b) => b[1].revenue - a[1].revenue);
  const maxPaymentRevenue = paymentEntries.length > 0 ? paymentEntries[0][1].revenue : 1;

  // Tier bars
  const tierOrder = ['PLATINUM', 'GOLD', 'SILVER', 'BRONZE'];
  const tierEntries = tierOrder.filter(t => byTier[t]).map(t => [t, byTier[t]] as const);
  const maxTierRevenue = tierEntries.length > 0 ? Math.max(...tierEntries.map(([, v]) => v.revenue)) : 1;

  return (
    <div
      className="min-h-screen bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <MobileHeader title={t('Doanh thu', 'Revenue')} showBack showNotifications={false} />

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

        {/* KPI Cards (2x2) */}
        {kpis && (
          <section className="mb-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">{t('Tổng doanh thu', 'Total Revenue')}</p>
                </div>
                <p className="text-lg font-bold">{kpis.totalRevenueFormatted}</p>
                {kpis.revenueGrowth !== null && (
                  <div className="flex items-center mt-1">
                    {kpis.revenueGrowth >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-emerald-600 mr-0.5" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600 mr-0.5" />
                    )}
                    <span className={cn('text-[11px] font-medium', kpis.revenueGrowth >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {Math.abs(kpis.revenueGrowth)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="bg-card rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Percent className="h-4 w-4 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">{t('Tổng giảm giá', 'Total Discounts')}</p>
                </div>
                <p className="text-lg font-bold">{kpis.totalDiscountsFormatted}</p>
              </div>

              <div className="bg-card rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">{t('Tín dụng đã dùng', 'Total Credit Used')}</p>
                </div>
                <p className="text-lg font-bold">{kpis.totalCreditUsedFormatted}</p>
              </div>

              <div className="bg-card rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-[11px] text-muted-foreground font-medium">{t('Giá trị TB đơn', 'Avg Order Value')}</p>
                </div>
                <p className="text-lg font-bold">{kpis.avgOrderValueFormatted}</p>
              </div>
            </div>
          </section>
        )}

        {/* Monthly Comparison */}
        {kpis && (
          <section className="mb-6">
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold mb-3">
                {t('So sánh theo tháng', 'Monthly Comparison')}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">{t('Tháng này', 'This Month')}</p>
                  <p className="text-sm font-bold mt-0.5">{kpis.thisMonthRevenueFormatted}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{t('Tháng trước', 'Last Month')}</p>
                  <p className="text-sm font-bold mt-0.5">{kpis.lastMonthRevenueFormatted}</p>
                </div>
              </div>
              {kpis.monthOverMonth !== null && (
                <div className="flex items-center justify-center mt-3 pt-3 border-t border-border/50">
                  {kpis.monthOverMonth >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-600 mr-1" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                  )}
                  <span className={cn('text-sm font-semibold', kpis.monthOverMonth >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {Math.abs(kpis.monthOverMonth)}%
                  </span>
                  <span className="text-xs text-muted-foreground ml-1">
                    {t('so với tháng trước', 'month-over-month')}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Revenue by Payment Method */}
        <section className="mb-6">
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('Doanh thu theo PT thanh toán', 'Revenue by Payment Method')}
            </h3>
            {paymentEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('Không có dữ liệu', 'No data')}</p>
            ) : (
              <div className="space-y-3">
                {paymentEntries.map(([method, pm]) => (
                  <div key={method}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2.5 w-2.5 rounded-full', PAYMENT_COLORS[method] || 'bg-gray-400')} />
                        <span className="text-xs font-medium">
                          {PAYMENT_LABELS[method]?.[locale === 'vi' ? 'vi' : 'en'] || method}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{pm.count} {t('đơn', 'orders')}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', PAYMENT_COLORS[method] || 'bg-gray-400')}
                        style={{ width: `${maxPaymentRevenue > 0 ? (pm.revenue / maxPaymentRevenue) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs font-semibold">{pm.revenue.toLocaleString()} ₫</span>
                      <span className="text-xs text-muted-foreground">{pm.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Revenue by Shop Tier */}
        <section className="mb-6">
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('Doanh thu theo hạng shop', 'Revenue by Shop Tier')}
            </h3>
            {tierEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('Không có dữ liệu', 'No data')}</p>
            ) : (
              <div className="space-y-3">
                {tierEntries.map(([tier, td]) => (
                  <div key={tier}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2.5 w-2.5 rounded-full', TIER_COLORS[tier] || 'bg-gray-400')} />
                        <span className="text-xs font-medium">
                          {TIER_LABELS[tier]?.[locale === 'vi' ? 'vi' : 'en'] || tier}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{td.count} {t('đơn', 'orders')}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', TIER_COLORS[tier] || 'bg-gray-400')}
                        style={{ width: `${maxTierRevenue > 0 ? (td.revenue / maxTierRevenue) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs font-semibold">{td.revenue.toLocaleString()} ₫</span>
                      <span className="text-xs text-muted-foreground">{td.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Daily Revenue Trend */}
        {dailyTrend.length > 0 && (
          <section className="mb-6">
            <div className="bg-card rounded-xl border border-border p-4">
              <h3 className="text-sm font-semibold mb-1">
                {t('Xu hướng doanh thu hàng ngày', 'Daily Revenue Trend')}
              </h3>
              <MiniBarChart data={dailyTrend} locale={locale} />
            </div>
          </section>
        )}

        {/* Top Revenue Shops */}
        <section>
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('Shop doanh thu cao nhất', 'Top Revenue Shops')}
            </h3>
            {topShops.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('Không có dữ liệu', 'No data')}</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {topShops.map((shop, i) => (
                  <div key={shop.shopId} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{shop.name}</p>
                      <p className="text-[10px] text-muted-foreground">{shop.orders} {t('đơn hàng', 'orders')}</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                      {shop.revenueFormatted}
                    </span>
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
