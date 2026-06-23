'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  ShoppingBag,
  Truck,
  CreditCard,
  Tag,
  Settings,
  CheckCheck,
  Filter,
  Package,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api, type ApiResponse } from '@/lib/mobile/api';
import { cn } from '@/lib/utils';

// ============================================
// Server notification type
// ============================================

interface ServerNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

// ============================================
// Map server type → mobile filter key
// ============================================

const TYPE_TO_FILTER: Record<string, string> = {
  ORDER_STATUS: 'order',
  SHIPMENT: 'shipment',
  CREDIT: 'credit',
  SETTLEMENT: 'settlement',
  INVENTORY: 'inventory',
  PROMOTION: 'promotion',
  SYSTEM: 'system',
};

// ============================================
// Filter tabs
// ============================================

interface FilterTab {
  key: string;
  labelVi: string;
  labelEn: string;
  icon: React.ReactNode;
  serverTypes?: string[];
  filter?: (n: ServerNotification) => boolean;
}

const filterTabs: FilterTab[] = [
  {
    key: 'all',
    labelVi: 'Tất cả',
    labelEn: 'All',
    icon: <Bell className="h-3.5 w-3.5" />,
    filter: () => true,
  },
  {
    key: 'order',
    labelVi: 'Đơn hàng',
    labelEn: 'Orders',
    icon: <ShoppingBag className="h-3.5 w-3.5" />,
    serverTypes: ['ORDER_STATUS'],
    filter: (n) => n.type === 'ORDER_STATUS',
  },
  {
    key: 'shipment',
    labelVi: 'Vận chuyển',
    labelEn: 'Shipments',
    icon: <Truck className="h-3.5 w-3.5" />,
    serverTypes: ['SHIPMENT'],
    filter: (n) => n.type === 'SHIPMENT',
  },
  {
    key: 'credit',
    labelVi: 'Công nợ',
    labelEn: 'Credit',
    icon: <CreditCard className="h-3.5 w-3.5" />,
    serverTypes: ['CREDIT'],
    filter: (n) => n.type === 'CREDIT',
  },
  {
    key: 'promotion',
    labelVi: 'Khuyến mãi',
    labelEn: 'Promos',
    icon: <Tag className="h-3.5 w-3.5" />,
    serverTypes: ['PROMOTION'],
    filter: (n) => n.type === 'PROMOTION',
  },
];

// ============================================
// Notification type colors
// ============================================

