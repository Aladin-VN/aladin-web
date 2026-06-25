'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Clock,
  TrendingUp,
  Zap,
  Plus,
  Package,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
  Check,
} from 'lucide-react';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ============================================
// Types
// ============================================

interface TemplateItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitPriceFormatted: string;
}

interface RecentTemplate {
  id: string;
  type: 'RECENT_ORDER';
  name: string;
  createdAt: string;
  itemCount: number;
  totalAmount: number;
  totalAmountFormatted: string;
  items: TemplateItem[];
}

interface FrequentProduct {
  productId: string;
  productName: string;
  sku: string;
  lastPrice: number;
  lastPriceFormatted: string;
  avgQty: number;
  orderFrequency: number;
}

interface TemplatesData {
  recentTemplates: RecentTemplate[];
  frequentProducts: FrequentProduct[];
}

// ============================================
// Local VND formatter
// ============================================

function fmtVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

// ============================================
// Cart helpers
// ============================================

interface CartItem {
  productId: string;
  quantity: number;
  name: string;
  price: number;
}

function getCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem('aladin-cart') || '[]');
  } catch {
    return [];
  }
}

function saveCart(cart: CartItem[]) {
  localStorage.setItem('aladin-cart', JSON.stringify(cart));
}

// ============================================
// Sub-components
// ============================================

