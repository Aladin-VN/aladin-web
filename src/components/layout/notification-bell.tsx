'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, ShoppingBag, Truck, CreditCard, Package, Settings, Tag, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useLocale, useAuth } from '@/providers/app-provider';
import { adminFetch } from '@/lib/admin-fetch';
import { cn } from '@/lib/utils';

// ============================================
// Types
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
// Notification type icon/color config
// ============================================

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  ORDER_STATUS: {
    icon: <ShoppingBag className="h-4 w-4" />,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  SHIPMENT: {
    icon: <Truck className="h-4 w-4" />,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
  },
  CREDIT: {
    icon: <CreditCard className="h-4 w-4" />,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  INVENTORY: {
    icon: <Package className="h-4 w-4" />,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  SETTLEMENT: {
    icon: <Tag className="h-4 w-4" />,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  PROMOTION: {
    icon: <Tag className="h-4 w-4" />,
    color: 'text-red-600',
    bg: 'bg-yellow-50',
  },
  SYSTEM: {
    icon: <Settings className="h-4 w-4" />,
    color: 'text-gray-600',
    bg: 'bg-gray-50',
  },
};

const DEFAULT_TYPE = {
  icon: <Bell className="h-4 w-4" />,
  color: 'text-gray-500',
  bg: 'bg-gray-50',
};

// ============================================
// Relative time formatting
// ============================================

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
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
// Notification Bell Component
// ============================================

export function NotificationBell() {
  const { locale } = useLocale();
  const { user } = useAuth();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [notifications, setNotifications] = useState<ServerNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const fetchedRef = useRef(false);

  // Fetch notifications when popover opens
  const fetchNotifications = useCallback(async () => {
    if (!user?.userId || loading) return;
    setLoading(true);
    try {
      const res = await adminFetch('/api/notifications?limit=10');
      if (res.success) {
        setNotifications(res.data || []);
        setUnreadCount(res.meta?.unreadCount || 0);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [user?.userId, loading]);

  useEffect(() => {
    if (open && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchNotifications();
    }
    if (!open) {
      fetchedRef.current = false;
    }
  }, [open, fetchNotifications]);

  // Also fetch on mount for the badge count
  useEffect(() => {
    if (!user?.userId) return;
    adminFetch('/api/notifications?limit=1&unreadOnly=true')
      .then((res) => {
        if (res.success) {
          setUnreadCount(res.meta?.unreadCount || 0);
        }
      })
      .catch(() => {});
  }, [user?.userId]);

  // Mark single as read
  const markAsRead = useCallback(async (id: string) => {
    try {
      await adminFetch('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  }, []);

  // Mark all as read
  const markAllRead = useCallback(async () => {
    try {
      await adminFetch('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }, []);

  const hasUnread = notifications.some((n) => !n.isRead);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white font-bold ring-2 ring-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">
            {t('Notifications', 'Thông báo')}
          </h3>
          {hasUnread && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-primary hover:text-primary"
              onClick={markAllRead}
            >
              {t('Mark all read', 'Đọc tất cả')}
            </Button>
          )}
        </div>

        {/* Notification list */}
        <ScrollArea className="h-80">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((n) => {
                const config = TYPE_CONFIG[n.type] || DEFAULT_TYPE;
                return (
                  <button
                    key={n.id}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                      !n.isRead && 'bg-primary/[0.03]'
                    )}
                    onClick={() => {
                      if (!n.isRead) markAsRead(n.id);
                    }}
                  >
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5', config.bg, config.color)}>
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className={cn('text-sm leading-tight', !n.isRead && 'font-semibold')}>
                          {n.title}
                        </p>
                        {!n.isRead && (
                          <div className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatRelativeTime(n.createdAt)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('No notifications', 'Không có thông báo')}
              </p>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-8 text-xs text-muted-foreground"
                onClick={() => setOpen(false)}
              >
                {t('View all notifications', 'Xem tất cả thông báo')}
                <ChevronDown className="h-3 w-3 ml-1 rotate-90" />
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}