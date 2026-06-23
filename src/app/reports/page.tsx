'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  RefreshCw,
  TrendingUp,
  ShoppingCart,
  Store,
  Truck,
  Package,
  DollarSign,
  CreditCard,
  Users,
  Tag,
  Clock,
  AlertTriangle,
  Download,
  Loader2,
  CheckCircle2,
  XCircle,
  BoxIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { DateRangePicker } from '@/components/reports/date-range-picker';
import { KpiCard } from '@/components/reports/kpi-card';
import { BarChart, HBarChart, DistributionChart } from '@/components/reports/charts';

// ============================================
// Types
// ============================================

interface OverviewData {
  period: string;
  kpis: {
    totalRevenue: number; totalRevenueFormatted: string; revenueGrowth: number | null;
    totalOrders: number; orderGrowth: number | null;
    avgOrderValue: number; avgOrderValueFormatted: string;
    activeShops: number; newShops: number;
    totalCreditExposure: number; totalCreditExposureFormatted: string; overdueShops: number;
    totalShipments: number; deliveredShipments: number;
    successRate: number; successRateDelta: number;
    avgDeliveryHours: number;
    totalSavings: number; totalSavingsFormatted: string;
    brokerGmv: number; brokerGmvFormatted: string;
    brokerCommission: number; brokerCommissionFormatted: string;
    totalBrokers: number; totalShops: number;
  };
  distributions: {
    orderStatus: Record<string, number>;
    paymentMethod: Record<string, number>;
    loyaltyTier: Record<string, number>;
    shipmentType: Record<string, number>;
  };
  dailyRevenue: { date: string; revenue: number; orders: number }[];
  topCategories: { name: string; revenue: number; revenueFormatted: string }[];
}

interface RevenueData {
  kpis: {
    totalRevenue: number; totalRevenueFormatted: string; revenueGrowth: number | null;
    totalDiscounts: number; totalDiscountsFormatted: string;
    totalDeliveryFees: number; totalDeliveryFeesFormatted: string;
    totalCreditUsed: number; totalCreditUsedFormatted: string;
    avgOrderValue: number; avgOrderValueFormatted: string;
    totalOrders: number;
    thisMonthRevenue: number; thisMonthRevenueFormatted: string;
    lastMonthRevenue: number; lastMonthRevenueFormatted: string;
    monthOverMonth: number | null;
  };
  breakdown: {
    byPaymentMethod: Record<string, { revenue: number; count: number; percentage: number }>;
    byTier: Record<string, { revenue: number; count: number; percentage: number }>;
    byDistrict: { district: string; revenue: number; revenueFormatted: string; percentage: number }[];
  };
  trends: {
    daily: { date: string; revenue: number; orders: number; avgOrderValue: number }[];
    weekly: { weekStart: string; revenue: number; orders: number }[];
  };
  topShops: { shopId: string; name: string; revenue: number; orders: number; revenueFormatted: string }[];
}

interface OrdersData {
  kpis: {
    totalOrders: number; orderGrowth: number | null;
    completedOrders: number; pendingOrders: number; cancelledOrders: number;
    cancellationRate: number; completionRate: number;
    totalRevenue: number; totalRevenueFormatted: string;
    avgOrderValue: number; avgOrderValueFormatted: string;
    avgCompletedValue: number; avgCompletedValueFormatted: string;
    avgItemsPerOrder: number; avgFulfillmentHours: number;
    creditRevenue: number; creditRevenueFormatted: string;
    digitalRevenue: number; digitalRevenueFormatted: string;
    codRevenue: number; codRevenueFormatted: string;
  };
  distributions: {
    status: Record<string, number>;
    paymentMethod: Record<string, { count: number; revenue: number; percentage: number }>;
    paymentStatus: Record<string, number>;
  };
  trends: { daily: { date: string; orders: number; completed: number; cancelled: number; revenue: number }[] };
  rankings: {
    topShops: { shopId: string; name: string; orders: number; revenue: number; tier: string; revenueFormatted: string }[];
    largestOrders: { id: string; totalAmount: number; totalAmountFormatted: string; shopName: string; status: string; itemCount: number; createdAt: string }[];
  };
}

interface ProductsData {
  kpis: {
    totalProducts: number; activeProducts: number; categories: number;
    uniqueProductsSold: number; totalItemsSold: number;
    totalRevenue: number; totalRevenueFormatted: string;
    avgUnitPrice: number; avgUnitPriceFormatted: string;
    lowStockCount: number; outOfStockCount: number;
    privateLabelCount: number;
    privateLabelRevenue: number; privateLabelRevenueFormatted: string; privateLabelPercentage: number;
    regularRevenue: number; regularRevenueFormatted: string;
    avgStock: number;
  };
  rankings: {
    topProducts: { productId: string; name: string; sku: string; revenue: number; qty: number; category: string; brand: string; revenueFormatted: string; inStock: boolean }[];
    topByQty: { name: string; sku: string; revenue: number; qty: number; category: string; brand: string; revenueFormatted: string }[];
    topCategories: { name: string; revenue: number; qty: number; orders: number; productCount: number; revenueFormatted: string; percentage: number }[];
    topBrands: { name: string; revenue: number; qty: number; revenueFormatted: string; percentage: number }[];
    topManufacturers: { name: string; revenue: number; qty: number; revenueFormatted: string; percentage: number }[];
  };
  stockAlerts: {
    lowStock: { id: string; name: string; sku: string; basePrice: number; stockQuantity: number; basePriceFormatted: string }[];
    outOfStock: { id: string; name: string; sku: string; basePrice: number; basePriceFormatted: string }[];
  };
}

