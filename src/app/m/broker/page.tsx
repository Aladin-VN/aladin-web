'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { cn } from '@/lib/utils';
import {
  DollarSign,
  TrendingUp,
  Users,
  MapPin,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  MinusCircle,
  Trophy,
  ChevronDown,
  Filter,
  Building2,
  Store,
  Loader2,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface BrokerStats {
  totalBrokers: number;
  activeBrokers: number;
  newBrokersThisMonth: number;
  totalCommissionEarned: number;
  totalCommissionEarnedFormatted: string;
  totalGmvGenerated: number;
  totalGmvGeneratedFormatted: string;
  avgCommissionPerBroker: number;
  avgGmvPerBroker: number;
  tierDistribution: Record<string, number>;
  topPerformers: TopPerformer[];
  territoryCoverage: {
    totalWards: number;
    coveredWards: number;
    uncoveredWards: number;
    coveragePercent: number;
  };
  monthlyTrends: MonthlyTrend[];
}

interface TopPerformer {
  id: string;
  name: string;
  phone: string;
  tier: string;
  gmvGenerated: number;
  gmvGeneratedFormatted: string;
  commissionEarned: number;
  commissionEarnedFormatted: string;
  shopsReferred: number;
}

interface MonthlyTrend {
  month: string;
  brokers: number;
  gmv: number;
  gmvFormatted: string;
  commission: number;
  commissionFormatted: string;
}

interface CommissionItem {
  id: string;
  userId: string;
  name: string;
  phone: string;
  status: string;
  tier: string;
  commissionRate: number;
  commissionRatePercent: string;
  totalShopsReferred: number;
  totalCommissionEarned: number;
  totalCommissionEarnedFormatted: string;
  totalGmvGenerated: number;
  totalGmvGeneratedFormatted: string;
  effectiveRate: string;
  ward: { id: string; name: string; district: string } | null;
  joinedAt: string;
}

interface CommissionSummary {
  totalUnpaidCommission: number;
  totalUnpaidCommissionFormatted: string;
  totalGmvGenerated: number;
  totalGmvGeneratedFormatted: string;
  brokersWithEarnings: number;
  brokersWithoutEarnings: number;
}

interface TerritoryWard {
  wardId: string;
  wardName: string;
  wardNameEn: string;
  district: string;
  shopCount: number;
  assignedBrokers: {
    brokerId: string;
    name: string;
    phone: string;
    tier: string;
    commissionRate: number;
    status: string;
    totalShopsReferred: number;
    totalGmvGenerated: number;
  }[];
  isCovered: boolean;
  brokerCount: number;
}

interface TerritoryDistrict {
  district: string;
  wardCount: number;
}

interface TerritorySummary {
  totalWards: number;
  coveredWards: number;
  uncoveredWards: number;
  coveragePercent: number;
  totalShops: number;
  coveredShops: number;
  uncoveredShops: number;
  shopCoveragePercent: number;
}

// ============================================
// Tier Labels Map (outside component)
// ============================================

const TIER_LABELS: Record<string, { vi: string; en: string; color: string }> = {
  WARD_LEVEL: { vi: 'Cấp phường', en: 'Ward Level', color: 'bg-blue-100 text-blue-700' },
  CATEGORY_SPECIALIST: { vi: 'Chuyên ngành', en: 'Category Specialist', color: 'bg-purple-100 text-purple-700' },
  FACTORY_GATE: { vi: 'Cổng nhà máy', en: 'Factory Gate', color: 'bg-emerald-100 text-emerald-700' },
};

const STATUS_LABELS: Record<string, { vi: string; en: string; color: string }> = {
  ACTIVE: { vi: 'Hoạt động', en: 'Active', color: 'bg-emerald-100 text-emerald-700' },
  INACTIVE: { vi: 'Ngưng', en: 'Inactive', color: 'bg-gray-100 text-gray-600' },
  LOCKED: { vi: 'Bị khóa', en: 'Locked', color: 'bg-red-100 text-red-700' },
  SUSPENDED: { vi: 'Tạm đình chỉ', en: 'Suspended', color: 'bg-amber-100 text-amber-700' },
};

const TABS = [
  { id: 'overview', vi: 'Tổng quan', en: 'Overview' },
  { id: 'commissions', vi: 'Hoa hồng', en: 'Commissions' },
  { id: 'territory', vi: 'Lãnh thổ', en: 'Territory' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const VI_MONTHS = [
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6',
  'T7', 'T8', 'T9', 'T10', 'T11', 'T12',
];

// ============================================
// Helper: parse month string to short label
// ============================================

function formatMonthLabel(monthStr: string, locale: string): string {
  const date = new Date(monthStr + '-01T00:00:00');
  if (isNaN(date.getTime())) return monthStr;
  if (locale === 'vi') {
    return `${VI_MONTHS[date.getMonth()]}/${String(date.getFullYear()).slice(2)}`;
  }
  const short = date.toLocaleDateString('en-US', { month: 'short' });
  return `${short} '${String(date.getFullYear()).slice(2)}`;
}

// ============================================
// Pull-to-refresh hook
// ============================================

function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef(0);
  const THRESHOLD = 70;

  const handleTouchStart = (e: React.TouchEvent) => {
    startYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isRefreshing) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta > 0 && window.scrollY <= 0) {
      const distance = Math.min(delta * 0.4, THRESHOLD * 1.3);
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(0);
      try { await onRefresh(); } catch { /* swallow */ }
      setIsRefreshing(false);
    } else {
      setPullDistance(0);
    }
  };

  return {
    pullDistance,
    isRefreshing,
    THRESHOLD,
    pullHandlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}

// ============================================
// Overview Tab Content
// ============================================

function OverviewTab({
  stats,
  locale,
}: {
  stats: BrokerStats;
  locale: string;
}) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const maxCommission = Math.max(...stats.monthlyTrends.map((m) => m.commission), 1);
  const lastSixMonths = stats.monthlyTrends.slice(-6);

  return (
    <div className="space-y-5">
      {/* Hero KPI Grid 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Commission */}
        <div className="bg-emerald-50/50 border border-emerald-200 dark:border-emerald-900 dark:bg-emerald-950/30 rounded-xl p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium">
                {t('Tổng hoa hồng', 'Total Commission')}
              </p>
              <p className="text-base font-bold mt-1 truncate">
                {stats.totalCommissionEarnedFormatted}
              </p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 ml-2">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          {stats.newBrokersThisMonth > 0 && (
            <div className="flex items-center mt-1.5">
              <TrendingUp className="h-3 w-3 text-emerald-600 mr-0.5" />
              <span className="text-[11px] text-emerald-600 font-medium">
                +{stats.newBrokersThisMonth} {t('đại lý mới', 'new')}
              </span>
            </div>
          )}
        </div>

        {/* Total GMV */}
        <div className="rounded-xl border border-border p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium">
                {t('Tổng GMV', 'Total GMV')}
              </p>
              <p className="text-base font-bold mt-1 truncate">
                {stats.totalGmvGeneratedFormatted}
              </p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 ml-2">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Active Brokers */}
        <div className="rounded-xl border border-border p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium">
                {t('Đại lý hoạt động', 'Active Brokers')}
              </p>
              <p className="text-base font-bold mt-1">{stats.activeBrokers}</p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 ml-2">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {t(`trên ${stats.totalBrokers} tổng`, `of ${stats.totalBrokers} total`)}
          </p>
        </div>

        {/* Territory Coverage */}
        <div className="rounded-xl border border-border p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium">
                {t('Phủ sóng lãnh thổ', 'Territory Coverage')}
              </p>
              <p className="text-base font-bold mt-1">
                {stats.territoryCoverage.coveragePercent}%
              </p>
            </div>
            <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0 ml-2">
              <MapPin className="h-4 w-4" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {stats.territoryCoverage.coveredWards}/{stats.territoryCoverage.totalWards} {t('phường', 'wards')}
          </p>
        </div>
      </div>

      {/* Top Performers */}
      {stats.topPerformers.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3">
            {t('Top đại lý hiệu suất cao', 'Top Performers')}
          </h3>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
            {stats.topPerformers.slice(0, 5).map((broker, idx) => {
              const rankColors = [
                'bg-amber-100 text-amber-700 border-amber-200',
                'bg-gray-100 text-gray-600 border-gray-200',
                'bg-orange-100 text-orange-700 border-orange-200',
                'bg-muted text-muted-foreground border-border',
                'bg-muted text-muted-foreground border-border',
              ];
              const tierInfo = TIER_LABELS[broker.tier];
              return (
                <div
                  key={broker.id}
                  className="shrink-0 w-52 bg-card border border-border rounded-xl p-3"
                >
                  {/* Rank + Name */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      'h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold border',
                      rankColors[idx]
                    )}>
                      {idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{broker.name}</p>
                    </div>
                  </div>
                  {/* Tier badge */}
                  {tierInfo && (
                    <span className={cn('inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-2', tierInfo.color)}>
                      {locale === 'vi' ? tierInfo.vi : tierInfo.en}
                    </span>
                  )}
                  {/* Stats */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t('GMV', 'GMV')}</span>
                      <span className="text-xs font-semibold">{broker.gmvGeneratedFormatted}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t('Hoa hồng', 'Commission')}</span>
                      <span className="text-xs font-semibold text-emerald-600">{broker.commissionEarnedFormatted}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{t('Cửa hàng', 'Shops')}</span>
                      <span className="text-xs font-medium">{broker.shopsReferred}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Monthly Commission Trend — Pure CSS Bar Chart */}
      {lastSixMonths.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3">
            {t('Xu hướng hoa hồng theo tháng', 'Monthly Commission Trend')}
          </h3>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-end gap-2 h-36">
              {lastSixMonths.map((item) => {
                const height = Math.max((item.commission / maxCommission) * 100, 4);
                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                      {item.commissionFormatted}
                    </span>
                    <div className="w-full flex items-end" style={{ height: '100px' }}>
                      <div
                        className="w-full rounded-t-md bg-primary/80 transition-all duration-500 min-h-[4px]"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {formatMonthLabel(item.month, locale)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Tier Distribution */}
      <section>
        <h3 className="text-sm font-semibold mb-3">
          {t('Phân loại đại lý', 'Tier Distribution')}
        </h3>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(TIER_LABELS).map(([tier, info]) => {
            const count = stats.tierDistribution[tier] || 0;
            return (
              <div
                key={tier}
                className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2"
              >
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', info.color)}>
                  {locale === 'vi' ? info.vi : info.en}
                </span>
                <span className="text-sm font-bold">{count}</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ============================================
// Commissions Tab Content
// ============================================

function CommissionsTabSkeleton() {
  return (
    <div className="space-y-4">
      {/* Summary banner skeleton */}
      <div className="bg-muted/50 rounded-xl p-4 space-y-3">
        <div className="h-5 w-40 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      {/* Card skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-5 w-20 bg-muted rounded-full" />
          </div>
          <div className="h-4 w-36 bg-muted rounded" />
          <div className="grid grid-cols-2 gap-2">
            <div className="h-3 w-24 bg-muted rounded" />
            <div className="h-3 w-20 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CommissionCard({
  item,
  locale,
}: {
  item: CommissionItem;
  locale: string;
}) {
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const tierInfo = TIER_LABELS[item.tier];
  const statusInfo = STATUS_LABELS[item.status] || { vi: item.status, en: item.status, color: 'bg-gray-100 text-gray-600' };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      {/* Header: Name + phone + tier + status */}
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold">{item.name}</p>
            <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', tierInfo?.color || 'bg-gray-100 text-gray-600')}>
              {tierInfo ? (locale === 'vi' ? tierInfo.vi : tierInfo.en) : item.tier}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{item.phone}</p>
        </div>
        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ml-2', statusInfo.color)}>
          {locale === 'vi' ? statusInfo.vi : statusInfo.en}
        </span>
      </div>

      {/* Commission info */}
      <div className="bg-muted/30 rounded-lg p-2.5 mb-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{t('Hoa hồng đã kiếm', 'Commission Earned')}</span>
          <span className="text-sm font-bold text-emerald-600">{item.totalCommissionEarnedFormatted}</span>
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('Tỷ lệ', 'Rate')}</span>
          <span className="font-medium">{item.commissionRatePercent}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('GMV', 'GMV')}</span>
          <span className="font-medium">{item.totalGmvGeneratedFormatted}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('Cửa hàng', 'Shops')}</span>
          <span className="font-medium">{item.totalShopsReferred}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">{t('Hiệu quả', 'Effective')}</span>
          <span className="font-medium">{item.effectiveRate}</span>
        </div>
      </div>

      {/* Ward info */}
      {item.ward && (
        <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            {item.ward.name}, {item.ward.district}
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================
// Territory Tab Content
// ============================================

function TerritoryTabSkeleton() {
  return (
    <div className="space-y-4">
      {/* Coverage summary skeleton */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-3 bg-muted rounded-full" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-4 w-16 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
      {/* Filter skeleton */}
      <div className="h-10 w-full bg-muted rounded-xl animate-pulse" />
      {/* Ward card skeletons */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2 animate-pulse">
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-5 w-16 bg-muted rounded-full" />
          </div>
          <div className="h-3 w-32 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

// ============================================
// Main Page Component
// ============================================

export default function BrokerDashboardPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Overview state
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  // Commissions state
  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [commissionSummary, setCommissionSummary] = useState<CommissionSummary | null>(null);
  const [commissionsLoading, setCommissionsLoading] = useState(true);
  const [commissionsError, setCommissionsError] = useState('');
  const [commissionPage, setCommissionPage] = useState(1);
  const [commissionHasMore, setCommissionHasMore] = useState(true);

  // Territory state
  const [territories, setTerritories] = useState<TerritoryWard[]>([]);
  const [territoryDistricts, setTerritoryDistricts] = useState<TerritoryDistrict[]>([]);
  const [territorySummary, setTerritorySummary] = useState<TerritorySummary | null>(null);
  const [territoryLoading, setTerritoryLoading] = useState(true);
  const [territoryError, setTerritoryError] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');

  // General refresh
  const [refreshing, setRefreshing] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ============================================
  // Data Fetchers
  // ============================================

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const res = await api.get<BrokerStats>('/brokers/stats');
      if (res.success && res.data) {
        setStats(res.data);
      } else {
        setStatsError(t('Không thể tải thống kê', 'Failed to load stats'));
      }
    } catch {
      setStatsError(t('Lỗi kết nối mạng', 'Network error'));
    } finally {
      setStatsLoading(false);
    }
  }, [t]);

  const fetchCommissions = useCallback(async (page: number, reset: boolean) => {
    if (page === 1) setCommissionsLoading(true);
    setCommissionsError('');
    try {
      const res = await api.get<{
        items: CommissionItem[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
        summary: CommissionSummary;
      }>('/brokers/commissions', {
        sortBy: 'totalCommissionEarned',
        sortOrder: 'desc',
        page,
        limit: 20,
      });
      if (res.success && res.data) {
        if (reset) {
          setCommissions(res.data.items);
        } else {
          setCommissions((prev) => [...prev, ...res.data!.items]);
        }
        setCommissionSummary(res.data.summary);
        setCommissionHasMore(page < res.data.pagination.totalPages);
      } else {
        setCommissionsError(t('Không thể tải dữ liệu hoa hồng', 'Failed to load commissions'));
      }
    } catch {
      setCommissionsError(t('Lỗi kết nối mạng', 'Network error'));
    } finally {
      setCommissionsLoading(false);
    }
  }, [t]);

  const fetchTerritories = useCallback(async () => {
    setTerritoryLoading(true);
    setTerritoryError('');
    try {
      const res = await api.get<{
        territories: TerritoryWard[];
        districts: TerritoryDistrict[];
        summary: TerritorySummary;
      }>('/brokers/territories');
      if (res.success && res.data) {
        setTerritories(res.data.territories);
        setTerritoryDistricts(res.data.districts);
        setTerritorySummary(res.data.summary);
      } else {
        setTerritoryError(t('Không thể tải dữ liệu lãnh thổ', 'Failed to load territories'));
      }
    } catch {
      setTerritoryError(t('Lỗi kết nối mạng', 'Network error'));
    } finally {
      setTerritoryLoading(false);
    }
  }, [t]);

  // ============================================
  // Effects
  // ============================================

  // Initial load of all tabs
  useEffect(() => {
    fetchStats();
    fetchCommissions(1, true);
    fetchTerritories();
  }, [fetchStats, fetchCommissions, fetchTerritories]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchCommissions(1, true),
        fetchTerritories(),
      ]);
      setCommissionPage(1);
    } catch { /* swallow */ }
    setRefreshing(false);
  }, [fetchStats, fetchCommissions, fetchTerritories]);

  const { pullDistance, isRefreshing, THRESHOLD, pullHandlers } = usePullToRefresh(handleRefresh);

  // Infinite scroll for commissions
  useEffect(() => {
    if (activeTab !== 'commissions') return;
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && commissionHasMore && !commissionsLoading) {
          const nextPage = commissionPage + 1;
          setCommissionPage(nextPage);
          fetchCommissions(nextPage, false);
        }
      },
      { threshold: 0.5 }
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [activeTab, commissionHasMore, commissionsLoading, commissionPage, fetchCommissions]);

  // Filter territories by district
  const filteredTerritories = selectedDistrict
    ? territories.filter((w) => w.district === selectedDistrict)
    : territories;

  // ============================================
  // Render
  // ============================================

  return (
    <div className="min-h-screen bg-background" {...pullHandlers}>
      <MobileHeader
        title={t('Đại lý', 'Broker Dashboard')}
        showBack
        showNotifications={false}
      />

      <main className="pb-4">
        {/* Pull to refresh spacer */}
        <div style={{ height: pullDistance, overflow: 'hidden' }} className="flex justify-center">
          {pullDistance > 0 && (
            <div className="flex items-center justify-center" style={{ height: Math.max(pullDistance, 40) }}>
              <div
                className={cn(
                  'h-8 w-8 rounded-full bg-muted flex items-center justify-center transition-all',
                  isRefreshing ? 'opacity-100' : 'opacity-70'
                )}
                style={{ transform: `rotate(${Math.min(pullDistance / THRESHOLD, 1) * 360}deg)` }}
              >
                <RefreshCw className={cn('h-4 w-4 text-muted-foreground', isRefreshing && 'animate-spin')} />
              </div>
            </div>
          )}
        </div>

        {/* Refresh button row */}
        <div className="flex justify-end px-4 mb-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            {t('Làm mới', 'Refresh')}
          </button>
        </div>

        {/* Sticky Tab Bar */}
        <div className="sticky top-14 z-40 bg-background border-b border-border">
          <div className="flex px-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 py-3 text-sm font-medium text-center relative transition-colors',
                  activeTab === tab.id
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {locale === 'vi' ? tab.vi : tab.en}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4 pt-4">
          {/* ===== OVERVIEW TAB ===== */}
          {activeTab === 'overview' && (
            <>
              {statsLoading ? (
                <div className="space-y-5">
                  {/* KPI skeletons */}
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-muted/50 rounded-xl p-3 space-y-2 animate-pulse">
                        <div className="h-3 w-20 bg-muted rounded" />
                        <div className="h-5 w-28 bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                  {/* Top performers skeleton */}
                  <div>
                    <div className="h-4 w-36 bg-muted rounded animate-pulse mb-3" />
                    <div className="flex gap-3 overflow-hidden">
                      {[1, 2].map((i) => (
                        <div key={i} className="shrink-0 w-52 bg-muted/50 rounded-xl p-3 space-y-2 animate-pulse">
                          <div className="h-4 w-24 bg-muted rounded" />
                          <div className="h-5 w-16 bg-muted rounded-full" />
                          <div className="h-3 w-28 bg-muted rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Bar chart skeleton */}
                  <div>
                    <div className="h-4 w-40 bg-muted rounded animate-pulse mb-3" />
                    <div className="bg-muted/50 rounded-xl p-4">
                      <div className="flex items-end gap-2 h-36">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                            <div className="h-3 w-12 bg-muted rounded animate-pulse" />
                            <div className="w-full bg-muted rounded-t-md animate-pulse" style={{ height: `${30 + Math.random() * 60}%` }} />
                            <div className="h-3 w-8 bg-muted rounded animate-pulse" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : statsError ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive/50" />
                  <p className="text-sm font-medium">{statsError}</p>
                  <button
                    onClick={fetchStats}
                    className="mt-3 px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground"
                  >
                    {t('Thử lại', 'Retry')}
                  </button>
                </div>
              ) : stats ? (
                <OverviewTab stats={stats} locale={locale} />
              ) : null}
            </>
          )}

          {/* ===== COMMISSIONS TAB ===== */}
          {activeTab === 'commissions' && (
            <>
              {commissionsLoading && commissions.length === 0 ? (
                <CommissionsTabSkeleton />
              ) : commissionsError && commissions.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive/50" />
                  <p className="text-sm font-medium">{commissionsError}</p>
                  <button
                    onClick={() => { setCommissionPage(1); setCommissionHasMore(true); fetchCommissions(1, true); }}
                    className="mt-3 px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground"
                  >
                    {t('Thử lại', 'Retry')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary Banner */}
                  {commissionSummary && (
                    <div className="bg-emerald-50/50 border border-emerald-200 dark:border-emerald-900 dark:bg-emerald-950/30 rounded-xl p-4">
                      <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-3">
                        {t('Tổng quan hoa hồng', 'Commission Summary')}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            {t('Chưa thanh toán', 'Unpaid')}
                          </p>
                          <p className="text-sm font-bold text-emerald-600">
                            {commissionSummary.totalUnpaidCommissionFormatted}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            {t('Tổng GMV', 'Total GMV')}
                          </p>
                          <p className="text-sm font-bold">
                            {commissionSummary.totalGmvGeneratedFormatted}
                          </p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            {t('Có thu nhập', 'With earnings')}
                          </p>
                          <p className="text-sm font-semibold">{commissionSummary.brokersWithEarnings}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground">
                            {t('Chưa có thu nhập', 'No earnings')}
                          </p>
                          <p className="text-sm font-semibold text-muted-foreground">
                            {commissionSummary.brokersWithoutEarnings}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Commission Cards List */}
                  <div className="space-y-3">
                    {commissions.map((item) => (
                      <CommissionCard key={item.id} item={item} locale={locale} />
                    ))}
                  </div>

                  {/* Empty state */}
                  {commissions.length === 0 && !commissionsLoading && (
                    <div className="text-center py-12">
                      <DollarSign className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-sm font-medium">{t('Chưa có dữ liệu hoa hồng', 'No commission data yet')}</p>
                    </div>
                  )}

                  {/* Infinite scroll sentinel */}
                  <div ref={activeTab === 'commissions' ? sentinelRef : null} className="h-1" />

                  {/* Loading more indicator */}
                  {commissionsLoading && commissions.length > 0 && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}

                  {/* End of list indicator */}
                  {!commissionHasMore && commissions.length > 0 && (
                    <p className="text-center text-[10px] text-muted-foreground py-4">
                      {t('Đã hiển thị tất cả', 'All brokers shown')}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {/* ===== TERRITORY TAB ===== */}
          {activeTab === 'territory' && (
            <>
              {territoryLoading ? (
                <TerritoryTabSkeleton />
              ) : territoryError && territories.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-10 w-10 mx-auto mb-3 text-destructive/50" />
                  <p className="text-sm font-medium">{territoryError}</p>
                  <button
                    onClick={fetchTerritories}
                    className="mt-3 px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground"
                  >
                    {t('Thử lại', 'Retry')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Coverage Summary */}
                  {territorySummary && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <h3 className="text-sm font-semibold mb-3">
                        {t('Phủ sóng lãnh thổ', 'Territory Coverage')}
                      </h3>

                      {/* Ward coverage progress bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-muted-foreground">{t('Phường/Xã', 'Wards')}</span>
                          <span className="text-[11px] font-medium">
                            {territorySummary.coveredWards}/{territorySummary.totalWards} ({territorySummary.coveragePercent}%)
                          </span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              territorySummary.coveragePercent >= 70
                                ? 'bg-emerald-500'
                                : territorySummary.coveragePercent >= 40
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                            )}
                            style={{ width: `${territorySummary.coveragePercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Shop coverage progress bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-muted-foreground">{t('Cửa hàng', 'Shops')}</span>
                          <span className="text-[11px] font-medium">
                            {territorySummary.coveredShops}/{territorySummary.totalShops} ({territorySummary.shopCoveragePercent}%)
                          </span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${territorySummary.shopCoveragePercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          <span className="text-[11px] text-muted-foreground">
                            {territorySummary.coveredWards} {t('đã phủ', 'covered')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MinusCircle className="h-3.5 w-3.5 text-red-400" />
                          <span className="text-[11px] text-muted-foreground">
                            {territorySummary.uncoveredWards} {t('chưa phủ', 'uncovered')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* District Filter */}
                  {territoryDistricts.length > 1 && (
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <select
                        value={selectedDistrict}
                        onChange={(e) => setSelectedDistrict(e.target.value)}
                        className="w-full h-10 pl-9 pr-10 text-sm rounded-xl border bg-card appearance-none outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">
                          {t('Tất cả quận/huyện', 'All Districts')}
                        </option>
                        {territoryDistricts.map((d) => (
                          <option key={d.district} value={d.district}>
                            {d.district} ({d.wardCount} {locale === 'vi' ? 'phường' : 'wards'})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    </div>
                  )}

                  {/* Territory Ward List */}
                  <div className="space-y-3">
                    {filteredTerritories.map((ward) => {
                      const tierInfo = ward.assignedBrokers.length > 0
                        ? TIER_LABELS[ward.assignedBrokers[0].tier]
                        : null;

                      return (
                        <div
                          key={ward.wardId}
                          className={cn(
                            'bg-card border rounded-xl p-4 transition-colors',
                            ward.isCovered
                              ? 'border-border'
                              : 'border-amber-200 bg-amber-50/30 dark:border-amber-900 dark:bg-amber-950/20'
                          )}
                        >
                          {/* Ward header */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold truncate">
                                  {locale === 'vi' ? ward.wardName : ward.wardNameEn}
                                </p>
                                {ward.isCovered ? (
                                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[11px] text-muted-foreground">{ward.district}</span>
                              </div>
                            </div>
                            <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0 ml-2">
                              <Store className="h-3 w-3" />
                              {ward.shopCount}
                            </span>
                          </div>

                          {/* Assigned brokers */}
                          {ward.assignedBrokers.length > 0 ? (
                            <div className="border-t border-border/50 pt-2 mt-1 space-y-1.5">
                              {ward.assignedBrokers.map((broker) => {
                                const bTierInfo = TIER_LABELS[broker.tier];
                                const brokerGmvFormatted = broker.totalGmvGenerated
                                  ? new Intl.NumberFormat('vi-VN').format(broker.totalGmvGenerated) + ' ₫'
                                  : '0 ₫';
                                return (
                                  <div key={broker.brokerId} className="flex items-center gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <Users className="h-3 w-3 text-muted-foreground" />
                                        <span className="text-xs font-medium truncate">{broker.name}</span>
                                        {bTierInfo && (
                                          <span className={cn('text-[9px] font-medium px-1.5 py-px rounded-full', bTierInfo.color)}>
                                            {(broker.commissionRate * 100).toFixed(1)}%
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-muted-foreground ml-5">
                                        {t(`${broker.totalShopsReferred} cửa hàng`, `${broker.totalShopsReferred} shops`)} · {brokerGmvFormatted}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="border-t border-border/50 pt-2 mt-1">
                              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                {t('Chưa có đại lý phụ trách', 'No broker assigned')}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Empty territory state */}
                  {filteredTerritories.length === 0 && !territoryLoading && (
                    <div className="text-center py-12">
                      <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-sm font-medium">{t('Không có dữ liệu lãnh thổ', 'No territory data')}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
