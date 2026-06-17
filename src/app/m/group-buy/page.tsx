'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { PullToRefreshIndicator } from '@/components/mobile/pull-to-refresh-indicator';
import { DealCard, type DealCardData } from '@/components/mobile/deal-card';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { Search, Loader2, TrendingDown, Package } from 'lucide-react';

// ============================================
// Group Buy List Page — /m/group-buy
// ============================================

const STATUS_TABS = [
  { key: '', vi: 'Tất cả', en: 'All' },
  { key: 'ACTIVE', vi: 'Hoạt động', en: 'Active' },
  { key: 'COMPLETED', vi: 'Hoàn thành', en: 'Completed' },
  { key: 'EXPIRED', vi: 'Hết hạn', en: 'Expired' },
] as const;

export default function MobileGroupBuyPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const router = useRouter();

  const [deals, setDeals] = useState<DealCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Fetch deals
  const fetchDeals = useCallback(async (pageNum: number, status: string, searchQuery: string, reset: boolean) => {
    try {
      if (pageNum === 1) setLoading(true);
      setError(null);

      const params: Record<string, string | number> = { page: pageNum, limit: 20 };
      if (status) params.status = status;
      if (searchQuery) params.search = searchQuery;

      const res = await api.get('/group-deals', params);
      const raw = res.data as Record<string, unknown> | undefined;
      const items = (raw?.items as Record<string, unknown>[]) || [];
      const pagination = raw?.pagination as { page: number; total: number; totalPages: number } | undefined;

      const mapped = (items as unknown as DealCardData[]).map((d) => ({
        id: d.id,
        title: d.title,
        titleEn: d.titleEn,
        status: d.status,
        product: d.product || { id: '', name: '', sku: '', basePrice: 0 },
        originalPriceFormatted: d.originalPriceFormatted || '',
        discountPriceFormatted: d.discountPriceFormatted || '',
        savingsPercent: d.savingsPercent || 0,
        progressPercent: d.progressPercent || 0,
        currentQty: d.currentQty || 0,
        targetQty: d.targetQty || 0,
        participantCount: d.participantCount || 0,
        timeRemaining: d.timeRemaining || '',
        expiresAt: d.expiresAt,
        ward: d.ward,
      }));

      if (reset) {
        setDeals(mapped);
      } else {
        setDeals((prev) => [...prev, ...mapped]);
      }

      setHasMore(pagination ? pageNum < pagination.totalPages : mapped.length >= 20);
    } catch {
      setError(t('Không thể tải deal mua chung', 'Failed to load group deals'));
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [t]);

  // Initial load + tab/search changes
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchDeals(1, activeTab, search, true);
  }, [activeTab, search, fetchDeals]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchDeals(nextPage, activeTab, search, false);
        }
      },
      { threshold: 0.5 }
    );

    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, page, activeTab, search, fetchDeals]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Pull to refresh
  const handlePullEnd = useCallback(() => {
    if (pullDistance > 80) {
      setIsRefreshing(true);
      setPage(1);
      setHasMore(true);
      fetchDeals(1, activeTab, search, true);
    }
    setPullDistance(0);
  }, [pullDistance, activeTab, search, fetchDeals]);

  const handleDealClick = (id: string) => {
    router.push(`/m/group-buy/${id}`);
  };

  // Skeleton loading
  const skeletons = Array.from({ length: 3 }, (_, i) => i);

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Mua chung', 'Group Buy')} showBack showNotifications={false} />

      <main className="pb-4">
        {/* Pull to refresh */}
        <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} threshold={80} />

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('Tìm deal mua chung...', 'Search group deals...')}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full h-10 pl-9 pr-4 text-sm rounded-xl border bg-muted/30 outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Status tabs */}
        <div className="px-4 mb-4">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? 'bg-red-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {locale === 'vi' ? tab.vi : tab.en}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 space-y-3">
          {loading && deals.length === 0 ? (
            skeletons.map((i) => (
              <div key={i} className="animate-pulse rounded-xl border p-4">
                <div className="flex justify-between mb-3">
                  <div className="h-5 w-16 rounded-full bg-muted" />
                  <div className="h-5 w-16 rounded bg-muted" />
                </div>
                <div className="h-4 w-3/4 bg-muted rounded mb-2" />
                <div className="h-3 w-1/2 bg-muted rounded mb-3" />
                <div className="flex gap-3 mb-3">
                  <div className="h-6 w-20 bg-muted rounded" />
                  <div className="h-6 w-16 bg-muted rounded" />
                </div>
                <div className="h-2 bg-muted rounded-full mb-2" />
                <div className="h-3 w-2/3 bg-muted rounded" />
              </div>
            ))
          ) : error ? (
            <div className="text-center py-12">
              <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={() => { setPage(1); setHasMore(true); fetchDeals(1, activeTab, search, true); }}
                className="mt-3 px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground"
              >
                {t('Thử lại', 'Retry')}
              </button>
            </div>
          ) : deals.length === 0 ? (
            <div className="text-center py-12">
              <TrendingDown className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium">{t('Không có deal nào', 'No deals found')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search
                  ? t('Thử tìm từ khoá khác', 'Try a different search term')
                  : t('Chưa có deal mua chung nào', 'No group buy deals available yet')
                }
              </p>
            </div>
          ) : (
            <>
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} onClick={handleDealClick} />
              ))}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-1" />

              {/* Loading more indicator */}
              {loading && deals.length > 0 && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* End of list */}
              {!hasMore && deals.length > 0 && (
                <p className="text-center text-[10px] text-muted-foreground py-4">
                  {t('Đã hiển thị tất cả', 'All deals shown')}
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
