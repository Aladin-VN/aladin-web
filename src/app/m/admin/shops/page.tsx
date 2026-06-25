'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Search,
  Store,
  Phone,
  MapPin,
  ShoppingBag,
  CreditCard,
  Star,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  X,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface ShopItem {
  id: string;
  name: string;
  nameEn?: string | null;
  district?: string | null;
  province: string;
  address?: string | null;
  shopType: string;
  loyaltyTier: string;
  creditStatus: string;
  creditLimit: number;
  creditBalance: number;
  creditLimitFormatted: string;
  creditBalanceFormatted: string;
  creditAvailable: number;
  creditAvailableFormatted: string;
  totalOrders: number;
  totalGmv: number;
  totalGmvFormatted: string;
  avgOrderValue: number;
  avgOrderValueFormatted: string;
  createdAt: string;
  user: {
    id: string;
    phone: string;
    name: string;
    status: string;
    zaloId?: string | null;
  };
}

interface ShopsResponse {
  items: ShopItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ============================================
// Loyalty Tier Config
// ============================================

const LOYALTY_COLORS: Record<string, string> = {
  BRONZE: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  SILVER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  GOLD: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  PLATINUM: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

const LOYALTY_LABELS: Record<string, { vi: string; en: string }> = {
  BRONZE: { vi: 'Đồng', en: 'Bronze' },
  SILVER: { vi: 'Bạc', en: 'Silver' },
  GOLD: { vi: 'Vàng', en: 'Gold' },
  PLATINUM: { vi: 'Bạch kim', en: 'Platinum' },
};

const CREDIT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  LOCKED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  OVERDUE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

// ============================================
// Helpers
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

// ============================================
// Main Page
// ============================================

export default function AdminShopsPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [shops, setShops] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [showDistrictFilter, setShowDistrictFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // KPI
  const [activeCount, setActiveCount] = useState(0);
  const [newThisMonth, setNewThisMonth] = useState(0);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ---- Fetch shops ----
  const fetchShops = useCallback(async (
    pageNum: number,
    search: string,
    district: string,
    isLoadMore = false
  ) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);
    setError(null);

    const params: Record<string, string | number | undefined> = {
      page: pageNum,
      limit: 50,
      sortBy: 'totalGmv',
      sortOrder: 'desc',
    };
    if (search) params.search = search;
    if (district) params.district = district;

    const res = await api.get<ShopsResponse>('/shops', params);
    if (res.success && res.data) {
      const items = res.data.items || [];

      // Extract unique districts from response
      if (!isLoadMore && pageNum === 1) {
        const uniqueDistricts = Array.from(
          new Set(items.map((s) => s.district).filter(Boolean) as string[])
        ).sort();
        setDistricts(uniqueDistricts);

        // Compute KPIs from items (first page is a good sample)
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        setActiveCount(items.filter((s) => s.user.status === 'ACTIVE').length);
        setNewThisMonth(items.filter((s) => s.createdAt >= monthStart).length);
      }

      if (isLoadMore) {
        setShops((prev) => [...prev, ...items]);
      } else {
        setShops(items);
      }
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotal(res.data.pagination?.total || 0);
    } else {
      if (!isLoadMore) {
        setError(res.error?.message || t('Lỗi tải danh sách', 'Failed to load shops'));
      }
    }

    setLoading(false);
    setLoadingMore(false);
  }, [t]);

  // ---- Initial load ----
  useEffect(() => {
    fetchShops(1, '', '');
  }, [fetchShops]);

