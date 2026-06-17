'use client';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  Calendar,
  DollarSign,
  BarChart3,
  ShoppingCart,
  Factory,
  Store,
  Loader2,
} from 'lucide-react';
import { PromoTypeBadge } from './promo-type-badge';
import { PromoStatusBadge } from './promo-status-badge';
import { formatVND } from '@/lib/security';

interface PromotionDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionId: string | null;
  locale?: string;
}

interface PromotionDetail {
  id: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  promoType: string;
  buyQty: number | null;
  getQty: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  startsAt: string;
  expiresAt: string;
  totalBudget: number | null;
  usedBudget: number;
  totalRedemptions: number;
  isActive: boolean;
  computedStatus: string;
  budgetPercent: number;
  budgetRemaining: number;
  budgetRemainingFormatted: string;
  usedBudgetFormatted: string;
  totalBudgetFormatted: string | null;
  manufacturer: { id: string; name: string; province: string | null; commissionRate: number };
  items: { product: { id: string; name: string; sku: string; basePrice: number; imageUrl: string | null; isActive: boolean } }[];
  orderItems: { id: string; productName: string; quantity: number; freeQty: number; totalPrice: number; order: { id: string; orderNumber: string; status: string; shop: { name: string; district: string | null } } }[];
}

export function PromotionDetailDrawer({ open, onOpenChange, promotionId, locale = 'vi' }: PromotionDetailDrawerProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const [detail, setDetail] = useState<PromotionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders'>('overview');

  useEffect(() => {
    if (promotionId && open) {
      setLoading(true);
      fetch(`/api/promotions/${promotionId}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success) setDetail(json.data);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setDetail(null);
      setActiveTab('overview');
    }
  }, [promotionId, open]);

  if (!promotionId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-1 pr-6">
          <SheetTitle className="text-lg">{t('Promotion Detail', 'Chi tiet khuyen mai')}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
            <div className="grid grid-cols-2 gap-3 mt-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ) : detail ? (
          <div className="mt-6 space-y-5">
            {/* Title + Badges */}
            <div>
              <h3 className="text-lg font-semibold">{detail.title}</h3>
              {detail.titleEn && <p className="text-sm text-muted-foreground">{detail.titleEn}</p>}
              {detail.description && <p className="text-sm text-muted-foreground mt-1">{detail.description}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                <PromoTypeBadge
                  type={detail.promoType}
                  buyQty={detail.buyQty}
                  getQty={detail.getQty}
                  discountPercent={detail.discountPercent}
                  discountAmount={detail.discountAmount}
                  locale={locale}
                />
                <PromoStatusBadge status={detail.computedStatus as 'active' | 'upcoming' | 'expired'} isActive={detail.isActive} locale={locale} />
              </div>
            </div>

            <Separator />

            {/* Tab navigation */}
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(['overview', 'products', 'orders'] as const).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? 'default' : 'ghost'}
                  size="sm"
                  className={`h-8 text-xs flex-1 ${activeTab === tab ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'overview' && <BarChart3 className="h-3.5 w-3.5 mr-1" />}
                  {tab === 'products' && <Package className="h-3.5 w-3.5 mr-1" />}
                  {tab === 'orders' && <ShoppingCart className="h-3.5 w-3.5 mr-1" />}
                  {t(
                    { overview: 'Overview', products: 'Products', orders: 'Orders' }[tab],
                    { overview: 'Tong quan', products: 'San pham', orders: 'Don hang' }[tab]
                  )}
                </Button>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">{t('Manufacturer', 'Nha san xuat')}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Factory className="h-3.5 w-3.5 text-red-600" />
                      <p className="text-sm font-medium truncate">{detail.manufacturer.name}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {t('Commission', 'Hoa hong')}: {(detail.manufacturer.commissionRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">{t('Redemptions', 'Da ap dung')}</p>
                    <p className="text-xl font-bold mt-1">{detail.totalRedemptions}</p>
                    <p className="text-[10px] text-muted-foreground">{t('order items', 'san pham trong don')}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">{t('Used Budget', 'Ngan sach da dung')}</p>
                    <p className="text-sm font-bold mt-1">{detail.usedBudgetFormatted}</p>
                    {detail.totalBudget && (
                      <div className="mt-1.5">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${detail.budgetPercent > 80 ? 'bg-red-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(100, detail.budgetPercent)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{detail.budgetPercent}%</p>
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">{t('Budget Remaining', 'Ngan sach con lai')}</p>
                    <p className="text-sm font-bold mt-1">{detail.budgetRemainingFormatted}</p>
                    {detail.totalBudgetFormatted && (
                      <p className="text-[10px] text-muted-foreground">
                        {t('of', 'trong')} {detail.totalBudgetFormatted}
                      </p>
                    )}
                  </div>
                </div>

                {/* Validity */}
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {t('Validity Period', 'Thoi gian hieu luc')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">{t('From', 'Tu')}</p>
                      <p className="font-medium">{new Date(detail.startsAt).toLocaleDateString('vi-VN')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('To', 'Den')}</p>
                      <p className="font-medium">{new Date(detail.expiresAt).toLocaleDateString('vi-VN')}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
              <div className="space-y-2">
                {detail.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{t('No products linked', 'Chua lien ket san pham nao')}</p>
                ) : (
                  detail.items.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50">
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product.name}</p>
                        <p className="text-[10px] text-muted-foreground">{item.product.sku} · {formatVND(item.product.basePrice)}</p>
                      </div>
                      {!item.product.isActive && (
                        <Badge variant="outline" className="text-[10px] text-red-600">{t('Inactive', 'Ngung')}</Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="space-y-2">
                {detail.orderItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{t('No orders yet', 'Chua co don hang nao')}</p>
                ) : (
                  detail.orderItems.map((oi) => (
                    <div key={oi.id} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50">
                      <div className="h-10 w-10 rounded-md bg-yellow-50 flex items-center justify-center shrink-0">
                        <ShoppingCart className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{oi.order.orderNumber}</p>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Store className="h-3 w-3" />
                          <span className="truncate">{oi.order.shop.name}</span>
                          {oi.order.shop.district && <span>· {oi.order.shop.district}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">{formatVND(oi.totalPrice)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          x{oi.quantity} {oi.freeQty > 0 && `(free: ${oi.freeQty})`}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
