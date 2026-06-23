'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  ThumbsUp,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { HorizontalBarChart } from '@/components/mobile/charts';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';

// ============================================
// Types
// ============================================

interface BenchmarkItem {
  metric: string;
  metricVi: string;
  metricEn: string;
  myValue: number;
  myValueFormatted: string;
  avgValue: number;
  avgValueFormatted: string;
  districtAvg: number | null;
  districtAvgFormatted: string | null;
  rank: number | null;
  totalInGroup: number | null;
  percentile: number;
  isHigher: boolean;
  isLowerBetter?: boolean;
}

interface SummaryInsight {
  strengths: string[];
  improvements: string[];
  overallMessage: string;
}

interface BenchmarkData {
  benchmarks: BenchmarkItem[];
  summary: SummaryInsight;
}

// ============================================
// Constants
// ============================================

const METRIC_ICONS: Record<string, React.ReactNode> = {
  avg_order_value: <Target className="h-4 w-4" />,
  order_frequency: <TrendingUp className="h-4 w-4" />,
  credit_utilization: <BarChart3 className="h-4 w-4" />,
  product_diversity: <Award className="h-4 w-4" />,
  total_spend_rank: <Target className="h-4 w-4" />,
};

const RANK_COLORS: Record<string, string> = {
  good: 'text-green-600',
  average: 'text-amber-600',
  low: 'text-red-600',
};

// ============================================
// Page
// ============================================

export default function MobileShopBenchmarkPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const [data, setData] = useState<BenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<BenchmarkData>('/shops/benchmark');
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error?.message || t('Failed to load benchmark', 'Không tải được so sánh'));
      }
    } catch {
      setError(t('Network error', 'Lỗi kết nối'));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getPerformanceColor = (item: BenchmarkItem) => {
    if (item.metric === 'total_spend_rank') {
      // For rank, lower is better, and percentile matters
      return item.percentile >= 50 ? 'good' : item.percentile >= 25 ? 'average' : 'low';
    }
    if (item.isLowerBetter) {
      return !item.isHigher ? 'good' : item.percentile < -20 ? 'low' : 'average';
    }
    return item.isHigher ? 'good' : item.percentile < -20 ? 'low' : 'average';
  };

  // ============================================
  // Loading
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Benchmark', 'So sánh hiệu quả')} showBack showNotifications={false} />
        <main className="px-4 pb-4 pt-3 space-y-4">
          <Skeleton className="h-20 rounded-xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
          <Skeleton className="h-32 rounded-xl" />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Benchmark', 'So sánh hiệu quả')} showBack showNotifications={false} />
        <main className="px-4 pt-3">
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{error || t('No data', 'Không có dữ liệu')}</p>
            <Button variant="outline" className="mt-4" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {t('Retry', 'Thử lại')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Benchmark', 'So sánh hiệu quả')} showBack showNotifications={false} />

      <main className="px-4 pb-6 pt-3 space-y-4">
        {/* Summary Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/90 to-primary p-4 text-primary-foreground">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-5 w-5" />
              <h2 className="text-base font-bold">
                {t('Performance Summary', 'Tổng quan hiệu quả')}
              </h2>
            </div>
            <p className="text-sm opacity-90">{data.summary.overallMessage}</p>
          </div>
          <CardContent className="p-3 space-y-2">
            {data.summary.strengths.length > 0 && (
              <div className="space-y-1">
                {data.summary.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ThumbsUp className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-xs">{s}</span>
                  </div>
                ))}
              </div>
            )}
            {data.summary.improvements.length > 0 && (
              <div className="space-y-1">
                {data.summary.improvements.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-muted-foreground">{s}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metric Comparison Cards */}
        {data.benchmarks.map((item) => {
          const perfColor = getPerformanceColor(item);
          const isRank = item.metric === 'total_spend_rank';
          const label = locale === 'vi' ? item.metricVi : item.metricEn;

          return (
            <Card key={item.metric}>
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                      {METRIC_ICONS[item.metric] || <BarChart3 className="h-4 w-4" />}
                    </div>
                    <span className="text-sm font-semibold">{label}</span>
                  </div>
                  {isRank && item.rank ? (
                    <Badge variant="outline" className={`text-xs font-bold ${RANK_COLORS[perfColor]}`}>
                      #{item.rank} / {item.totalInGroup}
                    </Badge>
                  ) : (
                    <div className={`flex items-center gap-0.5 text-xs font-medium ${RANK_COLORS[perfColor]}`}>
                      {item.isHigher ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : (
                        <TrendingDown className="h-3.5 w-3.5" />
                      )}
                      {item.isLowerBetter ? (
                        item.isHigher ? '↑' : '↓'
                      ) : (
                        item.isHigher ? '↑' : '↓'
                      )}
                    </div>
                  )}
                </div>

                {/* You vs Average comparison */}
                {!isRank && (
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">{t('You', 'Bạn')}</span>
                        <span className="font-semibold">{item.myValueFormatted}</span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            item.isHigher
                              ? item.isLowerBetter ? 'bg-amber-500' : 'bg-primary'
                              : item.isLowerBetter ? 'bg-green-500' : 'bg-muted-foreground/50'
                          }`}
                          style={{
                            width: `${Math.min(Math.abs(item.percentile) + 50, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">
                          {item.districtAvgFormatted ? t('District Avg', 'TB quận/huyện') : t('Platform Avg', 'TB nền tảng')}
                        </span>
                        <span className="text-muted-foreground">{item.avgValueFormatted}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-muted-foreground/30"
                          style={{
                            width: `${Math.min(Math.abs(item.percentile) + 50, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    {item.districtAvgFormatted && (
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">{t('District Avg', 'TB quận/huyện')}</span>
                        <span className="text-muted-foreground">{item.districtAvgFormatted}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Rank display */}
                {isRank && (
                  <div className="text-center py-2">
                    <p className="text-3xl font-bold text-primary">
                      Top {100 - item.percentile}%
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {item.percentile >= 70
                        ? t('Excellent performance! 🎉', 'Hiệu quả xuất sắc! 🎉')
                        : item.percentile >= 40
                        ? t('Good performance', 'Hiệu quả tốt')
                        : t('Room for improvement', 'Cần cải thiện thêm')}
                    </p>
                    {item.percentile > 0 && (
                      <Progress value={item.percentile} className="h-2 mt-2" />
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Comparison Bar Chart */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">
              {t('You vs Platform Average', 'Bạn so với trung bình nền tảng')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <HorizontalBarChart
              data={data.benchmarks
                .filter((b) => b.metric !== 'total_spend_rank' && b.avgValue > 0)
                .map((b) => ({
                  label: locale === 'vi' ? b.metricVi : b.metricEn,
                  value: b.myValue > 0 ? b.myValue : 1,
                  color: b.isHigher
                    ? b.isLowerBetter ? '#f59e0b' : '#22c55e'
                    : b.isLowerBetter ? '#22c55e' : '#f59e0b',
                  maxValue: Math.max(b.myValue, b.avgValue) * 1.2,
                }))}
              height={data.benchmarks.filter((b) => b.metric !== 'total_spend_rank').length * 35}
              barHeight={22}
              formatValue={(v) => {
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}tr`;
                if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                return String(Math.round(v));
              }}
            />
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12 text-xs"
            onClick={() => router.push('/m/shop/analytics')}
          >
            <span>{t('📊 Analytics', '📊 Phân tích')}</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
          <Button
            variant="outline"
            className="h-12 text-xs"
            onClick={() => router.push('/m/shop/loyalty')}
          >
            <span>{t('🏆 Loyalty', '🏆 Thân thiết')}</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </main>
    </div>
  );
}