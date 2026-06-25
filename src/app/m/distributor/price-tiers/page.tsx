'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAppStore } from '@/stores/app.store';
import { MobileHeader } from '@/components/mobile/mobile-header';
import {
  Plus, ChevronDown, ChevronUp, X, Search, Info, Package,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

// ============================================
// Types
// ============================================

interface TierProduct {
  id: string;
  name: string;
  price: number;
}

interface PriceTier {
  id: string;
  name: string;
  nameEn: string;
  type: 'LOYALTY_BASED' | 'VOLUME_BASED' | 'CUSTOM';
  discountPct: number;
  minOrderValue: number;
  productCount: number;
  active: boolean;
  products?: TierProduct[];
}

// ============================================
// Helpers
// ============================================

const t = (vi: string, en: string, locale: string) => (locale === 'vi' ? vi : en);

const typeBadge: Record<string, string> = {
  LOYALTY_BASED: 'bg-blue-100 text-blue-800',
  VOLUME_BASED: 'bg-green-100 text-green-800',
  CUSTOM: 'bg-purple-100 text-purple-800',
};

const typeLabelVi: Record<string, string> = {
  LOYALTY_BASED: 'Theo loyalty',
  VOLUME_BASED: 'Theo số lượng',
  CUSTOM: 'Tùy chỉnh',
};

const typeLabelEn: Record<string, string> = {
  LOYALTY_BASED: 'Loyalty Based',
  VOLUME_BASED: 'Volume Based',
  CUSTOM: 'Custom',
};

const tierTypes = ['LOYALTY_BASED', 'VOLUME_BASED', 'CUSTOM'] as const;

// ============================================
// Component
// ============================================

export default function PriceTiersPage() {
  const locale = useAppStore((s) => s.locale);
  const router = useRouter();
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Add tier dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    nameEn: '',
    type: 'LOYALTY_BASED' as PriceTier['type'],
    discountPct: '',
    minOrderValue: '',
  });
  const [addLoading, setAddLoading] = useState(false);

  // Product search in add dialog
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<TierProduct[]>([]);
  const [addedProducts, setAddedProducts] = useState<{ productId: string; customPrice: string }[]>([]);

  const fetchTiers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/distributor/price-tiers');
      if (res.success) {
        setTiers(res.data?.items || res.data || []);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTiers(); }, [fetchTiers]);

  const handleSearchProducts = useCallback(async (query: string) => {
    setProductSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await adminFetch(`/api/distributor/price-tiers/search-products?q=${encodeURIComponent(query)}`);
      if (res.success) {
        setSearchResults(res.data || []);
      }
    } catch {
      // silent
    }
  }, []);

  const handleAddTier = async () => {
    if (!addForm.name || !addForm.discountPct) return;
    setAddLoading(true);
    try {
      await adminFetch('/api/distributor/price-tiers', {
        method: 'POST',
        body: JSON.stringify({
          ...addForm,
          discountPct: parseFloat(addForm.discountPct),
          minOrderValue: addForm.minOrderValue ? parseInt(addForm.minOrderValue) : 0,
          products: addedProducts.map((p) => ({
            productId: p.productId,
            customPrice: p.customPrice ? parseFloat(p.customPrice) : undefined,
          })),
        }),
      });
      setAddOpen(false);
      setAddForm({ name: '', nameEn: '', type: 'LOYALTY_BASED', discountPct: '', minOrderValue: '' });
      setAddedProducts([]);
      fetchTiers();
    } catch {
      // silent
    }
    setAddLoading(false);
  };

  const addProductToList = (product: TierProduct) => {
    if (addedProducts.find((p) => p.productId === product.id)) return;
    setAddedProducts([...addedProducts, { productId: product.id, customPrice: '' }]);
    setSearchResults([]);
    setProductSearch('');
  };

  const removeProductFromList = (productId: string) => {
    setAddedProducts(addedProducts.filter((p) => p.productId !== productId));
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Bảng giá', 'Price Tiers', locale)}
        rightAction={
          <Dialog open={addOpen} onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) {
              setAddedProducts([]);
              setProductSearch('');
            }
          }}>
            <DialogTrigger asChild>
              <Button size="icon" className="h-9 w-9">
                <Plus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100vw-2rem)] w-full mx-auto max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('Thêm bậc giá', 'Add Price Tier', locale)}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t('Tên (Tiếng Việt)', 'Name (Vietnamese)', locale)}
                  </label>
                  <Input
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    placeholder={t('Nhập tên...', 'Enter name...', locale)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t('Tên (English)', 'Name (English)', locale)}
                  </label>
                  <Input
                    value={addForm.nameEn}
                    onChange={(e) => setAddForm({ ...addForm, nameEn: e.target.value })}
                    placeholder="Enter name..."
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t('Loại bậc giá', 'Tier Type', locale)}
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {tierTypes.map((tp) => (
                      <Badge
                        key={tp}
                        variant={addForm.type === tp ? 'default' : 'outline'}
                        className="cursor-pointer text-xs py-1.5 px-3"
                        onClick={() => setAddForm({ ...addForm, type: tp })}
                      >
                        {locale === 'vi' ? typeLabelVi[tp] : typeLabelEn[tp]}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('Giảm giá %', 'Discount %', locale)}
                    </label>
                    <Input
                      type="number"
                      value={addForm.discountPct}
                      onChange={(e) => setAddForm({ ...addForm, discountPct: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      {t('Đơn tối thiểu', 'Min Order', locale)}
                    </label>
                    <Input
                      type="number"
                      value={addForm.minOrderValue}
                      onChange={(e) => setAddForm({ ...addForm, minOrderValue: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Product search + add */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t('Thêm sản phẩm', 'Add Products', locale)}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-10"
                      value={productSearch}
                      onChange={(e) => handleSearchProducts(e.target.value)}
                      placeholder={t('Tìm sản phẩm...', 'Search products...', locale)}
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="border rounded-lg mt-1 max-h-32 overflow-y-auto">
                      {searchResults.map((product) => (
                        <button
                          key={product.id}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-accent border-b last:border-0"
                          onClick={() => addProductToList(product)}
                        >
                          <span className="font-medium">{product.name}</span>
                          <span className="text-muted-foreground ml-2">{formatVND(product.price)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {addedProducts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {addedProducts.map((ap) => {
                        const found = searchResults.find((r) => r.id === ap.productId);
                        return (
                          <div key={ap.productId} className="flex items-center gap-2 text-xs">
                            <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate">{found?.name || ap.productId}</span>
                            <Input
                              type="number"
                              className="h-7 w-24 text-xs"
                              placeholder={t('Giá', 'Price', locale)}
                              value={ap.customPrice}
                              onChange={(e) => {
                                setAddedProducts(
                                  addedProducts.map((p) =>
                                    p.productId === ap.productId
                                      ? { ...p, customPrice: e.target.value }
                                      : p
                                  )
                                );
                              }}
                            />
                            <button onClick={() => removeProductFromList(ap.productId)}>
                              <X className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Button
                  className="w-full mt-2"
                  onClick={handleAddTier}
                  disabled={addLoading || !addForm.name || !addForm.discountPct}
                >
                  {addLoading ? '...' : t('Thêm bậc giá', 'Add Tier', locale)}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
        showNotifications={false}
      />

      <main className="px-4 pb-24 pt-2">
        {/* Tier list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : tiers.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('Chưa có bậc giá', 'No price tiers yet', locale)}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tiers.map((tier) => {
              const isExpanded = expandedId === tier.id;
              return (
                <Card key={tier.id} className="rounded-xl">
                  <CardContent className="p-4">
                    <div
                      className="flex items-start justify-between gap-2 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : tier.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-sm font-semibold">{tier.name}</p>
                          <span className="text-xs text-muted-foreground">{tier.nameEn}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge className={`text-[10px] ${typeBadge[tier.type] || ''}`}>
                            {locale === 'vi'
                              ? typeLabelVi[tier.type]
                              : typeLabelEn[tier.type]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            -{tier.discountPct}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch
                          checked={tier.active}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>
                        {t('Đơn tối thiểu', 'Min order', locale)}: {formatVND(tier.minOrderValue)}
                      </span>
                      <span>
                        {t('SP:', 'Products:', locale)} {tier.productCount}
                      </span>
                    </div>

                    {/* Expanded: product list */}
                    {isExpanded && tier.products && tier.products.length > 0 && (
                      <>
                        <Separator className="my-3" />
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground mb-1">
                            {t('Danh sách sản phẩm', 'Product List', locale)}
                          </p>
                          {tier.products.map((prod) => (
                            <div
                              key={prod.id}
                              className="flex items-center justify-between py-1 border-b border-border/50 last:border-0"
                            >
                              <span className="text-xs truncate flex-1">{prod.name}</span>
                              <span className="text-xs font-medium ml-2 shrink-0">
                                {formatVND(prod.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* GVM info section */}
        <Card className="mt-6 bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">
                  {t('Giá vốn bán (GVM)', 'Gross Merchandise Value (GVM)', locale)}
                </p>
                <p>
                  {locale === 'vi'
                    ? 'Bậc giá giúp bạn thiết lập mức giá khác nhau cho từng nhóm khách hàng dựa trên hạng loyalty, số lượng đặt hàng, hoặc tùy chỉnh thủ công.'
                    : 'Price tiers let you set different price levels for customer groups based on loyalty tier, order volume, or custom rules.'}
                </p>
                <button
                  className="text-primary font-medium"
                  onClick={() => router.push('/m/distributor/margins')}
                >
                  {t('Xem phân tích GVM →', 'View GVM Analytics →', locale)}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}