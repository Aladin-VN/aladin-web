'use client';

import { useState, useEffect, useCallback } from 'react';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { cn } from '@/lib/utils';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Package,
  BarChart3,
  DollarSign,
  AlertTriangle,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MobileKpiCard } from '@/components/mobile/kpi-card';

// ============================================
// Period Selector
// ============================================

const PERIODS = [
  { key: '7d', vi: '7 ngày', en: '7 days' },
  { key: '30d', vi: '30 ngày', en: '30 days' },
  { key: '90d', vi: '90 ngày', en: '90 days' },
  { key: 'thisMonth', vi: 'Tháng này', en: 'This month' },
  { key: 'lastMonth', vi: 'Tháng trước', en: 'Last month' },
];

// ============================================
// Types
// ============================================

interface ProductsKpis {
  totalProducts: number;
  activeProducts: number;
  categories: number;
  uniqueProductsSold: number;
  totalItemsSold: number;
  totalRevenue: number;
  totalRevenueFormatted: string;
  lowStockCount: number;
  outOfStockCount: number;
}

interface TopProduct {
  productId: string;
  name: string;
  sku: string;
  revenue: number;
  revenueFormatted: string;
  qty: number;
  category: string;
  brand: string;
  inStock: boolean;
}

interface TopCategory {
  name: string;
  revenue: number;
  revenueFormatted: string;
  qty: number;
  productCount: number;
  percentage: number;
}

interface TopBrand {
  name: string;
  revenue: number;
  revenueFormatted: string;
  qty: number;
  percentage: number;
}

interface LowStockItem {
  id: string;
  name: string;
  sku: string;
  basePrice: number;
  basePriceFormatted: string;
  stockQuantity: number;
  unit: string;
}

interface OutOfStockItem {
  id: string;
  name: string;
  sku: string;
  basePrice: number;
  basePriceFormatted: string;
  unit: string;
}

interface ProductsData {
  kpis: ProductsKpis;
  rankings: {
    topProducts: TopProduct[];
    topCategories: TopCategory[];
    topBrands: TopBrand[];
  };
  stockAlerts: {
    lowStock: LowStockItem[];
    outOfStock: OutOfStockItem[];
  };
}

// ============================================
// Products Report Page
// ============================================

