'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import {
  Banknote,
  TrendingUp,
  Percent,
  ShoppingCart,
  CalendarDays,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Trophy,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminHeader } from '@/components/layout/admin-header';
import { toast } from 'sonner';

// ---- Types ----

interface MarginSummary {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPct: number;
  totalOrdersDelivered: number;
  avgOrderValue: number;
}

interface ProductMarginRow {
  productId: string;
  productName: string;
  productSku: string;
  totalQtySold: number;
  totalRevenue: number;
  totalCost: number | null;
  grossProfit: number;
  grossMarginPct: number | null;
}

interface CategoryMarginRow {
  categoryId: string;
  categoryName: string;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPct: number;
  productCount: number;
}

interface CustomerProfitRow {
  shopId: string;
  shopName: string;
  shopDistrict: string;
  totalOrders: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  avgOrderValue: number;
}

interface MarginTrendRow {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;
}

interface LowMarginAlert {
  productId: string;
  productName: string;
  currentMarginPct: number;
  suggestion: string;
}

interface MarginData {
  summary: MarginSummary;
  productMargins: ProductMarginRow[];
  categoryMargins: CategoryMarginRow[];
  customerProfitability: CustomerProfitRow[];
  marginTrend: MarginTrendRow[];
  lowMarginAlerts: LowMarginAlert[];
}

// ---- Helpers ----

function getMarginColor(pct: number | null, forText = false): string {
  if (pct == null) return forText ? 'text-muted-foreground' : 'bg-muted';
  if (pct < 5) return forText ? 'text-red-600' : 'bg-red-500';
  if (pct < 15) return forText ? 'text-amber-600' : 'bg-amber-500';
  return forText ? 'text-green-600' : 'bg-green-500';
}

function getMarginBarWidth(pct: number | null): number {
  if (pct == null) return 0;
  return Math.min(Math.max(pct, 0), 50) * 2; // scale: 0-50% → 0-100%
}

function formatMarginPct(pct: number | null): string {
  if (pct == null) return '—';
  return `${pct.toFixed(1)}%`;
}

// ---- Period Button ----

function PeriodButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      className={
        active
          ? 'bg-slate-700 text-white hover:bg-slate-800 shadow-sm'
          : 'border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }
    >
      {label}
    </Button>
  );
}

// ---- Component ----

