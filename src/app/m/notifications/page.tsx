'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  ShoppingBag,
  Truck,
  CreditCard,
  Tag,
  Settings,
  Check,
  CheckCheck,
  Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { cn } from '@/lib/utils';
import type { Notification } from '@/stores/app.store';

// ============================================
// Filter tabs
// ============================================

interface FilterTab {
  key: string;
  labelVi: string;
  labelEn: string;
  icon: React.ReactNode;
  filter: (n: Notification) => boolean;
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
    filter: (n) => n.type === 'order',
  },
  {
    key: 'shipment',
    labelVi: 'Vận chuyển',
    labelEn: 'Shipments',
    icon: <Truck className="h-3.5 w-3.5" />,
    filter: (n) => n.type === 'shipment',
  },
  {
    key: 'credit',
    labelVi: 'Công nợ',
    labelEn: 'Credit',
    icon: <CreditCard className="h-3.5 w-3.5" />,
    filter: (n) => n.type === 'credit',
  },
  {
    key: 'promotion',
    labelVi: 'Khuyến mãi',
    labelEn: 'Promos',
    icon: <Tag className="h-3.5 w-3.5" />,
    filter: (n) => n.type === 'promotion',
  },
];

// ============================================
// Notification type colors
// ============================================

const TYPE_COLORS: Record<string, { bg: string; icon: React.ReactNode }> = {
  order: { bg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40', icon: <ShoppingBag className="h-4 w-4" /> },
  shipment: { bg: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40', icon: <Truck className="h-4 w-4" /> },
  credit: { bg: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40', icon: <CreditCard className="h-4 w-4" /> },
  promotion: { bg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40', icon: <Tag className="h-4 w-4" /> },
  system: { bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800', icon: <Settings className="h-4 w-4" /> },
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
// Notifications Page
// ============================================

export default function MobileNotificationsPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const notifications = useAppStore((s) => s.notifications);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useAppStore((s) => s.markAllNotificationsRead);
  const [activeFilter, setActiveFilter] = useState('all');
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const filteredNotifications = useMemo(
    () => {
      const tab = filterTabs.find((f) => f.key === activeFilter);
      if (!tab) return notifications;
      return notifications.filter(tab.filter);
    },
    [notifications, activeFilter]
  );

  const unreadInFilter = useMemo(
    () => filteredNotifications.filter((n) => !n.read).length,
    [filteredNotifications]
  );

  const handleNotificationClick = (n: Notification) => {
    if (!n.read) markNotificationRead(n.id);
    if (n.actionUrl) router.push(n.actionUrl);
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
        {notifications.some((n) => !n.read) && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-primary"
              onClick={markAllNotificationsRead}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              {t('Đọc tất cả', 'Mark all read')}
            </Button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.key;
            const count = tab.key === 'all'
              ? notifications.filter((n) => !n.read).length
              : notifications.filter((n) => !n.read && tab.filter(n)).length;

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
        {filteredNotifications.length > 0 ? (
          <div className="space-y-2">
            {filteredNotifications.map((n) => {
              const typeConfig = TYPE_COLORS[n.type] || TYPE_COLORS.system;

              return (
                <Card
                  key={n.id}
                  className={cn(
                    'cursor-pointer active:scale-[0.99] transition-all',
                    !n.read ? 'border-primary/20 bg-primary/[0.02]' : 'opacity-70'
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
                          <p className={cn('text-sm leading-tight', !n.read && 'font-semibold')}>
                            {locale === 'vi' && n.titleVi ? n.titleVi : n.title}
                          </p>
                          {!n.read && (
                            <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {locale === 'vi' && n.bodyVi ? n.bodyVi : n.body}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                          {formatRelativeTime(n.createdAt)}
                        </p>
                      </div>

                      {/* Action chevron */}
                      {n.actionUrl && (
                        <div className="shrink-0 mt-2 text-muted-foreground/40">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
