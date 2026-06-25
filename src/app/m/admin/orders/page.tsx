'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  ShoppingBag,
  Package,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  Loader,
  Box,
  ArrowUpRight,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface OrderItem {
  id: string;
  orderNumber: string;
  shopName: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  totalAmountFormatted?: string;
  itemCount: number;
  createdAt: string;
}

interface OrdersResponse {
  items: OrderItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ============================================
// Status tabs
// ============================================

const STATUS_TABS = [
  { key: '', vi: 'Tất cả', en: 'All' },
  { key: 'PENDING', vi: 'Chờ xử lý', en: 'Pending' },
  { key: 'PROCESSING', vi: 'Đang xử lý', en: 'Processing' },
  { key: 'OUT_FOR_DELIVERY', vi: 'Đang giao', en: 'Out for Delivery' },
];

// ============================================
// Status badge colors
// ============================================

const STATUS_CONFIG: Record<string, { vi: string; en: string; color: string; icon: React.ElementType }> = {
  PENDING: { vi: 'Chờ xử lý', en: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  CONFIRMED: { vi: 'Xác nhận', en: 'Confirmed', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle2 },
  PROCESSING: { vi: 'Đang xử lý', en: 'Processing', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Loader },
  PACKED: { vi: 'Đã đóng gói', en: 'Packed', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400', icon: Box },
  OUT_FOR_DELIVERY: { vi: 'Đang giao', en: 'Out for Delivery', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400', icon: Truck },
  DELIVERED: { vi: 'Đã giao', en: 'Delivered', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  CANCELLED: { vi: 'Đã hủy', en: 'Cancelled', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
};

// ============================================
// Helpers
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ============================================
// Main Page
// ============================================

export default function AdminOrdersPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // KPIs computed from loaded orders
  const [pendingCount, setPendingCount] = useState(0);
  const [revenueToday, setRevenueToday] = useState(0);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ---- Fetch orders ----
  const fetchOrders = useCallback(async (
    pageNum: number,
    status: string,
    isLoadMore = false
  ) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    const params: Record<string, string | number | undefined> = {
      page: pageNum,
      limit: 50,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };
    if (status) params.status = status;

    const res = await api.get<OrdersResponse>('/orders', params);
    if (res.success && res.data) {
      const items = res.data.items || [];

      // KPIs from first page
      if (!isLoadMore && pageNum === 1) {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        setPendingCount(items.filter((o) => o.status === 'PENDING').length);
        setRevenueToday(
          items
            .filter((o) => {
              const created = new Date(o.createdAt);
              return o.status === 'DELIVERED' && created >= todayStart;
            })
            .reduce((sum, o) => sum + o.totalAmount, 0)
        );
      }

      if (isLoadMore) {
        setOrders((prev) => [...prev, ...items]);
      } else {
        setOrders(items);
      }
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotal(res.data.pagination?.total || 0);
    } else {
      if (!isLoadMore) {
        setError(res.error?.message || t('Lỗi tải đơn hàng', 'Failed to load orders'));
      }
    }

    setLoading(false);
    setLoadingMore(false);
  }, [t]);

  // ---- Load on tab change ----
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!cancelled) {
        setPage(1);
        await fetchOrders(1, activeTab);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activeTab, fetchOrders]);

  // ---- Infinite scroll ----
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && page < totalPages) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchOrders(nextPage, activeTab, true);
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [loading, loadingMore, page, totalPages, fetchOrders, activeTab]);

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Quản lý đơn hàng', 'Order Management')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-24 pt-2">
        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-destructive/60" />
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchOrders(1, activeTab)}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              {t('Thử lại', 'Retry')}
            </Button>
          </div>
        )}

        {/* KPI Strip */}
        {!loading && !error && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Card className="border-border/50">
              <CardContent className="p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground">{t('Tổng đơn', 'Total Orders')}</p>
                <p className="text-base font-bold">{total}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground">{t('Chờ xử lý', 'Pending')}</p>
                <p className="text-base font-bold text-yellow-600">{pendingCount}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground">{t('DT hôm nay', 'Revenue Today')}</p>
                <p className="text-xs font-bold text-green-600">{formatVND(revenueToday)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Status filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-4 px-4 no-scrollbar">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {locale === 'vi' ? tab.vi : tab.en}
            </button>
          ))}
        </div>

        {/* Results count */}
        {!loading && !error && (
          <p className="text-xs text-muted-foreground mb-3">
            {total} {t('đơn hàng', 'orders')}
          </p>
        )}

        {/* Loading */}
        {loading && <OrdersSkeleton />}

        {/* Empty state */}
        {!loading && !error && orders.length === 0 && (
          <div className="text-center py-16">
            <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-base font-semibold mb-1">
              {activeTab
                ? t('Không có đơn hàng ở trạng thái này', 'No orders in this status')
                : t('Không có đơn hàng', 'No orders')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('Đơn hàng sẽ xuất hiện ở đây', 'Orders will appear here')}
            </p>
          </div>
        )}

        {/* Order Cards */}
        {!loading && !error && orders.length > 0 && (
          <div className="space-y-3">
            {orders.map((order) => {
              const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
              const StatusIcon = statusCfg.icon;

              return (
                <Card
                  key={order.id}
                  className="border-border/50 cursor-pointer active:scale-[0.99] transition-transform"
                  onClick={() => router.push(`/m/orders/${order.id}`)}
                >
                  <CardContent className="p-3">
                    {/* Top row: order number + date */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-muted-foreground">{order.orderNumber}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(order.createdAt, locale)}
                      </span>
                    </div>

                    {/* Shop name */}
                    <p className="text-sm font-medium mb-2 truncate">{order.shopName}</p>

                    {/* Status + Payment row */}
                    <div className="flex items-center justify-between">
                      <Badge className={cn('text-[10px] gap-1 font-medium', statusCfg.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {locale === 'vi' ? statusCfg.vi : statusCfg.en}
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-primary">
                          {order.totalAmountFormatted || formatVND(order.totalAmount)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Items + payment method */}
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50">
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Package className="h-3 w-3" />
                        {order.itemCount} {t('SP', 'items')}
                      </span>
                      <span className="text-[11px] text-muted-foreground">·</span>
                      <span className="text-[11px] text-muted-foreground">
                        {order.paymentMethod === 'CREDIT'
                          ? t('Công nợ', 'Credit')
                          : order.paymentMethod === 'DIGITAL'
                          ? t('Thanh toán số', 'Digital')
                          : 'COD'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Infinite scroll trigger */}
            {page < totalPages && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ============================================
// Skeleton
// ============================================

function OrdersSkeleton() {
  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border rounded-xl p-2.5 space-y-1">
            <Skeleton className="h-3 w-14 mx-auto" />
            <Skeleton className="h-5 w-8 mx-auto" />
          </div>
        ))}
      </div>
      {/* Order cards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-36" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}