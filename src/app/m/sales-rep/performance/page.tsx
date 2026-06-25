'use client';

import { useState, useEffect, useCallback } from 'react';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileKpiCard } from '@/components/mobile/kpi-card';
import {
  RefreshCw,
  AlertCircle,
  Users,
  Store,
  TrendingUp,
  DollarSign,
  Package,
  ArrowDown,
  ChevronRight,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface PerformanceKpis {
  totalVisits: number;
  uniqueShops: number;
  conversionRate: number;
  avgOrderValue: number;
  avgOrderValueFormatted: string;
}

interface DailyBreakdown {
  date: string;
  label: string;
  visits: number;
  orders: number;
}

interface TopProduct {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
  revenueFormatted: string;
}

interface FunnelStep {
  label: { vi: string; en: string };
  count: number;
  percentage: number;
}

interface PerformanceData {
  kpis: PerformanceKpis;
  dailyBreakdown: DailyBreakdown[];
  topProducts: TopProduct[];
  funnel: FunnelStep[];
}

// ============================================
// Period Tabs
// ============================================

const PERIODS = [
  { key: '7d', vi: '7 ngày', en: '7 days' },
  { key: '30d', vi: '30 ngày', en: '30 days' },
  { key: '90d', vi: '90 ngày', en: '90 days' },
] as const;

// ============================================
// Performance Page
// ============================================

export default function SalesRepPerformancePage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Fetch performance data
  const fetchPerformance = useCallback(
    async (p: string, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      try {
        const res = await api.get<PerformanceData>('/sales-rep/performance', { period: p });
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
    },
    [locale, t]
  );

  useEffect(() => {
    fetchPerformance(period);
  }, [period, fetchPerformance]);

  // Compute chart max
  const dailyData = data?.dailyBreakdown || [];
  const maxDailyValue = dailyData.length > 0
    ? Math.max(...dailyData.map((d) => Math.max(d.visits, d.orders)))
    : 1;

  // Funnel max for bar widths
  const funnelData = data?.funnel || [];
  const funnelMax = funnelData.length > 0 ? funnelData[0].count : 1;

  // ---- Loading Skeleton ----
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Hiệu suất', 'Performance')} showBack showNotifications={false} />
        <main className="px-4 pb-24 pt-2">
          {/* Period tabs skeleton */}
          <div className="flex gap-2 mb-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          {/* KPI row skeleton */}
          <div className="flex gap-3 overflow-hidden mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[140px]">
                <Skeleton className="h-[88px] w-full rounded-xl" />
              </div>
            ))}
          </div>
          {/* Chart skeleton */}
          <Skeleton className="h-48 w-full rounded-xl mb-6" />
          {/* Products skeleton */}
          <Skeleton className="h-6 w-32 mb-3" />
          <div className="flex gap-3 overflow-hidden mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="shrink-0 w-[160px] h-[100px] rounded-xl" />
            ))}
          </div>
          {/* Funnel skeleton */}
          <Skeleton className="h-6 w-32 mb-3" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl mb-2" />
          ))}
        </main>
      </div>
    );
  }

  // ---- Error State ----
  if (error && !data) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Hiệu suất', 'Performance')} showBack showNotifications={false} />
        <main className="px-4 pb-24 pt-2">
          <div className="text-center py-16">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive/50" />
            <h3 className="text-lg font-semibold mb-2">{t('Lỗi tải dữ liệu', 'Failed to Load')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => fetchPerformance(period, true)}
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
  const topProducts = data?.topProducts || [];

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Hiệu suất', 'Performance')} showBack showNotifications={false} />

      <main className="px-4 pb-24 pt-2">
        {/* Period Selector */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar mb-4">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors',
                period === p.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground'
              )}
            >
              {t(p.vi, p.en)}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <div className="flex justify-end mb-2 -mt-1">
          <button
            onClick={() => fetchPerformance(period, true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {t('Làm mới', 'Refresh')}
          </button>
        </div>

        {/* KPI Row (Horizontal Scroll) */}
        {kpis && (
          <section className="mb-6">
            <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar">
              <div className="shrink-0 w-[140px]">
                <MobileKpiCard
                  label="Total Visits"
                  labelVi="Tổng lượt thăm"
                  value={kpis.totalVisits.toLocaleString()}
                  icon={<Users className="h-4 w-4" />}
                  variant="default"
                  locale={locale}
                />
              </div>
              <div className="shrink-0 w-[140px]">
                <MobileKpiCard
                  label="Unique Shops"
                  labelVi="Cửa hàng khác"
                  value={kpis.uniqueShops.toLocaleString()}
                  icon={<Store className="h-4 w-4" />}
                  variant="default"
                  locale={locale}
                />
              </div>
              <div className="shrink-0 w-[140px]">
                <MobileKpiCard
                  label="Conversion Rate"
                  labelVi="Tỷ lệ chuyển đổi"
                  value={`${kpis.conversionRate}%`}
                  icon={<TrendingUp className="h-4 w-4" />}
                  variant="success"
                  locale={locale}
                />
              </div>
              <div className="shrink-0 w-[140px]">
                <MobileKpiCard
                  label="Avg Order Value"
                  labelVi="TB giá trị đơn"
                  value={kpis.avgOrderValueFormatted}
                  icon={<DollarSign className="h-4 w-4" />}
                  variant="warning"
                  locale={locale}
                />
              </div>
            </div>
          </section>
        )}

        {/* CSS-Only Bar Chart: Daily Breakdown */}
        <section className="mb-6">
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-4">
              {t('Thống kê theo ngày', 'Daily Breakdown')}
            </h3>

            {dailyData.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                {t('Không có dữ liệu', 'No data')}
              </p>
            ) : (
              <div className="relative">
                {/* Chart area */}
                <div className="flex items-end gap-1 h-40">
                  {dailyData.map((day, i) => {
                    const visitHeight = maxDailyValue > 0 ? (day.visits / maxDailyValue) * 100 : 0;
                    const orderHeight = maxDailyValue > 0 ? (day.orders / maxDailyValue) * 100 : 0;

                    return (
                      <div key={i} className="flex-1 flex items-end gap-px min-w-0">
                        {/* Visit bar */}
                        <div className="flex-1 relative group">
                          <div
                            className="w-full bg-primary/80 rounded-t-sm transition-all min-h-[2px]"
                            style={{ height: `${Math.max(visitHeight, 2)}%` }}
                          />
                          {/* Tooltip */}
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                            {day.visits} {t('thăm', 'visits')}
                          </div>
                        </div>
                        {/* Order bar */}
                        <div className="flex-1 relative group">
                          <div
                            className="w-full bg-amber-500/80 rounded-t-sm transition-all min-h-[2px]"
                            style={{ height: `${Math.max(orderHeight, 2)}%` }}
                          />
                          {/* Tooltip */}
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                            {day.orders} {t('đơn', 'orders')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* X-axis labels */}
                <div className="flex gap-1 mt-1.5">
                  {dailyData.map((day, i) => (
                    <div key={i} className="flex-1 text-center min-w-0">
                      <span className="text-[9px] text-muted-foreground truncate block">
                        {day.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-primary/80" />
                    <span className="text-[10px] text-muted-foreground">{t('Thăm', 'Visits')}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/80" />
                    <span className="text-[10px] text-muted-foreground">{t('Đơn hàng', 'Orders')}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Top Products (Horizontal Scroll) */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold mb-3">
            {t('Sản phẩm bán chạy', 'Top Products')}
          </h3>

          {topProducts.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-6">
              <p className="text-xs text-muted-foreground text-center">
                {t('Không có dữ liệu', 'No data')}
              </p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar">
              {topProducts.map((product, i) => (
                <Card key={product.productId} className="shrink-0 w-[160px] rounded-xl">
                  <CardContent className="p-3.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-semibold leading-tight mb-2 line-clamp-2 min-h-[2rem]">
                      {product.productName}
                    </p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">
                        {product.quantity} {t('sp', 'pcs')}
                      </span>
                      <span className="text-xs font-bold text-emerald-700">
                        {product.revenueFormatted}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Conversion Funnel (CSS Visual) */}
        <section>
          <h3 className="text-sm font-semibold mb-3">
            {t('Phễu chuyển đổi', 'Conversion Funnel')}
          </h3>

          {funnelData.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-6">
              <p className="text-xs text-muted-foreground text-center">
                {t('Không có dữ liệu', 'No data')}
              </p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-4 space-y-2.5">
              {funnelData.map((step, i) => {
                const widthPercent = funnelMax > 0 ? (step.count / funnelMax) * 100 : 0;
                const isLast = i === funnelData.length - 1;

                return (
                  <div key={i}>
                    {/* Step label and count */}
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">
                        {step.label[locale === 'vi' ? 'vi' : 'en']}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold">{step.count}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {step.percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Funnel bar */}
                    <div className="relative">
                      <div className="h-8 rounded-lg bg-muted/50 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-lg transition-all duration-700 flex items-center justify-end pr-2',
                            i === 0 && 'bg-primary/80',
                            i === 1 && 'bg-amber-500/80',
                            i === 2 && 'bg-emerald-500/80',
                            i > 2 && 'bg-muted-foreground/60'
                          )}
                          style={{ width: `${Math.max(widthPercent, 8)}%` }}
                        >
                          {!isLast && widthPercent > 20 && (
                            <ArrowDown className="h-3 w-3 text-white/70" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Connector arrow between steps */}
                    {!isLast && i < funnelData.length - 1 && (
                      <div className="flex justify-center my-0.5">
                        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}