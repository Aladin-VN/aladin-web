'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { usePullToRefresh } from '@/lib/mobile/use-pull-to-refresh';
import { PullToRefreshIndicator } from '@/components/mobile/pull-to-refresh-indicator';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  DollarSign,
  ShoppingBag,
  Store,
  Building2,
  Clock,
  AlertTriangle,
  Users,
  BarChart3,
  Settings,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface DashboardData {
  totalRevenue: number;
  totalRevenueFormatted: string;
  totalOrders: number;
  totalShops: number;
  totalDistributors: number;
  activeBrokers: number;
  pendingOrders: number;
  overdueDebt: number;
  revenueTrend: Array<{ month: string; revenue: number; revenueFormatted: string; orders: number }>;
  topShops: Array<{ id: string; name: string; district: string; totalGmv: number; totalGmvFormatted: string; orderCount: number }>;
  pendingOrdersList: Array<{ id: string; orderNumber: string; shopName: string; totalAmount: number; totalAmountFormatted: string; createdAt: string; status: string }>;
  userDistribution: { admin: number; shopOwner: number; salesRep: number; driver: number; broker: number; distributor: number };
  lowStockProducts: Array<{ id: string; name: string; sku: string; currentStock: number; minStock: number }>;
  platformHealth: {
    ordersToday: number;
    revenueToday: number;
    revenueTodayFormatted: string;
    avgDeliveryTime: number;
    returnsRate: number;
  };
}

// ============================================
// Helpers
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function formatMonthLabel(month: string, locale: string): string {
  const [y, m] = month.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    month: 'short',
  });
}

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// Quick Actions Config
// ============================================

