'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Clock,
  ShoppingCart,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CalendarDays,
  StickyNote,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface VisitItem {
  visitId: string;
  shopId: string;
  shopName: string;
  visitDate: string;
  status: 'VISITED' | 'SKIPPED';
  durationMinutes: number;
  notes?: string;
  orderPlaced?: boolean;
  orderAmount?: number;
  orderAmountFormatted?: string;
  orderNumber?: string;
}

interface HistoryStats {
  totalVisits: number;
  totalOrders: number;
  totalRevenue: number;
  totalRevenueFormatted: string;
}

interface HistoryData {
  stats: HistoryStats;
  visits: VisitItem[];
}

// ============================================
// Date Range Tabs
// ============================================

const DATE_RANGES = [
  { key: '7', vi: '7 ngày', en: '7 days' },
  { key: '30', vi: '30 ngày', en: '30 days' },
  { key: '90', vi: '90 ngày', en: '90 days' },
] as const;

// ============================================
// Visit History Page
// ============================================

export default function SalesRepHistoryPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [range, setRange] = useState('30');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<HTMLDivElement | null>(null);

  // Expanded rows
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Compute date range
  const getDates = useCallback(
    (rangeKey: string) => {
      const days = parseInt(rangeKey, 10) || 30;
      const to = new Date();
      const from = new Date(to);
      from.setDate(from.getDate() - days);
      return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      };
    },
    []
  );

  // Fetch visits
  const fetchVisits = useCallback(
    async (pageNum: number, isLoadMore = false) => {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError('');

      try {
        const dates = getDates(range);
        const res = await api.get<HistoryData>('/sales-rep/visits', {
          from: dates.from,
          to: dates.to,
          page: pageNum,
          limit: 20,
          search: debouncedSearch || undefined,
        });

        if (res.success && res.data) {
          if (isLoadMore && data) {
            setData({
              stats: res.data.stats || data.stats,
              visits: [...data.visits, ...res.data.visits],
            });
          } else {
            setData(res.data);
          }
          setHasMore(res.data.visits.length >= 20);
        } else {
          setError(res.error?.message || t('Lỗi tải dữ liệu', 'Failed to load data'));
        }
      } catch {
        setError(t('Lỗi kết nối mạng', 'Network error'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [range, debouncedSearch, data, getDates, locale, t]
  );

  // Initial fetch & reset on filter change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setExpandedIds(new Set());
    fetchVisits(1);
  }, [range, debouncedSearch]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchVisits(nextPage, true);
        }
      },
      { rootMargin: '200px' }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }
    return () => observer.disconnect();
  }, [hasMore, loadingMore, page, fetchVisits]);

  // Toggle expand
  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Format date
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // ---- Loading Skeleton ----
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Lịch sử', 'History')} showBack showNotifications={false} />
        <main className="px-4 pb-24 pt-2">
          {/* Search skeleton */}
          <Skeleton className="h-10 w-full rounded-xl mb-3" />
          {/* Range tabs skeleton */}
          <div className="flex gap-2 mb-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
          {/* Stats skeleton */}
          <Skeleton className="h-10 w-full rounded-xl mb-4" />
          {/* Items skeleton */}
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl mb-2" />
          ))}
        </main>
      </div>
    );
  }

  // ---- Error State ----
  if (error && !data) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Lịch sử', 'History')} showBack showNotifications={false} />
        <main className="px-4 pb-24 pt-2">
          <div className="text-center py-16">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive/50" />
            <h3 className="text-lg font-semibold mb-2">{t('Lỗi tải dữ liệu', 'Failed to Load')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={() => fetchVisits(1)}>
              {t('Thử lại', 'Retry')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const visits = data?.visits || [];
  const stats = data?.stats;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Lịch sử', 'History')} showBack showNotifications={false} />

      <main className="px-4 pb-24 pt-2">
        {/* Search Input */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Tìm cửa hàng...', 'Search shop...')}
            className="pl-9 h-10 rounded-xl text-sm"
          />
        </div>

        {/* Date Range Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-4 no-scrollbar">
          {DATE_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors',
                range === r.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground'
              )}
            >
              {t(r.vi, r.en)}
            </button>
          ))}
        </div>

        {/* Stats Summary Bar */}
        {stats && (
          <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-2.5 mb-4">
            <div className="text-center flex-1">
              <p className="text-sm font-bold">{stats.totalVisits}</p>
              <p className="text-[10px] text-muted-foreground">{t('lượt thăm', 'visits')}</p>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="text-center flex-1">
              <p className="text-sm font-bold">{stats.totalOrders}</p>
              <p className="text-[10px] text-muted-foreground">{t('đơn hàng', 'orders')}</p>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="text-center flex-1">
              <p className="text-sm font-bold">{stats.totalRevenueFormatted}</p>
              <p className="text-[10px] text-muted-foreground">{t('doanh thu', 'revenue')}</p>
            </div>
          </div>
        )}

        {/* Visit List */}
        {visits.length === 0 ? (
          <div className="text-center py-12">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <CalendarDays className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {t('Không có lượt thăm', 'No visits found')}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {t('Thử thay đổi bộ lọc', 'Try changing the filters')}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visits.map((visit) => {
              const isExpanded = expandedIds.has(visit.visitId);
              const isVisited = visit.status === 'VISITED';

              return (
                <Card key={visit.visitId} className="rounded-xl overflow-hidden">
                  <CardContent className="p-3.5">
                    {/* Row header */}
                    <button
                      className="w-full text-left"
                      onClick={() => toggleExpand(visit.visitId)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(visit.visitDate)}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] px-1.5 py-0',
                                isVisited
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                  : 'bg-red-100 text-red-700 border-red-200'
                              )}
                            >
                              {isVisited
                                ? t('Đã thăm', 'Visited')
                                : t('Bỏ qua', 'Skipped')}
                            </Badge>
                          </div>
                          <p className="text-sm font-semibold truncate">{visit.shopName}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {visit.durationMinutes} {t('phút', 'min')}
                            </span>
                            {visit.orderPlaced && visit.orderAmountFormatted && (
                              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                                <ShoppingCart className="h-3 w-3" />
                                {visit.orderAmountFormatted}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 mt-1">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <>
                        <Separator className="my-2.5" />
                        <div className="space-y-1.5">
                          {/* Order number */}
                          {visit.orderNumber && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <ShoppingCart className="h-3 w-3" />
                                {t('Mã đơn hàng', 'Order #')}
                              </span>
                              <span className="text-xs font-medium">{visit.orderNumber}</span>
                            </div>
                          )}

                          {/* Amount */}
                          {visit.orderPlaced && visit.orderAmountFormatted && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <DollarSign className="h-3 w-3" />
                                {t('Giá trị đơn', 'Order Value')}
                              </span>
                              <span className="text-xs font-semibold">{visit.orderAmountFormatted}</span>
                            </div>
                          )}

                          {/* Duration */}
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Clock className="h-3 w-3" />
                              {t('Thời gian', 'Duration')}
                            </span>
                            <span className="text-xs">
                              {visit.durationMinutes} {t('phút', 'min')}
                            </span>
                          </div>

                          {/* Notes */}
                          {visit.notes && (
                            <div className="mt-2 pt-2 border-t border-dashed">
                              <div className="flex items-center gap-1.5 mb-1">
                                <StickyNote className="h-3 w-3 text-muted-foreground" />
                                <span className="text-[10px] font-medium text-muted-foreground uppercase">
                                  {t('Ghi chú', 'Notes')}
                                </span>
                              </div>
                              <p className="text-xs text-foreground leading-relaxed">{visit.notes}</p>
                            </div>
                          )}

                          {!visit.notes && !visit.orderNumber && (
                            <p className="text-xs text-muted-foreground/60 italic pt-1">
                              {t('Không có ghi chú', 'No notes')}
                            </p>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Infinite scroll sentinel */}
            <div ref={observerRef} className="h-8" />

            {/* Loading more indicator */}
            {loadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              </div>
            )}

            {/* End of list */}
            {!hasMore && visits.length > 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                {t('Đã hiển thị tất cả', 'All items shown')}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}