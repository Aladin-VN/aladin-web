'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Route,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Play,
  Eye,
  CalendarDays,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface RouteStop {
  shopId: string;
  shopName: string;
  phone?: string;
  address: string;
  district: string;
  status: 'PLANNED' | 'VISITED' | 'SKIPPED';
  sequence: number;
  visitedAt?: string;
  orderPlaced?: boolean;
  orderAmount?: number;
  orderAmountFormatted?: string;
  orderId?: string;
}

interface RouteData {
  date: string;
  isActive: boolean;
  isCompleted: boolean;
  stops: RouteStop[];
  totalStops: number;
  completedStops: number;
  remainingStops: number;
}

// ============================================
// Status Config
// ============================================

const STATUS_CONFIG: Record<string, { label: { vi: string; en: string }; cls: string; icon: React.ReactNode }> = {
  PLANNED: {
    label: { vi: 'Chưa thăm', en: 'Planned' },
    cls: 'bg-gray-100 text-gray-600 border-gray-200',
    icon: <Clock className="h-3 w-3" />,
  },
  VISITED: {
    label: { vi: 'Đã thăm', en: 'Visited' },
    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  SKIPPED: {
    label: { vi: 'Bỏ qua', en: 'Skipped' },
    cls: 'bg-red-100 text-red-700 border-red-200',
    icon: <XCircle className="h-3 w-3" />,
  },
};

// ============================================
// Date Options
// ============================================

function getDateOptions() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  return [
    { key: fmt(today), vi: 'Hôm nay', en: 'Today', display: today.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) },
    { key: fmt(yesterday), vi: 'Hôm qua', en: 'Yesterday', display: yesterday.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) },
  ];
}

// ============================================
// Route Planner Page
// ============================================

