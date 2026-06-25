'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/mobile/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  MapPin,
  Store,
  Phone,
  Trophy,
  TrendingUp,
  HandCoins,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  MapPinned,
  CalendarClock,
  Package,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface TerritoryShop {
  id: string;
  name: string;
  phone: string;
  district: string | null;
  orderCount: number;
  totalGmv: number;
  totalGmvFormatted: string;
  lastOrderDate: string | null;
}

interface TerritoryWard {
  id: string;
  name: string;
  district: string;
  province: string;
}

interface NearbyOpportunity {
  wardId: string;
  wardName: string;
  district: string;
  shopCount: number;
}

interface TerritoryData {
  broker: {
    id: string;
    name: string;
    phone: string;
    tier: string;
    commissionRate: number;
    totalShopsReferred: number;
    totalGmvGenerated: number;
    totalGmvGeneratedFormatted: string;
    totalCommissionEarned: number;
    totalCommissionEarnedFormatted: string;
  };
  territory: {
    ward: TerritoryWard | null;
    shopCount: number;
    shops: TerritoryShop[];
  };
  nearbyOpportunities: NearbyOpportunity[];
  performanceRank: number;
  totalBrokers: number;
}

// ============================================
// Config
// ============================================

const TIER_LABELS_VI: Record<string, string> = {
  WARD_LEVEL: 'Cấp Phường/Xã',
  CATEGORY_SPECIALIST: 'Chuyên ngành',
  FACTORY_GATE: 'Cửa hàng',
};
const TIER_LABELS_EN: Record<string, string> = {
  WARD_LEVEL: 'Ward Level',
  CATEGORY_SPECIALIST: 'Category Specialist',
  FACTORY_GATE: 'Factory Gate',
};

// ============================================
// Helpers
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { day: '2-digit', month: 'short', year: 'numeric' }
  );
}

function getRankColor(rank: number, total: number): string {
  const pct = total > 0 ? rank / total : 1;
  if (pct <= 0.1) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  if (pct <= 0.3) return 'bg-blue-100 text-blue-700 border-blue-200';
  return 'bg-muted text-muted-foreground';
}

function getNextRankTarget(rank: number): { label: string; target: number; current: number } {
  if (rank <= 1) return { label: '1st', target: 1, current: 1 };
  if (rank <= 3) return { label: 'Top 3', target: 3, current: rank };
  if (rank <= 10) return { label: 'Top 10', target: 10, current: rank };
  return { label: 'Top 10', target: 10, current: rank };
}

// ============================================
// Page Component
// ============================================