  // ---- Debounced search ----
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      fetchShops(1, value, selectedDistrict);
    }, 400);
  };

  // ---- District filter change ----
  const handleDistrictChange = (district: string) => {
    setSelectedDistrict(district);
    setShowDistrictFilter(false);
    setPage(1);
    fetchShops(1, searchInput, district);
  };

  // ---- Infinite scroll ----
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && page < totalPages) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchShops(nextPage, searchInput, selectedDistrict, true);
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [loading, loadingMore, page, totalPages, fetchShops, searchInput, selectedDistrict]);

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Quản lý cửa hàng', 'Shop Management')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-24 pt-2">
        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-destructive/60" />
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <Button variant="outline" size="sm" onClick={() => fetchShops(1, searchInput, selectedDistrict)}>
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
                <p className="text-[10px] text-muted-foreground">{t('Tổng cửa hàng', 'Total Shops')}</p>
                <p className="text-base font-bold">{total}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground">{t('Hoạt động', 'Active')}</p>
                <p className="text-base font-bold text-green-600">{activeCount}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground">{t('Tháng này', 'This Month')}</p>
                <p className="text-base font-bold text-blue-600">{newThisMonth}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('Tìm tên, SĐT cửa hàng...', 'Search name, phone...')}
              className="pl-10 h-10"
            />
          </div>

          {/* District filter */}
          <div className="relative">
            <Button
              variant="outline"
              className={cn('h-10 gap-1.5', selectedDistrict && 'border-primary text-primary')}
              onClick={() => setShowDistrictFilter(!showDistrictFilter)}
            >
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">
                {selectedDistrict || t('Khu vực', 'District')}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>

            {showDistrictFilter && (
              <div className="absolute right-0 top-11 z-50 bg-popover border rounded-lg shadow-lg min-w-48 max-h-60 overflow-y-auto">
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                  onClick={() => handleDistrictChange('')}
                >
                  {t('Tất cả khu vực', 'All Districts')}
                </button>
                {districts.map((d) => (
                  <button
                    key={d}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors',
                      selectedDistrict === d && 'bg-primary/10 text-primary font-medium'
                    )}
                    onClick={() => handleDistrictChange(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active filters */}
        {selectedDistrict && (
          <div className="flex items-center gap-1.5 mb-3">
            <Badge variant="secondary" className="text-[11px] gap-1">
              {selectedDistrict}
              <X className="h-3 w-3 cursor-pointer" onClick={() => handleDistrictChange('')} />
            </Badge>
          </div>
        )}

        {/* Results count */}
        {!loading && !error && (
          <p className="text-xs text-muted-foreground mb-3">
            {total} {t('cửa hàng', 'shops')}
          </p>
        )}

        {/* Loading */}
        {loading && <ShopsSkeleton />}

        {/* Shop Cards */}
        {!loading && !error && shops.length === 0 && (
          <div className="text-center py-16">
            <Store className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-base font-semibold mb-1">{t('Không tìm thấy cửa hàng', 'No shops found')}</h3>
            <p className="text-sm text-muted-foreground">
              {searchInput || selectedDistrict
                ? t('Thử thay đổi bộ lọc', 'Try different filters')
                : t('Chưa có cửa hàng nào', 'No shops yet')}
            </p>
          </div>
        )}

        {!loading && !error && shops.length > 0 && (
          <div className="space-y-3">
            {shops.map((shop) => (
              <Card key={shop.id} className="border-border/50">
                <CardContent className="p-3">
                  {/* Header: Name + tier + credit status */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold truncate">
                          {locale === 'en' && shop.nameEn ? shop.nameEn : shop.name}
                        </p>
                        <Badge
                          className={cn('text-[9px] px-1.5 py-0 h-4.5 font-medium', LOYALTY_COLORS[shop.loyaltyTier])}
                        >
                          <Star className="h-2.5 w-2.5 mr-0.5" />
                          {locale === 'vi'
                            ? LOYALTY_LABELS[shop.loyaltyTier]?.vi || shop.loyaltyTier
                            : LOYALTY_LABELS[shop.loyaltyTier]?.en || shop.loyaltyTier}
                        </Badge>
                      </div>
                    </div>
                    <Badge
                      className={cn('text-[9px] px-1.5 py-0 h-4.5 shrink-0', CREDIT_STATUS_COLORS[shop.creditStatus])}
                    >
                      {shop.creditStatus === 'ACTIVE'
                        ? t('Bình thường', 'Active')
                        : shop.creditStatus === 'LOCKED'
                        ? t('Khóa', 'Locked')
                        : t('Quá hạn', 'Overdue')}
                    </Badge>
                  </div>

                  {/* Phone + District */}
                  <div className="flex items-center gap-3 mb-2.5">
                    <a
                      href={`tel:${shop.user.phone}`}
                      className="flex items-center gap-1 text-xs text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="h-3 w-3" />
                      <span>{shop.user.phone}</span>
                    </a>
                    {shop.district && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{shop.district}</span>
                      </span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                    <div>
                      <p className="text-[10px] text-muted-foreground">{t('GMV', 'GMV')}</p>
                      <p className="text-xs font-bold">{shop.totalGmvFormatted}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">{t('Đơn hàng', 'Orders')}</p>
                      <p className="text-xs font-semibold">{shop.totalOrders}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">{t('Công nợ', 'Credit')}</p>
                      <p className={cn(
                        'text-xs font-semibold',
                        shop.creditBalance > 0 ? 'text-orange-600' : 'text-muted-foreground'
                      )}>
                        {shop.creditBalanceFormatted}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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

// ============================================
// Skeleton
// ============================================

function ShopsSkeleton() {
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
      {/* Shop cards */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4.5 w-14 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-20" />
          </div>
          <div className="pt-2 border-t grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="space-y-1">
                <Skeleton className="h-2.5 w-10" />
                <Skeleton className="h-3.5 w-16" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}