'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { usePullToRefresh } from '@/lib/mobile/use-pull-to-refresh';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Truck,
  MapPin,
  Package,
  Clock,
  PackageCheck,
  Loader2,
  Inbox,
  RotateCcw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

type DeliveryStatus = 'PENDING' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';

interface DriverDelivery {
  id: string;
  orderNumber: string;
  shopName: string;
  address: string;
  district?: string;
  itemCount: number;
  totalAmount: number;
  status: DeliveryStatus;
  scheduledTime?: string;
  pickedUpAt?: string;
  inTransitAt?: string;
  deliveredAt?: string;
  failedAt?: string;
  failureReason?: string;
}

interface DeliveriesResponse {
  deliveries: DriverDelivery[];
  summary: {
    total: number;
    delivered: number;
    remaining: number;
  };
}

// ============================================
// Config
// ============================================

type FilterTab = 'ALL' | DeliveryStatus;

const STATUS_CONFIG: Record<DeliveryStatus, { vi: string; en: string; bg: string; text: string }> = {
  PENDING: { vi: 'Chờ lấy', en: 'Pending', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  PICKED_UP: { vi: 'Đã lấy', en: 'Picked Up', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  IN_TRANSIT: { vi: 'Đang giao', en: 'In Transit', bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400' },
  DELIVERED: { vi: 'Đã giao', en: 'Delivered', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  FAILED: { vi: 'Thất bại', en: 'Failed', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
};

const FILTER_TABS: { value: FilterTab; vi: string; en: string }[] = [
  { value: 'ALL', vi: 'Tất cả', en: 'All' },
  { value: 'PENDING', vi: 'Chờ lấy', en: 'Pending' },
  { value: 'PICKED_UP', vi: 'Đã lấy', en: 'Picked Up' },
  { value: 'IN_TRANSIT', vi: 'Đang giao', en: 'In Transit' },
  { value: 'DELIVERED', vi: 'Đã giao', en: 'Delivered' },
  { value: 'FAILED', vi: 'Thất bại', en: 'Failed' },
];

// ============================================
// Helpers
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ============================================
// Page Component
// ============================================

export default function DriverDeliveriesPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [dateMode, setDateMode] = useState<'today' | 'yesterday'>('today');
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [deliveries, setDeliveries] = useState<DriverDelivery[]>([]);
  const [summary, setSummary] = useState({ total: 0, delivered: 0, remaining: 0 });
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Initial fetch & refetch on filter/refresh change
  useEffect(() => {
    const date = dateMode === 'today' ? getTodayStr() : getYesterdayStr();
    const status = activeTab !== 'ALL' ? activeTab : undefined;
    const fetch = async () => {
      setLoading(true);
      const params: Record<string, string | number | undefined> = { date };
      if (status) params.status = status;
      const res = await api.get<DeliveriesResponse>('/driver/deliveries', params);
      if (res.success && res.data) {
        setDeliveries(res.data.deliveries);
        setSummary(res.data.summary);
      }
      setLoading(false);
    };
    fetch();
  }, [dateMode, activeTab, refreshCounter]);

  // Pull to refresh
  const { isRefreshing, pullHandlers, pullDistance } = usePullToRefresh({
    onRefresh: async () => {
      setRefreshCounter((c) => c + 1);
    },
  });

  // Status update handler
  const handleStatusUpdate = async (deliveryId: string, newStatus: DeliveryStatus) => {
    setUpdatingId(deliveryId);
    await api.patch(`/driver/deliveries/${deliveryId}/status`, { status: newStatus });
    setUpdatingId(null);
    setRefreshCounter((c) => c + 1);
  };

  // Action button config per status
  const getActionButton = (delivery: DriverDelivery) => {
    switch (delivery.status) {
      case 'PENDING':
        return {
          label: t('Lấy hàng', 'Pick Up'),
          variant: 'default' as const,
          onClick: () => handleStatusUpdate(delivery.id, 'PICKED_UP'),
          icon: <Package className="h-4 w-4" />,
        };
      case 'PICKED_UP':
        return {
          label: t('Bắt đầu giao', 'Start Transit'),
          variant: 'default' as const,
          onClick: () => handleStatusUpdate(delivery.id, 'IN_TRANSIT'),
          icon: <Truck className="h-4 w-4" />,
        };
      case 'IN_TRANSIT':
        return {
          label: t('Xác nhận giao', 'Confirm Delivery'),
          variant: 'default' as const,
          onClick: () => router.push(`/m/driver/deliveries/${delivery.id}`),
          icon: <PackageCheck className="h-4 w-4" />,
        };
      case 'DELIVERED':
        return {
          label: t('Đã hoàn thành', 'Completed'),
          variant: 'ghost' as const,
          onClick: () => router.push(`/m/driver/deliveries/${delivery.id}`),
          icon: <CheckCircle2 className="h-4 w-4" />,
          muted: true,
        };
      case 'FAILED':
        return {
          label: t('Thử lại', 'Retry'),
          variant: 'outline' as const,
          onClick: () => handleStatusUpdate(delivery.id, 'PENDING'),
          icon: <RotateCcw className="h-4 w-4" />,
        };
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Giao hàng hôm nay', "Today's Deliveries")}
        showBack
        showNotifications={false}
      />

      <main
        className="pb-24"
        {...pullHandlers}
        style={{ transform: `translateY(${pullDistance}px)`, transition: pullDistance > 0 ? 'none' : 'transform 0.2s' }}
      >
        {/* Refresh indicator */}
        {isRefreshing && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}

        {/* Date selector */}
        <div className="px-4 pt-3">
          <div className="flex gap-2">
            <button
              onClick={() => setDateMode('today')}
              className={cn(
                'flex-1 h-10 rounded-lg text-sm font-medium transition-colors',
                dateMode === 'today'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {t('Hôm nay', 'Today')}
            </button>
            <button
              onClick={() => setDateMode('yesterday')}
              className={cn(
                'flex-1 h-10 rounded-lg text-sm font-medium transition-colors',
                dateMode === 'yesterday'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {t('Hôm qua', 'Yesterday')}
            </button>
          </div>
        </div>

        {/* Filter tabs — horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3 -mx-4">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            const label = locale === 'vi' ? tab.vi : tab.en;
            const count = tab.value === 'ALL'
              ? deliveries.length
              : deliveries.filter((d) => d.status === tab.value).length;

            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-border hover:border-primary/50'
                )}
              >
                {label}
                {count > 0 && (
                  <span className={cn(
                    'h-4 min-w-4 px-1 rounded-full text-[10px] flex items-center justify-center',
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Summary stats */}
        {!loading && (
          <div className="px-4 mb-3">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span>
                {summary.total} {t('chuyến', 'trips')}
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span className="text-green-600 dark:text-green-400 font-medium">
                {summary.delivered} {t('thành công', 'success')}
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span>
                {summary.remaining} {t('còn lại', 'remaining')}
              </span>
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="px-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && deliveries.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">{t('Không có chuyến giao hàng', 'No deliveries')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t(
                'Chưa có chuyến giao nào cho ngày được chọn',
                'No deliveries for the selected date'
              )}
            </p>
          </div>
        )}

        {/* Delivery cards list */}
        {!loading && deliveries.length > 0 && (
          <div className="px-4 space-y-3">
            {deliveries.map((delivery) => {
              const action = getActionButton(delivery);
              const statusCfg = STATUS_CONFIG[delivery.status];
              const isUpdating = updatingId === delivery.id;

              return (
                <Card key={delivery.id} className="rounded-xl overflow-hidden">
                  <CardContent className="p-4">
                    {/* Top: status badge + order number */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium text-[10px]', statusCfg.bg, statusCfg.text)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', delivery.status === 'PENDING' ? 'bg-amber-500' : delivery.status === 'PICKED_UP' ? 'bg-blue-500' : delivery.status === 'IN_TRANSIT' ? 'bg-cyan-500' : delivery.status === 'DELIVERED' ? 'bg-green-500' : 'bg-red-500')} />
                        {locale === 'vi' ? statusCfg.vi : statusCfg.en}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {delivery.orderNumber}
                      </span>
                    </div>

                    {/* Shop name */}
                    <p className="text-sm font-semibold mb-1">{delivery.shopName}</p>

                    {/* Address */}
                    <div className="flex items-start gap-1.5 mb-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {delivery.address}{delivery.district ? `, ${delivery.district}` : ''}
                      </p>
                    </div>

                    {/* Items + amount + time */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {delivery.itemCount} {t('sp', 'items')}
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatVND(delivery.totalAmount)}
                      </span>
                      {delivery.scheduledTime && (
                        <span className="ml-auto flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {delivery.scheduledTime}
                        </span>
                      )}
                    </div>

                    {/* Delivered/Failed timestamp */}
                    {delivery.deliveredAt && (
                      <p className="text-[10px] text-green-600 dark:text-green-400 mb-2">
                        <CheckCircle2 className="h-3 w-3 inline mr-0.5" />
                        {t('Đã giao lúc', 'Delivered at')} {new Date(delivery.deliveredAt).toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {delivery.failedAt && (
                      <p className="text-[10px] text-red-600 dark:text-red-400 mb-2">
                        <XCircle className="h-3 w-3 inline mr-0.5" />
                        {t('Thất bại lúc', 'Failed at')} {new Date(delivery.failedAt).toLocaleTimeString(locale === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                        {delivery.failureReason && ` — ${delivery.failureReason}`}
                      </p>
                    )}

                    {/* Action button */}
                    <Button
                      className={cn(
                        'w-full h-12 rounded-xl font-semibold',
                        action.muted && 'opacity-50 pointer-events-none'
                      )}
                      variant={action.variant}
                      onClick={action.onClick}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <span className="mr-2">{action.icon}</span>
                      )}
                      {action.label}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

