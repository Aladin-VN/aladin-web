'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { PromoCard, type PromoCardData } from '@/components/mobile/promo-card';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { Search, Loader2, Gift, Factory } from 'lucide-react';

// ============================================
// Promotions List Page — /m/promotions
// ============================================

const STATUS_TABS = [
  { key: 'active', vi: 'Hoạt động', en: 'Active' },
  { key: 'upcoming', vi: 'Sắp diễn ra', en: 'Upcoming' },
  { key: 'expired', vi: 'Hết hạn', en: 'Expired' },
  { key: '', vi: 'Tất cả', en: 'All' },
] as const;

export default function MobilePromotionsPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const router = useRouter();

  const [promos, setPromos] = useState<PromoCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchPromos = useCallback(async (pageNum: number, status: string, searchQuery: string, reset: boolean) => {
    try {
      if (pageNum === 1) setLoading(true);
      setError(null);

      const params: Record<string, string | number> = { page: pageNum, limit: 20 };
      if (status) params.status = status;
      if (searchQuery) params.search = searchQuery;

      const res = await api.get('/promotions', params);
      const raw = res.data as Record<string, unknown> | undefined;
      const items = (raw?.items as Record<string, unknown>[]) || [];
      const pagination = raw?.pagination as { page: number; total: number; totalPages: number } | undefined;

      const mapped = (items as unknown as PromoCardData[]).map((p) => ({
        id: p.id,
        title: p.title,
        titleEn: p.titleEn,
        promoType: p.promoType,
        buyQty: p.buyQty,
        getQty: p.getQty,
        discountPercent: p.discountPercent,
        discountAmount: p.discountAmount,
        manufacturerName: ((p as unknown) as Record<string, unknown>).manufacturerName as string || '',
        computedStatus: p.computedStatus || 'expired',
        isActive: p.isActive,
        startsAt: p.startsAt,
        expiresAt: p.expiresAt,
        totalRedemptions: p.totalRedemptions || 0,
        budgetPercent: p.budgetPercent || 0,
        productCount: p.productCount || 0,
      }));

      if (reset) {
        setPromos(mapped);
      } else {
        setPromos((prev) => [...prev, ...mapped]);
      }

      setHasMore(pagination ? pageNum < pagination.totalPages : mapped.length >= 20);
    } catch {
      setError(t('Không thể tải khuyến mãi', 'Failed to load promotions'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchPromos(1, activeTab, search, true);
  }, [activeTab, search, fetchPromos]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchPromos(nextPage, activeTab, search, false);
        }
      },
      { threshold: 0.5 }
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, page, activeTab, search, fetchPromos]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handlePromoClick = (id: string) => {
    router.push(`/m/promotions/${id}`);
  };

  const skeletons = Array.from({ length: 3 }, (_, i) => i);

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Khuyến mãi', 'Promotions')} showBack showNotifications={false} />

      <main className="pb-4">
        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('Tìm khuyến mãi...', 'Search promotions...')}
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
                    ? 'bg-emerald-600 text-white'
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
          {loading && promos.length === 0 ? (
            skeletons.map((i) => (
              <div key={i} className="animate-pulse rounded-xl border p-4">
                <div className="flex justify-between mb-3">
                  <div className="h-5 w-16 rounded-full bg-muted" />
                  <div className="h-5 w-20 rounded-full bg-muted" />
                </div>
                <div className="h-4 w-3/4 bg-muted rounded mb-2" />
                <div className="h-3 w-1/2 bg-muted rounded mb-3" />
                <div className="h-1.5 bg-muted rounded-full" />
              </div>
            ))
          ) : error ? (
            <div className="text-center py-12">
              <Gift className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={() => { setPage(1); setHasMore(true); fetchPromos(1, activeTab, search, true); }}
                className="mt-3 px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground"
              >
                {t('Thử lại', 'Retry')}
              </button>
            </div>
          ) : promos.length === 0 ? (
            <div className="text-center py-12">
              <Gift className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium">{t('Không có khuyến mãi', 'No promotions found')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search
                  ? t('Thử tìm từ khoá khác', 'Try a different search term')
                  : t('Chưa có chương trình khuyến mãi', 'No promotions available yet')
                }
              </p>
            </div>
          ) : (
            <>
              {promos.map((promo) => (
                <PromoCard key={promo.id} promo={promo} onClick={handlePromoClick} />
              ))}
              <div ref={sentinelRef} className="h-1" />
              {loading && promos.length > 0 && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!hasMore && promos.length > 0 && (
                <p className="text-center text-[10px] text-muted-foreground py-4">
                  {t('Đã hiển thị tất cả', 'All promotions shown')}
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
