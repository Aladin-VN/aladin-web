'use client';
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
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  DollarSign,
  Users,
  ShieldCheck,
  Clock,
  Lock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { SidebarInset } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { formatVND, ROLES } from '@/lib/security';

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
  pipeline: { status: string; count: number }[];
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
// Stat Card Component
// ============================================

function StatCard({
  title,
  titleVi,
  value,
  formattedValue,
  icon,
  trend,
  trendLabel,
  isSensitive = false,
  variant = 'default',
  locale,
}: {
  title: string;
  titleVi: string;
  value: string | number;
  formattedValue?: string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  isSensitive?: boolean;
  variant?: 'default' | 'warning' | 'danger';
  locale: string;
}) {
  const t = locale === 'vi' ? titleVi : title;

  return (
    <Card className={variant === 'danger' ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40' : variant === 'warning' ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/40' : 'border-yellow-100 hover:border-yellow-200 transition-colors'}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{t}</CardTitle>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
          variant === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400' :
          variant === 'warning' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' :
          'bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-400'
        }`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight">
          {isSensitive ? (
            <SensitiveValue value={String(formattedValue || value)} maskType="amount" formatOptions={{ formatCurrency: true }} />
          ) : (
            formattedValue || value
          )}
        </div>
        {trend !== undefined && (
          <div className="flex items-center mt-1">
            {trend >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5 text-green-600 mr-1" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5 text-red-500 mr-1" />
            )}
            <span className={`text-xs font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {Math.abs(trend)}%
            </span>
            {trendLabel && <span className="text-xs text-muted-foreground ml-1">{trendLabel}</span>}
          </div>
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
  { key: 'processing', label: 'Processing', labelVi: 'Dang XL', color: 'bg-indigo-100 dark:bg-indigo-900/50', textColor: 'text-indigo-700 dark:text-indigo-300', icon: Package },
  { key: 'packed', label: 'Packed', labelVi: 'Dong goi', color: 'bg-purple-100 dark:bg-purple-900/50', textColor: 'text-purple-700 dark:text-purple-300', icon: Package },
  { key: 'outForDelivery', label: 'Out for Delivery', labelVi: 'Dang giao', color: 'bg-yellow-100 dark:bg-yellow-900/50', textColor: 'text-yellow-700 dark:text-yellow-300', icon: Truck },
  { key: 'delivered', label: 'Delivered', labelVi: 'Da giao', color: 'bg-green-100 dark:bg-green-900/50', textColor: 'text-green-700 dark:text-green-300', icon: DollarSign },
];