export default function DistributorMarginAnalytics() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  // State
  const [data, setData] = useState<MarginData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState('products');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (period === 'custom') {
          if (dateFrom) params.set('from', dateFrom);
          if (dateTo) params.set('to', dateTo);
        } else {
          params.set('period', period);
        }
        const qs = params.toString() ? `?${params.toString()}` : '?period=30d';
        const res = await adminFetch(`/api/distributor/analytics/margins${qs}`);
        if (cancelled) return;
        if (res.success) {
          setData(res.data);
        } else {
          toast.error(res.error?.message || t('Lỗi tải dữ liệu', 'Failed to load data'));
        }
      } catch {
        if (cancelled) return;
        toast.error(t('Lỗi kết nối máy chủ', 'Server connection error'));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [period, dateFrom, dateTo, locale, refreshKey]);

  // Handlers
  const handlePeriodChange = (p: '7d' | '30d' | '90d') => {
    setPeriod(p);
    setDateFrom('');
    setDateTo('');
  };

  const handleCustomFilter = () => {
    if (!dateFrom && !dateTo) {
      toast.error(t('Vui lòng chọn ngày bắt đầu hoặc kết thúc', 'Please select a start or end date'));
      return;
    }
    setPeriod('custom');
    setRefreshKey((k) => k + 1);
  };

  // Derived: sorted product margins
  const sortedProducts = data?.productMargins
    ? [...data.productMargins].sort((a, b) => b.totalRevenue - a.totalRevenue)
    : [];

  // Derived: category max revenue for bar chart
  const categoryMaxRevenue =
    data?.categoryMargins?.length
      ? Math.max(...data.categoryMargins.map((c) => c.totalRevenue), 1)
      : 1;

  // Derived: trend data for chart (last 30 points)
  const trendDataRaw = data?.marginTrend?.filter((d) => d.marginPct != null) || [];
  const trendData = trendDataRaw.length > 30 ? trendDataRaw.slice(-30) : trendDataRaw;

  const trendMaxPct = trendData.length
    ? Math.max(...trendData.map((d) => d.marginPct || 0), 10)
    : 50;

  // ---- Render ----

  return (
    <>
      <AdminHeader />
      <div className="flex flex-1 flex-col">
        {/* Page Header */}
        <div className="px-4 sm:px-6 py-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {t('Phân tích biên lợi nhuận GVM', 'GVM Margin Analytics')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t(
                  'Theo dõi lợi nhuận gộp theo sản phẩm, danh mục và khách hàng',
                  'Track gross profit by product, category and customer'
                )}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefreshKey((k) => k + 1)}
              disabled={loading}
              className="w-fit"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              {t('Làm mới', 'Refresh')}
            </Button>
          </div>

          {/* Period Selector + Custom Date Range */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1.5">
              <PeriodButton
                label={t('7 ngày', '7 days')}
                active={period === '7d'}
                onClick={() => handlePeriodChange('7d')}
              />
              <PeriodButton
                label={t('30 ngày', '30 days')}
                active={period === '30d'}
                onClick={() => handlePeriodChange('30d')}
              />
              <PeriodButton
                label={t('90 ngày', '90 days')}
                active={period === '90d'}
                onClick={() => handlePeriodChange('90d')}
              />
            </div>

            <div className="flex items-end gap-2 ml-0 sm:ml-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" />
                  {t('Từ', 'From')}
                </label>
                <Input
                  type="date"
                  className="h-9 w-36 text-sm"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {t('Đến', 'To')}
                </label>
                <Input
                  type="date"
                  className="h-9 w-36 text-sm"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="h-9"
                onClick={handleCustomFilter}
              >
                {t('Lọc', 'Filter')}
              </Button>
              {period === 'custom' && (dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs"
                  onClick={() => {
                    setPeriod('30d');
                    setDateFrom('');
                    setDateTo('');
                  }}
                >
                  {t('Xóa bộ lọc', 'Clear')}
                </Button>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Main Content */}
        <div className="flex-1 px-4 sm:px-6 py-4 space-y-6">
          {/* ====== KPI Cards ====== */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[110px] rounded-xl" />
              ))
            ) : data ? (
              <>
                {/* KPI 1: Total Revenue */}
                <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                        <Banknote className="h-4.5 w-4.5 text-blue-600" />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {t('Tổng doanh thu', 'Total Revenue')}
                      </span>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-slate-900">
                      {formatVND(data.summary.totalRevenue)}
                    </p>
                  </CardContent>
                </Card>

                {/* KPI 2: Gross Profit */}
                <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center">
                        <TrendingUp className="h-4.5 w-4.5 text-green-600" />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {t('Lợi nhuận gộp', 'Gross Profit')}
                      </span>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-green-700">
                      {formatVND(data.summary.grossProfit)}
                    </p>
                  </CardContent>
                </Card>

                {/* KPI 3: Gross Margin % */}
                <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center">
                        <Percent className="h-4.5 w-4.5 text-slate-600" />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {t('Biên lợi nhuận', 'Gross Margin')}
                      </span>
                    </div>
                    <p
                      className={`text-lg sm:text-xl font-bold ${
                        data.summary.grossMarginPct < 10
                          ? 'text-red-600'
                          : data.summary.grossMarginPct <= 20
                          ? 'text-amber-600'
                          : 'text-green-600'
                      }`}
                    >
                      {data.summary.grossMarginPct.toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>

                {/* KPI 4: Delivered Orders */}
                <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center">
                        <ShoppingCart className="h-4.5 w-4.5 text-slate-600" />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">
                        {t('Đơn hàng đã giao', 'Delivered Orders')}
                      </span>
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-slate-900">
                      {data.summary.totalOrdersDelivered}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('TB/đơn', 'Avg/order')}: {formatVND(data.summary.avgOrderValue)}
                    </p>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>

          {/* ====== Tabs Section ====== */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-slate-100 p-1 h-auto">
              <TabsTrigger
                value="products"
                className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm px-3"
              >
                {t('Biên lợi nhuận SP', 'Product Margins')}
              </TabsTrigger>
              <TabsTrigger
                value="categories"
                className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm px-3"
              >
                {t('Theo danh mục', 'By Category')}
              </TabsTrigger>
              <TabsTrigger
                value="customers"
                className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm px-3"
              >
                {t('Khách hàng', 'Customers')}
              </TabsTrigger>
              <TabsTrigger
                value="alerts"
                className="text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:shadow-sm px-3 relative"
              >
                {t('Cảnh báo', 'Alerts')}
                {data?.lowMarginAlerts && data.lowMarginAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                    {data.lowMarginAlerts.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ---- Tab 1: Product Margins ---- */}
            <TabsContent value="products">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700">
                    {t(
                      'Biên lợi nhuận theo sản phẩm',
                      'Profit Margin by Product'
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  {loading ? (
                    <div className="px-6 pb-6 space-y-3">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : sortedProducts.length === 0 ? (
                    <div className="px-6 pb-6 py-8 text-center text-sm text-muted-foreground">
                      {t('Chưa có dữ liệu sản phẩm', 'No product data available')}
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                            <TableHead className="w-10 text-xs font-semibold text-slate-500">#</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">{t('Sản phẩm', 'Product')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 hidden sm:table-cell">SKU</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 text-right">{t('SL bán', 'Qty')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 text-right">{t('Doanh thu', 'Revenue')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 text-right hidden md:table-cell">{t('Giá vốn', 'Cost')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 text-right hidden md:table-cell">{t('Lợi nhuận', 'Profit')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 text-right min-w-[120px]">{t('Biên LN', 'Margin')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedProducts.map((p, i) => (
                            <TableRow key={p.productId} className="border-b-slate-100">
                              <TableCell className="text-xs text-muted-foreground font-medium">
                                {i + 1}
                              </TableCell>
                              <TableCell>
                                <p className="text-sm font-medium text-slate-800 leading-tight">
                                  {p.productName}
                                </p>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <span className="text-xs font-mono text-muted-foreground">
                                  {p.productSku}
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium text-slate-700">
                                {p.totalQtySold.toLocaleString('vi-VN')}
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium text-slate-800">
                                {formatVND(p.totalRevenue)}
                              </TableCell>
                              <TableCell className="text-right text-sm hidden md:table-cell">
                                {p.totalCost != null ? (
                                  <span className="text-slate-600">{formatVND(p.totalCost)}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-sm hidden md:table-cell">
                                {p.totalCost != null ? (
                                  <span className={p.grossProfit >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                                    {formatVND(p.grossProfit)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${getMarginColor(p.grossMarginPct)}`}
                                      style={{ width: `${getMarginBarWidth(p.grossMarginPct)}%` }}
                                    />
                                  </div>
                                  <span
                                    className={`text-xs font-bold min-w-[40px] text-right ${getMarginColor(p.grossMarginPct, true)}`}
                                  >
                                    {formatMarginPct(p.grossMarginPct)}
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Info note */}
                  <div className="px-6 py-3 bg-amber-50 border-t border-amber-100">
                    <p className="text-xs text-amber-700">
                      {t(
                        'Nhiều sản phẩm không có giá vốn nhập. Cập nhật giá vốn trong Kho hàng để phân tích chính xác.',
                        'Many products have no purchase cost. Update cost prices in Inventory for accurate analysis.'
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---- Tab 2: Category Margins ---- */}
            <TabsContent value="categories">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700">
                    {t('Biên lợi nhuận theo danh mục', 'Profit Margin by Category')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  {loading ? (
                    <div className="px-6 pb-6 space-y-3">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : !data?.categoryMargins?.length ? (
                    <div className="px-6 pb-6 py-8 text-center text-sm text-muted-foreground">
                      {t('Chưa có dữ liệu danh mục', 'No category data available')}
                    </div>
                  ) : (
                    <>
                      {/* Horizontal Bar Chart */}
                      <div className="px-6 pb-4 space-y-2.5">
                        {data.categoryMargins.map((c) => {
                          const pct = (c.totalRevenue / categoryMaxRevenue) * 100;
                          return (
                            <div key={c.categoryId} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-700 truncate max-w-[200px]">
                                  {c.categoryName}
                                </span>
                                <span className="text-xs font-medium text-slate-500">
                                  {formatVND(c.totalRevenue)}
                                </span>
                              </div>
                              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-slate-600 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <Separator />

                      {/* Category Table */}
                      <div className="max-h-[320px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                              <TableHead className="w-10 text-xs font-semibold text-slate-500">#</TableHead>
                              <TableHead className="text-xs font-semibold text-slate-500">{t('Danh mục', 'Category')}</TableHead>
                              <TableHead className="text-xs font-semibold text-slate-500 text-right">{t('Số SP', 'Products')}</TableHead>
                              <TableHead className="text-xs font-semibold text-slate-500 text-right">{t('Doanh thu', 'Revenue')}</TableHead>
                              <TableHead className="text-xs font-semibold text-slate-500 text-right hidden sm:table-cell">{t('Giá vốn', 'Cost')}</TableHead>
                              <TableHead className="text-xs font-semibold text-slate-500 text-right hidden sm:table-cell">{t('Lợi nhuận', 'Profit')}</TableHead>
                              <TableHead className="text-xs font-semibold text-slate-500 text-right min-w-[100px]">{t('Biên LN', 'Margin')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.categoryMargins.map((c, i) => (
                              <TableRow key={c.categoryId} className="border-b-slate-100">
                                <TableCell className="text-xs text-muted-foreground font-medium">
                                  {i + 1}
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm font-medium text-slate-800">
                                    {c.categoryName}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right text-sm text-slate-600">
                                  {c.productCount}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium text-slate-800">
                                  {formatVND(c.totalRevenue)}
                                </TableCell>
                                <TableCell className="text-right text-sm text-slate-600 hidden sm:table-cell">
                                  {formatVND(c.totalCost)}
                                </TableCell>
                                <TableCell className="text-right text-sm hidden sm:table-cell">
                                  <span className={c.grossProfit >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                                    {formatVND(c.grossProfit)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-14 h-2 bg-slate-100 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${getMarginColor(c.grossMarginPct)}`}
                                        style={{ width: `${getMarginBarWidth(c.grossMarginPct)}%` }}
                                      />
                                    </div>
                                    <span
                                      className={`text-xs font-bold min-w-[40px] text-right ${getMarginColor(c.grossMarginPct, true)}`}
                                    >
                                      {formatMarginPct(c.grossMarginPct)}
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---- Tab 3: Customer Profitability ---- */}
            <TabsContent value="customers">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700">
                    {t('Độ sinh lời theo khách hàng', 'Customer Profitability')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-0 pb-0">
                  {loading ? (
                    <div className="px-6 pb-6 space-y-3">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : !data?.customerProfitability?.length ? (
                    <div className="px-6 pb-6 py-8 text-center text-sm text-muted-foreground">
                      {t('Chưa có dữ liệu khách hàng', 'No customer data available')}
                    </div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                            <TableHead className="w-10 text-xs font-semibold text-slate-500">#</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">{t('Cửa hàng', 'Shop')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 hidden sm:table-cell">{t('Quận', 'District')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 text-right">{t('Số ĐH', 'Orders')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 text-right">{t('Doanh thu', 'Revenue')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 text-right hidden md:table-cell">{t('Giá vốn', 'Cost')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 text-right hidden md:table-cell">{t('Lợi nhuận', 'Profit')}</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500 text-right">{t('TB/Đơn', 'Avg/Order')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.customerProfitability.map((c, i) => (
                            <TableRow key={c.shopId} className="border-b-slate-100">
                              <TableCell className="text-xs text-muted-foreground font-medium">
                                {i + 1}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-slate-800">
                                    {c.shopName}
                                  </span>
                                  {i === 0 && (
                                    <Trophy className="h-4 w-4 text-yellow-500" />
                                  )}
                                  {i === 1 && (
                                    <Trophy className="h-4 w-4 text-slate-400" />
                                  )}
                                  {i === 2 && (
                                    <Trophy className="h-4 w-4 text-amber-700" />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <span className="text-xs text-muted-foreground">
                                  {c.shopDistrict}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant="secondary"
                                  className="text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-100"
                                >
                                  {c.totalOrders}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium text-slate-800">
                                {formatVND(c.totalRevenue)}
                              </TableCell>
                              <TableCell className="text-right text-sm text-slate-600 hidden md:table-cell">
                                {formatVND(c.totalCost)}
                              </TableCell>
                              <TableCell className="text-right text-sm hidden md:table-cell">
                                <span className={c.grossProfit >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                                  {formatVND(c.grossProfit)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium text-slate-700">
                                {formatVND(c.avgOrderValue)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ---- Tab 4: Low Margin Alerts ---- */}
            <TabsContent value="alerts">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700">
                    {t('Cảnh báo biên lợi nhuận thấp', 'Low Margin Alerts')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-20 w-full" />
                      <Skeleton className="h-20 w-full" />
                    </div>
                  ) : !data?.lowMarginAlerts?.length ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                      <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                      </div>
                      <p className="text-sm font-medium text-green-700">
                        {t(
                          'Tất cả sản phẩm đều có biên lợi nhuận tốt!',
                          'All products have healthy profit margins!'
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[420px] overflow-y-auto">
                      {data.lowMarginAlerts.map((alert) => (
                        <div
                          key={alert.productId}
                          className="flex items-start gap-4 p-4 rounded-lg border border-red-100 bg-red-50/50 hover:bg-red-50 transition-colors"
                        >
                          <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <p className="text-sm font-semibold text-slate-800 truncate">
                                {alert.productName}
                              </p>
                              <span className="text-sm font-bold text-red-600 whitespace-nowrap">
                                {alert.currentMarginPct.toFixed(1)}%
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mb-2.5">
                              {t('Gợi ý', 'Suggestion')}: {alert.suggestion}
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700"
                              onClick={() => {
                                toast.info(
                                  t(
                                    'Chuyển đến quản lý kho hàng để cập nhật giá vốn.',
                                    'Navigate to Inventory to update cost prices.'
                                  )
                                );
                              }}
                            >
                              {t('Xem chi tiết', 'View Details')}
                              <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* ====== Margin Trend Chart (always visible) ====== */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700">
                {t('Xu hướng biên lợi nhuận', 'Margin Trend')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-48 w-full" />
              ) : !trendData.length ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  {t('Chưa có dữ liệu xu hướng', 'No trend data available')}
                </div>
              ) : (
                <div>
                  <div className="flex items-end gap-[3px] h-40 sm:h-48">
                    {trendData.map((d, i) => {
                      const heightPct =
                        trendMaxPct > 0
                          ? Math.max((d.marginPct / trendMaxPct) * 100, 2)
                          : 2;
                      const isLast = i === trendData.length - 1;

                      return (
                        <div
                          key={d.date}
                          className="flex-1 group relative flex flex-col items-center"
                          title={`${d.date}: ${d.marginPct.toFixed(1)}%`}
                        >
                          <div className="w-full flex-1 flex items-end">
                            <div
                              className={`w-full rounded-t-sm transition-all cursor-pointer ${
                                d.marginPct < 5
                                  ? 'bg-red-400 hover:bg-red-500'
                                  : d.marginPct < 15
                                  ? 'bg-amber-400 hover:bg-amber-500'
                                  : 'bg-green-500 hover:bg-green-600'
                              } ${isLast ? 'opacity-100' : 'opacity-80'}`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          {/* Tooltip on hover */}
                          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                            {d.date.slice(5)}: {d.marginPct.toFixed(1)}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {/* X-axis labels */}
                  <div className="flex justify-between mt-2 text-[10px] text-muted-foreground px-0.5">
                    <span>{trendData[0]?.date.slice(5)}</span>
                    {trendData.length > 2 && (
                      <span>{trendData[Math.floor(trendData.length / 2)]?.date.slice(5)}</span>
                    )}
                    <span>{trendData[trendData.length - 1]?.date.slice(5)}</span>
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-sm bg-red-400" />
                      <span className="text-[10px] text-muted-foreground">&lt; 5%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
                      <span className="text-[10px] text-muted-foreground">5–15%</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-sm bg-green-500" />
                      <span className="text-[10px] text-muted-foreground">&gt; 15%</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}