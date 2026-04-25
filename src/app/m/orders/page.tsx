'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { StatusBadge } from '@/components/mobile/order-status-badge';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import {
  Search,
  ShoppingBag,
  Package,
  Filter,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { OrderStatus, PaymentMethod } from '@/types';

// ============================================
// Types
// ============================================

interface OrderItem {
  id: string;
  orderNumber: string;
  shopName: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
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
// Filter tabs
// ============================================

const STATUS_TABS = [
  { key: '', vi: 'Tất cả', en: 'All' },
  { key: 'PENDING', vi: 'Chờ xử lý', en: 'Pending' },
  { key: 'CONFIRMED', vi: 'Xác nhận', en: 'Confirmed' },
  { key: 'PROCESSING', vi: 'Xử lý', en: 'Processing' },
  { key: 'PACKED', vi: 'Đóng gói', en: 'Packed' },
  { key: 'OUT_FOR_DELIVERY', vi: 'Đang giao', en: 'Delivering' },
  { key: 'DELIVERED', vi: 'Đã giao', en: 'Delivered' },
  { key: 'CANCELLED', vi: 'Đã hủy', en: 'Cancelled' },
];

// ============================================
// Helpers
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ============================================
// Orders List Page
// ============================================

export default function MobileOrdersPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTab, setActiveTab] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ---- Fetch orders ----
  const fetchOrders = useCallback(async (pageNum: number, search: string, status: string, isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    const params: Record<string, string | number | undefined> = {
      page: pageNum,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };
    if (search) params.search = search;
    if (status) params.status = status;

    const res = await api.get<OrdersResponse>('/orders', params);
    if (res.success && res.data) {
      if (isLoadMore) {
        setOrders((prev) => [...prev, ...(res.data?.items || [])]);
      } else {
        setOrders(res.data.items || []);
      }
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotal(res.data.pagination?.total || 0);
    }

    setLoading(false);
    setLoadingMore(false);
  }, []);

  // ---- Load on tab/search change ----
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!cancelled) {
        setPage(1);
        await fetchOrders(1, searchInput, activeTab);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activeTab, fetchOrders]);

  // ---- Debounced search ----
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchOrders(1, value, activeTab);
    }, 400);
  };

  // ---- Infinite scroll ----
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && page < totalPages) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchOrders(nextPage, searchInput, activeTab, true);
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [loading, loadingMore, page, totalPages, fetchOrders, searchInput, activeTab]);

  // ---- Count per status (approximate from current data) ----
  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Đơn hàng', 'Orders')}
        showSearch={false}
        showNotifications={false}
      />

      <main className="px-4 pb-24 pt-2">
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('Tìm mã đơn hàng, tên shop...', 'Search order number, shop name...')}
            className="pl-10 h-10"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
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
        {!loading && (
          <p className="text-xs text-muted-foreground mt-2 mb-3">
            {total} {t('đơn hàng', 'orders')}
          </p>
        )}

        {/* Orders list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border rounded-xl p-3 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-24" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-base font-semibold mb-1">{t('Không có đơn hàng', 'No orders')}</h3>
            <p className="text-sm text-muted-foreground">
              {searchInput || activeTab
                ? t('Thử thay đổi bộ lọc', 'Try different filters')
                : t('Đơn hàng sẽ xuất hiện ở đây', 'Orders will appear here')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <button
                key={order.id}
                onClick={() => router.push(`/m/orders/${order.id}`)}
                className="w-full text-left bg-card border rounded-xl p-3 active:scale-[0.99] transition-all"
              >
                {/* Top row: order number + date */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-muted-foreground">{order.orderNumber}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(order.createdAt, locale)}
                  </span>
                </div>

                {/* Status + payment method */}
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge status={order.status} type="order" locale={locale} />
                  <StatusBadge status={order.paymentStatus} type="payment" locale={locale} />
                </div>

                {/* Items + total */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Package className="h-3 w-3" />
                    <span>{order.itemCount} {t('SP', 'items')}</span>
                    <span className="mx-1">·</span>
                    <span>{t(order.paymentMethod === 'CREDIT' ? 'Công nợ' : order.paymentMethod === 'DIGITAL' ? 'Số' : 'COD',
                              order.paymentMethod === 'CREDIT' ? 'Credit' : order.paymentMethod === 'DIGITAL' ? 'Digital' : 'COD')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-primary">
                      {order.totalAmountFormatted || formatVND(order.totalAmount)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </button>
            ))}

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
