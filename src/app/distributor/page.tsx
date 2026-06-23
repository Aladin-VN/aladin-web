'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAuth, useLocale } from '@/providers/app-provider';
import {
  ShoppingCart,
  DollarSign,
  Wallet,
  AlertTriangle,
  Package,
  CheckCircle,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  Clock,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  CreditCard,
  Truck,
  BoxesIcon,
  CircleDollarSign,
  Store,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// ============================================
// Types
// ============================================

interface DashboardData {
  pendingOrders: number;
  todayOrders: number;
  todayRevenue: number;
  todayNetPayout: number;
  platformFeeToday: number;
  pendingPayout: number;
  totalPayouts: number;
  lowStockCount: number;
  totalProducts: number;
  weekFulfilled: number;
  commissionRate: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  shopName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

interface AnalyticsData {
  salesTrend: { date: string; revenue: number; orders: number }[];
  orderStatusDistribution: { status: string; count: number }[];
  topProducts: {
    productId: string;
    productName: string;
    sku: string;
    totalQty: number;
    totalRevenue: number;
  }[];
  topShops: {
    shopId: string;
    shopName: string;
    orderCount: number;
    totalRevenue: number;
  }[];
  categoryBreakdown: { category: string; revenue: number; qty: number }[];
  comparison: {
    thisWeek: { revenue: number; orders: number };
    lastWeek: { revenue: number; orders: number };
  };
}

// ============================================
// Status Helpers
// ============================================

const STATUS_VARIANT: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PROCESSING: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  PACKED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  OUT_FOR_DELIVERY: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  DELIVERED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  REFUNDED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const STATUS_LABEL_VI: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  PACKED: 'Đã đóng gói',
  OUT_FOR_DELIVERY: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn',
};

function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="secondary"
      className={`text-[10px] font-medium px-2 py-0.5 ${STATUS_VARIANT[status] || 'bg-gray-100 text-gray-700'}`}
    >
      {STATUS_LABEL_VI[status] || status.replace(/_/g, ' ')}
    </Badge>
  );
}

// ============================================
// Pie Chart Colors
// ============================================

const PIE_COLORS: Record<string, string> = {
  PENDING: '#EAB308',
  CONFIRMED: '#3B82F6',
  PROCESSING: '#A855F7',
  PACKED: '#F59E0B',
  OUT_FOR_DELIVERY: '#06B6D4',
  DELIVERED: '#22C55E',
  CANCELLED: '#EF4444',
  REFUNDED: '#6B7280',
};

// ============================================
// Custom Tooltip for Charts
// ============================================

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-3 shadow-xl">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-sm font-bold text-foreground mt-1">{formatVND(payload[0].value)}</p>
    </div>
  );
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { count: number; total: number } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  const pct = d.payload.total > 0 ? ((d.value / d.payload.total) * 100).toFixed(1) : '0';
  return (
    <div className="rounded-lg border bg-background p-3 shadow-xl">
      <p className="text-xs font-medium">{STATUS_LABEL_VI[d.name] || d.name}</p>
      <p className="text-sm font-bold mt-1">{d.value} đơn ({pct}%)</p>
    </div>
  );
}

// ============================================
// KPI Card — matches admin style with accent line
// ============================================

function KpiCard({
  title,
  titleVi,
  value,
  subtitle,
  icon,
  accent = 'yellow',
  locale,
}: {
  title: string;
  titleVi: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accent?: 'yellow' | 'red' | 'green' | 'neutral';
  locale: string;
}) {
  const label = locale === 'vi' ? titleVi : title;

  const accentTop =
    accent === 'yellow' ? 'border-t-yellow-500' :
    accent === 'red' ? 'border-t-red-600' :
    accent === 'green' ? 'border-t-green-500' :
    'border-t-gray-300';

  const iconBg =
    accent === 'yellow' ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-400' :
    accent === 'red' ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400' :
    accent === 'green' ? 'bg-green-100 text-green-600 dark:bg-green-950/50 dark:text-green-400' :
    'bg-gray-100 text-gray-500';

  const cardHover =
    accent === 'yellow' ? 'hover:border-yellow-300' :
    accent === 'red' ? 'hover:border-red-300' :
    accent === 'green' ? 'hover:border-green-300' :
    'hover:border-gray-300';

  return (
    <Card className={`border-t-[3px] ${accentTop} ${cardHover} transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-sm ${iconBg}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="text-2xl font-extrabold tracking-tight">{value}</div>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Skeleton Loaders
// ============================================

function KpiGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border-t-[3px] border-t-gray-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </CardHeader>
          <CardContent className="pb-3">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-16 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-64 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

// ============================================
// Growth Indicator
// ============================================

function GrowthIndicator({ thisVal, lastVal, locale }: { thisVal: number; lastVal: number; locale: string }) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  if (lastVal === 0) return null;
  const pct = ((thisVal - lastVal) / lastVal) * 100;
  const isUp = pct >= 0;
  return (
    <div className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
      isUp
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }`}>
      {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(pct).toFixed(1)}%
      <span className="font-normal text-muted-foreground ml-0.5">{t('vs tuần trước', 'vs last week')}</span>
    </div>
  );
}

