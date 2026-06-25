'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { toast } from 'sonner';
import {
  Bell, ShoppingCart, Truck, CreditCard, Wallet, Package, Settings, Tag,
  ChevronLeft, ChevronRight, RefreshCw, CheckCheck, Mail, MailOpen,
  CalendarDays,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AdminHeader } from '@/components/layout/admin-header';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// ─── Notification type config ────────────────────────────────────────
type NotifType = 'ORDER_STATUS' | 'SHIPMENT' | 'CREDIT' | 'SETTLEMENT' | 'INVENTORY' | 'SYSTEM' | 'PROMOTION';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  data: any;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

interface NotifMeta {
  unreadCount: number;
}

// ─── Type icon / color map ───────────────────────────────────────────
const typeConfig: Record<NotifType, { icon: React.ElementType; color: string; bg: string; label: string; labelEn: string }> = {
  ORDER_STATUS: { icon: ShoppingCart, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/50', label: 'Đơn hàng', labelEn: 'Order' },
  SHIPMENT:     { icon: Truck,        color: 'text-cyan-600 dark:text-cyan-400',       bg: 'bg-cyan-100 dark:bg-cyan-900/50',       label: 'Vận chuyển', labelEn: 'Shipment' },
  CREDIT:       { icon: CreditCard,   color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-100 dark:bg-amber-900/50',     label: 'Tín dụng', labelEn: 'Credit' },
  INVENTORY:    { icon: Package,      color: 'text-orange-600 dark:text-orange-400',   bg: 'bg-orange-100 dark:bg-orange-900/50',   label: 'Kho hàng', labelEn: 'Inventory' },
  SETTLEMENT:   { icon: Wallet,       color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-100 dark:bg-violet-900/50',   label: 'Quyết toán', labelEn: 'Settlement' },
  PROMOTION:    { icon: Tag,          color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-100 dark:bg-red-900/50',         label: 'Khuyến mãi', labelEn: 'Promotion' },
  SYSTEM:       { icon: Settings,     color: 'text-gray-600 dark:text-gray-400',       bg: 'bg-gray-100 dark:bg-gray-900/50',       label: 'Hệ thống', labelEn: 'System' },
};

// ─── Relative time helper (Vietnamese) ───────────────────────────────
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  if (diffHr < 24) return `${diffHr} giờ trước`;
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

// ─── Filter tabs ─────────────────────────────────────────────────────
type FilterTab = 'all' | 'unread' | 'read';

// ─── Component ───────────────────────────────────────────────────────
export default function DistributorNotifications() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [markingAll, setMarkingAll] = useState(false);

  const limit = 20;

  // ─── Fetch notifications ─────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/notifications?limit=${limit}&page=${page}${filter === 'unread' ? '&unreadOnly=true' : ''}`);
      if (res.success) {
        const payload = res.data || {};
        const data: Notification[] = payload.items || res.data || [];
        setNotifications(data);
        setUnreadCount(payload.unreadCount ?? res.meta?.unreadCount ?? 0);
        const total = payload.pagination?.total ?? data.length;
        setTotalPages(Math.max(1, Math.ceil(total / limit)));
      }
    } catch (e: any) {
      toast.error(t('Lỗi tải thông báo', 'Failed to load notifications'), {
        description: e?.message || '',
      });
    }
    setLoading(false);
  }, [page, filter, locale]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // ─── Mark single as read ─────────────────────────────────────────
  const markAsRead = useCallback(async (id: string) => {
    try {
      await adminFetch('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ ids: [id] }),
      });
      fetchNotifications();
    } catch (e: any) {
      toast.error(t('Lỗi đánh dấu đã đọc', 'Failed to mark as read'));
    }
  }, [fetchNotifications, locale]);

  // ─── Mark all as read ───────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (markingAll) return;
    setMarkingAll(true);
    try {
      await adminFetch('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ all: true }),
      });
      toast.success(t('Đã đánh dấu tất cả là đã đọc', 'All notifications marked as read'));
      fetchNotifications();
    } catch (e: any) {
      toast.error(t('Lỗi cập nhật', 'Failed to update'));
    }
    setMarkingAll(false);
  }, [markingAll, fetchNotifications, locale]);

  // ─── KPIs ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86400000;
    const all = notifications;
    const unread = all.filter(n => !n.isRead).length;
    const read = all.filter(n => n.isRead).length;
    const thisWeek = all.filter(n => new Date(n.createdAt).getTime() >= weekAgo).length;
    return { total: all.length, unread, read, thisWeek };
  }, [notifications]);

  // ─── Tab button helper ───────────────────────────────────────────
  const tabBtn = (key: FilterTab, vi: string, en: string, count: number) => {
    const active = filter === key;
    return (
      <button
        key={key}
        onClick={() => { setFilter(key); setPage(1); }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
          active
            ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
            : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
        )}
      >
        {t(vi, en)}
        <span className={cn(
          'inline-flex items-center justify-center h-5 min-w-5 rounded-full text-[11px] font-bold px-1.5',
          active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground',
        )}>
          {count}
        </span>
      </button>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <>
      <AdminHeader />
      <div className="flex flex-1 flex-col">
      {/* Page Header */}
      <div className="px-4 md:px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-600/20">
            <Bell className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{t('Thông báo', 'Notifications')}</h1>
              {unreadCount > 0 && (
                <Badge className="rounded-full bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 hover:bg-red-700 shadow-sm">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('Cập nhật hoạt động và thông báo hệ thống', 'Activity updates and system notifications')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchNotifications}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              {t('Làm mới', 'Refresh')}
            </Button>
            {unreadCount > 0 && (
              <Button
                size="sm"
                onClick={markAllRead}
                disabled={markingAll}
                className="bg-red-600 hover:bg-red-700 text-white shadow-sm"
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                {t('Đọc tất cả', 'Mark all read')}
              </Button>
            )}
          </div>
        </div>
      </div>
      <Separator />

      <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {tabBtn('all', 'Tất cả', 'All', notifications.length)}
          {tabBtn('unread', 'Chưa đọc', 'Unread', unreadCount)}
          {tabBtn('read', 'Đã đọc', 'Read', kpis.read)}
        </div>

        {/* KPI Mini Cards */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{t('Tổng thông báo', 'Total')}</p>
                    <p className="text-xl font-bold mt-1 text-blue-700 dark:text-blue-400">{kpis.total}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t('tất cả loại', 'all types')}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{t('Chưa đọc', 'Unread')}</p>
                    <p className="text-xl font-bold mt-1 text-red-700 dark:text-red-400">{kpis.unread}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t('cần chú ý', 'need attention')}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{t('Đã đọc', 'Read')}</p>
                    <p className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{kpis.read}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t('đã xem', 'viewed')}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                    <MailOpen className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{t('Trong tuần', 'This Week')}</p>
                    <p className="text-xl font-bold mt-1 text-amber-700 dark:text-amber-400">{kpis.thisWeek}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t('7 ngày gần nhất', 'last 7 days')}</p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                    <CalendarDays className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Notification List */}
        <Card className="shadow-sm rounded-xl overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 md:p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48 rounded" />
                      <Skeleton className="h-3 w-72 rounded" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 w-20 rounded" />
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-20">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Bell className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {filter === 'unread'
                    ? t('Không có thông báo chưa đọc', 'No unread notifications')
                    : filter === 'read'
                      ? t('Không có thông báo đã đọc', 'No read notifications')
                      : t('Chưa có thông báo nào', 'No notifications yet')
                  }
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {t('Thông báo mới sẽ xuất hiện ở đây', 'New notifications will appear here')}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider w-12">{t('Loại', 'Type')}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Tiêu đề', 'Title')}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider hidden md:table-cell">{t('Nội dung', 'Message')}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Trạng thái', 'Status')}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Thời gian', 'Time')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifications.map((notif) => {
                      const cfg = typeConfig[notif.type] || typeConfig.SYSTEM;
                      const Icon = cfg.icon;
                      return (
                        <TableRow
                          key={notif.id}
                          className={cn(
                            'cursor-pointer transition-colors',
                            !notif.isRead ? 'bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50 dark:hover:bg-red-950/20' : 'hover:bg-muted/50',
                          )}
                          onClick={() => !notif.isRead && markAsRead(notif.id)}
                        >
                          {/* Type icon */}
                          <TableCell>
                            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', cfg.bg)}>
                              <Icon className={cn('h-4 w-4', cfg.color)} />
                            </div>
                          </TableCell>
                          {/* Title */}
                          <TableCell>
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className={cn('text-sm truncate', !notif.isRead && 'font-semibold')}>
                                {notif.title}
                              </span>
                              <span className="md:hidden text-xs text-muted-foreground truncate max-w-[200px]">
                                {notif.message}
                              </span>
                            </div>
                          </TableCell>
                          {/* Message (desktop) */}
                          <TableCell className="hidden md:table-cell">
                            <p className="text-xs text-muted-foreground truncate max-w-xs">
                              {notif.message}
                            </p>
                          </TableCell>
                          {/* Read/Unread badge */}
                          <TableCell className="text-center">
                            {notif.isRead ? (
                              <Badge variant="secondary" className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[11px] font-medium px-2.5 py-0.5 border-0">
                                {t('Đã đọc', 'Read')}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-[11px] font-medium px-2.5 py-0.5 border-0">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse" />
                                {t('Chưa đọc', 'Unread')}
                              </Badge>
                            )}
                          </TableCell>
                          {/* Relative time */}
                          <TableCell className="text-right">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {relativeTime(notif.createdAt)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t(`Trang ${page}/${totalPages}`, `Page ${page}/${totalPages}`)}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> {t('Trước', 'Prev')}
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                {t('Sau', 'Next')} <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
}