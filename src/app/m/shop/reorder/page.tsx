'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShoppingCart,
  Package,
  RefreshCw,
  ChevronRight,
  PackageSearch,
  Tag,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';

// ============================================
// Types
// ============================================

interface ReorderSuggestion {
  productId: string;
  productName: string;
  sku: string;
  price: number;
  lastOrdered: string;
  avgFrequencyDays: number;
  suggestedQty: number;
  hasPromotion: boolean;
}

interface ReorderData {
  suggestions: ReorderSuggestion[];
}

// ============================================
// Helpers
// ============================================

const fmtVND = (amount: number) =>
  new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';

// ============================================
// Page
// ============================================

export default function MobileShopReorderPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<ReorderData>('/shops/reorder-suggestions');
      if (res.success && res.data) {
        setSuggestions(res.data.suggestions || []);
      } else {
        setError(
          res.error?.message ||
            t('Không tải được gợi ý', 'Failed to load suggestions')
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

  const handleReorder = (productId: string, qty: number) => {
    if (!productId) return;
    try {
      const cart = JSON.parse(localStorage.getItem('aladin-cart') || '[]');
      const existing = cart.find(
        (c: { productId: string }) => c.productId === productId
      );
      if (existing) {
        existing.quantity += qty;
      } else {
        cart.push({ productId, quantity: qty, name: '', price: 0 });
      }
      localStorage.setItem('aladin-cart', JSON.stringify(cart));
    } catch {
      // localStorage not available
    }
    router.push('/m/cart');
  };

  // ============================================
  // Loading
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Gợi ý đặt hàng', 'Reorder Suggestions')}
          showBack
          showNotifications={false}
        />
        <main className="px-4 pb-24 pt-3 space-y-4">
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">
              {t('Dựa trên lịch sử mua hàng', 'Based on your order history')}
            </p>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </main>
      </div>
    );
  }

  // ============================================
  // Error
  // ============================================
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Gợi ý đặt hàng', 'Reorder Suggestions')}
          showBack
          showNotifications={false}
        />
        <main className="px-4 pt-3">
          <div className="text-center py-12">
            <PackageSearch className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {t('Thử lại', 'Retry')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ============================================
  // Empty state
  // ============================================
  if (suggestions.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Gợi ý đặt hàng', 'Reorder Suggestions')}
          showBack
          showNotifications={false}
        />
        <main className="px-4 pt-3">
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {t('Bạn đã đặt hàng đầy đủ!', 'All caught up!')}
            </p>
          </div>
        </main>
      </div>
    );
  }

  // ============================================
  // Content
  // ============================================
  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Gợi ý đặt hàng', 'Reorder Suggestions')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-24 pt-3 space-y-4">
        {/* Subtitle */}
        <p className="text-xs text-muted-foreground">
          {t('Dựa trên lịch sử mua hàng', 'Based on your order history')}
        </p>

        {/* Suggestion cards */}
        <div className="space-y-2">
          {suggestions.map((s) => (
            <Card
              key={s.productId}
              className={s.hasPromotion ? 'border-yellow-200 bg-yellow-50/50' : ''}
            >
              <CardContent className="p-3 space-y-2">
                {/* Top row: name + promotion badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      SKU: {s.sku} · {fmtVND(s.price)}
                      {t('/đv', '/unit')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('Đặt lần cuối', 'Last ordered')}: {s.lastOrdered} ·{' '}
                      {t('TB', 'Avg')} {s.avgFrequencyDays}{' '}
                      {t('ngày/lần', 'days/order')}
                    </p>
                  </div>
                  {s.hasPromotion && (
                    <Badge className="bg-yellow-500 text-white text-[10px] shrink-0">
                      <Tag className="h-3 w-3 mr-0.5" />
                      {t('KM', 'Sale')}
                    </Badge>
                  )}
                </div>

                {/* Bottom row: suggested qty + add to cart */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {t('Gợi ý', 'Suggested')}: {s.suggestedQty}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleReorder(s.productId, s.suggestedQty)}
                  >
                    <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                    {s.suggestedQty}
                    <Package className="h-3.5 w-3.5 ml-0.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12 text-xs"
            onClick={() => router.push('/m/shop/analytics')}
          >
            <span>{t('📊 Phân tích', '📊 Analytics')}</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
          <Button
            variant="outline"
            className="h-12 text-xs"
            onClick={() => router.push('/m/shop/loyalty')}
          >
            <span>{t('🏆 Thân thiết', '🏆 Loyalty')}</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </main>
    </div>
  );
}