export default function BrokerTerritoryPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [data, setData] = useState<TerritoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const fetchTerritory = async () => {
      if (!user?.userId) {
        setError(t('Vui lòng đăng nhập', 'Please login'));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await api.get<TerritoryData>('/brokers/my-territory');
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(t('Không tìm thấy dữ liệu lãnh thổ', 'Territory data not found'));
        }
      } catch {
        setError(t('Lỗi kết nối mạng', 'Network error'));
      }
      setLoading(false);
    };
    fetchTerritory();
  }, [user?.userId]);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Lãnh thổ của tôi', 'My Territory')}
          showBack
          showNotifications={false}
        />
        <div className="px-4 pt-4 pb-24 space-y-4">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Lãnh thổ của tôi', 'My Territory')}
          showBack
          showNotifications={false}
        />
        <div className="px-4 pt-12 flex flex-col items-center justify-center text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <p className="text-sm font-semibold">
            {error || t('Không tìm thấy dữ liệu', 'No data found')}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            {t('Thử lại', 'Retry')}
          </Button>
        </div>
      </div>
    );
  }

  const { broker, territory, nearbyOpportunities, performanceRank, totalBrokers } = data;
  const tierLabel =
    locale === 'vi'
      ? (TIER_LABELS_VI[broker.tier] ?? broker.tier)
      : (TIER_LABELS_EN[broker.tier] ?? broker.tier);

  const rankInfo = getNextRankTarget(performanceRank);
  const progressPct = rankInfo.target >= rankInfo.current
    ? Math.round((1 - (rankInfo.current - 1) / rankInfo.target) * 100)
    : 100;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Lãnh thổ của tôi', 'My Territory')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pt-4 pb-24 space-y-5">
        {/* ============================================ */}
        {/* 1. Territory Header Card */}
        {/* ============================================ */}
        <Card className="rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <MapPinned className="h-4 w-4 opacity-80" />
                  <p className="text-xs opacity-80 font-medium">
                    {t('Lãnh thổ', 'Territory')}
                  </p>
                </div>

                {territory.ward ? (
                  <h2 className="text-lg font-bold truncate">
                    {territory.ward.name}
                  </h2>
                ) : (
                  <h2 className="text-lg font-bold">
                    {t('Chưa phân công khu vực', 'No territory assigned')}
                  </h2>
                )}

                {territory.ward && (
                  <p className="text-xs opacity-80 mt-0.5">
                    {territory.ward.district}, {territory.ward.province}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-3 text-xs opacity-90">
                  <span className="flex items-center gap-1">
                    <Store className="h-3 w-3" />
                    {territory.shopCount} {t('cửa hàng', 'shops')}
                  </span>
                  <span className="flex items-center gap-1">
                    <HandCoins className="h-3 w-3" />
                    {(broker.commissionRate * 100).toFixed(1)}% {t('hoa hồng', 'commission')}
                  </span>
                </div>
              </div>

              {/* Rank badge */}
              <Badge
                className={cn(
                  'shrink-0 border text-xs font-bold px-2.5 py-1',
                  getRankColor(performanceRank, totalBrokers)
                )}
              >
                <Trophy className="h-3 w-3 mr-1" />
                #{performanceRank}
              </Badge>
            </div>
          </div>
        </Card>

        {/* ============================================ */}
        {/* 2. My Performance Card */}
        {/* ============================================ */}
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {t('Hiệu suất của tôi', 'My Performance')}
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-base font-bold text-primary">
                  {broker.totalGmvGeneratedFormatted}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  {t('Tổng GMV', 'Total GMV')}
                </p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-green-600">
                  {broker.totalCommissionEarnedFormatted}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  {t('Hoa hồng', 'Commission')}
                </p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold">
                  {broker.totalShopsReferred}
                </p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  {t('Shop giới thiệu', 'Referred')}
                </p>
              </div>
            </div>

            {/* Progress to next rank */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {t('Xếp hạng', 'Rank')}: #{performanceRank}/{totalBrokers}
                </span>
                <span className="font-medium text-primary">
                  {t('Mục tiêu', 'Target')}: {rankInfo.label}
                </span>
              </div>
              <Progress value={progressPct} className="h-2" />
              <p className="text-[10px] text-muted-foreground">
                {progressPct >= 100
                  ? t('🎉 Đã đạt mục tiêu xếp hạng!', '🎉 Rank target achieved!')
                  : t(
                      `Cần vượt qua ${rankInfo.current - 1} đại lý khác để đạt ${rankInfo.label}`,
                      `Need to pass ${rankInfo.current - 1} other brokers to reach ${rankInfo.label}`
                    )}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* 3. Shops in My Territory */}
        {/* ============================================ */}
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  {t('Cửa hàng trong khu vực', 'Shops in My Territory')}
                </h3>
              </div>
              <Badge variant="outline" className="text-[10px] font-medium">
                {territory.shopCount}
              </Badge>
            </div>

            {territory.shops.length > 0 ? (
              <div className="space-y-0">
                {territory.shops.map((shop, idx) => {
                  const isLast = idx === territory.shops.length - 1;
                  return (
                    <div key={shop.id}>
                      <div className="flex items-start gap-3 py-3">
                        {/* Shop icon */}
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Store className="h-4 w-4 text-primary" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium truncate">
                              {shop.name}
                            </p>
                            <a
                              href={`tel:${shop.phone}`}
                              className="h-7 w-7 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0"
                            >
                              <Phone className="h-3.5 w-3.5 text-green-600" />
                            </a>
                          </div>

                          {shop.district && (
                            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {shop.district}
                            </div>
                          )}

                          <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                            <span className="flex items-center gap-0.5 text-muted-foreground">
                              <Package className="h-3 w-3" />
                              {shop.orderCount} {t('đơn', 'orders')}
                            </span>
                            <span className="font-medium">
                              {shop.totalGmvFormatted}
                            </span>
                          </div>

                          {shop.lastOrderDate && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              <CalendarClock className="h-3 w-3 inline mr-0.5" />
                              {t('Đơn cuối', 'Last order')}: {formatDate(shop.lastOrderDate, locale)}
                            </p>
                          )}
                        </div>
                      </div>
                      {!isLast && <Separator />}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Empty state */
              <div className="text-center py-8">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Store className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold">
                  {t('Chưa có cửa hàng nào', 'No shops yet')}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[260px] mx-auto">
                  {t(
                    'Cửa hàng trong khu vực sẽ xuất hiện ở đây',
                    'Shops in your territory will appear here'
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* 4. Nearby Opportunities */}
        {/* ============================================ */}
        {nearbyOpportunities.length > 0 && (
          <Card className="rounded-xl">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-500" />
                <h3 className="text-sm font-semibold">
                  {t('Cơ hội lân cận', 'Nearby Opportunities')}
                </h3>
                <Badge variant="secondary" className="text-[10px] font-medium ml-auto">
                  {nearbyOpportunities.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t(
                  'Các phường/xã trong cùng quận chưa có đại lý',
                  'Wards in the same district without broker coverage'
                )}
              </p>

              <div className="space-y-2">
                {nearbyOpportunities.map((opp) => (
                  <div
                    key={opp.wardId}
                    className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{opp.wardName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {opp.shopCount} {t('cửa hàng', 'shops')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs h-7"
                      onClick={() => setDialogOpen(true)}
                    >
                      {t('Mở rộng', 'Expand')}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* 5. Quick Actions */}
        {/* ============================================ */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12 rounded-xl justify-start gap-2 px-4"
            onClick={() => router.push('/m/broker/me/commissions')}
          >
            <HandCoins className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              {t('Xem hoa hồng', 'View Commissions')}
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-12 rounded-xl justify-start gap-2 px-4"
            onClick={() => router.push('/m/broker/me')}
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground rotate-180" />
            <span className="text-sm font-medium">
              {t('Trở về Portal', 'Back to Portal')}
            </span>
          </Button>
        </div>
      </main>

      {/* ============================================ */}
      {/* Coming Soon Dialog */}
      {/* ============================================ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[320px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-center">
              {t('Sắp ra mắt!', 'Coming Soon!')}
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              {t(
                'Tính năng mở rộng lãnh thổ đang được phát triển. Bạn sẽ có thể đăng ký quản lý thêm khu vực.',
                'Territory expansion is under development. You will be able to apply to manage additional areas.'
              )}
            </DialogDescription>
          </DialogHeader>
          <Button
            className="w-full rounded-xl mt-2"
            onClick={() => setDialogOpen(false)}
          >
            {t('Đã hiểu', 'Got it')}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}