function EmptyTabState({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-3">
        {icon}
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// ============================================
// Page
// ============================================

export default function MobileShopTemplatesPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [data, setData] = useState<TemplatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('recent');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get<TemplatesData>('/shops/order-templates');
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(
          res.error?.message ||
            t('Không tải được mẫu đơn hàng', 'Failed to load order templates')
        );
      }
    } catch {
      setError(t('Lỗi kết nối', 'Network error'));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================
  // Cart actions
  // ============================================

  function handleReorderTemplate(template: RecentTemplate) {
    const cart = getCart();
    for (const item of template.items) {
      const idx = cart.findIndex((c) => c.productId === item.productId);
      if (idx >= 0) {
        cart[idx].quantity += item.quantity;
      } else {
        cart.push({
          productId: item.productId,
          quantity: item.quantity,
          name: item.productName,
          price: item.unitPrice,
        });
      }
    }
    saveCart(cart);
    router.push('/m/cart');
  }

  function handleOrderAll() {
    if (!data?.frequentProducts.length) return;
    const cart = getCart();
    for (const p of data.frequentProducts) {
      const idx = cart.findIndex((c) => c.productId === p.productId);
      if (idx >= 0) {
        cart[idx].quantity += p.avgQty;
      } else {
        cart.push({
          productId: p.productId,
          quantity: p.avgQty,
          name: p.productName,
          price: p.lastPrice,
        });
      }
    }
    saveCart(cart);
    router.push('/m/cart');
  }

  function handleQuickAdd(product: FrequentProduct) {
    const cart = getCart();
    const idx = cart.findIndex((c) => c.productId === product.productId);
    if (idx >= 0) {
      cart[idx].quantity += 1;
    } else {
      cart.push({
        productId: product.productId,
        quantity: 1,
        name: product.productName,
        price: product.lastPrice,
      });
    }
    saveCart(cart);
    setAddedProducts((prev) => new Set(prev).add(product.productId));
    setTimeout(() => {
      setAddedProducts((prev) => {
        const next = new Set(prev);
        next.delete(product.productId);
        return next;
      });
    }, 1500);
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  // ============================================
  // Loading skeleton
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Mẫu đặt hàng', 'Order Templates')}
          showBack
          showNotifications={false}
        />
        <main className="px-4 pt-4 pb-24 space-y-4">
          <Skeleton className="h-10 rounded-lg" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  // ============================================
  // Error state
  // ============================================

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Mẫu đặt hàng', 'Order Templates')}
          showBack
          showNotifications={false}
        />
        <main className="px-4 pt-3">
          <div className="text-center py-16">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mb-4">
              {error || t('Không có dữ liệu', 'No data')}
            </p>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {t('Thử lại', 'Retry')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const hasRecent = data.recentTemplates.length > 0;
  const hasFrequent = data.frequentProducts.length > 0;
  const hasAnyData = hasRecent || hasFrequent;

  // ============================================
  // Render
  // ============================================

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Mẫu đặt hàng', 'Order Templates')}
        showBack
        showNotifications={false}
      />

      <main className="pb-24">
        {/* Empty state — no data at all */}
        {!hasAnyData && (
          <div className="px-4 pt-3">
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Package className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold mb-1">
                {t('Chưa có mẫu đặt hàng', 'No order templates yet')}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-[260px]">
                {t(
                  'Đặt hàng ít nhất 1 lần để hệ thống tạo mẫu cho bạn',
                  'Place at least 1 order for the system to generate templates'
                )}
              </p>
              <Button
                className="rounded-full px-6"
                onClick={() => router.push('/m/products')}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {t('Đặt hàng ngay', 'Order Now')}
              </Button>
            </div>
          </div>
        )}

        {hasAnyData && (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            {/* Tab bar */}
            <div className="px-4 pt-3">
              <TabsList className="w-full grid grid-cols-3 h-10">
                <TabsTrigger value="recent" className="text-xs gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {t('Đơn gần đây', 'Recent')}
                </TabsTrigger>
                <TabsTrigger value="frequent" className="text-xs gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  {t('Hay mua', 'Frequent')}
                </TabsTrigger>
                <TabsTrigger value="quick" className="text-xs gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  {t('Đặt nhanh', 'Quick')}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ====== TAB 1: Recent Orders ====== */}
            <TabsContent value="recent" className="mt-3 px-4 space-y-3">
              {!hasRecent ? (
                <EmptyTabState
                  icon={<Clock className="h-10 w-10 text-muted-foreground/40" />}
                  message={t(
                    'Chưa có đơn hàng gần đây',
                    'No recent orders'
                  )}
                />
              ) : (
                data.recentTemplates.map((template) => {
                  const isExpanded = expandedId === template.id;
                  return (
                    <Card key={template.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {template.name}
                            </p>
                            <div className="flex items-center gap-3 mt-1.5">
                              <Badge variant="secondary" className="text-[10px]">
                                {template.itemCount} {t('sản phẩm', 'items')}
                              </Badge>
                              <span className="text-xs font-medium text-primary">
                                {template.totalAmountFormatted}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              className="rounded-full"
                              onClick={() => handleReorderTemplate(template)}
                            >
                              <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                              {t('Đặt lại', 'Reorder')}
                            </Button>
                          </div>
                        </div>

                        {/* Expand toggle */}
                        {template.items.length > 0 && (
                          <button
                            className="flex items-center gap-1 mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                            onClick={() => toggleExpand(template.id)}
                          >
                            <span>
                              {isExpanded
                                ? t('Thu gọn', 'Collapse')
                                : t('Xem chi tiết', 'View details')}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}

                        {/* Expanded item list */}
                        {isExpanded && template.items.length > 0 && (
                          <div className="mt-2 pt-2 border-t space-y-2">
                            {template.items.map((item) => (
                              <div
                                key={item.productId}
                                className="flex items-center justify-between text-xs"
                              >
                                <div className="flex-1 min-w-0 mr-2">
                                  <p className="font-medium truncate">
                                    {item.productName}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    SKU: {item.sku}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-medium">
                                    {item.unitPriceFormatted}
                                  </p>
                                  <p className="text-muted-foreground">
                                    x{item.quantity}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            {/* ====== TAB 2: Frequent Items ====== */}
            <TabsContent value="frequent" className="mt-3 px-4">
              {!hasFrequent ? (
                <EmptyTabState
                  icon={
                    <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
                  }
                  message={t(
                    'Cần đặt hàng từ 2 lần trở lên để tạo danh sách hay mua',
                    'Order at least 2 times to build a frequent-buy list'
                  )}
                />
              ) : (
                <Card className="overflow-hidden">
                  <CardContent className="p-4">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">
                          {t('Sản phẩm hay mua', 'Frequently Ordered')}
                        </p>
                        <Badge variant="secondary" className="text-[10px]">
                          {data.frequentProducts.length}{' '}
                          {t('sản phẩm', 'items')}
                        </Badge>
                      </div>
                    </div>

                    <Separator className="mb-3" />

                    {/* Product list */}
                    <div className="space-y-3">
                      {data.frequentProducts.map((product) => (
                        <div
                          key={product.productId}
                          className="flex items-center justify-between gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {product.productName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              SKU: {product.sku} ·{' '}
                              {product.lastPriceFormatted}
                              /{t('đv', 'unit')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge
                              variant="outline"
                              className="text-[10px] h-5 px-1.5"
                            >
                              {t('TB', 'Avg')} x{product.avgQty}
                            </Badge>
                            <Badge
                              className={cn(
                                'text-[10px] h-5 px-1.5',
                                product.orderFrequency >= 5
                                  ? 'bg-green-100 text-green-700 border-green-200'
                                  : 'bg-blue-100 text-blue-700 border-blue-200'
                              )}
                              variant="outline"
                            >
                              {product.orderFrequency}x{' '}
                              {t('đặt', 'ordered')}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Order All button */}
                    <div className="mt-4 pt-3 border-t">
                      <Button
                        className="w-full rounded-full"
                        onClick={handleOrderAll}
                      >
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        {t('Đặt tất cả', 'Order All')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ====== TAB 3: Quick Reorder ====== */}
            <TabsContent value="quick" className="mt-3 px-4 space-y-2">
              {!hasFrequent ? (
                <EmptyTabState
                  icon={<Zap className="h-10 w-10 text-muted-foreground/40" />}
                  message={t(
                    'Chưa có sản phẩm nào',
                    'No products yet'
                  )}
                />
              ) : (
                data.frequentProducts.map((product) => {
                  const isAdded = addedProducts.has(product.productId);
                  return (
                    <Card key={product.productId}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          {/* Product info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {product.productName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              SKU: {product.sku}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-xs font-semibold text-primary">
                                {product.lastPriceFormatted}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-5 px-1.5"
                              >
                                {t('TB', 'Avg')} x{product.avgQty}
                              </Badge>
                            </div>
                          </div>

                          {/* Frequency badge + Add button */}
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <Badge
                              className={cn(
                                'text-[10px] h-5 px-1.5',
                                product.orderFrequency >= 5
                                  ? 'bg-green-100 text-green-700 border-green-200'
                                  : 'bg-blue-100 text-blue-700 border-blue-200'
                              )}
                              variant="outline"
                            >
                              {product.orderFrequency}x{' '}
                              {t('đặt', 'ordered')}
                            </Badge>
                            <Button
                              size="icon"
                              className={cn(
                                'h-8 w-8 rounded-full shrink-0',
                                isAdded && 'bg-green-500 hover:bg-green-500'
                              )}
                              onClick={() => handleQuickAdd(product)}
                              disabled={isAdded}
                            >
                              {isAdded ? (
                                <Check className="h-4 w-4 text-white" />
                              ) : (
                                <Plus className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}