interface ShopsData {
  kpis: {
    totalShops: number; activeShops: number; newShops: number; newShopsGrowth: number | null;
    totalGmv: number; totalGmvFormatted: string; dormantShops: number;
    creditHealth: {
      active: number; overdue: number; locked: number;
      utilizationPercent: number;
      totalExposure: number; totalExposureFormatted: string;
      totalLimit: number; totalLimitFormatted: string;
      available: number; availableFormatted: string;
    };
  };
  distributions: {
    tier: Record<string, { count: number; gmv: number; percentage: number }>;
    shopType: Record<string, number>;
    district: { district: string; count: number; gmv: number; gmvFormatted: string }[];
  };
  rankings: {
    topByGmv: { id: string; name: string; district: string | null; loyaltyTier: string; totalOrders: number; totalGmv: number; totalGmvFormatted: string; avgOrderValue: number; avgOrderValueFormatted: string; status: string }[];
    topByOrders: { id: string; name: string; district: string | null; loyaltyTier: string; totalOrders: number; totalGmv: number; totalGmvFormatted: string; status: string }[];
    topByPeriodRevenue: { shopId: string; name: string; district: string | null; tier: string; count: number; revenue: number; revenueFormatted: string }[];
  };
  trends: { dailyNewShops: { date: string; count: number }[] };
}

interface ShipmentsData {
  kpis: {
    totalShipments: number; shipmentGrowth: number | null;
    pendingShipments: number; inTransit: number; delivered: number; failed: number;
    successRate: number; failureRate: number; successRateDelta: number;
    avgDeliveryHours: number; minDeliveryHours: number; maxDeliveryHours: number;
    totalValue: number; totalValueFormatted: string;
    avgShipmentValue: number; avgShipmentValueFormatted: string;
    internal: number; thirdParty: number;
    internalSuccessRate: number; thirdPartySuccessRate: number;
  };
  distributions: {
    status: Record<string, number>;
    deliveryTimeBuckets: Record<string, number>;
  };
  trends: { daily: { date: string; total: number; delivered: number; failed: number; inTransit: number }[] };
  rankings: {
    drivers: { driverId: string; name: string; phone: string; totalShipments: number; delivered: number; failed: number; inTransit: number; successRate: number; avgDeliveryHours: number; totalValue: number; totalValueFormatted: string }[];
    districts: { district: string; total: number; delivered: number; failed: number; successRate: number; failureRate: number }[];
  };
}

// ============================================
// Compact VND formatter for charts
// ============================================
function compactVND(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

// ============================================
// Status colors map
// ============================================
const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500', CONFIRMED: 'bg-blue-500', PROCESSING: 'bg-indigo-500',
  PACKED: 'bg-purple-500', OUT_FOR_DELIVERY: 'bg-cyan-500',
  DELIVERED: 'bg-red-500', CANCELLED: 'bg-red-500', REFUNDED: 'bg-orange-500',
};

const ORDER_STATUS_LABELS: Record<string, { en: string; vi: string }> = {
  PENDING: { en: 'Pending', vi: 'Cho xac nhan' }, CONFIRMED: { en: 'Confirmed', vi: 'Da xac nhan' },
  PROCESSING: { en: 'Processing', vi: 'Dang xu ly' }, PACKED: { en: 'Packed', vi: 'Da dong goi' },
  OUT_FOR_DELIVERY: { en: 'Out for Delivery', vi: 'Dang giao' },
  DELIVERED: { en: 'Delivered', vi: 'Da giao' }, CANCELLED: { en: 'Cancelled', vi: 'Da huy' },
  REFUNDED: { en: 'Refunded', vi: 'Da hoan' },
};

const PAYMENT_METHOD_LABELS: Record<string, { en: string; vi: string }> = {
  CREDIT: { en: 'Credit', vi: 'Cong no' }, DIGITAL: { en: 'Digital', vi: 'Chuyen khoan' }, COD: { en: 'COD', vi: 'Thu tien' },
};

const TIER_COLORS: Record<string, string> = {
  BRONZE: 'bg-orange-500', SILVER: 'bg-gray-400', GOLD: 'bg-yellow-500', PLATINUM: 'bg-purple-500',
};

// Tab-to-endpoint mapping for reports API
const REPORT_TAB_ENDPOINTS: Record<string, string> = {
  revenue: 'revenue',
  orders: 'orders',
  products: 'products',
  shops: 'shops-analytics',
  shipments: 'shipments-analytics',
};

// ============================================
// Main Reports Page
// ============================================