export default function MobileProductsReportPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<ProductsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showLowStock, setShowLowStock] = useState(true);

  // Fetch data
  const fetchData = useCallback(async (p: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = await api.get<ProductsData>('/reports/products', { period: p });
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
  }, [locale, t]);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  // Pull-to-refresh
  const [pullState, setPullState] = useState<'idle' | 'pulling' | 'ready'>('idle');
  const [startY, setStartY] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
      setPullState('pulling');
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullState === 'idle') return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 80) setPullState('ready');
    else if (diff < 20) setPullState('idle');
  };

  const handleTouchEnd = () => {
    if (pullState === 'ready') fetchData(period, true);
    setPullState('idle');
    setStartY(0);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Sản phẩm', 'Products')} showBack showNotifications={false} />
        <main className="px-4 pb-4 pt-3">
          <div className="flex gap-2 mb-4">
            {PERIODS.map((_, i) => (
              <div key={i} className="h-8 w-20 rounded-full bg-muted/50 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-muted/50 rounded-xl p-3 animate-pulse">
                <div className="h-3 w-20 bg-muted rounded mb-2" />
                <div className="h-5 w-24 bg-muted rounded" />
              </div>
            ))}
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-muted/50 rounded-xl p-4 mb-4 animate-pulse">
              <div className="h-4 w-32 bg-muted rounded mb-3" />
              <div className="h-3 w-full bg-muted rounded" />
            </div>
          ))}
        </main>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Sản phẩm', 'Products')} showBack showNotifications={false} />
        <main className="px-4 pb-4 pt-3">
          <div className="text-center py-16">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive/50" />
            <h3 className="text-lg font-semibold mb-2">{t('Lỗi tải dữ liệu', 'Failed to Load')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => fetchData(period, true)}
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
  const topProducts = data?.rankings?.topProducts || [];
  const topCategories = data?.rankings?.topCategories || [];
  const topBrands = data?.rankings?.topBrands || [];
  const lowStock = data?.stockAlerts?.lowStock || [];
  const outOfStock = data?.stockAlerts?.outOfStock || [];
  const maxCatRevenue = topCategories.length > 0 ? topCategories[0].revenue : 1;
  const maxBrandRevenue = topBrands.length > 0 ? topBrands[0].revenue : 1;

  return (
    <div
      className="min-h-screen bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <MobileHeader title={t('Sản phẩm', 'Products')} showBack showNotifications={false} />

      <main className="px-4 pb-4 pt-3">
        {/* Pull-to-refresh */}
        {pullState === 'ready' && (
          <div className="flex justify-center py-2 mb-2">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        )}

        {/* Refresh */}
        <div className="flex justify-end mb-3">
          <button
            onClick={() => fetchData(period, true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {t('Làm mới', 'Refresh')}
          </button>
        </div>

        {/* Period selector */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar mb-4">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                period === p.key ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground'
              )}
            >
              {t(p.vi, p.en)}
            </button>
          ))}
        </div>

        {/* KPI Cards (2x2) */}
        {kpis && (
          <section className="mb-6">
            <div className="grid grid-cols-2 gap-3">
              <MobileKpiCard
                label="Unique Products Sold"
                labelVi="SP đã bán"
                value={kpis.uniqueProductsSold.toLocaleString()}
                icon={<Package className="h-4 w-4" />}
                locale={locale}
              />
              <MobileKpiCard
                label="Total Items Sold"
                labelVi="Tổng số lượng"
                value={kpis.totalItemsSold.toLocaleString()}
                icon={<BarChart3 className="h-4 w-4" />}
                locale={locale}
              />
              <MobileKpiCard
                label="Total Revenue"
                labelVi="Tổng doanh thu"
                value={kpis.totalRevenueFormatted}
                icon={<DollarSign className="h-4 w-4" />}
                locale={locale}
              />
              <MobileKpiCard
                label="Active / Total"
                labelVi="Hoạt động / Tổng"
                value={`${kpis.activeProducts} / ${kpis.totalProducts}`}
                icon={<TrendingUp className="h-4 w-4" />}
                locale={locale}
              />
            </div>
          </section>
        )}

        {/* Stock Alerts */}
        {kpis && (kpis.lowStockCount > 0 || kpis.outOfStockCount > 0) && (
          <section className="mb-6">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {t('Cảnh báo tồn kho', 'Stock Alerts')}
                </h3>
                <div className="flex items-center gap-2">
                  {kpis.lowStockCount > 0 && (
                    <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] hover:bg-red-100">
                      {kpis.lowStockCount} {t('sắp hết', 'low')}
                    </Badge>
                  )}
                  {kpis.outOfStockCount > 0 && (
                    <Badge className="bg-gray-800 text-white dark:bg-gray-700 dark:text-gray-200 text-[10px] hover:bg-gray-800">
                      {kpis.outOfStockCount} {t('hết hàng', 'out')}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tab toggle */}
              <div className="flex gap-1 bg-muted/50 rounded-lg p-1 mb-3">
                <button
                  onClick={() => setShowLowStock(true)}
                  className={cn(
                    'flex-1 py-1.5 rounded-md text-[11px] font-medium transition-colors',
                    showLowStock ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  {t('Sắp hết hàng', 'Low Stock')} ({kpis.lowStockCount})
                </button>
                <button
                  onClick={() => setShowLowStock(false)}
                  className={cn(
                    'flex-1 py-1.5 rounded-md text-[11px] font-medium transition-colors',
                    !showLowStock ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                  )}
                >
                  {t('Hết hàng', 'Out of Stock')} ({kpis.outOfStockCount})
                </button>
              </div>

              {/* Low stock list */}
              {showLowStock ? (
                lowStock.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{t('Không có sản phẩm', 'No products')}</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {lowStock.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">{item.sku} · {item.basePriceFormatted}</p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] hover:bg-amber-100 shrink-0">
                          {item.stockQuantity} {t('còn', 'left')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                outOfStock.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">{t('Không có sản phẩm', 'No products')}</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {outOfStock.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground">{item.sku} · {item.basePriceFormatted}</p>
                        </div>
                        <div className="flex items-center gap-1 text-red-500 shrink-0">
                          <XCircle className="h-3 w-3" />
                          <span className="text-[10px] font-medium">{t('Hết', 'Out')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {/* Top Products by Revenue */}
        <section className="mb-6">
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('SP doanh thu cao nhất', 'Top Products by Revenue')}
            </h3>
            {topProducts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('Không có dữ liệu', 'No data')}</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {topProducts.slice(0, 10).map((product, i) => (
                  <div key={product.productId} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold truncate">{product.name}</p>
                        {!product.inStock && (
                          <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {product.sku} · {product.qty} {t('bán', 'sold')} · {product.category}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-red-600 dark:text-yellow-500 shrink-0">
                      {product.revenueFormatted}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Top Categories */}
        <section className="mb-6">
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('Danh mục hàng đầu', 'Top Categories')}
            </h3>
            {topCategories.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('Không có dữ liệu', 'No data')}</p>
            ) : (
              <div className="space-y-3">
                {topCategories.slice(0, 8).map((cat, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate max-w-[55%]">{cat.name}</span>
                      <span className="text-xs font-semibold">{cat.revenueFormatted}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${maxCatRevenue > 0 ? (cat.revenue / maxCatRevenue) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {cat.qty} {t('bán', 'sold')} · {cat.productCount} SP
                      </span>
                      <span className="text-[10px] text-muted-foreground">{cat.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Top Brands */}
        <section>
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">
              {t('Thương hiệu hàng đầu', 'Top Brands')}
            </h3>
            {topBrands.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t('Không có dữ liệu', 'No data')}</p>
            ) : (
              <div className="space-y-3">
                {topBrands.slice(0, 5).map((brand, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{brand.name}</span>
                      <span className="text-xs font-semibold">{brand.revenueFormatted}</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500 transition-all"
                        style={{ width: `${maxBrandRevenue > 0 ? (brand.revenue / maxBrandRevenue) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{brand.qty} {t('bán', 'sold')}</span>
                      <span className="text-[10px] text-muted-foreground">{brand.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