// ============================================
// Main Distributor Dashboard Page
// ============================================

export default function DistributorDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [data, setData] = useState<DashboardData | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/distributor/dashboard');
      if (res.success) setData(res.data);
    } catch {}
    try {
      const res = await adminFetch('/api/distributor/orders?limit=5');
      if (res.success) setRecentOrders(res.data.items || []);
    } catch {}
    try {
      const res = await adminFetch('/api/distributor/analytics');
      if (res.success) setAnalytics(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // ----- Derived data -----

  // Revenue trend: last 14 days
  const revenueTrendData = analytics?.salesTrend
    ? analytics.salesTrend.slice(-14).map((d) => {
        const date = new Date(d.date);
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return { date: `${dd}/${mm}`, revenue: d.revenue, orders: d.orders };
      })
    : [];

  // Order pipeline for donut
  const orderPipelineData = analytics?.orderStatusDistribution
    ? analytics.orderStatusDistribution.map((d) => ({
        name: d.status,
        value: d.count,
        count: d.count,
        total: analytics.orderStatusDistribution.reduce((s, x) => s + x.count, 0),
      }))
    : [];

  // Top 5 products for horizontal bar
  const topProductsData = analytics?.topProducts
    ? analytics.topProducts.slice(0, 5).map((p, i) => ({
        name: p.productName.length > 20 ? p.productName.slice(0, 20) + '…' : p.productName,
        fullName: p.productName,
        revenue: p.totalRevenue,
        qty: p.totalQty,
        rank: i + 1,
      }))
    : [];

  // Comparison growth
  const comp = analytics?.comparison;

  return (
    <>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />

        <main className="flex-1 p-4 md:p-6 space-y-6">

          {/* ===== Page Header ===== */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-600/20">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                  {t('Xin chào', 'Hello')}, {user?.name?.split(' ').pop()}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t('Bảng điều khiển kho hàng', 'Distributor Warehouse Dashboard')}
                  {user?.distributor && (
                    <span className="ml-1.5 font-medium text-foreground/70">— {user.distributor.name}</span>
                  )}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchDashboard}
              disabled={loading}
              className="w-fit gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700 font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {t('Làm mới', 'Refresh')}
            </Button>
          </div>

          {/* ===== Commission Rate Banner + Week-over-Week Growth ===== */}
          {!loading && data && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Commission Banner */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 dark:from-yellow-900/20 dark:to-amber-900/20 dark:border-yellow-800/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center shadow-sm">
                    <Percent className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">
                      {t('Tỷ lệ hoa hồng', 'Commission Rate')}
                    </p>
                    <p className="text-xl font-extrabold text-yellow-700 dark:text-yellow-400">
                      {(data.commissionRate * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('Thu nhập ròng hôm nay', 'Today Net Payout')}</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatVND(data.todayNetPayout)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('Phí nền tảng hôm nay', 'Platform Fee Today')}</p>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">{formatVND(data.platformFeeToday)}</p>
                  </div>
                </div>
              </div>

              {/* Week-over-Week Growth */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 dark:from-green-900/20 dark:to-emerald-900/20 dark:border-green-800/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center shadow-sm">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">
                      {t('So sánh tuần này', 'Week-over-Week Comparison')}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {comp && (
                        <>
                          <GrowthIndicator thisVal={comp.thisWeek.revenue} lastVal={comp.lastWeek.revenue} locale={locale} />
                          <span className="text-xs text-muted-foreground">·</span>
                          <GrowthIndicator thisVal={comp.thisWeek.orders} lastVal={comp.lastWeek.orders} locale={locale} />
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('Doanh thu tuần này', 'This Week Revenue')}</p>
                    <p className="text-lg font-bold text-green-700 dark:text-green-400">
                      {comp ? formatVND(comp.thisWeek.revenue) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">{t('Đơn hàng tuần này', 'This Week Orders')}</p>
                    <p className="text-sm font-semibold">{comp ? comp.thisWeek.orders : '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== KPI Grid ===== */}
          {loading ? (
            <KpiGridSkeleton />
          ) : data ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
              <KpiCard
                title="Pending Orders"
                titleVi="Đơn chờ xử lý"
                value={data.pendingOrders}
                subtitle={`${data.todayOrders} ${t('đơn hôm nay', 'today')}`}
                icon={<Clock className="h-4 w-4" />}
                accent="yellow"
                locale={locale}
              />
              <KpiCard
                title="Today Revenue"
                titleVi="Doanh thu hôm nay"
                value={formatVND(data.todayRevenue)}
                icon={<DollarSign className="h-4 w-4" />}
                accent="red"
                locale={locale}
              />
              <KpiCard
                title="Today Net Payout"
                titleVi="Thu nhập ròng hôm nay"
                value={formatVND(data.todayNetPayout)}
                subtitle={`${t('Phí', 'Fee')}: ${formatVND(data.platformFeeToday)}`}
                icon={<CircleDollarSign className="h-4 w-4" />}
                accent="green"
                locale={locale}
              />
              <KpiCard
                title="Pending Payout"
                titleVi="Thanh toán chờ"
                value={formatVND(data.pendingPayout)}
                subtitle={`${t('Đã nhận', 'Received')}: ${formatVND(data.totalPayouts)}`}
                icon={<Wallet className="h-4 w-4" />}
                accent="yellow"
                locale={locale}
              />
              <KpiCard
                title="Low Stock Alerts"
                titleVi="Cảnh báo tồn kho"
                value={data.lowStockCount}
                subtitle={`${data.totalProducts} ${t('tổng SP', 'products')}`}
                icon={<AlertTriangle className="h-4 w-4" />}
                accent={data.lowStockCount > 0 ? 'red' : 'green'}
                locale={locale}
              />
              <KpiCard
                title="Week Fulfilled"
                titleVi="Hoàn thành tuần này"
                value={data.weekFulfilled}
                icon={<CheckCircle className="h-4 w-4" />}
                accent="green"
                locale={locale}
              />
            </div>
          ) : null}

          {/* ===== Quick Actions ===== */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              className="gap-2 border-yellow-200 hover:bg-yellow-50 hover:border-yellow-300"
              onClick={() => router.push('/distributor/orders')}
            >
              <ShoppingCart className="h-4 w-4 text-yellow-600" />
              {t('Quản lý đơn hàng', 'Manage Orders')}
              {data?.pendingOrders ? (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-[10px] px-1">{data.pendingOrders}</Badge>
              ) : null}
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-purple-200 hover:bg-purple-50 hover:border-purple-300"
              onClick={() => router.push('/distributor/inventory')}
            >
              <Package className="h-4 w-4 text-purple-600" />
              {t('Kiểm tra kho', 'Check Inventory')}
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-blue-200 hover:bg-blue-50 hover:border-blue-300"
              onClick={() => router.push('/distributor/settlements')}
            >
              <Wallet className="h-4 w-4 text-blue-600" />
              {t('Quyết toán', 'Settlements')}
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-green-200 hover:bg-green-50 hover:border-green-300"
              onClick={() => router.push('/distributor/products')}
            >
              <BoxesIcon className="h-4 w-4 text-green-600" />
              {t('Quản lý sản phẩm', 'Manage Products')}
            </Button>
          </div>

          <Separator />

          {/* ===== Charts Section ===== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue Trend — Bar Chart (last 14 days) */}
            {loading ? (
              <ChartSkeleton />
            ) : (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 text-yellow-800 flex items-center justify-center shadow-md shadow-yellow-500/20">
                        <BarChart3 className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold">
                          {t('Xu hướng doanh thu', 'Revenue Trend')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {t('Doanh thu 14 ngày gần nhất', 'Daily revenue — last 14 days')}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs border-yellow-300 text-yellow-700">
                      14 {t('ngày', 'days')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {revenueTrendData.length > 0 ? (
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            className="text-muted-foreground"
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            className="text-muted-foreground"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: number) => {
                              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}tr`;
                              if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                              return String(v);
                            }}
                          />
                          <Tooltip content={<RevenueTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)' }} />
                          <Bar
                            dataKey="revenue"
                            fill="#EAB308"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-72 flex items-center justify-center text-sm text-muted-foreground">
                      {t('Chưa có dữ liệu doanh thu', 'No revenue data yet')}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Order Status Donut */}
            {loading ? (
              <ChartSkeleton />
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-md shadow-red-500/20">
                        <Truck className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold">
                          {t('Trạng thái đơn hàng', 'Order Pipeline')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {t('Phân bổ theo trạng thái', 'Distribution by status')}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs border-red-200 text-red-600">
                      {orderPipelineData.reduce((s, d) => s + d.count, 0)} {t('đơn', 'orders')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {orderPipelineData.length > 0 ? (
                    <div className="flex items-center gap-4">
                      <div className="h-56 w-56 shrink-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={orderPipelineData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={85}
                              paddingAngle={3}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              {orderPipelineData.map((entry) => (
                                <Cell key={entry.name} fill={PIE_COLORS[entry.name] || '#9CA3AF'} />
                              ))}
                            </Pie>
                            <Tooltip content={<PieTooltip />} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-2">
                        {orderPipelineData.map((entry) => (
                          <div key={entry.name} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="h-3 w-3 rounded-full shrink-0 ring-1 ring-inset ring-black/10"
                                style={{ backgroundColor: PIE_COLORS[entry.name] || '#9CA3AF' }}
                              />
                              <span className="text-xs text-muted-foreground truncate">
                                {STATUS_LABEL_VI[entry.name] || entry.name.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-foreground tabular-nums shrink-0">{entry.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                      {t('Chưa có dữ liệu', 'No data yet')}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Top Products Horizontal Bar */}
            {loading ? (
              <ChartSkeleton />
            ) : (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 text-yellow-800 flex items-center justify-center shadow-md shadow-yellow-500/20">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold">
                          {t('Sản phẩm bán chạy', 'Top Products')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {t('Top 5 theo doanh thu', 'Top 5 by revenue')}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs border-yellow-300 text-yellow-700">
                      {topProductsData.length} SP
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {topProductsData.length > 0 ? (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={topProductsData}
                          layout="vertical"
                          margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: number) => {
                              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}tr`;
                              if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                              return String(v);
                            }}
                          />
                          <YAxis
                            dataKey="name"
                            type="category"
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            width={120}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="rounded-lg border bg-background p-3 shadow-xl">
                                  <p className="text-xs font-medium">{d.fullName}</p>
                                  <p className="text-sm font-bold mt-1">{formatVND(d.revenue)}</p>
                                  <p className="text-[10px] text-muted-foreground">{d.qty} {t('đơn vị', 'units')}</p>
                                </div>
                              );
                            }}
                          />
                          <Bar
                            dataKey="revenue"
                            fill="#DC2626"
                            radius={[0, 4, 4, 0]}
                            maxBarSize={24}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
                      {t('Chưa có dữ liệu sản phẩm', 'No product data yet')}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          {/* ===== Recent Orders Table ===== */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-md shadow-red-500/20">
                    <ShoppingCart className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold">
                      {t('Đơn hàng gần đây', 'Recent Orders')}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {t('5 đơn hàng mới nhất', 'Latest 5 orders')}
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => router.push('/distributor/orders')}
                >
                  {t('Xem tất cả', 'View All')}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-lg" />
                  ))}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('Chưa có đơn hàng nào', 'No orders yet')}</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t('Mã đơn', 'Order #')}</TableHead>
                        <TableHead className="text-xs">{t('Cửa hàng', 'Shop')}</TableHead>
                        <TableHead className="text-xs">{t('Trạng thái', 'Status')}</TableHead>
                        <TableHead className="text-xs text-right">{t('Tổng tiền', 'Total')}</TableHead>
                        <TableHead className="text-xs text-right">{t('Ngày tạo', 'Date')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentOrders.map((order) => (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => router.push(`/distributor/orders/${order.id}`)}
                        >
                          <TableCell className="font-mono text-xs font-medium">{order.orderNumber}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-1.5">
                              <Store className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="truncate max-w-[140px]">{order.shopName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <OrderStatusBadge status={order.status} />
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold">{formatVND(order.totalAmount)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

        </main>
      </SidebarInset>
    </>
  );
}