const TYPE_COLORS: Record<string, { bg: string; icon: React.ReactNode }> = {
  ORDER_STATUS: { bg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40', icon: <ShoppingBag className="h-4 w-4" /> },
  SHIPMENT: { bg: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40', icon: <Truck className="h-4 w-4" /> },
  CREDIT: { bg: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40', icon: <CreditCard className="h-4 w-4" /> },
  PROMOTION: { bg: 'bg-yellow-50 text-red-600 dark:bg-red-900/40', icon: <Tag className="h-4 w-4" /> },
  INVENTORY: { bg: 'bg-orange-100 text-orange-600 dark:bg-orange-900/40', icon: <Package className="h-4 w-4" /> },
  SETTLEMENT: { bg: 'bg-violet-100 text-violet-600 dark:bg-violet-900/40', icon: <Tag className="h-4 w-4" /> },
  SYSTEM: { bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800', icon: <Settings className="h-4 w-4" /> },
};

// ============================================
// Format relative time
// ============================================

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHour < 24) return `${diffHour} giờ trước`;
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

// ============================================
// Notifications Page (Server-Synced)
// ============================================

export default function MobileNotificationsPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [notifications, setNotifications] = useState<ServerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch notifications from server
  const fetchNotifications = useCallback(async (pageNum: number, append = false) => {
    try {
      const res = await api.get<ServerNotification[]>('/notifications', {
        page: String(pageNum),
        limit: '20',
      });
      if (res.success && res.data) {
        setNotifications((prev) => append ? [...prev, ...res.data!] : res.data!);
        setTotal(res.meta?.total || 0);
        setUnreadCount(res.meta?.unreadCount || 0);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  // Load more
  const hasMore = notifications.length < total;
  const loadMore = useCallback(() => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage, true);
  }, [hasMore, loading, page, fetchNotifications]);

  const filteredNotifications = useMemo(() => {
    const tab = filterTabs.find((f) => f.key === activeFilter);
    if (!tab || !tab.filter) return notifications;
    return notifications.filter(tab.filter);
  }, [notifications, activeFilter]);

  const unreadInFilter = useMemo(
    () => filteredNotifications.filter((n) => !n.isRead).length,
    [filteredNotifications]
  );

  // Mark single as read
  const handleNotificationClick = async (n: ServerNotification) => {
    if (!n.isRead) {
      try {
        await api.patch('/notifications', { ids: [n.id] });
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === n.id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Silently fail
      }
    }

    // Navigate based on notification data
    if (n.data?.orderId) {
      router.push(`/m/orders/${n.data.orderId}`);
    } else if (n.data?.shipmentId) {
      router.push(`/m/shipments`);
    } else if (n.type === 'CREDIT') {
      router.push('/m/credit');
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await api.patch('/notifications', { all: true });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // Silently fail
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Thông báo', 'Notifications')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-4 pt-3 space-y-3">
        {/* Mark all read button */}
        {unreadCount > 0 && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-primary"
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              {markingAll ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
              )}
              {t('Đọc tất cả', 'Mark all read')}
            </Button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.key;
            const count = tab.key === 'all'
              ? unreadCount
              : notifications.filter((n) => !n.isRead && tab.filter?.(n)).length;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {tab.icon}
                {locale === 'vi' ? tab.labelVi : tab.labelEn}
                {count > 0 && (
                  <Badge
                    className={cn(
                      'h-4 min-w-4 px-1 text-[10px] flex items-center justify-center rounded-full',
                      isActive
                        ? 'bg-white/20 text-primary-foreground'
                        : 'bg-destructive text-destructive-foreground'
                    )}
                  >
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Notification count */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {unreadInFilter > 0
              ? t(`${unreadInFilter} chưa đọc`, `${unreadInFilter} unread`)
              : t('Đã đọc tất cả', 'All read')}
          </p>
          <p className="text-xs text-muted-foreground">
            {filteredNotifications.length} {t('thông báo', 'notifications')}
          </p>
        </div>

        {/* Notification list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredNotifications.length > 0 ? (
          <div className="space-y-2">
            {filteredNotifications.map((n) => {
              const typeConfig = TYPE_COLORS[n.type] || TYPE_COLORS.SYSTEM;

              return (
                <Card
                  key={n.id}
                  className={cn(
                    'cursor-pointer active:scale-[0.99] transition-all',
                    !n.isRead ? 'border-primary/20 bg-primary/[0.02]' : 'opacity-70'
                  )}
                  onClick={() => handleNotificationClick(n)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      {/* Type icon */}
                      <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', typeConfig.bg)}>
                        {typeConfig.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn('text-sm leading-tight', !n.isRead && 'font-semibold')}>
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                          {formatRelativeTime(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Load more */}
            {hasMore && activeFilter === 'all' && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-9 text-xs"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : null}
                  {t('Tải thêm', 'Load more')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Bell className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-semibold">
              {t('Không có thông báo', 'No notifications')}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {activeFilter !== 'all'
                ? t('Không có thông báo trong danh mục này', 'No notifications in this category')
                : t('Thông báo mới sẽ xuất hiện ở đây', 'New notifications will appear here')}
            </p>
            {activeFilter !== 'all' && (
              <Button
                variant="outline"
                className="mt-4 h-9"
                onClick={() => setActiveFilter('all')}
              >
                <Filter className="h-3.5 w-3.5 mr-1" />
                {t('Xem tất cả', 'View all')}
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}