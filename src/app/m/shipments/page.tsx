'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { ShipmentCard, type ShipmentCardData } from '@/components/mobile/shipment-card';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import {
  Search,
  Truck,
  Loader2,
  Package,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ShipmentStatus } from '@/types';

// ============================================
// Filter tabs
// ============================================

const SHIPMENT_TABS = [
  { key: '', vi: 'Tất cả', en: 'All' },
  { key: 'PENDING', vi: 'Chờ lấy', en: 'Pending' },
  { key: 'PICKED_UP', vi: 'Đã lấy', en: 'Picked Up' },
  { key: 'IN_TRANSIT', vi: 'Vận chuyển', en: 'In Transit' },
  { key: 'DELIVERED', vi: 'Đã giao', en: 'Delivered' },
  { key: 'FAILED', vi: 'Thất bại', en: 'Failed' },
];

// ============================================
// Shipments List Page
// ============================================

export default function MobileShipmentsPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [shipments, setShipments] = useState<ShipmentCardData[]>([]);
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

  // ---- Fetch shipments ----
  const fetchShipments = useCallback(async (pageNum: number, search: string, status: string, isLoadMore = false) => {
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

    const res = await api.get<{
      items: ShipmentCardData[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>('/shipments', params);

    if (res.success && res.data) {
      if (isLoadMore) {
        setShipments((prev) => [...prev, ...(res.data?.items || [])]);
      } else {
        setShipments(res.data.items || []);
      }
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotal(res.data.pagination?.total || 0);
    }

    setLoading(false);
    setLoadingMore(false);
  }, []);

  // ---- Load on tab change ----
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!cancelled) {
        setPage(1);
        await fetchShipments(1, searchInput, activeTab);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activeTab, fetchShipments]);

  // ---- Debounced search ----
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchShipments(1, value, activeTab);
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
          fetchShipments(nextPage, searchInput, activeTab, true);
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [loading, loadingMore, page, totalPages, fetchShipments, searchInput, activeTab]);

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Vận chuyển', 'Shipments')}
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
            placeholder={t('Tìm mã đơn, tên shop...', 'Search order, shop name...')}
            className="pl-10 h-10"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
          {SHIPMENT_TABS.map((tab) => (
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
            {total} {t('lô hàng', 'shipments')}
          </p>
        )}

        {/* Shipments list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border rounded-xl p-3 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-24" />
                <div className="flex justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-base font-semibold mb-1">{t('Không có lô hàng', 'No shipments')}</h3>
            <p className="text-sm text-muted-foreground">
              {searchInput || activeTab
                ? t('Thử thay đổi bộ lọc', 'Try different filters')
                : t('Lô hàng sẽ xuất hiện ở đây', 'Shipments will appear here')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {shipments.map((shipment) => (
              <ShipmentCard
                key={shipment.id}
                shipment={shipment}
                locale={locale}
                onTap={(s) => router.push(`/m/shipments/${s.id}`)}
              />
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
