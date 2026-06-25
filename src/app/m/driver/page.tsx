'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { MobileKpiCard } from '@/components/mobile/kpi-card';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/mobile/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Truck,
  CheckCircle,
  Wallet,
  XCircle,
  PlayCircle,
  MapPin,
  Package,
  Phone,
  ArrowRight,
  Clock,
  WalletIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface DriverDashboardData {
  todayDelivered: number;
  todayTotal: number;
  successRate: number;
  todayEarnings: number;
  todayFailed: number;
  dayStarted: boolean;
  completedStops: number;
  totalStops: number;
  nextDelivery: {
    id: string;
    orderNumber: string;
    shopName: string;
    address: string;
    phone: string;
    estimatedItems: number;
    totalAmount: number;
    scheduledTime?: string;
  } | null;
  recentActivity: Array<{
    id: string;
    timestamp: string;
    action: string;
    actionEn: string;
    orderNumber: string;
  }>;
}

// ============================================
// Helpers
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function formatTime(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getGreeting(locale: string): string {
  const hour = new Date().getHours();
  if (hour < 12) return locale === 'vi' ? 'Chào buổi sáng' : 'Good morning';
  if (hour < 18) return locale === 'vi' ? 'Chào buổi chiều' : 'Good afternoon';
  return locale === 'vi' ? 'Chào buổi tối' : 'Good evening';
}

function getTodayDate(locale: string): string {
  return new Date().toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ============================================
// Page Component
// ============================================

export default function DriverDashboardPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [data, setData] = useState<DriverDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingDay, setStartingDay] = useState(false);

  // Fetch dashboard
  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      const res = await api.get<DriverDashboardData>('/driver/dashboard');
      if (res.success && res.data) {
        setData(res.data);
      }
      setLoading(false);
    };
    fetchDashboard();
  }, []);

  // Start day handler
  const handleStartDay = async () => {
    setStartingDay(true);
    await api.post('/driver/dashboard/start-day');
    setStartingDay(false);
    // Re-fetch dashboard
    const res = await api.get<DriverDashboardData>('/driver/dashboard');
    if (res.success && res.data) {
      setData(res.data);
    }
  };

  // KPI success variant logic
  const getSuccessVariant = (rate: number): 'success' | 'warning' | 'danger' => {
    if (rate > 90) return 'success';
    if (rate > 70) return 'warning';
    return 'danger';
  };

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader showNotifications={false} />
        <div className="px-4 pt-4 pb-24 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-6 w-36" />
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-28 shrink-0 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const nextDelivery = data?.nextDelivery ?? null;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader showNotifications={false} />

      <main className="px-4 pt-4 pb-24 space-y-5">
        {/* Greeting */}
        <div>
          <h2 className="text-xl font-bold">
            {getGreeting(locale)}, {user?.name || t('Tài xế', 'Driver')}!
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{getTodayDate(locale)}</p>
        </div>

        {/* KPI Strip — horizontal scroll */}
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
          <MobileKpiCard
            label="Today"
            labelVi="Hôm nay"
            value={`${data?.todayDelivered ?? 0}/${data?.todayTotal ?? 0}`}
            icon={<Truck className="h-4 w-4" />}
            variant="default"
            locale={locale}
          />
          <MobileKpiCard
            label="Success Rate"
            labelVi="Thành công"
            value={`${data?.successRate ?? 0}%`}
            icon={<CheckCircle className="h-4 w-4" />}
            variant={data ? getSuccessVariant(data.successRate) : 'default'}
            locale={locale}
          />
          <MobileKpiCard
            label="Today Earnings"
            labelVi="Thu nhập hôm nay"
            value={formatVND(data?.todayEarnings ?? 0)}
            icon={<Wallet className="h-4 w-4" />}
            variant="warning"
            locale={locale}
          />
          {(data?.todayFailed ?? 0) > 0 && (
            <MobileKpiCard
              label="Failed"
              labelVi="Thất bại"
              value={String(data?.todayFailed ?? 0)}
              icon={<XCircle className="h-4 w-4" />}
              variant="danger"
              locale={locale}
            />
          )}
        </div>

        {/* Start Day Button */}
        {data && !data.dayStarted && (
          <Button
            className="w-full h-14 rounded-xl text-base font-semibold gap-2"
            onClick={handleStartDay}
            disabled={startingDay}
          >
            {startingDay ? (
              <span className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <PlayCircle className="h-5 w-5" />
            )}
            {t('Bắt đầu ngày', 'Start Day')}
          </Button>
        )}

        {/* Next Delivery Card — Amber/Yellow */}
        {nextDelivery && (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <Truck className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    {t('Giao tiếp theo', 'Next Delivery')}
                  </p>
                  {nextDelivery.scheduledTime && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      <Clock className="h-3 w-3 inline mr-0.5" />
                      {nextDelivery.scheduledTime}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-sm font-bold font-mono mb-2">
                {nextDelivery.orderNumber}
              </p>

              <div className="space-y-1.5 mb-3">
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{nextDelivery.shopName}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{nextDelivery.address}</p>
                  </div>
                </div>
                <button
                  className="flex items-center gap-1.5 text-sm text-primary"
                  onClick={() => window.open(`tel:${nextDelivery.phone}`, '_self')}
                >
                  <Phone className="h-3.5 w-3.5" />
                  {nextDelivery.phone}
                </button>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  {nextDelivery.estimatedItems} {t('sản phẩm', 'items')}
                </span>
                <span className="font-semibold text-foreground">
                  {formatVND(nextDelivery.totalAmount)}
                </span>
              </div>

              <Button
                className="w-full h-12 rounded-xl font-semibold"
                onClick={() => router.push(`/m/driver/deliveries/${nextDelivery.id}`)}
              >
                {t('Bắt đầu giao', 'Start Delivery')}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Today's Progress */}
        {data && data.totalStops > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold">
                  {t('Tiến độ hôm nay', "Today's Progress")}
                </p>
                <span className="text-xs text-muted-foreground">
                  {data.completedStops}/{data.totalStops} {t('chuyến', 'stops')}
                </span>
              </div>
              <Progress
                value={(data.completedStops / data.totalStops) * 100}
                className="h-3"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {data.completedStops === data.totalStops
                  ? t('Hoàn thành tất cả chuyến!', 'All stops completed!')
                  : t(`${data.totalStops - data.completedStops} chuyến còn lại`, `${data.totalStops - data.completedStops} stops remaining`)}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl justify-start gap-2"
            onClick={() => router.push('/m/driver/earnings')}
          >
            <WalletIcon className="h-4 w-4 text-amber-600" />
            {t('Doanh thu', 'Earnings')}
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl justify-start gap-2"
            onClick={() => router.push('/m/driver/deliveries')}
          >
            <Truck className="h-4 w-4 text-primary" />
            {t('Chuyến hàng', 'Deliveries')}
            <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
          </Button>
        </div>

        {/* Recent Activity */}
        {data?.recentActivity && data.recentActivity.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3">
                {t('Hoạt động gần đây', 'Recent Activity')}
              </h3>
              <div className="space-y-0">
                {data.recentActivity.slice(0, 5).map((activity, idx) => (
                  <div key={activity.id}>
                    <div className="flex items-start gap-3 py-2.5">
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{locale === 'vi' ? activity.action : activity.actionEn}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span className="font-mono">{activity.orderNumber}</span>
                          <span>·</span>
                          <span>{formatTime(activity.timestamp, locale)}</span>
                        </p>
                      </div>
                    </div>
                    {idx < Math.min(data.recentActivity.length, 5) - 1 && (
                      <Separator />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {data && !data.dayStarted && !data.nextDelivery && data.todayTotal === 0 && (
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Truck className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">{t('Chưa có chuyến giao hàng', 'No deliveries yet')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('Bắt đầu ngày để nhận chuyến giao hàng mới', 'Start your day to receive new deliveries')}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}