function PipelineBar({ stats, locale, t }: { stats: DashboardStats; locale: string; t: (en: string, vi: string) => string }) {
  const pipeline = stats.pipeline || [];
  const total = pipeline.reduce((sum, s) => sum + s.count, 0) || 1;

  return (
    <div className="space-y-4">
      {/* Visual Pipeline Bar */}
      <div className="flex h-10 rounded-lg overflow-hidden border border-yellow-200 dark:border-yellow-800">
        {pipeline.map((stage, i) => {
          const widthPct = Math.max((stage.count / total) * 100, stage.count > 0 ? 3 : 0);
          const stageConfig = PIPELINE_STAGES[i] || PIPELINE_STAGES[0];
          return (
            <div
              key={stage.status}
              className="relative flex items-center justify-center transition-all duration-500 group cursor-default"
              style={{ width: `${widthPct}%` }}
              title={`${stageConfig.key === 'outForDelivery' ? (locale === 'vi' ? 'Dang giao' : 'Out for Delivery') : stage.status.replace(/_/g, ' ')}: ${stage.count}`}
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
      <div className="flex flex-wrap gap-3">
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
    </div>
  );
}

// ============================================
// Status Badge
// ============================================

function OrderStatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100',
    CONFIRMED: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
    PROCESSING: 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100',
    PACKED: 'bg-purple-100 text-purple-700 hover:bg-purple-100',
    OUT_FOR_DELIVERY: 'bg-cyan-100 text-cyan-700 hover:bg-cyan-100',
    DELIVERED: 'bg-yellow-50 text-red-700 hover:bg-yellow-50',
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
    CREDIT: '7-Day Credit',
    DIGITAL: 'Digital',
    COD: 'COD',
  };
  return <span className="text-xs text-muted-foreground">{labels[method] || method}</span>;
}

// ============================================
// Main Dashboard Page
// ============================================

export default function DashboardPage() {
  const { locale, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const userRole = user?.role || 'SHOP_OWNER';

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('aladin-access-token');
      const res = await fetch('/api/dashboard/stats', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
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

  return (
    <AuthGuard>
    <div className="flex min-h-screen">
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {getGreeting()}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Real-time business metrics and KPIs', 'Chi so kinh doanh va KPI theo thoi gian thuc')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchStats}>
                {t('Refresh', 'Lam moi')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* KPI Stat Cards */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-3 w-20 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Shops"
                titleVi="Tong cua hang"
                value={stats.totalShops}
                icon={<Store className="h-4 w-4" />}
                trend={stats.activeShops > 0 ? Math.round((stats.activeShops / stats.totalShops) * 100) : 0}
                trendLabel={t('active', 'hoat dong')}
                locale={locale}
              />
              <StatCard
                title="Monthly GMV"
                titleVi="GMV hang thang"
                value={stats.monthlyGmvFormatted}
                icon={<DollarSign className="h-4 w-4" />}
                trend={12.5}
                trendLabel={t('vs last month', 'so voi thang truoc')}
                isSensitive
                locale={locale}
              />
              <StatCard
                title="Total Orders"
                titleVi="Tong don hang"
                value={stats.monthlyOrderCount.toLocaleString()}
                icon={<ShoppingCart className="h-4 w-4" />}
                trend={8.3}
                trendLabel={t('vs last month', 'so voi thang truoc')}
                locale={locale}
              />
              <StatCard
                title="Retention Rate"
                titleVi="Ty giu chan"
                value={`${stats.retentionRate}%`}
                icon={<Users className="h-4 w-4" />}
                trend={stats.retentionRate >= 80 ? 2.1 : -3.5}
                trendLabel={t('vs last month', 'so voi thang truoc')}
                locale={locale}
              />
              <StatCard
                title="Avg. Order Value"
                titleVi="TB gia tri don"
                value={stats.avgOrderValueFormatted}
                icon={<BarChart3 className="h-4 w-4" />}
                trend={5.2}
                trendLabel={t('vs last month', 'so voi thang truoc')}
                isSensitive
                locale={locale}
              />
              <StatCard
                title="Credit Exposure"
                titleVi="No cong no"
                value={stats.creditExposureFormatted}
                icon={<CreditCard className="h-4 w-4" />}
                isSensitive
                locale={locale}
              />
              <StatCard
                title="Overdue Accounts"
                titleVi="Tai khoan qua han"
                value={stats.overdueAccounts}
                icon={<AlertTriangle className="h-4 w-4" />}
                variant={stats.overdueAccounts > 0 ? 'warning' : 'default'}
                locale={locale}
              />
              <StatCard
                title="Active Deals"
                titleVi="Deal mua chung"
                value={stats.activeGroupDeals}
                icon={<Tag className="h-4 w-4" />}
                locale={locale}
              />
            </div>
          ) : null}

          {/* Order Pipeline Overview */}
          {!loading && stats && (
            <Card className="border-yellow-200 dark:border-yellow-900">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4 text-red-600" />
                      {t('Order Pipeline', 'Luong Don hang')}
                    </CardTitle>
                    <CardDescription>
                      {t('B2B fulfillment pipeline — orders by status', 'Luong thuc thi B2B — don hang theo trang thai')}
                    </CardDescription>
                  </div>
                  <Badge className="bg-red-600 hover:bg-red-600 text-white font-mono">
                    {stats.monthlyOrderCount} {t('orders', 'don')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <PipelineBar stats={stats} locale={locale} t={t} />
              </CardContent>
            </Card>
          )}

          {/* Bottom Section: Recent Orders + Top Products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {t('Recent Orders', 'Don hang gan day')}
                  </CardTitle>
                  <CardDescription>
                    {t('Last 10 orders across all shops', '10 don hang gan nhat')}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono">
                  {stats?.recentOrders.length || 0}
                </Badge>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : stats && stats.recentOrders.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                    {stats.recentOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium">{order.orderNumber}</span>
                            <OrderStatusBadge status={order.status} />
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-muted-foreground">{order.shopName}</span>
                            <PaymentMethodBadge method={order.paymentMethod} />
                            <span className="text-xs text-muted-foreground">{order.itemCount} {t('items', 'SP')}</span>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <span className="text-sm font-semibold">{order.totalAmountFormatted}</span>
                          <div className="text-[10px] text-muted-foreground">
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
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {t('Top Products', 'San pham ban chay')}
                  </CardTitle>
                  <CardDescription>
                    {t('Best sellers this month', 'San pham ban chay thang nay')}
                  </CardDescription>
                </div>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : stats && stats.topProducts.length > 0 ? (
                  <div className="space-y-3">
                    {stats.topProducts.map((product, index) => (
                      <div
                        key={product.productId}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                          index === 0 ? 'bg-amber-100 text-amber-700' :
                          index === 1 ? 'bg-gray-100 text-gray-600' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{product.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            SKU: {product.productSku} · {product.totalQty.toLocaleString()} {t('units', 'don vi')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{product.totalRevenueFormatted}</p>
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

          {/* Platform Rules Footer */}
          <Card className="border-dashed border-yellow-200 dark:border-yellow-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-red-600" />
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
                    <p className="text-sm font-medium">
                      {t('Credit Auto-Lock', 'Tu khoa Cong no')}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
                    <p className="text-sm font-medium">
                      {t('Group Buy Threshold', 'Nguong Mua chung')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(
                        'No PO sent to distributor until MOQ is met. Auto-cancel if timer expires.',
                        'Khong gui don cho NPP cho den khi dat SL muc tieu. Tu dong huy neu het han.'
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/40 dark:text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {t('Cash Reconciliation', 'Doi chieu Tien mat')}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
