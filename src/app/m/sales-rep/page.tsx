'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { MobileKpiCard } from '@/components/mobile/kpi-card';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Route,
  Store,
  Clock,
  BarChart3,
  RefreshCw,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface DashboardKpis {
  todayVisits: number;
  monthlyOrders: number;
  monthlyRevenue: number;
  monthlyRevenueFormatted: string;
  conversionRate: number;
}

interface RouteStop {
  shopId: string;
  shopName: string;
  district: string;
  status: 'PLANNED' | 'VISITED' | 'SKIPPED';
  orderPlaced: boolean;
  orderAmount?: number;
  orderAmountFormatted?: string;
}

interface DashboardData {
  kpis: DashboardKpis;
  todayRoute: RouteStop[];
}

// ============================================
// Quick Actions
// ============================================

const QUICK_ACTIONS = [
  {
    key: 'route',
    vi: 'Lên tuyến',
    en: 'Start Route',
    href: '/m/sales-rep/route',
    icon: Route,
    color: 'text-blue-600 bg-blue-50',
  },
  {
    key: 'visit',
    vi: 'Thăm khách hàng',
    en: 'Visit Shop',
    href: '/m/sales-rep/visit',
    icon: Store,
    color: 'text-emerald-600 bg-emerald-50',
  },
  {
    key: 'history',
    vi: 'Lịch sử',
    en: 'History',
    href: '/m/sales-rep/history',
    icon: Clock,
    color: 'text-amber-600 bg-amber-50',
  },
  {
    key: 'performance',
    vi: 'Hiệu suất',
    en: 'Performance',
    href: '/m/sales-rep/performance',
    icon: BarChart3,
    color: 'text-purple-600 bg-purple-50',
  },
] as const;

// ============================================
// Status Badge Config
// ============================================

