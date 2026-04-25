'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  Truck,
  Tag,
  ChevronRight,
  RefreshCw,
  Package,
  Users,
  BarChart3,
  Camera,
  Gift,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { MobileKpiCard } from '@/components/mobile/kpi-card';
import { SparklineChart, DonutChart } from '@/components/mobile/charts';
import { AnnouncementBanner, type Announcement } from '@/components/mobile/announcement-banner';
import { PullToRefreshIndicator } from '@/components/mobile/pull-to-refresh-indicator';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';

// ============================================
// Types
// ============================================

interface DashboardStats {
  totalShops: number;
  activeShops: number;
  totalOrders: number;
  monthlyOrderCount: number;
  monthlyGmv: number;
  monthlyGmvFormatted: string;
  avgOrderValue: number;
  avgOrderValueFormatted: string;
  retentionRate: number;
  creditExposure: number;
  creditExposureFormatted: string;
  overdueAccounts: number;
  pendingShipments: number;
  activeGroupDeals: number;
  recentOrders: {
    id: string;
    orderNumber: string;
    shopName: string;
    status: string;
    paymentMethod: string;
    totalAmount: number;
    totalAmountFormatted: string;
    itemCount: number;
    createdAt: string;
  }[];
  topProducts: {
    productId: string;
    productName: string;
    productSku: string;
    totalQty: number;
    totalRevenue: number;
    totalRevenueFormatted: string;
  }[];
}

// ============================================
// Order Status Badge
// ============================================

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-indigo-100 text-indigo-700',
  PACKED: 'bg-purple-100 text-purple-700',
  OUT_FOR_DELIVERY: 'bg-cyan-100 text-cyan-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={`text-[10px] font-medium px-1.5 py-0 ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}
    >
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

// ============================================
// Quick Action Button
// ============================================

function QuickAction({
  icon,
  label,
  labelVi,
  href,
  locale,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  labelVi: string;
  href: string;
  locale: string;
  badge?: number;
}) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-muted/50 active:scale-95 transition-all relative"
    >
      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        {icon}
      </div>
      <span className="text-[11px] font-medium text-center leading-tight">
        {locale === 'vi' ? labelVi : label}
      </span>
      {badge !== undefined && badge > 0 && (
        <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center bg-destructive text-destructive-foreground rounded-full">
          {badge}
        </Badge>
      )}
    </button>
  );
}

// ============================================
// Pull-to-Refresh State
// ============================================

