'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { ProductCard, type ProductCardData } from '@/components/mobile/product-card';
import { CategoryChips, type CategoryChipData } from '@/components/mobile/category-chips';
import { ProductDetailSheet, type ProductDetailData } from '@/components/mobile/product-detail-sheet';
import { useAppStore } from '@/stores/app.store';
import { useCartStore } from '@/stores/cart.store';
import { api } from '@/lib/mobile/api';
import { Search, SlidersHorizontal, ChevronDown, X, Package, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface ProductListData extends ProductCardData {
  description?: string | null;
  descriptionEn?: string | null;
  unitEn?: string | null;
  categoryId: string;
  weightKg?: number | null;
  barcode?: string | null;
  manufacturer?: { id: string; name: string } | null;
  distributor?: { id: string; name: string } | null;
  isPrivateLabel: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductFilters {
  search: string;
  categoryId: string | null;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  brand: string | null;
  page: number;
  limit: number;
}

// ============================================
// Sort options
// ============================================

const SORT_OPTIONS: { value: string; order: 'asc' | 'desc'; vi: string; en: string }[] = [
  { value: 'createdAt', order: 'desc', vi: 'Mới nhất', en: 'Newest' },
  { value: 'name', order: 'asc', vi: 'A → Z', en: 'A → Z' },
  { value: 'basePrice', order: 'asc', vi: 'Giá tăng', en: 'Price Low' },
  { value: 'basePrice', order: 'desc', vi: 'Giá giảm', en: 'Price High' },
  { value: 'stockQuantity', order: 'desc', vi: 'Nhiều hàng', en: 'Most Stock' },
];

// ============================================
// Skeleton grid component (static, outside render)
// ============================================

function ProductSkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card overflow-hidden">
          <Skeleton className="aspect-square" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Product Catalog Page
// ============================================

export default function MobileProductsPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  // State
  const [products, setProducts] = useState<ProductListData[]>([]);
  const [categories, setCategories] = useState<CategoryChipData[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [filters, setFilters] = useState<ProductFilters>({
    search: '',
    categoryId: null,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    brand: null,
    page: 1,
    limit: 20,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showBrandFilter, setShowBrandFilter] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ProductDetailData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addedToast, setAddedToast] = useState<string | null>(null);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // ---- Fetch categories ----
  useEffect(() => {
    async function fetchCategories() {
      const res = await api.get<{ items: CategoryChipData[] }>('/categories');
      if (res.success && res.data) {
        const active = (res.data.items || []).filter(
          (c) => c.productCount === undefined || c.productCount > 0
        );
        setCategories(active);
      }
    }
    fetchCategories();
  }, []);

  // ---- Fetch products ----
  const fetchProducts = useCallback(
    async (isLoadMore = false) => {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params: Record<string, string | number | undefined> = {
        page: filters.page,
        limit: filters.limit,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        isActive: 'true',
      };
      if (filters.search) params.search = filters.search;
      if (filters.categoryId) params.categoryId = filters.categoryId;
      if (filters.brand) params.brand = filters.brand;

      const res = await api.get<{
        items: ProductListData[];
        pagination: { total: number; totalPages: number };
        filters: { categories: { categoryId: string; count: number }[]; brands: string[] };
      }>('/products', params);

      if (res.success && res.data) {
        const newItems = res.data.items || [];
        if (isLoadMore) {
          setProducts((prev) => [...prev, ...newItems]);
        } else {
          setProducts(newItems);
        }
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotal(res.data.pagination?.total || 0);

        // Extract brands from first page
        if (!isLoadMore && res.data.filters?.brands) {
          setBrands(res.data.filters.brands.filter(Boolean));
        }
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [filters]
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await fetchProducts();
      if (!cancelled) {
        void result;
      }
    };
    load();
    return () => { cancelled = true; };
  }, [fetchProducts]);

  // ---- Infinite scroll ----
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && filters.page < totalPages) {
          setFilters((prev) => ({ ...prev, page: prev.page + 1 }));
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [loading, loadingMore, filters.page, totalPages]);

  // ---- Debounced search ----
  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: value, page: 1 }));
    }, 400);
  };

  const clearSearch = () => {
    setSearchInput('');
    setFilters((prev) => ({ ...prev, search: '', page: 1 }));
  };

  // ---- Category filter ----
  const handleCategorySelect = (categoryId: string | null) => {
    setFilters((prev) => ({ ...prev, categoryId, page: 1 }));
  };

  // ---- Sort ----
  const handleSort = (value: string, order: 'asc' | 'desc') => {
    setFilters((prev) => ({ ...prev, sortBy: value, sortOrder: order, page: 1 }));
    setShowSort(false);
  };

  // ---- Brand filter ----
  const handleBrandSelect = (brand: string | null) => {
    setFilters((prev) => ({ ...prev, brand, page: 1 }));
    setShowBrandFilter(false);
  };

  // ---- Product detail ----
  const handleProductTap = (product: ProductCardData) => {
    setDetailProduct(product as ProductDetailData);
    setDetailOpen(true);
  };

  const handleAddToCartToast = (product: ProductCardData) => {
    const name = locale === 'en' && product.nameEn ? product.nameEn : product.name;
    setAddedToast(name);
    setTimeout(() => setAddedToast(null), 2000);
  };

  // ---- Current sort label ----
  const currentSort = SORT_OPTIONS.find(
    (s) => s.value === filters.sortBy && s.order === filters.sortOrder
  );

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Sản phẩm', 'Products')}
        showSearch={false}
        showNotifications={false}
      />

      <main className="px-4 pb-24 pt-2">
        {/* Search bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder={t('Tìm tên, SKU, barcode...', 'Search name, SKU, barcode...')}
            className={cn('pl-10 h-10 pr-10', searchFocused && 'ring-2 ring-primary/20')}
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filter bar: sort + brand filter */}
        <div className="flex gap-2 mb-3">
          {/* Sort button */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs rounded-full"
              onClick={() => setShowSort(!showSort)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {currentSort
                ? locale === 'vi'
                  ? currentSort.vi
                  : currentSort.en
                : t('Sắp xếp', 'Sort')}
              <ChevronDown className="h-3 w-3" />
            </Button>
            {showSort && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-xl shadow-lg py-1 min-w-[160px] animate-in fade-in slide-in-from-top-1 duration-150">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={`${opt.value}-${opt.order}`}
                    onClick={() => handleSort(opt.value, opt.order)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors',
                      filters.sortBy === opt.value && filters.sortOrder === opt.order
                        ? 'text-primary font-medium bg-primary/5'
                        : ''
                    )}
                  >
                    {locale === 'vi' ? opt.vi : opt.en}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Brand filter */}
          {brands.length > 0 && (
            <div className="relative">
              <Button
                variant={filters.brand ? 'default' : 'outline'}
                size="sm"
                className="h-8 gap-1.5 text-xs rounded-full"
                onClick={() => setShowBrandFilter(!showBrandFilter)}
              >
                {t('Thương hiệu', 'Brand')}
                {filters.brand && (
                  <span className="ml-0.5">
                    ({filters.brand})
                    <X className="h-3 w-3 ml-0.5" />
                  </span>
                )}
                <ChevronDown className="h-3 w-3" />
              </Button>
              {showBrandFilter && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-xl shadow-lg py-1 min-w-[160px] max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                  <button
                    onClick={() => handleBrandSelect(null)}
                    className={cn(
                      'w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors',
                      !filters.brand && 'text-primary font-medium bg-primary/5'
                    )}
                  >
                    {t('Tất cả', 'All Brands')}
                  </button>
                  {brands.map((b) => (
                    <button
                      key={b}
                      onClick={() => handleBrandSelect(b)}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors',
                        filters.brand === b && 'text-primary font-medium bg-primary/5'
                      )}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Results count */}
          <div className="ml-auto flex items-center text-xs text-muted-foreground self-center">
            {loading ? '' : `${total} ${t('sản phẩm', 'products')}`}
          </div>
        </div>

        {/* Category chips */}
        {categories.length > 0 && (
          <div className="mb-3">
            <CategoryChips
              categories={categories}
              selectedId={filters.categoryId}
              onSelect={handleCategorySelect}
            />
          </div>
        )}

        {/* Close dropdowns when clicking outside */}
        {(showSort || showBrandFilter) && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowSort(false);
              setShowBrandFilter(false);
            }}
          />
        )}

        {/* Product grid */}
        {loading ? (
          <ProductSkeletonGrid />
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-base font-semibold mb-1">
              {filters.search
                ? t('Không tìm thấy sản phẩm', 'No products found')
                : t('Chưa có sản phẩm', 'No products yet')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {filters.search
                ? t('Thử tìm từ khóa khác', 'Try a different search term')
                : t('Sản phẩm sẽ sớm được cập nhật', 'Products will be updated soon')}
            </p>
            {filters.search && (
              <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={clearSearch}>
                {t('Xóa bộ lọc', 'Clear filters')}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onTap={handleProductTap}
                  onAddToCart={handleAddToCartToast}
                />
              ))}
            </div>

            {/* Infinite scroll trigger */}
            {filters.page < totalPages && (
              <div ref={loadMoreRef} className="flex justify-center py-6">
                {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
              </div>
            )}

            {/* End of list */}
            {filters.page >= totalPages && products.length > 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">
                {t('Đã hiển thị tất cả sản phẩm', 'All products displayed')}
              </p>
            )}
          </>
        )}
      </main>

      {/* Product detail bottom sheet */}
      <ProductDetailSheet
        key={detailProduct?.id}
        product={detailProduct}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onAddedToCart={() => {
          if (detailProduct) handleAddToCartToast(detailProduct);
        }}
      />

      {/* Added to cart toast */}
      {addedToast && (
        <div className="fixed top-4 left-4 right-4 z-[70] bg-red-600 text-white rounded-xl px-4 py-3 shadow-lg text-sm font-medium text-center animate-in slide-in-from-top-2 duration-300">
          + {addedToast}
        </div>
      )}
    </div>
  );
}
