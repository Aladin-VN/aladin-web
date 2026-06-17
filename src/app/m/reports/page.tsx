'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  DollarSign,
  ShoppingBag,
  Package,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface OverviewKpis {
  totalRevenue: number;
  totalRevenueFormatted: string;
  totalOrders: number;
  activeShops: number;
  totalShops: number;
}

// ============================================
// Navigation Cards
// ============================================

const REPORT_CARDS = [
  {
    href: '/m/reports/overview',
    icon: BarChart3,
    titleVi: 'Tổng quan',
    titleEn: 'Overview',
    descVi: 'KPI nền tảng tổng hợp',
    descEn: 'Platform KPI dashboard',
    color: 'bg-yellow-50 text-red-600 dark:bg-red-900/30 dark:text-yellow-500',
  },
  {
    href: '/m/reports/revenue',
    icon: DollarSign,
    titleVi: 'Doanh thu',
    titleEn: 'Revenue',
    descVi: 'Phân tích doanh thu',
    descEn: 'Revenue breakdown',
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  },
  {
    href: '/m/reports/orders',
    icon: ShoppingBag,
    titleVi: 'Đơn hàng',
    titleEn: 'Orders',
    descVi: 'Phân tích đơn hàng',
    descEn: 'Order analytics',
    color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  },
  {
    href: '/m/reports/products',
    icon: Package,
    titleVi: 'Sản phẩm',
    titleEn: 'Products',
    descVi: 'Hiệu suất sản phẩm',
    descEn: 'Product performance',
    color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
  },
];

// ============================================
// Reports Hub Page
// ============================================

export default function MobileReportsPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [kpis, setKpis] = useState<OverviewKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Fetch quick summary
  const fetchOverview = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const res = await api.get<{ kpis: OverviewKpis }>('/reports/overview', { period: '30d' });
      if (res.success && res.data) {
        setKpis(res.data.kpis);
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
    fetchOverview();
  }, [fetchOverview]);

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
    if (diff > 80) {
      setPullState('ready');
    } else if (diff < 20) {
      setPullState('idle');
    }
  };

  const handleTouchEnd = () => {
    if (pullState === 'ready') {
      fetchOverview(true);
    }
    setPullState('idle');
    setStartY(0);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Báo cáo', 'Reports')} showNotifications={false} />
        <main className="px-4 pb-4 pt-3">
          {/* KPI skeletons */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-muted/50 rounded-xl p-3 animate-pulse">
                <div className="h-3 w-16 bg-muted rounded mb-2" />
                <div className="h-5 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
          {/* Card skeletons */}
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-muted/50 rounded-xl p-4 animate-pulse">
                <div className="h-10 w-10 bg-muted rounded-lg mb-3" />
                <div className="h-4 w-24 bg-muted rounded mb-2" />
                <div className="h-3 w-32 bg-muted rounded" />
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (error && !kpis) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Báo cáo', 'Reports')} showNotifications={false} />
        <main className="px-4 pb-4 pt-3">
          <div className="text-center py-16">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive/50" />
            <h3 className="text-lg font-semibold mb-2">
              {t('Lỗi tải dữ liệu', 'Failed to Load')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => fetchOverview(true)}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium"
            >
              {t('Thử lại', 'Retry')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <MobileHeader title={t('Báo cáo', 'Reports')} showNotifications={false} />

      <main className="px-4 pb-4 pt-3">
        {/* Pull-to-refresh indicator */}
        {pullState === 'ready' && (
          <div className="flex justify-center py-2 mb-2">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        )}

        {/* Refresh button */}
        <div className="flex justify-end mb-3">
          <button
            onClick={() => fetchOverview(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {t('Làm mới', 'Refresh')}
          </button>
        </div>

        {/* Quick Summary KPIs */}
        {kpis && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t('Tổng quan 30 ngày', '30-Day Summary')}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card rounded-xl border border-border p-3">
                <p className="text-[10px] text-muted-foreground font-medium">
                  {t('Doanh thu', 'Revenue')}
                </p>
                <p className="text-sm font-bold mt-1 truncate">
                  {kpis.totalRevenueFormatted}
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-3">
                <p className="text-[10px] text-muted-foreground font-medium">
                  {t('Đơn hàng', 'Orders')}
                </p>
                <p className="text-sm font-bold mt-1">
                  {kpis.totalOrders.toLocaleString()}
                </p>
              </div>
              <div className="bg-card rounded-xl border border-border p-3">
                <p className="text-[10px] text-muted-foreground font-medium">
                  {t('Shop hoạt động', 'Active Shops')}
                </p>
                <p className="text-sm font-bold mt-1">
                  {kpis.activeShops}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Navigation Cards */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t('Báo cáo chi tiết', 'Detailed Reports')}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {REPORT_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <button
                  key={card.href}
                  onClick={() => router.push(card.href)}
                  className="bg-card rounded-xl border border-border p-4 text-left hover:bg-accent/50 transition-colors active:scale-[0.98] transition-transform"
                >
                  <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center mb-3', card.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t(card.titleVi, card.titleEn)}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {t(card.descVi, card.descEn)}
                  </p>
                  <div className="flex justify-end mt-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
