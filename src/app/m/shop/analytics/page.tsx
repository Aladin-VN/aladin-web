'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  CreditCard,
  Package,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Star,
  Award,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';

// ============================================
// Types
// ============================================

interface FavoriteProduct {
  productId: string;
  productName: string;
  quantity: number;
  totalSpent: number;
}

interface LoyaltySummary {
  currentTier: string;
  nextTier: string | null;
  ordersNeeded: number;
  spendNeeded: number;
  benefits: string[];
}

interface BenchmarkRow {
  metric: string;
  myValue: number;
  avgValue: number;
}

interface MonthData {
  revenue: number;
  orders: number;
}

interface ComparisonData {
  thisMonth: MonthData;
  monthGrowth: number;
}

interface AnalyticsData {
  comparison: ComparisonData;
  favoriteProducts: FavoriteProduct[];
  loyalty: LoyaltySummary | null;
  benchmarks: BenchmarkRow[] | null;
}

// ============================================
// Helpers
// ============================================

const fmtVND = (amount: number) =>
  new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';

// ============================================
// Page
// ============================================

export default function MobileShopAnalyticsPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<AnalyticsData>('/shops/my-analytics');
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(
          res.error?.message ||
            t('Không tải được phân tích', 'Failed to load analytics')
        );
      }
    } catch {
      setError(t('Lỗi kết nối', 'Network error'));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================
  // Loading
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Phân tích của tôi', 'My Analytics')}
          showBack
          showNotifications={false}
        />
        <main className="px-4 pb-24 pt-3 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Phân tích của tôi', 'My Analytics')}
          showBack
          showNotifications={false}
        />
        <main className="px-4 pt-3">
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {error || t('Không có dữ liệu', 'No data')}
            </p>
            <Button variant="outline" className="mt-4" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {t('Thử lại', 'Retry')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ============================================
  // KPI data
  // ============================================
  const comp = data.comparison;
  const thisMonth = comp?.thisMonth || { revenue: 0, orders: 0 };
  const growth = comp?.monthGrowth ?? 0;
  const avgOrderValue =
    thisMonth.orders > 0
      ? Math.round(thisMonth.revenue / thisMonth.orders)
      : 0;

  const kpis = [
    {
      label: t('Chi tiêu tháng này', 'Spend this month'),
      value: fmtVND(thisMonth.revenue),
      icon: CreditCard,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: t('Số đơn hàng', 'Orders'),
      value: `${thisMonth.orders}`,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: t('Đơn trung bình', 'Avg order value'),
      value: fmtVND(avgOrderValue),
      icon: BarChart3,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: t('Tăng trưởng', 'Growth'),
      value: `${growth}%`,
      icon: TrendingUp,
      color: growth >= 0 ? 'text-green-600' : 'text-red-600',
      bg: 'bg-yellow-50',
    },
  ];

  // ============================================
  // Render
  // ============================================
  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Phân tích của tôi', 'My Analytics')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-24 pt-3 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className={`${kpi.bg} border-0`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                  <span className="text-[11px] text-muted-foreground">
                    {kpi.label}
                  </span>
                </div>
                <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Favorite Products */}
        {data.favoriteProducts && data.favoriteProducts.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Star className="h-4 w-4" />
                {t('Sản phẩm hay mua', 'Favorite Products')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {data.favoriteProducts.slice(0, 5).map((p) => (
                  <div
                    key={p.productId}
                    className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('x', 'x')}
                        {p.quantity}
                      </p>
                    </div>
                    <span className="text-sm font-semibold">
                      {fmtVND(p.totalSpent)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loyalty Summary */}
        {data.loyalty && (
          <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50/50 to-transparent">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Award className="h-4 w-4 text-yellow-600" />
                <h3 className="text-sm font-semibold">
                  {t('Hạng thành viên', 'Member Tier')}
                </h3>
              </div>
              <div className="flex items-center justify-between">
                <Badge className="text-base px-3 py-1">
                  {data.loyalty.currentTier}
                </Badge>
                {data.loyalty.nextTier && (
                  <div className="text-right text-xs text-muted-foreground max-w-[60%]">
                    {t(
                      `Cần thêm ${data.loyalty.ordersNeeded} đơn hoặc ${fmtVND(data.loyalty.spendNeeded)} để lên`,
                      `Need ${data.loyalty.ordersNeeded} more orders or ${fmtVND(data.loyalty.spendNeeded)} to reach`
                    )}{' '}
                    <b>{data.loyalty.nextTier}</b>
                  </div>
                )}
              </div>
              {data.loyalty.benefits && data.loyalty.benefits.length > 0 && (
                <div className="space-y-1">
                  {data.loyalty.benefits.map((b, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      ✓ {b}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Benchmark Comparison */}
        {data.benchmarks && data.benchmarks.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t('So sánh với trung bình', 'vs. Average')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {data.benchmarks.slice(0, 5).map((b) => (
                  <div
                    key={b.metric}
                    className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
                  >
                    <span className="text-sm">{b.metric}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold">
                        {fmtVND(b.myValue)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">
                        / {fmtVND(b.avgValue)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12 text-xs"
            onClick={() => router.push('/m/shop/reorder')}
          >
            <span>{t('🔄 Gợi ý đặt hàng', '🔄 Reorder')}</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
          <Button
            variant="outline"
            className="h-12 text-xs"
            onClick={() => router.push('/m/shop/benchmark')}
          >
            <span>{t('🏆 So sánh', '🏆 Benchmark')}</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </main>
    </div>
  );
}