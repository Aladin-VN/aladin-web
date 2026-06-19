'use client';

import { adminFetch } from '@/lib/admin-fetch';
import { useLocale, useAuth } from '@/providers/app-provider';
import { AuthGuard } from '@/components/auth/auth-guard';

import { useState, useEffect, useCallback } from 'react';
import {
  Store,
  ShoppingCart,
  CreditCard,
  AlertTriangle,
  Truck,
  Tag,
  Package,
  BarChart3,
  DollarSign,
  Users,
  ShieldCheck,
  Clock,
  Lock,
  TrendingUp,
  CheckCircle2,
  Boxes,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { SidebarInset } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { formatVND, ROLES } from '@/lib/security';
import { BarChart, HBarChart, DistributionChart } from '@/components/reports/charts';

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
  totalProducts: number;
  deliveredOrders: number;
  deliveredGmv: number;
  deliveredGmvFormatted: string;
  pipeline: { status: string; count: number }[];
  monthlyTrend: { month: string; orders: number; gmv: number }[];
  paymentBreakdown: {
    CREDIT?: { count: number; revenue: number; revenueFormatted: string };
    DIGITAL?: { count: number; revenue: number; revenueFormatted: string };
    COD?: { count: number; revenue: number; revenueFormatted: string };
  };
  topShops: {
    shopId: string;
    shopName: string;
    orderCount: number;
    totalRevenue: number;
    totalRevenueFormatted: string;
  }[];
  topCategories: {
    name: string;
    revenue: number;
    revenueFormatted: string;
    qty: number;
  }[];
  recentOrders: {
    id: string;
    orderNumber: string;
    shopName: string;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
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
// KPI Card — compact, with accent line
// ============================================

function KpiCard({
  title,
  titleVi,
  value,
  formattedValue,
  icon,
  subtitle,
  isSensitive = false,
  accent = 'yellow',
  locale,
}: {
  title: string;
  titleVi: string;
  value: string | number;
  formattedValue?: string;
  icon: React.ReactNode;
  subtitle?: string;
  isSensitive?: boolean;
  accent?: 'yellow' | 'red' | 'green' | 'neutral';
  locale: string;
}) {
  const t = locale === 'vi' ? titleVi : title;

  const accentTop = accent === 'yellow'
    ? 'border-t-yellow-400'
    : accent === 'red'
      ? 'border-t-red-500'
      : accent === 'green'
        ? 'border-t-green-500'
        : 'border-t-muted';

  const iconBg = accent === 'yellow'
    ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-400'
    : accent === 'red'
      ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
      : accent === 'green'
        ? 'bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400'
        : 'bg-muted text-muted-foreground';

  return (
    <Card className={`border-t-2 ${accentTop} hover:shadow-md transition-shadow`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t}</CardTitle>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="text-2xl font-bold tracking-tight">
          {isSensitive ? (
            <SensitiveValue value={String(formattedValue || value)} maskType="amount" formatOptions={{ formatCurrency: true }} />
          ) : (
            formattedValue || value
          )}
        </div>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// Pipeline Bar Component
// ============================================

const PIPELINE_STAGES = [
  { key: 'pending', label: 'Pending', labelVi: 'Cho XL', color: 'bg-gray-200 dark:bg-gray-700', textColor: 'text-gray-700 dark:text-gray-300', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', labelVi: 'Da XL', color: 'bg-blue-100 dark:bg-blue-900/50', textColor: 'text-blue-700 dark:text-blue-300', icon: ShieldCheck },
  { key: 'processing', label: 'Processing', labelVi: 'Dang XL', color: 'bg-purple-100 dark:bg-purple-900/50', textColor: 'text-purple-700 dark:text-purple-300', icon: Package },
  { key: 'packed', label: 'Packed', labelVi: 'Dong goi', color: 'bg-amber-100 dark:bg-amber-900/50', textColor: 'text-amber-700 dark:text-amber-300', icon: Package },
  { key: 'outForDelivery', label: 'Out for Delivery', labelVi: 'Dang giao', color: 'bg-yellow-100 dark:bg-yellow-900/50', textColor: 'text-yellow-700 dark:text-yellow-300', icon: Truck },
  { key: 'delivered', label: 'Delivered', labelVi: 'Da giao', color: 'bg-green-100 dark:bg-green-900/50', textColor: 'text-green-700 dark:text-green-300', icon: CheckCircle2 },
];

function PipelineBar({ stats, locale }: { stats: DashboardStats; locale: string }) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const pipeline = stats.pipeline || [];
  const total = pipeline.reduce((sum, s) => sum + s.count, 0) || 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 flex items-center justify-center">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">
                {t('Order Pipeline', 'Luong Don hang')}
              </CardTitle>
              <CardDescription className="text-xs">
                {t('Fulfillment pipeline — orders by status', 'Luong thuc thi — don hang theo trang thai')}
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-red-600 hover:bg-red-700 text-white font-mono text-xs">
            {stats.monthlyOrderCount ?? 0} {t('orders', 'don')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Visual Pipeline Bar */}
        <div className="flex h-10 rounded-lg overflow-hidden border">
          {pipeline.map((stage, i) => {
            const widthPct = Math.max((stage.count / total) * 100, stage.count > 0 ? 3 : 0);
            const stageConfig = PIPELINE_STAGES[i] || PIPELINE_STAGES[0];
            return (
              <div
                key={stage.status}
                className="relative flex items-center justify-center transition-all duration-500 group cursor-default"
                style={{ width: `${widthPct}%` }}
                title={`${stage.status.replace(/_/g, ' ')}: ${stage.count}`}
              >
                <div className={`absolute inset-0 ${stageConfig.color}`} />
                {stage.count > 0 && (
                  <span className={`relative text-[11px] font-bold ${stageConfig.textColor}`}>
                    {stage.count}
                  </span>
                )}
                {i < pipeline.length - 1 && widthPct > 0 && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[4px] border-l-white dark:border-l-gray-900 border-y-[5px] border-y-transparent z-10" />
                )}
              </div>
            );
          })}
        </div>

        {/* Stage Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {pipeline.map((stage, i) => {
            const stageConfig = PIPELINE_STAGES[i] || PIPELINE_STAGES[0];
            const Icon = stageConfig.icon;
            return (
              <div key={stage.status} className="flex items-center gap-1.5">
                <div className={`h-2.5 w-2.5 rounded-full ${stageConfig.color} ring-1 ring-inset ring-black/10`} />
                <Icon className={`h-3 w-3 ${stageConfig.textColor}`} />
                <span className="text-xs text-muted-foreground">
                  {locale === 'vi' ? stageConfig.labelVi : stageConfig.label}
                </span>
                <span className="text-xs font-bold text-foreground">{stage.count}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Status & Payment Badges
// ============================================

function OrderStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
    CONFIRMED: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    PROCESSING: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
    PACKED: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
    OUT_FOR_DELIVERY: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100',
    DELIVERED: 'bg-green-100 text-green-700 hover:bg-green-100',
    CANCELLED: 'bg-red-100 text-red-700 hover:bg-red-100',
    REFUNDED: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  };

  return (
    <Badge variant="secondary" className={`text-[10px] font-medium px-2 py-0.5 ${variants[status] || ''}`}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

function PaymentMethodBadge({ method }: { method: string }) {
  const labels: Record<string, string> = {
    CREDIT: 'Credit',
    DIGITAL: 'Digital',
    COD: 'COD',
  };
  return <span className="text-xs text-muted-foreground">{labels[method] || method}</span>;
}

// ============================================
// Skeleton Loaders
// ============================================

function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="border-t-2 border-t-muted">
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
        <Skeleton className="h-48 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

// ============================================
// Main Dashboard Page
// ============================================

export default function DashboardPage() {
  const { locale } = useLocale();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const userRole = user?.role || 'SHOP_OWNER';

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminFetch('/api/dashboard/stats');
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Role-specific dashboard title
  const getGreeting = () => {
    switch (userRole) {
      case ROLES.ADMIN: return t('Dashboard Overview', 'Tong quan');
      case ROLES.SHOP_OWNER: return t('My Shop Dashboard', 'Tong quan cua hang');
      case ROLES.SALES_REP: return t('Sales Dashboard', 'Tong quan ban hang');
      case ROLES.DRIVER: return t('Delivery Dashboard', 'Tong quan giao hang');
      case ROLES.BROKER: return t('Broker Dashboard', 'Tong quan dai ly');
      default: return t('Dashboard', 'Tong quan');
    }
  };

  // ---- Derived data for charts ----

  // Monthly trend chart data (GMV bars)
  const trendChartData = stats?.monthlyTrend?.map((m) => ({
    label: m.month,
    value: m.gmv,
    color: 'bg-yellow-400 dark:bg-yellow-500',
  })) || [];

  // Monthly trend orders overlay
  const trendOrdersData = stats?.monthlyTrend?.map((m) => ({
    label: m.month,
    value: m.orders,
    color: 'bg-red-400 dark:bg-red-500',
  })) || [];

  // Payment breakdown distribution chart
  const paymentChartData = stats?.paymentBreakdown
    ? [
        ...(stats.paymentBreakdown.CREDIT ? [{ label: 'Credit', labelVi: 'Cong no', value: stats.paymentBreakdown.CREDIT.revenue, color: 'bg-red-500' }] : []),
        ...(stats.paymentBreakdown.DIGITAL ? [{ label: 'Digital', labelVi: 'Chuyen khoan', value: stats.paymentBreakdown.DIGITAL.revenue, color: 'bg-yellow-400' }] : []),
        ...(stats.paymentBreakdown.COD ? [{ label: 'COD', labelVi: 'COD', value: stats.paymentBreakdown.COD.revenue, color: 'bg-green-500' }] : []),
      ]
    : [];

  // Top categories for horizontal bar chart
  const categoryChartData = stats?.topCategories?.map((c) => ({
    label: c.name,
    value: c.revenue,
    subtitle: `${c.qty.toLocaleString()} ${t('units', 'SP')} · ${c.revenueFormatted}`,
  })) || [];

  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <SidebarInset>
          <AdminHeader />

          <main className="flex-1 p-4 md:p-6 lg:p-6 space-y-5 max-w-full overflow-hidden">

            {/* ===== Page Header ===== */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {getGreeting()}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t('Real-time business metrics and KPIs', 'Chi so kinh doanh va KPI theo thoi gian thuc')}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchStats} className="w-fit gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                {t('Refresh', 'Lam moi')}
              </Button>
            </div>

            {/* ===== KPI Grid: 2 rows × 4 ===== */}
            {loading ? (
              <KpiGridSkeleton />
            ) : stats ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {/* Row 1 */}
                <KpiCard
                  title="Total Shops"
                  titleVi="Tong cua hang"
                  value={stats.totalShops}
                  subtitle={`${stats.activeShops.toLocaleString()} ${t('active', 'hoat dong')}`}
                  icon={<Store className="h-4 w-4" />}
                  accent="yellow"
                  locale={locale}
                />
                <KpiCard
                  title="Total GMV"
                  titleVi="Tong doanh thu"
                  value={stats.monthlyGmvFormatted}
                  subtitle={`${t('Delivered', 'Da giao')}: ${stats.deliveredGmvFormatted || '0 ₫'}`}
                  icon={<DollarSign className="h-4 w-4" />}
                  isSensitive
                  accent="red"
                  locale={locale}
                />
                <KpiCard
                  title="Total Orders"
                  titleVi="Tong don hang"
                  value={stats.monthlyOrderCount.toLocaleString()}
                  subtitle={`${stats.deliveredOrders?.toLocaleString() || 0} ${t('delivered', 'da giao')}`}
                  icon={<ShoppingCart className="h-4 w-4" />}
                  accent="yellow"
                  locale={locale}
                />
                <KpiCard
                  title="Retention Rate"
                  titleVi="Ty giu chan"
                  value={`${stats.retentionRate ?? 0}%`}
                  icon={<Users className="h-4 w-4" />}
                  accent={stats.retentionRate >= 80 ? 'green' : 'red'}
                  locale={locale}
                />

                {/* Row 2 */}
                <KpiCard
                  title="Avg. Order Value"
                  titleVi="TB gia tri don"
                  value={stats.avgOrderValueFormatted}
                  icon={<BarChart3 className="h-4 w-4" />}
                  isSensitive
                  accent="neutral"
                  locale={locale}
                />
                <KpiCard
                  title="Credit Exposure"
                  titleVi="No cong no"
                  value={stats.creditExposureFormatted}
                  subtitle={stats.overdueAccounts > 0 ? `${stats.overdueAccounts} ${t('overdue', 'qua han')}` : undefined}
                  icon={<CreditCard className="h-4 w-4" />}
                  isSensitive
                  accent={stats.overdueAccounts > 0 ? 'red' : 'neutral'}
                  locale={locale}
                />
                <KpiCard
                  title="Pending Shipments"
                  titleVi="Cho giao hang"
                  value={stats.pendingShipments}
                  subtitle={`${stats.activeGroupDeals} ${t('group deals', 'deal mua chung')}`}
                  icon={<Truck className="h-4 w-4" />}
                  accent={stats.pendingShipments > 0 ? 'yellow' : 'green'}
                  locale={locale}
                />
                <KpiCard
                  title="Total Products"
                  titleVi="Tong san pham"
                  value={stats.totalProducts || 0}
                  icon={<Boxes className="h-4 w-4" />}
                  accent="neutral"
                  locale={locale}
                />
              </div>
            ) : null}

            {/* ===== Order Pipeline ===== */}
            {!loading && stats && (
              <PipelineBar stats={stats} locale={locale} />
            )}

            {/* ===== Charts Row: Revenue Trend + Payment Breakdown ===== */}
            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ChartSkeleton />
                <ChartSkeleton />
                <ChartSkeleton />
              </div>
            ) : stats ? (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Revenue Trend — takes 3/5 width */}
                <div className="lg:col-span-3">
                  <BarChart
                    title="Revenue Trend"
                    titleVi="Xu huong Doanh thu"
                    data={trendChartData}
                    formatValue={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v.toLocaleString()}
                    locale={locale}
                    height={200}
                    showValues
                  />
                </div>

                {/* Payment Breakdown — takes 2/5 width */}
                <div className="lg:col-span-2">
                  <DistributionChart
                    title="Payment Methods"
                    titleVi="Phuong thuc Thanh toan"
                    data={paymentChartData}
                    locale={locale}
                    totalLabel="Total Revenue"
                    totalLabelVi="Tong doanh thu"
                  />

                  {/* Payment method counts underneath */}
                  {stats.paymentBreakdown && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {stats.paymentBreakdown.CREDIT && (
                        <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
                          <p className="text-[10px] text-muted-foreground">{t('Credit', 'Cong no')}</p>
                          <p className="text-sm font-bold text-red-600">{stats.paymentBreakdown.CREDIT.count}</p>
                          <p className="text-[10px] text-muted-foreground">{t('orders', 'don')}</p>
                        </div>
                      )}
                      {stats.paymentBreakdown.DIGITAL && (
                        <div className="text-center p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
                          <p className="text-[10px] text-muted-foreground">{t('Digital', 'Chuyen khoan')}</p>
                          <p className="text-sm font-bold text-yellow-600">{stats.paymentBreakdown.DIGITAL.count}</p>
                          <p className="text-[10px] text-muted-foreground">{t('orders', 'don')}</p>
                        </div>
                      )}
                      {stats.paymentBreakdown.COD && (
                        <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-950/30">
                          <p className="text-[10px] text-muted-foreground">COD</p>
                          <p className="text-sm font-bold text-green-600">{stats.paymentBreakdown.COD.count}</p>
                          <p className="text-[10px] text-muted-foreground">{t('orders', 'don')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* ===== Orders Trend (compact) + Top Categories ===== */}
            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <ChartSkeleton />
                <ChartSkeleton />
              </div>
            ) : stats ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Monthly Orders Trend */}
                <BarChart
                  title="Monthly Orders"
                  titleVi="Don hang theo thang"
                  data={trendOrdersData}
                  formatValue={(v) => v.toLocaleString()}
                  locale={locale}
                  height={180}
                  showValues
                />

                {/* Top Categories */}
                <HBarChart
                  title="Top Categories"
                  titleVi="Danh muc ban chay"
                  data={categoryChartData}
                  formatValue={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M ₫` : formatVND(v)}
                  locale={locale}
                  maxItems={6}
                />
              </div>
            ) : null}

            {/* ===== Top Shops Table ===== */}
            {!loading && stats && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-yellow-50 text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-400 flex items-center justify-center">
                        <Store className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          {t('Top Shops', 'Cua hang hang dau')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {t('Ranked by total revenue', 'Xep theo tong doanh thu')}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {stats.topShops?.length || 0} {t('shops', 'cua hang')}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {stats.topShops && stats.topShops.length > 0 ? (
                    <div className="max-h-72 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs w-10">#</TableHead>
                            <TableHead className="text-xs">{t('Shop Name', 'Ten cua hang')}</TableHead>
                            <TableHead className="text-xs text-right">{t('Orders', 'Don hang')}</TableHead>
                            <TableHead className="text-xs text-right">{t('Revenue', 'Doanh thu')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.topShops.map((shop, index) => (
                            <TableRow key={shop.shopId}>
                              <TableCell className="text-xs">
                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                                  index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' :
                                  index === 1 ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' :
                                  index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {index + 1}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs font-medium">{shop.shopName}</TableCell>
                              <TableCell className="text-xs text-right font-mono">{shop.orderCount.toLocaleString()}</TableCell>
                              <TableCell className="text-xs text-right font-semibold">
                                <SensitiveValue value={shop.totalRevenueFormatted} maskType="amount" formatOptions={{ formatCurrency: true }} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Store className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('No shop data yet', 'Chua co du lieu cua hang')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ===== Bottom Section: Recent Orders + Top Products ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Recent Orders */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 flex items-center justify-center">
                        <ShoppingCart className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          {t('Recent Orders', 'Don hang gan day')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {t('Last 10 orders across all shops', '10 don hang gan nhat')}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {stats?.recentOrders?.length || 0}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : stats && stats.recentOrders && stats.recentOrders.length > 0 ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {stats.recentOrders.map((order) => (
                        <div
                          key={order.id}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-medium">{order.orderNumber}</span>
                              <OrderStatusBadge status={order.status} />
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">{order.shopName}</span>
                              <span className="text-muted-foreground/50">·</span>
                              <PaymentMethodBadge method={order.paymentMethod} />
                              <span className="text-muted-foreground/50">·</span>
                              <span className="text-[11px] text-muted-foreground">{order.itemCount} {t('items', 'SP')}</span>
                            </div>
                          </div>
                          <div className="text-right ml-3 shrink-0">
                            <SensitiveValue value={order.totalAmountFormatted} maskType="amount" formatOptions={{ formatCurrency: true }} />
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('No orders yet', 'Chua co don hang')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top Products */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-yellow-50 text-yellow-600 dark:bg-yellow-950/50 dark:text-yellow-400 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          {t('Top Products', 'San pham ban chay')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {t('Best sellers by revenue', 'San pham ban chay theo doanh thu')}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {stats?.topProducts?.length || 0}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-2.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-14 w-full rounded-lg" />
                      ))}
                    </div>
                  ) : stats && stats.topProducts && stats.topProducts.length > 0 ? (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {stats.topProducts.map((product, index) => (
                        <div
                          key={product.productId}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                        >
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold shrink-0 ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' :
                            index === 1 ? 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' :
                            index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{product.productName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              SKU: {product.productSku} · {product.totalQty.toLocaleString()} {t('units', 'don vi')}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <SensitiveValue value={product.totalRevenueFormatted} maskType="amount" formatOptions={{ formatCurrency: true }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('No product data yet', 'Chua co du lieu san pham')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ===== Platform Rules Footer ===== */}
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 flex items-center justify-center">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </div>
                  {t('Active Automation Rules', 'Quy tac Tu dong hoa Dang hoat dong')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Lock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t('Credit Auto-Lock', 'Tu khoa Cong no')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t(
                          'Shops with unpaid credit after Day 7 are auto-locked from placing new orders.',
                          'Cua hang chua tra no sau ngay 7 se bi tu dong khoa khong dat duoc don hang moi.'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t('Group Buy Threshold', 'Nguong Mua chung')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t(
                          'No PO sent to distributor until MOQ is met. Auto-cancel if timer expires.',
                          'Khong gui don cho NPP cho den khi dat SL muc tieu. Tu dong huy neu het han.'
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Truck className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{t('Cash Reconciliation', 'Doi chieu Tien mat')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t(
                          'Drivers must confirm cash collection in app before shop can open new credit.',
                          'Tai xe phai xac nhan thu tien trong app truoc khi cua hang co the mo tin dung moi.'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

          </main>
        </SidebarInset>
      </div>
    </AuthGuard>
  );
}