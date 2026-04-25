'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { AuditCard, type AuditCardData } from '@/components/mobile/audit-card';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { Search, Loader2, Camera, ClipboardCheck } from 'lucide-react';

// ============================================
// Merchandising Audit List Page — /m/merchandising
// ============================================

const STATUS_TABS = [
  { key: '', vi: 'Tất cả', en: 'All' },
  { key: 'PENDING_REVIEW', vi: 'Chờ duyệt', en: 'Pending' },
  { key: 'APPROVED', vi: 'Đã duyệt', en: 'Approved' },
  { key: 'REJECTED', vi: 'Từ chối', en: 'Rejected' },
] as const;

export default function MobileMerchandisingPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const router = useRouter();

  const [audits, setAudits] = useState<AuditCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const fetchAudits = useCallback(async (pageNum: number, status: string, searchQuery: string, reset: boolean) => {
    try {
      if (pageNum === 1) setLoading(true);
      setError(null);

      const params: Record<string, string | number> = { page: pageNum, limit: 20 };
      if (status) params.status = status;
      if (searchQuery) params.search = searchQuery;

      const res = await api.get('/merchandising', params);
      const raw = res.data as Record<string, unknown> | undefined;
      const items = (raw?.items as Record<string, unknown>[]) || [];
      const pagination = raw?.pagination as { page: number; total: number; totalPages: number } | undefined;

      const mapped = (items as unknown as AuditCardData[]).map((a) => ({
        id: a.id,
        photoUrl: a.photoUrl,
        status: a.status,
        reviewNotes: a.reviewNotes,
        createdAt: a.createdAt,
        shop: a.shop || { id: '', name: '', district: null, shopType: '' },
        product: a.product || { id: '', name: '', sku: '', imageUrl: null },
        promotion: a.promotion,
      }));

      if (reset) {
        setAudits(mapped);
      } else {
        setAudits((prev) => [...prev, ...mapped]);
      }

      setHasMore(pagination ? pageNum < pagination.totalPages : mapped.length >= 20);
    } catch {
      setError(t('Không thể tải danh sách', 'Failed to load audits'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchAudits(1, activeTab, search, true);
  }, [activeTab, search, fetchAudits]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchAudits(nextPage, activeTab, search, false);
        }
      },
      { threshold: 0.5 }
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, page, activeTab, search, fetchAudits]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleAuditClick = (id: string) => {
    // Navigate to detail view (future enhancement, for now just log)
    // For now we can show a toast or expand inline
  };

  const skeletons = Array.from({ length: 3 }, (_, i) => i);

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Trung bay', 'Merchandising')}
        showBack={false}
        showNotifications={false}
        rightAction={
          <button
            onClick={() => router.push('/m/merchandising/submit')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-medium"
          >
            <Camera className="h-3.5 w-3.5" />
            {t('Gửi ảnh', 'Submit')}
          </button>
        }
      />

      <main className="pb-4">
        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t('Tìm kiểm tra trung bay...', 'Search audits...')}
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
          {loading && audits.length === 0 ? (
            skeletons.map((i) => (
              <div key={i} className="animate-pulse rounded-xl border overflow-hidden">
                <div className="flex">
                  <div className="w-24 h-24 bg-muted" />
                  <div className="flex-1 p-3 space-y-2">
                    <div className="flex justify-between">
                      <div className="h-5 w-14 rounded-full bg-muted" />
                      <div className="h-5 w-12 rounded bg-muted" />
                    </div>
                    <div className="h-3 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-1/2 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))
          ) : error ? (
            <div className="text-center py-12">
              <ClipboardCheck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <button
                onClick={() => { setPage(1); setHasMore(true); fetchAudits(1, activeTab, search, true); }}
                className="mt-3 px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground"
              >
                {t('Thử lại', 'Retry')}
              </button>
            </div>
          ) : audits.length === 0 ? (
            <div className="text-center py-12">
              <Camera className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium">{t('Chưa có kiểm tra', 'No audits yet')}</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                {t('Chụp ảnh kệ hàng để kiểm tra trung bay', 'Take shelf photos for merchandising audit')}
              </p>
              <button
                onClick={() => router.push('/m/merchandising/submit')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium"
              >
                <Camera className="h-3.5 w-3.5" />
                {t('Gửi ảnh đầu tiên', 'Submit First Photo')}
              </button>
            </div>
          ) : (
            <>
              {audits.map((audit) => (
                <AuditCard key={audit.id} audit={audit} onClick={handleAuditClick} />
              ))}
              <div ref={sentinelRef} className="h-1" />
              {loading && audits.length > 0 && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!hasMore && audits.length > 0 && (
                <p className="text-center text-[10px] text-muted-foreground py-4">
                  {t('Đã hiển thị tất cả', 'All audits shown')}
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