const STATUS_CONFIG: Record<string, { label: { vi: string; en: string }; cls: string }> = {
  PLANNED: {
    label: { vi: 'Chưa thăm', en: 'Planned' },
    cls: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  VISITED: {
    label: { vi: 'Đã thăm', en: 'Visited' },
    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  SKIPPED: {
    label: { vi: 'Bỏ qua', en: 'Skipped' },
    cls: 'bg-red-100 text-red-700 border-red-200',
  },
};

// ============================================
// Dashboard Page
// ============================================

export default function SalesRepDashboardPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Derive first name
  const firstName = user?.name?.split(' ').pop() || '';

  // Today's date
  const todayStr = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Fetch dashboard
  const fetchDashboard = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError('');

      try {
        const res = await api.get<DashboardData>('/sales-rep/dashboard');
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
    fetchDashboard();
  }, [fetchDashboard]);

  // ---- Loading Skeleton ----
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader showNotifications={false} />
        <main className="px-4 pb-24 pt-2">
          {/* Greeting skeleton */}
          <div className="mb-5">
            <Skeleton className="h-5 w-40 mb-2" />
            <Skeleton className="h-3.5 w-56" />
          </div>
          {/* KPI skeleton */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted/50 rounded-xl p-3 animate-pulse">
                <Skeleton className="h-3 w-20 mb-2" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
          {/* Quick actions skeleton */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          {/* Route skeleton */}
          <Skeleton className="h-6 w-40 mb-3" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl mb-2" />
          ))}
        </main>
      </div>
    );
  }

  // ---- Error State ----
  if (error && !data) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader showNotifications={false} />
        <main className="px-4 pb-24 pt-2">
          <div className="text-center py-16">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive/50" />
            <h3 className="text-lg font-semibold mb-2">{t('Lỗi tải dữ liệu', 'Failed to Load')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchDashboard(true)} variant="outline">
              {t('Thử lại', 'Retry')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const kpis = data?.kpis;
  const todayRoute = data?.todayRoute || [];
  const visitedCount = todayRoute.filter((s) => s.status === 'VISITED').length;
  const totalCount = todayRoute.length;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader showNotifications={false} />

      <main className="px-4 pb-24 pt-2">
        {/* Greeting */}
        <div className="mb-5">
          <h2 className="text-xl font-bold">
            {t('Xin chào, ', 'Hello, ')}
            <span className="text-primary">{firstName}</span> 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{todayStr}</p>
        </div>

        {/* Refresh button */}
        <div className="flex justify-end mb-2 -mt-1">
          <button
            onClick={() => fetchDashboard(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {t('Làm mới', 'Refresh')}
          </button>
        </div>

        {/* KPI Cards 2x2 */}
        {kpis && (
          <section className="mb-6">
            <div className="grid grid-cols-2 gap-3">
              <MobileKpiCard
                label="Today's Visits"
                labelVi="Khách thăm hôm nay"
                value={`${visitedCount}${totalCount > 0 ? `/${totalCount}` : ''}`}
                icon={<MapPin className="h-4 w-4" />}
                variant="default"
                locale={locale}
              />
              <MobileKpiCard
                label="Monthly Orders"
                labelVi="Đơn hàng tháng này"
                value={kpis.monthlyOrders.toLocaleString()}
                icon={<ShoppingCart className="h-4 w-4" />}
                variant="success"
                locale={locale}
              />
              <MobileKpiCard
                label="Monthly Revenue"
                labelVi="Doanh thu tháng"
                value={kpis.monthlyRevenueFormatted}
                icon={<DollarSign className="h-4 w-4" />}
                variant="warning"
                locale={locale}
              />
              <MobileKpiCard
                label="Conversion Rate"
                labelVi="Tỷ lệ chuyển đổi"
                value={`${kpis.conversionRate}%`}
                icon={<TrendingUp className="h-4 w-4" />}
                variant="default"
                locale={locale}
              />
            </div>
          </section>
        )}

        {/* Quick Actions */}
        <section className="mb-6">
          <h3 className="text-sm font-semibold mb-3">{t('Thao tác nhanh', 'Quick Actions')}</h3>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.key}
                  onClick={() => router.push(action.href)}
                  className="flex items-center gap-3 bg-card border border-border rounded-xl p-3.5 hover:border-primary/30 transition-colors text-left active:scale-[0.98] transition-transform"
                >
                  <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', action.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium">{t(action.vi, action.en)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Today's Route Summary */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t('Tuyến hôm nay', "Today's Route")}</h3>
            {todayRoute.length > 0 && (
              <button
                onClick={() => router.push('/m/sales-rep/route')}
                className="text-xs text-primary font-medium flex items-center gap-0.5"
              >
                {t('Xem tất cả', 'View all')}
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {todayRoute.length === 0 ? (
            <Card className="rounded-xl border-dashed">
              <CardContent className="flex flex-col items-center py-8 px-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Route className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('Chưa có tuyến hôm nay', 'No route planned for today')}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {t('Nhấn "Lên tuyến" để bắt đầu', 'Tap "Start Route" to begin')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {todayRoute.slice(0, 5).map((stop) => {
                const statusCfg = STATUS_CONFIG[stop.status] || STATUS_CONFIG.PLANNED;
                return (
                  <Card
                    key={stop.shopId}
                    className="rounded-xl cursor-pointer hover:border-primary/30 transition-colors active:scale-[0.99]"
                    onClick={() =>
                      stop.status === 'PLANNED'
                        ? router.push(`/m/sales-rep/visit?shopId=${stop.shopId}`)
                        : router.push(`/m/sales-rep/route`)
                    }
                  >
                    <CardContent className="p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{stop.shopName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{stop.district}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {stop.orderPlaced && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-emerald-300 text-emerald-700 bg-emerald-50"
                            >
                              {t('Đặt hàng', 'Ordered')}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] px-1.5 py-0', statusCfg.cls)}
                          >
                            {statusCfg.label[locale === 'vi' ? 'vi' : 'en']}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}