export default function SalesRepRoutePage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const dateOptions = getDateOptions();
  const [selectedDate, setSelectedDate] = useState(dateOptions[0].key);

  const [data, setData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startingDay, setStartingDay] = useState(false);

  // Fetch route
  const fetchRoute = useCallback(
    async (date: string) => {
      setLoading(true);
      setError('');

      try {
        const res = await api.get<RouteData>('/sales-rep/route', { date });
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.error?.message || t('Lỗi tải dữ liệu', 'Failed to load data'));
        }
      } catch {
        setError(t('Lỗi kết nối mạng', 'Network error'));
      } finally {
        setLoading(false);
      }
    },
    [locale, t]
  );

  useEffect(() => {
    fetchRoute(selectedDate);
  }, [selectedDate, fetchRoute]);

  // Start day handler
  const handleStartDay = async () => {
    setStartingDay(true);
    try {
      await api.post('/sales-rep/route/start', { date: selectedDate });
      // Re-fetch after starting
      await fetchRoute(selectedDate);
    } catch {
      // silently handle
    } finally {
      setStartingDay(false);
    }
  };

  // Format time
  const formatTime = (iso?: string) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // ---- Loading Skeleton ----
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Tuyến hôm nay', "Today's Route")} showBack showNotifications={false} />
        <main className="px-4 pb-24 pt-2">
          {/* Date selector skeleton */}
          <div className="flex gap-2 mb-4">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          {/* Stats skeleton */}
          <Skeleton className="h-10 w-full rounded-xl mb-4" />
          {/* Stops skeleton */}
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl mb-3" />
          ))}
        </main>
      </div>
    );
  }

  // ---- Error State ----
  if (error && !data) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Tuyến hôm nay', "Today's Route")} showBack showNotifications={false} />
        <main className="px-4 pb-24 pt-2">
          <div className="text-center py-16">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive/50" />
            <h3 className="text-lg font-semibold mb-2">{t('Lỗi tải dữ liệu', 'Failed to Load')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchRoute(selectedDate)} variant="outline">
              {t('Thử lại', 'Retry')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const stops = data?.stops || [];
  const totalStops = data?.totalStops || 0;
  const completedStops = data?.completedStops || 0;
  const remainingStops = data?.remainingStops || 0;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Tuyến hôm nay', "Today's Route")} showBack showNotifications={false} />

      <main className="px-4 pb-24 pt-2">
        {/* Date Selector */}
        <div className="flex gap-2 mb-4">
          {dateOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSelectedDate(opt.key)}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium border transition-colors',
                selectedDate === opt.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/50'
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {t(opt.vi, opt.en)}
              <span className="opacity-70">({opt.display})</span>
            </button>
          ))}
        </div>

        {/* Route Stats Bar */}
        {data && (
          <div className="flex items-center justify-between bg-primary/5 border border-primary/10 rounded-xl px-4 py-2.5 mb-4">
            <div className="text-center">
              <p className="text-base font-bold text-primary">{totalStops}</p>
              <p className="text-[10px] text-muted-foreground">{t('điểm', 'stops')}</p>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="text-center">
              <p className="text-base font-bold text-emerald-600">{completedStops}</p>
              <p className="text-[10px] text-muted-foreground">{t('hoàn thành', 'done')}</p>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="text-center">
              <p className="text-base font-bold text-amber-600">{remainingStops}</p>
              <p className="text-[10px] text-muted-foreground">{t('còn lại', 'left')}</p>
            </div>
          </div>
        )}

        {/* Stop List */}
        {stops.length === 0 ? (
          <div className="text-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Route className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {t('Chưa có tuyến cho ngày này', 'No route for this day')}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t('Liên hệ quản lý để được phân tuyến', 'Contact manager for route assignment')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {stops.map((stop, idx) => {
              const statusCfg = STATUS_CONFIG[stop.status] || STATUS_CONFIG.PLANNED;
              const isPlanned = stop.status === 'PLANNED';
              const isVisited = stop.status === 'VISITED';

              return (
                <Card
                  key={stop.shopId}
                  className={cn(
                    'rounded-xl overflow-hidden transition-colors',
                    isPlanned && 'border-dashed',
                    isVisited && 'border-l-4 border-l-emerald-500'
                  )}
                >
                  <CardContent className="p-4">
                    {/* Sequence number + status */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                          {stop.sequence || idx + 1}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] px-1.5 py-0 gap-0.5', statusCfg.cls)}
                        >
                          {statusCfg.icon}
                          {statusCfg.label[locale === 'vi' ? 'vi' : 'en']}
                        </Badge>
                      </div>
                      {isVisited && stop.visitedAt && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatTime(stop.visitedAt)}
                        </span>
                      )}
                    </div>

                    {/* Shop info */}
                    <p className="text-sm font-semibold mb-0.5">{stop.shopName}</p>
                    <div className="flex items-center gap-1 mb-1">
                      <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground truncate">{stop.address}, {stop.district}</p>
                    </div>
                    {stop.phone && (
                      <a
                        href={`tel:${stop.phone}`}
                        className="flex items-center gap-1 text-xs text-primary mb-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="h-3 w-3" />
                        {stop.phone}
                      </a>
                    )}

                    {/* Order info for visited */}
                    {isVisited && stop.orderPlaced && (
                      <div className="flex items-center gap-1.5 mb-3 text-xs">
                        <ShoppingBagIcon />
                        <span className="text-emerald-700 font-medium">
                          {t('Đã đặt: ', 'Ordered: ')}
                          {stop.orderAmountFormatted || new Intl.NumberFormat('vi-VN').format(stop.orderAmount || 0) + ' ₫'}
                        </span>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="mt-1">
                      {isPlanned ? (
                        <Button
                          size="sm"
                          className="h-9 w-full text-xs font-medium gap-1.5"
                          onClick={() => router.push(`/m/sales-rep/visit?shopId=${stop.shopId}`)}
                        >
                          <Play className="h-3.5 w-3.5" />
                          {t('Bắt đầu thăm', 'Start Visit')}
                        </Button>
                      ) : isVisited ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 w-full text-xs font-medium gap-1.5"
                          onClick={() => router.push('/m/sales-rep/route')}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t('Xem chi tiết', 'View Details')}
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* FAB: Start Day */}
      {data && !data.isActive && stops.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
          <Button
            size="lg"
            className="w-full h-12 text-sm font-semibold gap-2 rounded-xl shadow-lg"
            onClick={handleStartDay}
            disabled={startingDay}
          >
            {startingDay ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {t('Bắt đầu ngày', 'Start Day')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Small helper icon
// ============================================

function ShoppingBagIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}