export default function ReportsPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [period, setPeriod] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');

  // Data state
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [ordersData, setOrdersData] = useState<OrdersData | null>(null);
  const [productsData, setProductsData] = useState<ProductsData | null>(null);
  const [shopsData, setShopsData] = useState<ShopsData | null>(null);
  const [shipmentsData, setShipmentsData] = useState<ShipmentsData | null>(null);

  const [loading, setLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Fetch overview
  const fetchOverview = useCallback(async () => {
    try {
      setOverviewLoading(true);
      const json = await adminFetch(`/api/reports/overview?period=${period}`);
      if (json.success) setOverview(json.data);
    } catch (err) { console.error('Overview fetch error:', err); }
    finally { setOverviewLoading(false); }
  }, [period]);

  // Fetch tab-specific data
  const fetchTabData = useCallback(async (tab: string) => {
    if (tab === 'overview') return;
    const endpoint = REPORT_TAB_ENDPOINTS[tab];
    if (!endpoint) return;
    setLoading(true);
    try {
      const json = await adminFetch(`/api/reports/${endpoint}?period=${period}`);
      if (json.success) {
        switch (tab) {
          case 'revenue': setRevenue(json.data); break;
          case 'orders': setOrdersData(json.data); break;
          case 'products': setProductsData(json.data); break;
          case 'shops': setShopsData(json.data); break;
          case 'shipments': setShipmentsData(json.data); break;
        }
      }
    } catch (err) { console.error(`${tab} fetch error:`, err); }
    finally { setLoading(false); }
  }, [period]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { fetchTabData(activeTab); }, [activeTab, fetchTabData]);

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
  };

  const handleRefresh = () => {
    fetchOverview();
    fetchTabData(activeTab);
  };

  // Export CSV for current tab
  const handleExport = () => {
    // Build CSV based on active tab
    let csv = '';
    const BOM = '\uFEFF';

    if (activeTab === 'overview' && overview) {
      csv = 'KPI,Value\n';
      csv += `${t('Total Revenue', 'Tong Doanh thu')},${overview.kpis.totalRevenue}\n`;
      csv += `${t('Total Orders', 'Tong Don hang')},${overview.kpis.totalOrders}\n`;
      csv += `${t('Active Shops', 'Cua hang HD')},${overview.kpis.activeShops}\n`;
      csv += `${t('Success Rate', 'Ti le thanh cong')},${overview.kpis.successRate}%\n`;
    } else if (activeTab === 'orders' && ordersData) {
      csv = 'Date,Orders,Completed,Cancelled,Revenue\n';
      ordersData.trends.daily.forEach(d => {
        csv += `${d.date},${d.orders},${d.completed},${d.cancelled},${d.revenue}\n`;
      });
    } else if (activeTab === 'revenue' && revenue) {
      csv = 'Date,Revenue,Orders,AOV\n';
      revenue.trends.daily.forEach(d => {
        csv += `${d.date},${d.revenue},${d.orders},${d.avgOrderValue}\n`;
      });
    } else if (activeTab === 'products' && productsData) {
      csv = 'Product,SKU,Revenue,Qty,Category,Brand\n';
      productsData.rankings.topProducts.forEach(p => {
        csv += `"${p.name}","${p.sku}",${p.revenue},${p.qty},"${p.category}","${p.brand}"\n`;
      });
    } else if (activeTab === 'shops' && shopsData) {
      csv = 'Name,District,Tier,Orders,GMV\n';
      shopsData.rankings.topByGmv.forEach(s => {
        csv += `"${s.name}","${s.district || ''}","${s.loyaltyTier}",${s.totalOrders},${s.totalGmv}\n`;
      });
    } else if (activeTab === 'shipments' && shipmentsData) {
      csv = 'Date,Total,Delivered,Failed,InTransit\n';
      shipmentsData.trends.daily.forEach(d => {
        csv += `${d.date},${d.total},${d.delivered},${d.failed},${d.inTransit}\n`;
      });
    }

    if (!csv) return;
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aladin-report-${activeTab}-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============================================
  // OVERVIEW TAB
  // ============================================
  const renderOverview = () => {
    if (overviewLoading) {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      );
    }

    if (!overview) {
      return (
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">{t('No data available', 'Khong co du lieu')}</p>
        </div>
      );
    }

    const k = overview.kpis;

    return (
      <div className="space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Revenue" titleVi="Doanh thu" value={k.totalRevenueFormatted} icon={<DollarSign className="h-4 w-4" />} growth={k.revenueGrowth} locale={locale} variant="success" />
          <KpiCard title="Orders" titleVi="Don hang" value={k.totalOrders} icon={<ShoppingCart className="h-4 w-4" />} growth={k.orderGrowth} locale={locale} />
          <KpiCard title="Active Shops" titleVi="Cua hang HD" value={k.activeShops} icon={<Store className="h-4 w-4" />} locale={locale} suffix={`/ ${k.totalShops}`} />
          <KpiCard title="Avg Order Value" titleVi="TB Don hang" value={k.avgOrderValueFormatted} icon={<Package className="h-4 w-4" />} locale={locale} />
          <KpiCard title="Shipments" titleVi="Van chuyen" value={k.deliveredShipments} icon={<Truck className="h-4 w-4" />} locale={locale} suffix={`/ ${k.totalShipments}`} growth={k.successRateDelta ? k.successRateDelta : undefined} />
          <KpiCard title="Success Rate" titleVi="TL Thanh cong" value={`${k.successRate}%`} icon={<CheckCircle2 className="h-4 w-4" />} locale={locale} variant={k.successRate >= 90 ? 'success' : k.successRate >= 70 ? 'warning' : 'danger'} />
          <KpiCard title="Credit Exposure" titleVi="Cong no" value={k.totalCreditExposureFormatted} icon={<CreditCard className="h-4 w-4" />} locale={locale} variant={k.overdueShops > 0 ? 'warning' : 'default'} />
          <KpiCard title="Group Buy Savings" titleVi="Tiet kiem MC" value={k.totalSavingsFormatted} icon={<Tag className="h-4 w-4" />} locale={locale} variant="info" />
        </div>

        {/* Revenue Trend + Distributions Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <BarChart
              title="Revenue Trend" titleVi="Xu huong Doanh thu"
              data={overview.dailyRevenue.map(d => ({
                label: d.date.slice(5),
                value: d.revenue,
                color: d.date === overview.dailyRevenue[overview.dailyRevenue.length - 1]?.date ? 'bg-red-500' : 'bg-red-500/60',
              }))}
              formatValue={compactVND}
              locale={locale}
              height={200}
            />
          </div>

          <DistributionChart
            title="Order Status" titleVi="Trang thai Don hang"
            data={Object.entries(overview.distributions.orderStatus)
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => ({
                label: ORDER_STATUS_LABELS[status]?.en || status,
                labelVi: ORDER_STATUS_LABELS[status]?.vi || status,
                value: count,
                color: ORDER_STATUS_COLORS[status] || 'bg-gray-400',
              }))}
            totalLabel="Total" totalLabelVi="Tong"
            locale={locale}
          />
        </div>

        {/* Bottom Row: Top Categories + Payment + Tier */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <HBarChart
            title="Top Categories" titleVi="Danh muc hang dau"
            data={overview.topCategories.slice(0, 8).map(c => ({
              label: c.name, value: c.revenue,
              subtitle: c.revenueFormatted,
            }))}
            formatValue={compactVND}
            locale={locale}
            maxItems={8}
          />

          <DistributionChart
            title="Payment Method" titleVi="Phuong thuc TT"
            data={Object.entries(overview.distributions.paymentMethod)
              .sort((a, b) => b[1] - a[1])
              .map(([method, value]) => ({
                label: PAYMENT_METHOD_LABELS[method]?.en || method,
                labelVi: PAYMENT_METHOD_LABELS[method]?.vi || method,
                value,
                color: method === 'CREDIT' ? 'bg-amber-500' : method === 'DIGITAL' ? 'bg-blue-500' : 'bg-red-500',
              }))}
            locale={locale}
          />

          <DistributionChart
            title="Loyalty Tiers" titleVi="Cap Thanh vien"
            data={Object.entries(overview.distributions.loyaltyTier)
              .sort((a, b) => b[1] - a[1])
              .map(([tier, count]) => ({
                label: tier, value: count,
                color: TIER_COLORS[tier] || 'bg-gray-400',
              }))}
            totalLabel="Shops" totalLabelVi="Cua hang"
            locale={locale}
          />
        </div>
      </div>
    );
  };

  // ============================================
  // REVENUE TAB
  // ============================================
  const renderRevenue = () => {
    if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-full" /><div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div><Skeleton className="h-64 w-full" /></div>;
    if (!revenue) return <div className="text-center py-12"><p className="text-sm text-muted-foreground">{t('Failed to load revenue data.', 'Khong the tai du lieu doanh thu.')}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => fetchTabData('revenue')}>{t('Retry', 'Thu lai')}</Button></div>;

    const k = revenue.kpis;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Total Revenue" titleVi="Tong Doanh thu" value={k.totalRevenueFormatted} icon={<DollarSign className="h-4 w-4" />} growth={k.revenueGrowth} locale={locale} variant="success" />
          <KpiCard title="Discounts" titleVi="Giam gia" value={k.totalDiscountsFormatted} icon={<Tag className="h-4 w-4" />} locale={locale} variant="warning" />
          <KpiCard title="Delivery Fees" titleVi="Phi giao" value={k.totalDeliveryFeesFormatted} icon={<Truck className="h-4 w-4" />} locale={locale} />
          <KpiCard title="Avg Order Value" titleVi="TB Don hang" value={k.avgOrderValueFormatted} icon={<Package className="h-4 w-4" />} locale={locale} />
        </div>

        {/* Monthly comparison */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">{t('This Month', 'Thang nay')}</p>
                <p className="text-lg font-bold text-red-700">{k.thisMonthRevenueFormatted}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('Last Month', 'Thang truoc')}</p>
                <p className="text-lg font-bold">{k.lastMonthRevenueFormatted}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('MoM Growth', 'Tang/thang')}</p>
                <p className={`text-lg font-bold ${k.monthOverMonth && k.monthOverMonth >= 0 ? 'text-red-600' : 'text-red-600'}`}>
                  {k.monthOverMonth !== null ? `${k.monthOverMonth >= 0 ? '+' : ''}${k.monthOverMonth.toFixed(1)}%` : '-'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <BarChart
              title="Daily Revenue" titleVi="Doanh thu hang ngay"
              data={revenue.trends.daily.map(d => ({
                label: d.date.slice(5), value: d.revenue,
                color: d.date === revenue.trends.daily[revenue.trends.daily.length - 1]?.date ? 'bg-red-500' : 'bg-red-500/50',
              }))}
              formatValue={compactVND} locale={locale} height={200}
            />
          </div>
          <DistributionChart
            title="By Payment Method" titleVi="Theo PT Thanh toan"
            data={Object.entries(revenue.breakdown.byPaymentMethod)
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .map(([method, d]) => ({
                label: PAYMENT_METHOD_LABELS[method]?.en || method,
                labelVi: PAYMENT_METHOD_LABELS[method]?.vi || method,
                value: d.revenue,
                color: method === 'CREDIT' ? 'bg-amber-500' : method === 'DIGITAL' ? 'bg-blue-500' : 'bg-red-500',
              }))}
            locale={locale}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <HBarChart
            title="Revenue by Tier" titleVi="Doanh thu theo Cap"
            data={Object.entries(revenue.breakdown.byTier)
              .sort((a, b) => b[1].revenue - a[1].revenue)
              .map(([tier, d]) => ({
                label: tier, value: d.revenue, subtitle: `${d.count} orders`,
                color: TIER_COLORS[tier] || 'bg-gray-400',
              }))}
            formatValue={compactVND} locale={locale} maxItems={6}
          />
          <HBarChart
            title="Revenue by District" titleVi="Doanh thu theo Quan"
            data={revenue.breakdown.byDistrict.map(d => ({
              label: d.district, value: d.revenue, subtitle: d.revenueFormatted,
            }))}
            formatValue={compactVND} locale={locale} maxItems={8}
          />
        </div>

        {/* Top Revenue Shops Table */}
        {revenue.topShops.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">{t('Top Revenue Shops', 'Cua hang Doanh thu cao')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{t('Shop', 'Cua hang')}</TableHead>
                    <TableHead className="text-right">{t('Revenue', 'Doanh thu')}</TableHead>
                    <TableHead className="text-right">{t('Orders', 'Don hang')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenue.topShops.slice(0, 10).map((s, i) => (
                    <TableRow key={s.shopId}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium">{s.name}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">
                        <SensitiveValue value={s.revenue} maskType="amount" formatOptions={{ formatCurrency: true }} />
                      </TableCell>
                      <TableCell className="text-right text-xs">{s.orders}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ============================================
  // ORDERS TAB
  // ============================================
  const renderOrders = () => {
    if (loading) return <div className="space-y-4"><div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div></div>;
    if (!ordersData) return <div className="text-center py-12"><p className="text-sm text-muted-foreground">{t('Failed to load orders data.', 'Khong the tai du lieu don hang.')}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => fetchTabData('orders')}>{t('Retry', 'Thu lai')}</Button></div>;

    const k = ordersData.kpis;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Total Orders" titleVi="Tong Don hang" value={k.totalOrders} icon={<ShoppingCart className="h-4 w-4" />} growth={k.orderGrowth} locale={locale} />
          <KpiCard title="Completed" titleVi="Hoan thanh" value={k.completedOrders} icon={<CheckCircle2 className="h-4 w-4" />} locale={locale} growth={k.completionRate} suffix={`${k.completionRate}%`} />
          <KpiCard title="Cancelled" titleVi="Da huy" value={k.cancelledOrders} icon={<XCircle className="h-4 w-4" />} locale={locale} variant={k.cancelledOrders > 0 ? 'danger' : 'default'} suffix={`${k.cancellationRate}%`} />
          <KpiCard title="Avg Items/Order" titleVi="TB SP/Don" value={k.avgItemsPerOrder} icon={<Package className="h-4 w-4" />} locale={locale} />
        </div>

        {/* Revenue by Payment */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">{t('Credit', 'Cong no')}</p>
                <p className="text-base font-bold text-amber-700">{k.creditRevenueFormatted}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('Digital', 'Chuyen khoan')}</p>
                <p className="text-base font-bold text-blue-700">{k.digitalRevenueFormatted}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('COD', 'Thu tien')}</p>
                <p className="text-base font-bold text-red-700">{k.codRevenueFormatted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <BarChart
              title="Order Trend" titleVi="Xu huong Don hang"
              data={ordersData.trends.daily.map(d => ({
                label: d.date.slice(5), value: d.orders,
                color: d.date === ordersData.trends.daily[ordersData.trends.daily.length - 1]?.date ? 'bg-blue-500' : 'bg-blue-500/50',
              }))}
              locale={locale} height={200}
            />
          </div>
          <DistributionChart
            title="Order Status" titleVi="Trang thai"
            data={Object.entries(ordersData.distributions.status)
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([s, count]) => ({
                label: ORDER_STATUS_LABELS[s]?.en || s,
                labelVi: ORDER_STATUS_LABELS[s]?.vi || s,
                value: count,
                color: ORDER_STATUS_COLORS[s] || 'bg-gray-400',
              }))}
            totalLabel="Total" totalLabelVi="Tong"
            locale={locale}
          />
        </div>

        {/* Top Ordering Shops */}
        {ordersData.rankings.topShops.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">{t('Top Ordering Shops', 'Cua hang Dat nhieu nhat')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{t('Shop', 'Cua hang')}</TableHead>
                    <TableHead>{t('Tier', 'Cap')}</TableHead>
                    <TableHead className="text-right">{t('Orders', 'DH')}</TableHead>
                    <TableHead className="text-right">{t('Revenue', 'DT')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersData.rankings.topShops.slice(0, 10).map((s, i) => (
                    <TableRow key={s.shopId}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium">{s.name}</TableCell>
                      <TableCell>
                        <span className={`inline-block h-2 w-2 rounded-sm mr-1 ${TIER_COLORS[s.tier] || 'bg-gray-400'}`} />
                        <span className="text-[10px]">{s.tier}</span>
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium">{s.orders}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">
                        <SensitiveValue value={s.revenue} maskType="amount" formatOptions={{ formatCurrency: true, compact: true }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Largest Orders */}
        {ordersData.rankings.largestOrders.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">{t('Largest Orders', 'Don hang lon nhat')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{t('Shop', 'Cua hang')}</TableHead>
                    <TableHead>{t('Items', 'SP')}</TableHead>
                    <TableHead className="text-right">{t('Amount', 'Tien')}</TableHead>
                    <TableHead>{t('Status', 'TT')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersData.rankings.largestOrders.slice(0, 10).map((o, i) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium">{o.shopName}</TableCell>
                      <TableCell className="text-xs">{o.itemCount}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">
                        <SensitiveValue value={o.totalAmount} maskType="amount" formatOptions={{ formatCurrency: true }} />
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          o.status === 'DELIVERED' ? 'bg-yellow-50 text-red-700' :
                          o.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {ORDER_STATUS_LABELS[o.status]?.en || o.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ============================================
  // PRODUCTS TAB
  // ============================================
  const renderProducts = () => {
    if (loading) return <div className="space-y-4"><div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div></div>;
    if (!productsData) return <div className="text-center py-12"><p className="text-sm text-muted-foreground">{t('Failed to load products data.', 'Khong the tai du lieu san pham.')}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => fetchTabData('products')}>{t('Retry', 'Thu lai')}</Button></div>;

    const k = productsData.kpis;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Products Sold" titleVi="SP da ban" value={k.uniqueProductsSold} icon={<Package className="h-4 w-4" />} locale={locale} suffix={`/ ${k.activeProducts}`} />
          <KpiCard title="Total Items Sold" titleVi="Tong SL ban" value={k.totalItemsSold} icon={<BoxIcon className="h-4 w-4" />} locale={locale} />
          <KpiCard title="Product Revenue" titleVi="DT San pham" value={k.totalRevenueFormatted} icon={<DollarSign className="h-4 w-4" />} locale={locale} variant="success" />
          <KpiCard title="Avg Unit Price" titleVi="TB Don gia" value={k.avgUnitPriceFormatted} icon={<Tag className="h-4 w-4" />} locale={locale} />
        </div>

        {/* Stock Alerts */}
        {(k.lowStockCount > 0 || k.outOfStockCount > 0) && (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-800">{t('Stock Alerts', 'Canh bao Ton kho')}</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-lg bg-white p-3 border">
                  <p className="text-xs text-muted-foreground">{t('Out of Stock', 'Het hang')}</p>
                  <p className="text-xl font-bold text-red-600">{k.outOfStockCount}</p>
                </div>
                <div className="rounded-lg bg-white p-3 border">
                  <p className="text-xs text-muted-foreground">{t('Low Stock (< 10)', 'Sap het (< 10)')}</p>
                  <p className="text-xl font-bold text-amber-600">{k.lowStockCount}</p>
                </div>
                <div className="rounded-lg bg-white p-3 border">
                  <p className="text-xs text-muted-foreground">{t('Avg Stock Level', 'TB Ton kho')}</p>
                  <p className="text-xl font-bold">{k.avgStock}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Private Label */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">{t('Aladin Select', 'Aladin Select')}</p>
                <p className="text-base font-bold text-blue-700">{k.privateLabelRevenueFormatted}</p>
                <p className="text-[10px] text-muted-foreground">{k.privateLabelPercentage}% {t('of total', 'tong DT')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('Regular Products', 'SP Thuong')}</p>
                <p className="text-base font-bold">{k.regularRevenueFormatted}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('PL Products', 'SP PL')}</p>
                <p className="text-xl font-bold">{k.privateLabelCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <HBarChart
            title="Top Products by Revenue" titleVi="SP Doanh thu cao"
            data={productsData.rankings.topProducts.slice(0, 10).map(p => ({
              label: `${p.name} (${p.sku})`, value: p.revenue, subtitle: `${p.qty} units`,
            }))}
            formatValue={compactVND} locale={locale} maxItems={10}
          />
          <HBarChart
            title="Top Categories" titleVi="Danh muc"
            data={productsData.rankings.topCategories.slice(0, 10).map(c => ({
              label: c.name, value: c.revenue, subtitle: `${c.percentage}%`,
            }))}
            formatValue={compactVND} locale={locale} maxItems={10}
          />
        </div>

        {/* Out of Stock Table */}
        {productsData.stockAlerts.outOfStock.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                <XCircle className="h-4 w-4" />
                {t('Out of Stock Products', 'San pham Het hang')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-red-50/50">
                    <TableHead>{t('Product', 'San pham')}</TableHead>
                    <TableHead>{t('SKU', 'SKU')}</TableHead>
                    <TableHead className="text-right">{t('Price', 'Gia')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsData.stockAlerts.outOfStock.slice(0, 10).map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-medium">{p.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{p.sku}</TableCell>
                      <TableCell className="text-right text-xs">{p.basePriceFormatted}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ============================================
  // SHOPS TAB
  // ============================================
  const renderShops = () => {
    if (loading) return <div className="space-y-4"><div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div></div>;
    if (!shopsData) return <div className="text-center py-12"><p className="text-sm text-muted-foreground">{t('Failed to load shops data.', 'Khong the tai du lieu cua hang.')}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => fetchTabData('shops')}>{t('Retry', 'Thu lai')}</Button></div>;

    const k = shopsData.kpis;
    const ch = k.creditHealth;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Total Shops" titleVi="Tong CH" value={k.totalShops} icon={<Store className="h-4 w-4" />} locale={locale} />
          <KpiCard title="Active" titleVi="Hoat dong" value={k.activeShops} icon={<Users className="h-4 w-4" />} locale={locale} variant="success" />
          <KpiCard title="New Shops" titleVi="CH moi" value={k.newShops} icon={<Store className="h-4 w-4" />} growth={k.newShopsGrowth} locale={locale} variant="info" />
          <KpiCard title="Dormant" titleVi="Ngung hoat dong" value={k.dormantShops} icon={<AlertTriangle className="h-4 w-4" />} locale={locale} variant={k.dormantShops > 0 ? 'warning' : 'default'} />
        </div>

        {/* Credit Health */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">{t('Credit Health', 'Suc khoe Cong no')}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{t('Active', 'HD')}</p>
                <p className="text-lg font-bold text-red-600">{ch.active}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{t('Overdue', 'Qua han')}</p>
                <p className="text-lg font-bold text-amber-600">{ch.overdue}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{t('Locked', 'Bi khoa')}</p>
                <p className="text-lg font-bold text-red-600">{ch.locked}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{t('Utilization', 'Su dung')}</p>
                <p className={`text-lg font-bold ${ch.utilizationPercent > 80 ? 'text-red-600' : ch.utilizationPercent > 50 ? 'text-amber-600' : 'text-red-600'}`}>{ch.utilizationPercent}%</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">{t('Available', 'Con lai')}</p>
                <p className="text-base font-bold text-red-700">{ch.availableFormatted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DistributionChart
            title="Tier Distribution" titleVi="Phan bo Cap"
            data={Object.entries(shopsData.distributions.tier)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([tier, d]) => ({
                label: tier, value: d.count,
                color: TIER_COLORS[tier] || 'bg-gray-400',
                subtitle: `GMV: ${compactVND(d.gmv)}`,
              }))}
            totalLabel="Shops" totalLabelVi="Cua hang"
            locale={locale}
          />
          <HBarChart
            title="GMV by District" titleVi="GMV theo Quan"
            data={shopsData.distributions.district.map(d => ({
              label: d.district, value: d.count, subtitle: d.gmvFormatted,
            }))}
            locale={locale} maxItems={10}
          />
        </div>

        {/* Top GMV Shops Table */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">{t('Top GMV Shops', 'Cua hang GMV cao')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>{t('Shop', 'Cua hang')}</TableHead>
                  <TableHead>{t('Tier', 'Cap')}</TableHead>
                  <TableHead>{t('District', 'Quan')}</TableHead>
                  <TableHead className="text-right">{t('Orders', 'DH')}</TableHead>
                  <TableHead className="text-right">{t('GMV', 'GMV')}</TableHead>
                  <TableHead className="text-right">{t('AOV', 'TB/DH')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shopsData.rankings.topByGmv.slice(0, 15).map((s, i) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-xs font-medium">{s.name}</TableCell>
                    <TableCell>
                      <span className={`inline-block h-2 w-2 rounded-sm mr-1 ${TIER_COLORS[s.loyaltyTier] || 'bg-gray-400'}`} />
                      <span className="text-[10px]">{s.loyaltyTier}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.district || '-'}</TableCell>
                    <TableCell className="text-right text-xs">{s.totalOrders}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">
                      <SensitiveValue value={s.totalGmv} maskType="amount" formatOptions={{ formatCurrency: true, compact: true }} />
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      <SensitiveValue value={s.avgOrderValue} maskType="amount" formatOptions={{ formatCurrency: true }} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ============================================
  // SHIPMENTS TAB
  // ============================================
  const renderShipments = () => {
    if (loading) return <div className="space-y-4"><div className="grid grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div></div>;
    if (!shipmentsData) return <div className="text-center py-12"><p className="text-sm text-muted-foreground">{t('Failed to load shipments data.', 'Khong the tai du lieu van chuyen.')}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => fetchTabData('shipments')}>{t('Retry', 'Thu lai')}</Button></div>;

    const k = shipmentsData.kpis;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard title="Total Shipments" titleVi="Tong VC" value={k.totalShipments} icon={<Truck className="h-4 w-4" />} growth={k.shipmentGrowth} locale={locale} />
          <KpiCard title="Delivered" titleVi="Da giao" value={k.delivered} icon={<CheckCircle2 className="h-4 w-4" />} locale={locale} variant="success" />
          <KpiCard title="Failed" titleVi="That bai" value={k.failed} icon={<XCircle className="h-4 w-4" />} locale={locale} variant={k.failed > 0 ? 'danger' : 'default'} />
          <KpiCard title="Success Rate" titleVi="TL Thanh cong" value={`${k.successRate}%`} icon={<TrendingUp className="h-4 w-4" />} growth={k.successRateDelta} locale={locale} variant={k.successRate >= 90 ? 'success' : 'warning'} />
        </div>

        {/* Delivery Time */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">{t('Delivery Times', 'Thoi gian Giao hang')}</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">{t('Average', 'Trung binh')}</p>
                <p className="text-xl font-bold">{k.avgDeliveryHours}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('Fastest', 'Nhanh nhat')}</p>
                <p className="text-xl font-bold text-red-600">{k.minDeliveryHours}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('Slowest', 'Cham nhat')}</p>
                <p className="text-xl font-bold text-red-600">{k.maxDeliveryHours}h</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Internal vs 3rd Party */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground">{t('Internal Fleet', 'Noi bo')}</p>
                <p className="text-lg font-bold">{k.internal}</p>
                <p className="text-[10px] text-red-600">{k.internalSuccessRate}% {t('success', 'thanh cong')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('3rd Party', "Bên thu 3")}</p>
                <p className="text-lg font-bold">{k.thirdParty}</p>
                <p className="text-[10px] text-blue-600">{k.thirdPartySuccessRate}% {t('success', 'thanh cong')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('Shipment Value', 'Gia tri VC')}</p>
                <p className="text-base font-bold">{k.totalValueFormatted}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('Avg Value', 'TB/Don')}</p>
                <p className="text-base font-bold">{k.avgShipmentValueFormatted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <BarChart
              title="Shipment Trend" titleVi="Xu huong Van chuyen"
              data={shipmentsData.trends.daily.map(d => ({
                label: d.date.slice(5), value: d.total,
                color: d.date === shipmentsData.trends.daily[shipmentsData.trends.daily.length - 1]?.date ? 'bg-blue-500' : 'bg-blue-500/50',
              }))}
              locale={locale} height={200}
            />
          </div>
          <DistributionChart
            title="Delivery Time Distribution" titleVi="Phan bo TG Giao"
            data={Object.entries(shipmentsData.distributions.deliveryTimeBuckets)
              .filter(([, v]) => v > 0)
              .map(([bucket, count]) => ({
                label: bucket === 'under2h' ? '< 2h' : bucket === 'over24h' ? '> 24h' : bucket,
                labelVi: bucket === 'under2h' ? '< 2 gio' : bucket === 'over24h' ? '> 24 gio' : bucket,
                value: count,
                color: bucket === 'under2h' ? 'bg-red-500' : bucket === '2-4h' ? 'bg-blue-500' : bucket === '4-8h' ? 'bg-cyan-500' : bucket === '8-24h' ? 'bg-amber-500' : 'bg-red-500',
              }))}
            totalLabel="Total" totalLabelVi="Tong"
            locale={locale}
          />
        </div>

        {/* Driver Performance Table */}
        {shipmentsData.rankings.drivers.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">{t('Driver Performance', 'Hieu suat Tai xe')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>{t('Driver', 'Tai xe')}</TableHead>
                    <TableHead className="text-right">{t('Total', 'Tong')}</TableHead>
                    <TableHead className="text-right">{t('Delivered', 'Da giao')}</TableHead>
                    <TableHead className="text-right">{t('Failed', 'That bai')}</TableHead>
                    <TableHead className="text-right">{t('Success', 'TL')}</TableHead>
                    <TableHead className="text-right">{t('Avg Time', 'TB TG')}</TableHead>
                    <TableHead className="text-right">{t('Value', 'Gia tri')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipmentsData.rankings.drivers.slice(0, 10).map((d, i) => (
                    <TableRow key={d.driverId}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-xs font-medium">{d.name}</TableCell>
                      <TableCell className="text-right text-xs">{d.totalShipments}</TableCell>
                      <TableCell className="text-right text-xs font-medium text-red-600">{d.delivered}</TableCell>
                      <TableCell className="text-right text-xs">{d.failed > 0 ? <span className="text-red-600">{d.failed}</span> : '-'}</TableCell>
                      <TableCell className="text-right">
                        <span className={`text-xs font-semibold ${d.successRate >= 90 ? 'text-red-600' : d.successRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                          {d.successRate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs">{d.avgDeliveryHours > 0 ? `${d.avgDeliveryHours}h` : '-'}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">
                        <SensitiveValue value={d.totalValue} maskType="amount" formatOptions={{ formatCurrency: true, compact: true }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* District Performance */}
        {shipmentsData.rankings.districts.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">{t('Delivery by District', 'Giao hang theo Quan')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>{t('District', 'Quan')}</TableHead>
                    <TableHead className="text-right">{t('Total', 'Tong')}</TableHead>
                    <TableHead className="text-right">{t('Delivered', 'Da giao')}</TableHead>
                    <TableHead className="text-right">{t('Failed', 'That bai')}</TableHead>
                    <TableHead className="text-right">{t('Success Rate', 'TL TC')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipmentsData.rankings.districts.slice(0, 10).map((d, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{d.district}</TableCell>
                      <TableCell className="text-right text-xs">{d.total}</TableCell>
                      <TableCell className="text-right text-xs font-medium">{d.delivered}</TableCell>
                      <TableCell className="text-right text-xs">{d.failed}</TableCell>
                      <TableCell className="text-right">
                        <span className={`text-xs font-semibold ${d.successRate >= 90 ? 'text-red-600' : d.successRate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                          {d.successRate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />

        <main className="flex-1 p-4 md:p-6 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                {t('Analytics & Reports', 'Bao cao & Phan tich')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Platform-wide analytics, trends, and insights', 'Phan tich, xu huong va thong nhat toan nen tang')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DateRangePicker value={period} onChange={handlePeriodChange} locale={locale} />
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Lam moi')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                {t('Export', 'Xuat')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview" className="text-xs">
                <BarChart3 className="h-3.5 w-3.5 mr-1" />
                {t('Overview', 'Tong quan')}
              </TabsTrigger>
              <TabsTrigger value="revenue" className="text-xs">
                <DollarSign className="h-3.5 w-3.5 mr-1" />
                {t('Revenue', 'Doanh thu')}
              </TabsTrigger>
              <TabsTrigger value="orders" className="text-xs">
                <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                {t('Orders', 'Don hang')}
              </TabsTrigger>
              <TabsTrigger value="products" className="text-xs">
                <Package className="h-3.5 w-3.5 mr-1" />
                {t('Products', 'San pham')}
              </TabsTrigger>
              <TabsTrigger value="shops" className="text-xs">
                <Store className="h-3.5 w-3.5 mr-1" />
                {t('Shops', 'Cua hang')}
              </TabsTrigger>
              <TabsTrigger value="shipments" className="text-xs">
                <Truck className="h-3.5 w-3.5 mr-1" />
                {t('Shipments', 'Van chuyen')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">{renderOverview()}</TabsContent>
            <TabsContent value="revenue" className="mt-4">{renderRevenue()}</TabsContent>
            <TabsContent value="orders" className="mt-4">{renderOrders()}</TabsContent>
            <TabsContent value="products" className="mt-4">{renderProducts()}</TabsContent>
            <TabsContent value="shops" className="mt-4">{renderShops()}</TabsContent>
            <TabsContent value="shipments" className="mt-4">{renderShipments()}</TabsContent>
          </Tabs>
        </main>
      </SidebarInset>
    </div>
  );
}
