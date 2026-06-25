'use client';

import { useState, useEffect, useMemo } from 'react';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Wallet,
  Truck,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  CalendarDays,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface DailyBreakdown {
  date: string;
  deliveries: number;
  earnings: number;
}

interface EarningsResponse {
  totalEarnings: number;
  totalDeliveries: number;
  successfulDeliveries: number;
  successRate: number;
  avgPerDelivery: number;
  daily: DailyBreakdown[];
  monthSummary: {
    month: string;
    totalEarnings: number;
    totalDeliveries: number;
    successRate: number;
  } | null;
}

// ============================================
// Config
// ============================================

const PERIOD_OPTIONS = [
  { value: '7d', vi: '7 ngày', en: '7 days' },
  { value: '30d', vi: '30 ngày', en: '30 days' },
  { value: '90d', vi: '90 ngày', en: '90 days' },
];

// ============================================
// Helpers
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function getFromTo(period: string): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (period === '7d') from.setDate(from.getDate() - 6);
  else if (period === '30d') from.setDate(from.getDate() - 29);
  else if (period === '90d') from.setDate(from.getDate() - 89);
  else from.setDate(from.getDate() - 29);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: fmt(from), to: fmt(to) };
}

function formatDateLabel(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// ============================================
// Page Component
// ============================================

export default function DriverEarningsPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch earnings
  useEffect(() => {
    const { from, to } = getFromTo(period);
    const fetchEarnings = async () => {
      setLoading(true);
      const res = await api.get<EarningsResponse>('/driver/earnings', { from, to });
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    };
    fetchEarnings();
  }, [period]);

  // Compute max daily earnings for bar chart
  const maxDaily = useMemo(() => {
    if (!data?.daily?.length) return 0;
    return Math.max(...data.daily.map((d) => d.earnings), 1);
  }, [data]);

  // Period label
  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period);

  // ---- Loading ----
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Doanh thu', 'Earnings')}
          showBack
          showNotifications={false}
        />
        <div className="px-4 pt-4 pb-24 space-y-4">
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-20 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-2xl" />
          <div className="flex gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 flex-1 rounded-xl" />
            ))}
          </div>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Doanh thu', 'Earnings')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pt-4 pb-24 space-y-5">
        {/* Period selector */}
        <div className="flex gap-2">
          {PERIOD_OPTIONS.map((opt) => {
            const isActive = period === opt.value;
            const label = locale === 'vi' ? opt.vi : opt.en;
            return (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={cn(
                  'shrink-0 px-4 py-2 rounded-full text-sm font-medium border transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:border-primary/50'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Total Earnings Card — big, prominent */}
        <Card className="rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 opacity-80" />
              <p className="text-sm opacity-80 font-medium">
                {t('Thu nhập trong', 'Earnings in')} {locale === 'vi' ? periodLabel?.vi : periodLabel?.en}
              </p>
            </div>
            <p className="text-3xl font-bold tracking-tight mt-1">
              {formatVND(data?.totalEarnings ?? 0)}
            </p>
            <div className="flex items-center gap-1 mt-2 text-xs opacity-70">
              <TrendingUp className="h-3 w-3" />
              <span>
                {data?.totalDeliveries ?? 0} {t('chuyến', 'deliveries')}
              </span>
            </div>
          </div>
        </Card>

        {/* Stats Row — 3 items */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="rounded-xl">
            <CardContent className="p-3 text-center">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-1.5">
                <Truck className="h-4 w-4 text-primary" />
              </div>
              <p className="text-lg font-bold">{data?.totalDeliveries ?? 0}</p>
              <p className="text-[10px] text-muted-foreground font-medium">
                {t('Tổng chuyến', 'Total')}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent className="p-3 text-center">
              <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-lg font-bold">{data?.successRate ?? 0}%</p>
              <p className="text-[10px] text-muted-foreground font-medium">
                {t('Thành công', 'Success')}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent className="p-3 text-center">
              <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-1.5">
                <BarChart3 className="h-4 w-4 text-amber-600" />
              </div>
              <p className="text-lg font-bold">{formatVND(data?.avgPerDelivery ?? 0)}</p>
              <p className="text-[10px] text-muted-foreground font-medium">
                {t('TB/Chuyến', 'Avg/Delivery')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Daily Breakdown */}
        {data?.daily && data.daily.length > 0 && (
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  {t('Chi tiết theo ngày', 'Daily Breakdown')}
                </h3>
              </div>

              <div className="space-y-3">
                {data.daily.map((day, idx) => {
                  const barWidth = maxDaily > 0 ? (day.earnings / maxDaily) * 100 : 0;
                  const isToday = day.date === new Date().toISOString().split('T')[0];

                  return (
                    <div key={day.date}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'text-xs font-medium',
                            isToday && 'text-primary'
                          )}>
                            {formatDateLabel(day.date, locale)}
                            {isToday && (
                              <span className="ml-1.5 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                                {t('Hôm nay', 'Today')}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold">{formatVND(day.earnings)}</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5">
                            {day.deliveries} {t('chuyến', 'trips')}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            isToday ? 'bg-primary' : 'bg-primary/60'
                          )}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      {idx < data.daily.length - 1 && <Separator className="mt-3" />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!loading && data && data.daily.length === 0 && (
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Wallet className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">{t('Chưa có doanh thu', 'No earnings yet')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('Doanh thu sẽ hiển thị sau khi bạn hoàn thành chuyến giao hàng', 'Earnings will appear after completing deliveries')}
            </p>
          </div>
        )}

        {/* Month Summary */}
        {data?.monthSummary && (
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  {t('Tháng này', 'This Month')}
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-lg font-bold text-primary">
                    {formatVND(data.monthSummary.totalEarnings)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t('Tổng thu nhập', 'Total earnings')}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold">
                    {data.monthSummary.totalDeliveries}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t('Chuyến giao', 'Deliveries')}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-green-600">
                    {data.monthSummary.successRate}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t('Thành công', 'Success')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}