function useSimplePullToRefresh(onRefresh: () => Promise<void>) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const THRESHOLD = 70;

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isRefreshing) return;
    const el = scrollRef.current;
    if (!el || el.scrollTop > 5) return;

    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0) {
      const distance = Math.min(delta * 0.4, THRESHOLD * 1.3);
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(0);
      try { await onRefresh(); } catch {}
      setIsRefreshing(false);
    } else {
      setPullDistance(0);
    }
  };

  return {
    pullDistance,
    isRefreshing,
    THRESHOLD,
    scrollRef,
    pullHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

// ============================================
// Dashboard Home Page
// ============================================

export default function MobileDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());
  const lastRefreshRef = useRef<string>('');

  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const json = await api.get<DashboardStats>('/dashboard/stats');
      if (json.success && json.data) {
        setStats(json.data);
        lastRefreshRef.current = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const { pullDistance, isRefreshing, THRESHOLD, scrollRef, pullHandlers } = useSimplePullToRefresh(fetchStats);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('Chào buổi sáng', 'Good morning');
    if (hour < 18) return t('Chào buổi chiều', 'Good afternoon');
    return t('Chào buổi tối', 'Good evening');
  };

  // Sample announcements
  const announcements: Announcement[] = [
    {
      id: 'ann-1',
      title: 'Flash Sale: -15% all beverages',
      titleVi: 'Flash Sale: Giảm 15% tất cả đồ uống',
      body: 'Valid until end of month. Min order 500K VND.',
      bodyVi: 'Áp dụng đến cuối tháng. Đơn tối thiểu 500K.',
      type: 'promotion',
      actionLabel: 'Browse products',
      actionLabelVi: 'Xem sản phẩm',
      actionHref: '/m/products',
      dismissible: true,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    },
  ];

  const visibleAnnouncements = announcements.filter((a) => !dismissedAnnouncements.has(a.id));

  // Simulated sparkline data (in real app, would come from API)
  const revenueSparkline = [12, 18, 15, 22, 19, 28, 25, 32, 29, 35, 38, 42];
  const orderSparkline = [5, 8, 6, 10, 9, 12, 11, 15, 14, 18, 16, 20];

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title="ALADIN" showNotifications />

      <main
        ref={scrollRef}
        className="px-4 pb-4 space-y-5 overflow-y-auto"
        style={{ minHeight: 'calc(100vh - 56px - 64px)' }}
        {...pullHandlers}
      >
        {/* Pull to refresh indicator */}
        <div style={{ height: pullDistance, overflow: 'hidden' }}>
          <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} threshold={THRESHOLD} />
        </div>

        {/* Greeting banner */}
        <div className="flex items-center justify-between pt-2">
          <div>
            <p className="text-sm text-muted-foreground">{getGreeting()}</p>
            <h2 className="text-xl font-bold mt-0.5">
              {user?.name || t('Chào bạn', 'Hello')}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            {lastRefreshRef.current && !loading && (
              <span className="text-[10px] text-muted-foreground">{lastRefreshRef.current}</span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={fetchStats}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading || isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Announcements */}
        {visibleAnnouncements.length > 0 && (
          <AnnouncementBanner
            announcements={visibleAnnouncements}
            onDismiss={(id) => setDismissedAnnouncements((prev) => new Set(prev).add(id))}
          />
        )}

        {/* KPI Grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-3">
            <MobileKpiCard
              label="Monthly GMV"
              labelVi="GMV tháng này"
              value={stats.monthlyGmvFormatted}
              icon={<DollarSign className="h-4 w-4" />}
              trend={12.5}
              trendLabel={t('vs LM', 'vs LM')}
              variant="success"
              locale={locale}
            />
            <MobileKpiCard
              label="Total Orders"
              labelVi="Đơn hàng"
              value={stats.monthlyOrderCount.toLocaleString()}
              icon={<ShoppingCart className="h-4 w-4" />}
              trend={8.3}
              trendLabel={t('vs LM', 'vs LM')}
              locale={locale}
            />
            <MobileKpiCard
              label="Avg Order"
              labelVi="TB đơn hàng"
              value={stats.avgOrderValueFormatted}
              icon={<TrendingUp className="h-4 w-4" />}
              locale={locale}
            />
            <MobileKpiCard
              label="Overdue"
              labelVi="Quá hạn"
              value={stats.overdueAccounts}
              icon={<AlertTriangle className="h-4 w-4" />}
              variant={stats.overdueAccounts > 0 ? 'danger' : 'default'}
              locale={locale}
            />
          </div>
        ) : null}

        {/* Revenue & Order Trends Chart */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                {t('Xu hướng', 'Trends')}
              </CardTitle>
              <div className="flex gap-3">
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">{t('Doanh thu', 'Revenue')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] text-muted-foreground">{t('Đơn hàng', 'Orders')}</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <SparklineChart
                  data={revenueSparkline}
                  color="#10b981"
                  fillColor="#10b981"
                  width={140}
                  height={48}
                  showDots
                />
                <p className="text-[10px] text-muted-foreground mt-1">{t('Doanh thu (tr triệu)', 'Revenue (M VND)')}</p>
              </div>
              <div className="flex-1">
                <SparklineChart
                  data={orderSparkline}
                  color="#3b82f6"
                  fillColor="#3b82f6"
                  width={140}
                  height={48}
                  showDots
                />
                <p className="text-[10px] text-muted-foreground mt-1">{t('Số đơn hàng', 'Order count')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold mb-3">{t('Lối tắt', 'Quick Actions')}</h3>
          <div className="grid grid-cols-4 gap-2">
            <QuickAction
              icon={<Package className="h-5 w-5" />}
              label="Products"
              labelVi="Sản phẩm"
              href="/m/products"
              locale={locale}
            />
            <QuickAction
              icon={<ShoppingCart className="h-5 w-5" />}
              label="Orders"
              labelVi="Đơn hàng"
              href="/m/orders"
              locale={locale}
              badge={stats?.pendingShipments}
            />
            <QuickAction
              icon={<CreditCard className="h-5 w-5" />}
              label="Credit"
              labelVi="Công nợ"
              href="/m/credit"
              locale={locale}
              badge={stats?.overdueAccounts}
            />
            <QuickAction
              icon={<Tag className="h-5 w-5" />}
              label="Group Buy"
              labelVi="Mua chung"
              href="/m/group-buy"
              locale={locale}
              badge={stats?.activeGroupDeals}
            />
            <QuickAction
              icon={<Gift className="h-5 w-5" />}
              label="Promos"
              labelVi="Khuyến mãi"
              href="/m/promotions"
              locale={locale}
            />
            <QuickAction
              icon={<Camera className="h-5 w-5" />}
              label="Shelf Audit"
              labelVi="Trung bay"
              href="/m/merchandising"
              locale={locale}
            />
            <QuickAction
              icon={<Truck className="h-5 w-5" />}
              label="Shipments"
              labelVi="Vận chuyển"
              href="/m/shipments"
              locale={locale}
              badge={stats?.pendingShipments}
            />
            <QuickAction
              icon={<Store className="h-5 w-5" />}
              label="My Shop"
              labelVi="Cửa hàng"
              href="/m/shop"
              locale={locale}
            />
          </div>
        </div>

        <Separator />

        {/* Shop Profile Quick Access */}
        {user?.shopId && (
          <Card
            className="cursor-pointer active:scale-[0.99] transition-transform"
            onClick={() => router.push('/m/shop')}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Store className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{user?.shop?.name || t('My Shop', 'Cửa hàng của tôi')}</p>
                  <p className="text-xs text-muted-foreground">
                    {user?.shop?.district ? `${user.shop.district}, ` : ''}{user?.shop?.province}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {user?.shop?.loyaltyTier}
                </Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Credit Snapshot */}
        {user?.shop && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {t('Tín dụng', 'Credit')}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => router.push('/m/credit')}
                >
                  {t('Chi tiết', 'Details')}
                  <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11px] text-muted-foreground">{t('Hạn mức', 'Limit')}</p>
                  <p className="text-lg font-bold">
                    {user.shop.creditLimit ? Number(user.shop.creditLimit).toLocaleString() : '1.000.000'} ₫
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">{t('Đã sử dụng', 'Used')}</p>
                  <p className="text-lg font-bold text-amber-600">
                    {user.shop.creditBalance ? Number(user.shop.creditBalance).toLocaleString() : '0'} ₫
                  </p>
                </div>
              </div>
              <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      ((Number(user.shop?.creditBalance) || 0) / (Number(user.shop?.creditLimit) || 1000000)) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Group Deals */}
        {stats && stats.activeGroupDeals > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {t('Deal mua chung', 'Group Deals')}
                </CardTitle>
                <Badge variant="secondary" className="font-mono text-xs">
                  {stats.activeGroupDeals}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Button
                variant="outline"
                className="w-full h-10"
                onClick={() => router.push('/m/group-buy')}
              >
                <Tag className="mr-2 h-4 w-4" />
                {t('Xem deal đang mở', 'View active deals')}
                <ChevronRight className="ml-auto h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pending Shipments */}
        {stats && stats.pendingShipments > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {t('Vận chuyển', 'Shipments')}
                </CardTitle>
                <Badge variant="secondary" className="font-mono text-xs">
                  {stats.pendingShipments}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Button
                variant="outline"
                className="w-full h-10"
                onClick={() => router.push('/m/shipments')}
              >
                <Truck className="mr-2 h-4 w-4" />
                {t('Theo dõi vận chuyển', 'Track shipments')}
                <ChevronRight className="ml-auto h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Top Products with Donut */}
        {stats && stats.topProducts && stats.topProducts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                {t('Sản phẩm bán chạy', 'Top Products')}
              </h3>
              <Badge variant="outline" className="font-mono text-xs">
                {stats.topProducts.length}
              </Badge>
            </div>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Mini donut */}
                  <div className="shrink-0">
                    <DonutChart
                      segments={stats.topProducts.slice(0, 5).map((p, i) => ({
                        label: p.productName,
                        value: p.totalRevenue,
                        color: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444'][i],
                      }))}
                      size={70}
                      strokeWidth={10}
                    />
                  </div>
                  {/* Product list */}
                  <div className="flex-1 space-y-2.5 min-w-0">
                    {stats.topProducts.slice(0, 5).map((product, index) => (
                      <div key={product.productId} className="flex items-center gap-2">
                        <div className={`h-5 w-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${
                          index === 0 ? 'bg-amber-100 text-amber-700' :
                          index === 1 ? 'bg-gray-100 text-gray-600' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{product.productName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {product.totalQty.toLocaleString()} {t('SP', 'units')}
                          </p>
                        </div>
                        <p className="text-xs font-semibold shrink-0">{product.totalRevenueFormatted}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Orders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">
              {t('Đơn hàng gần đây', 'Recent Orders')}
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => router.push('/m/orders')}
            >
              {t('Tất cả', 'All')}
              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : stats && stats.recentOrders.length > 0 ? (
            <div className="space-y-2">
              {stats.recentOrders.slice(0, 5).map((order) => (
                <Card
                  key={order.id}
                  className="cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => router.push(`/m/orders?id=${order.id}`)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-medium">
                            {order.orderNumber}
                          </span>
                          <StatusBadge status={order.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {order.shopName} · {order.itemCount} {t('SP', 'items')}
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-sm font-semibold">{order.totalAmountFormatted}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  {t('Chưa có đơn hàng', 'No orders yet')}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
