'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAppStore } from '@/stores/app.store';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { MobileKpiCard } from '@/components/mobile/kpi-card';
import {
  DollarSign, TrendingDown, TrendingUp, Percent, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ============================================
// Types
// ============================================

interface MarginProduct {
  id: string;
  name: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  qtySold?: number;
  avgPrice?: number;
  avgCost?: number;
}

interface MarginCategory {
  id: string;
  name: string;
  revenue: number;
  marginPct: number;
}

interface MarginData {
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  marginPct: number;
  products: MarginProduct[];
  categories: MarginCategory[];
  lowMarginAlerts: { productId: string; productName: string; marginPct: number; suggestion: string }[];
}

type Period = '7d' | '30d' | '90d';

// ============================================
// Helpers
// ============================================

const t = (vi: string, en: string, locale: string) => (locale === 'vi' ? vi : en);

const marginColor = (pct: number) => {
  if (pct > 15) return 'text-green-600';
  if (pct >= 5) return 'text-yellow-600';
  return 'text-red-600';
};

const marginBg = (pct: number) => {
  if (pct > 15) return 'bg-green-50 border-green-200';
  if (pct >= 5) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
};

const periods: { key: Period; vi: string; en: string }[] = [
  { key: '7d', vi: '7 ngày', en: '7 days' },
  { key: '30d', vi: '30 ngày', en: '30 days' },
  { key: '90d', vi: '90 ngày', en: '90 days' },
];

// ============================================
// Component
// ============================================

export default function MarginsPage() {
  const locale = useAppStore((s) => s.locale);
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<MarginData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/distributor/analytics/margins?period=${period}`);
      if (res.success) {
        setData(res.data);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const sortedProducts = data?.products
    ? [...data.products].sort((a, b) => b.marginPct - a.marginPct)
    : [];

  const bestCategoryPct = data?.categories
    ? Math.max(...data.categories.map((c) => c.marginPct), 1)
    : 1;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Phân tích GVM', 'GVM Analytics', locale)}
        showNotifications={false}
      />

      <main className="px-4 pb-24 pt-2">
        {/* Period chips */}
        <div className="flex gap-2 mb-4">
          {periods.map((p) => (
            <button
              key={p.key}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                period === p.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
              onClick={() => setPeriod(p.key)}
            >
              {locale === 'vi' ? p.vi : p.en}
            </button>
          ))}
        </div>

        {/* KPI 2x2 grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <MobileKpiCard
              label={t('Tổng doanh thu', 'Total Revenue', locale)}
              value={formatVND(data.totalRevenue)}
              icon={<DollarSign className="h-4 w-4" />}
              variant="success"
            />
            <MobileKpiCard
              label={t('Giá vốn', 'Total Cost', locale)}
              value={formatVND(data.totalCost)}
              icon={<TrendingDown className="h-4 w-4" />}
              variant="warning"
            />
            <MobileKpiCard
              label={t('Lợi nhuận gộp', 'Gross Profit', locale)}
              value={formatVND(data.grossProfit)}
              icon={<TrendingUp className="h-4 w-4" />}
              variant="default"
            />
            <MobileKpiCard
              label={t('Biên lợi nhuận', 'Margin %', locale)}
              value={`${data.marginPct.toFixed(1)}%`}
              icon={<Percent className="h-4 w-4" />}
              variant="success"
            />
          </div>
        ) : null}

        {/* Tabs */}
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-10">
            <TabsTrigger value="products" className="text-xs">
              {t('Sản phẩm', 'Products', locale)}
            </TabsTrigger>
            <TabsTrigger value="categories" className="text-xs">
              {t('Danh mục', 'Categories', locale)}
            </TabsTrigger>
          </TabsList>

          {/* Products tab */}
          <TabsContent value="products" className="mt-3">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : sortedProducts.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  {t('Chưa có dữ liệu', 'No data available', locale)}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {sortedProducts.map((p) => {
                  const isExpanded = expandedProduct === p.id;
                  return (
                    <Card
                      key={p.id}
                      className={`rounded-xl cursor-pointer transition-colors ${marginBg(p.marginPct)}`}
                      onClick={() => setExpandedProduct(isExpanded ? null : p.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatVND(p.revenue)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              className={`text-xs font-bold ${marginColor(p.marginPct)}`}
                              style={{ border: 'none', background: 'transparent' }}
                            >
                              {p.marginPct.toFixed(1)}%
                            </Badge>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                          <span>
                            {t('Giá vốn', 'Cost', locale)}: {formatVND(p.cost)}
                          </span>
                          <span className={marginColor(p.marginPct)}>
                            {t('LN', 'Profit', locale)}: {formatVND(p.margin)}
                          </span>
                        </div>

                        {isExpanded && (
                          <>
                            <Separator className="my-2" />
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div>
                                <p className="text-muted-foreground">
                                  {t('SL bán', 'Qty Sold', locale)}
                                </p>
                                <p className="font-medium">{p.qtySold || 0}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">
                                  {t('TB giá bán', 'Avg Price', locale)}
                                </p>
                                <p className="font-medium">
                                  {p.avgPrice ? formatVND(p.avgPrice) : '-'}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">
                                  {t('TB giá vốn', 'Avg Cost', locale)}
                                </p>
                                <p className="font-medium">
                                  {p.avgCost ? formatVND(p.avgCost) : '-'}
                                </p>
                              </div>
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Categories tab */}
          <TabsContent value="categories" className="mt-3">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            ) : (!data?.categories || data.categories.length === 0) ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  {t('Chưa có dữ liệu', 'No data available', locale)}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {data.categories.map((cat) => {
                  const barWidth = bestCategoryPct > 0
                    ? (cat.marginPct / bestCategoryPct) * 100
                    : 0;
                  return (
                    <Card key={cat.id} className="rounded-xl">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium">{cat.name}</p>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${marginColor(cat.marginPct)}`}>
                              {cat.marginPct.toFixed(1)}%
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatVND(cat.revenue)}
                            </p>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              cat.marginPct > 15
                                ? 'bg-green-500'
                                : cat.marginPct >= 5
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Low Margin Alerts */}
        {!loading && data?.lowMarginAlerts && data.lowMarginAlerts.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              {t('Cảnh báo biên thấp', 'Low Margin Alerts', locale)}
            </h3>
            <div className="space-y-2">
              {data.lowMarginAlerts.map((alert) => (
                <Card key={alert.productId} className="rounded-xl border-red-200 bg-red-50/50">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-red-800">{alert.productName}</p>
                        <p className="text-xs text-red-600 font-semibold mt-0.5">
                          {alert.marginPct.toFixed(1)}%
                        </p>
                      </div>
                      <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                    </div>
                    {alert.suggestion && (
                      <p className="text-[11px] text-red-600/80 mt-1.5">
                        {alert.suggestion}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}