const QUICK_ACTIONS = [
  { key: 'shops', vi: 'Cửa hàng', en: 'Shops', icon: Store, href: '/m/admin/shops', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { key: 'orders', vi: 'Đơn hàng', en: 'Orders', icon: ShoppingBag, href: '/m/admin/orders', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  { key: 'users', vi: 'Người dùng', en: 'Users', icon: Users, href: '/m/admin/users', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400' },
  { key: 'brokers', vi: 'Đại lý', en: 'Brokers', icon: TrendingUp, href: '/m/broker', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { key: 'reports', vi: 'Báo cáo', en: 'Reports', icon: BarChart3, href: '/m/reports', color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400' },
  { key: 'settings', vi: 'Cài đặt', en: 'Settings', icon: Settings, href: '/m/settings', color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400' },
];

// ============================================
// Main Page
// ============================================

export default function AdminMobileDashboardPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setError(null);
    const res = await api.get<DashboardData>('/admin/mobile-dashboard');
    if (res.success && res.data) {
      setData(res.data);
    } else {
      setError(res.error?.message || t('Lỗi tải dữ liệu', 'Failed to load data'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const { pullDistance, isRefreshing, pullHandlers } = usePullToRefresh({
    onRefresh: async () => {
      await fetchDashboard();
    },
  });

  // ---- Compute max revenue for chart ----
  const maxRevenue = data
    ? Math.max(...data.revenueTrend.map((r) => r.revenue), 1)
    : 1;

  // ---- Today's date ----
  const todayStr = new Date().toLocaleDateString(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  );

  // ---- KPI Grid ----
  const kpiCards = data
    ? [
        { label: t('Tổng doanh thu', 'Total Revenue'), value: data.totalRevenueFormatted, icon: DollarSign, color: 'text-emerald-600' },
        { label: t('Đơn hàng', 'Orders'), value: data.totalOrders.toLocaleString(), icon: ShoppingBag, color: 'text-blue-600' },
        { label: t('Cửa hàng', 'Shops'), value: data.totalShops.toLocaleString(), icon: Store, color: 'text-purple-600' },
        { label: t('Nhà phân phối', 'Distributors'), value: data.totalDistributors.toLocaleString(), icon: Building2, color: 'text-orange-600' },
        { label: t('Chờ xử lý', 'Pending'), value: data.pendingOrders.toLocaleString(), icon: Clock, color: 'text-yellow-600' },
        { label: t('Công nợ quá hạn', 'Overdue Debt'), value: formatVND(data.overdueDebt), icon: AlertTriangle, color: 'text-red-600' },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Quản trị', 'Admin')} showNotifications={true} />

      <main
        className="px-4 pb-24 pt-2"
        {...pullHandlers}
      >
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} threshold={80} />

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-destructive/60" />
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchDashboard}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              {t('Thử lại', 'Retry')}
            </Button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && <DashboardSkeleton />}

        {/* Dashboard Content */}
        {!loading && data && (
          <div className="space-y-5">
            {/* 1. Greeting */}
            <div>
              <h2 className="text-lg font-bold">
                {t('Xin chào, Quản trị viên 👋', 'Hello, Admin 👋')}
              </h2>
              <p className="text-xs text-muted-foreground capitalize">{todayStr}</p>
            </div>

            {/* 2. KPI Grid 2×3 */}
            <div className="grid grid-cols-2 gap-3">
              {kpiCards.map((kpi) => (
                <Card key={kpi.label} className="border-border/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <kpi.icon className={cn('h-4 w-4', kpi.color)} />
                      <span className="text-[11px] text-muted-foreground leading-tight">{kpi.label}</span>
                    </div>
                    <p className="text-sm font-bold truncate">{kpi.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 3. Platform Health */}
            <section>
              <h3 className="text-sm font-semibold mb-2.5">
                {t('Sức khỏe nền tảng hôm nay', 'Platform Health Today')}
              </h3>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t('Đơn hàng hôm nay', 'Orders Today')}</p>
                      <p className="text-lg font-bold">{data.platformHealth.ordersToday}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t('Doanh thu hôm nay', 'Revenue Today')}</p>
                      <p className="text-lg font-bold">{data.platformHealth.revenueTodayFormatted}</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t('Thời gian giao TB', 'Avg Delivery Time')}</p>
                      <p className="text-lg font-bold">{data.platformHealth.avgDeliveryTime}h</p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t('Tỷ lệ hủy', 'Cancellation Rate')}</p>
                      <p className={cn('text-lg font-bold', data.platformHealth.returnsRate > 10 ? 'text-red-600' : 'text-green-600')}>
                        {data.platformHealth.returnsRate}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* 4. Revenue Trend — CSS Bar Chart */}
            {data.revenueTrend.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2.5">
                  {t('Xu hướng doanh thu', 'Revenue Trend')}
                </h3>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-end gap-2 h-40">
                      {data.revenueTrend.map((item) => {
                        const height = Math.max((item.revenue / maxRevenue) * 100, 4);
                        return (
                          <div key={item.month} className="flex-1 flex flex-col items-center gap-1.5">
                            <span className="text-[9px] text-muted-foreground font-medium whitespace-nowrap">
                              {item.revenueFormatted}
                            </span>
                            <div className="w-full flex items-end" style={{ height: '100px' }}>
                              <div
                                className="w-full rounded-t-md bg-primary/80 transition-all duration-500 min-h-[4px]"
                                style={{ height: `${height}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {formatMonthLabel(item.month, locale)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            {/* 5. Quick Actions 2×3 */}
            <section>
              <h3 className="text-sm font-semibold mb-2.5">
                {t('Truy cập nhanh', 'Quick Actions')}
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.key}
                    variant="outline"
                    className="h-auto flex-col gap-2 py-3 px-2 border-border/50"
                    onClick={() => router.push(action.href)}
                  >
                    <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', action.color)}>
                      <action.icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-[11px] font-medium leading-tight text-center">
                      {locale === 'vi' ? action.vi : action.en}
                    </span>
                  </Button>
                ))}
              </div>
            </section>

            {/* 6. Top Shops — Horizontal Scroll */}
            {data.topShops.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-sm font-semibold">
                    {t('Top cửa hàng GMV', 'Top Shops by GMV')}
                  </h3>
                  <button
                    onClick={() => router.push('/m/admin/shops')}
                    className="text-xs text-primary font-medium flex items-center gap-0.5"
                  >
                    {t('Xem tất cả', 'View all')}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
                  {data.topShops.map((shop, index) => (
                    <Card
                      key={shop.id}
                      className="shrink-0 w-52 border-border/50 cursor-pointer active:scale-[0.98] transition-transform"
                      onClick={() => router.push(`/m/admin/shops`)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                {index + 1}
                              </span>
                              <p className="text-xs font-semibold truncate">{shop.name}</p>
                            </div>
                            {shop.district && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 ml-6.5 truncate">{shop.district}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                          <div>
                            <p className="text-[10px] text-muted-foreground">{t('GMV', 'GMV')}</p>
                            <p className="text-xs font-bold text-primary">{shop.totalGmvFormatted}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground">{t('Đơn hàng', 'Orders')}</p>
                            <p className="text-xs font-semibold">{shop.orderCount}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* 7. Pending Orders needing attention */}
            {data.pendingOrdersList.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-sm font-semibold">
                    {t('Đơn hàng cần xử lý', 'Pending Orders')}
                  </h3>
                  <button
                    onClick={() => router.push('/m/admin/orders')}
                    className="text-xs text-primary font-medium flex items-center gap-0.5"
                  >
                    {t('Xem tất cả', 'View all')}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="space-y-2">
                  {data.pendingOrdersList.slice(0, 5).map((order) => (
                    <Card
                      key={order.id}
                      className="border-border/50 cursor-pointer active:scale-[0.99] transition-transform"
                      onClick={() => router.push(`/m/admin/orders`)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-muted-foreground">{order.orderNumber}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(order.createdAt, locale)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground truncate mr-2">{order.shopName}</span>
                          <span className="text-sm font-bold text-yellow-600 shrink-0">{order.totalAmountFormatted}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* 8. Low Stock Alerts */}
            {data.lowStockProducts.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold mb-2.5">
                  {t('Cảnh báo tồn kho thấp', 'Low Stock Alerts')}
                </h3>
                <div className="space-y-2">
                  {data.lowStockProducts.slice(0, 5).map((product) => (
                    <Card key={product.id} className="border-border/50">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 mr-2">
                            <p className="text-xs font-medium truncate">{product.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{product.sku}</p>
                          </div>
                          <Badge
                            variant={product.currentStock === 0 ? 'destructive' : 'secondary'}
                            className="shrink-0 text-[10px]"
                          >
                            {product.currentStock === 0
                              ? t('Hết hàng', 'Out of stock')
                              : `${product.currentStock} / ${product.minStock}`}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================
// Skeleton
// ============================================

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3.5 w-36" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>

      {/* Platform Health */}
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-40" />
        <div className="border rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue Trend */}
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-36" />
        <div className="border rounded-xl p-4">
          <div className="flex items-end gap-2 h-40">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <Skeleton className="h-3 w-12" />
                <div className="w-full flex items-end" style={{ height: '100px' }}>
                  <div
                    className="w-full bg-muted rounded-t-md animate-pulse"
                    style={{ height: `${20 + Math.random() * 70}%` }}
                  />
                </div>
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border rounded-xl py-3 px-2 flex flex-col items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>

      {/* Top Shops */}
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-32" />
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="shrink-0 w-52 border rounded-xl p-3 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
              <div className="pt-2 border-t space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}