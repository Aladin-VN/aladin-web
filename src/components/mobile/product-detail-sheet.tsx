'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/stores/app.store';
import { useCartStore } from '@/stores/cart.store';
import { X, Package, ShoppingBag, Barcode, Factory, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { QuantityStepper } from './quantity-stepper';

// ============================================
// Types
// ============================================

interface ProductDetailData {
  id: string;
  sku: string;
  name: string;
  nameEn?: string | null;
  brand?: string | null;
  unit: string;
  basePrice: number;
  groupBuyPrice?: number | null;
  stockQuantity: number;
  imageUrl?: string | null;
  isActive: boolean;
  description?: string | null;
  descriptionEn?: string | null;
  category: { id: string; name: string } | null;
  manufacturer?: { id: string; name: string } | null;
  distributor?: { id: string; name: string } | null;
  minOrderQty?: number;
  maxOrderQty?: number | null;
  weightKg?: number | null;
  isPrivateLabel: boolean;
  barcode?: string | null;
}

interface ProductDetailSheetProps {
  product: ProductDetailData | null;
  open: boolean;
  onClose: () => void;
  onAddedToCart?: () => void;
}

// ============================================
// Helpers
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ============================================
// Component
// ============================================

export function ProductDetailSheet({
  product,
  open,
  onClose,
  onAddedToCart,
}: ProductDetailSheetProps) {
  const locale = useAppStore((s) => s.locale);
  const addItem = useCartStore((s) => s.addItem);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [quantity, setQuantity] = useState(product?.minOrderQty || 1);
  const [added, setAdded] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleAddToCart = useCallback(() => {
    if (!product) return;
    addItem({
      productId: product.id,
      productName: locale === 'en' && product.nameEn ? product.nameEn : product.name,
      productSku: product.sku,
      unitPrice: product.basePrice,
      imageUrl: product.imageUrl || undefined,
      maxOrderQty: product.maxOrderQty || undefined,
      minOrderQty: product.minOrderQty || undefined,
      quantity,
    });
    setAdded(true);
    onAddedToCart?.();
    setTimeout(() => setAdded(false), 1500);
  }, [product, quantity, addItem, locale, onAddedToCart]);

  if (!product || !open) return null;

  const displayName = locale === 'en' && product.nameEn ? product.nameEn : product.name;
  const description = locale === 'en' && product.descriptionEn ? product.descriptionEn : product.description;
  const isOutOfStock = product.stockQuantity === 0 || !product.isActive;
  const lineTotal = product.basePrice * quantity;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Close button */}
        <div className="absolute top-3 right-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full bg-muted/50"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 pb-4">
          {/* Image */}
          <div className="relative aspect-[4/3] rounded-xl bg-muted flex items-center justify-center mb-4 overflow-hidden">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="h-16 w-16 text-muted-foreground/30" />
            )}
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Badge variant="destructive" className="text-sm px-3 py-1">
                  {t('Hết hàng', 'Out of Stock')}
                </Badge>
              </div>
            )}
            {product.isPrivateLabel && (
              <Badge className="absolute top-2 left-2 bg-violet-600 text-white text-[10px]">
                {t('Thương hiệu riêng', 'Private Label')}
              </Badge>
            )}
          </div>

          {/* Name & brand */}
          <div className="mb-3">
            {product.brand && (
              <span className="text-xs text-muted-foreground uppercase tracking-wider">
                {product.brand}
              </span>
            )}
            <h2 className="text-lg font-bold leading-tight mt-0.5">{displayName}</h2>
            {product.category && (
              <span className="text-xs text-muted-foreground">
                {product.category.name}
              </span>
            )}
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-xl font-bold text-primary">
              {formatVND(product.basePrice)}
            </span>
            <span className="text-sm text-muted-foreground">/{product.unit}</span>
          </div>

          {product.groupBuyPrice && product.groupBuyPrice < product.basePrice && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 mb-3">
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {t('Giá mua chung', 'Group Buy Price')}
              </span>
              <span className="text-base font-bold text-emerald-700 dark:text-emerald-400 ml-2">
                {formatVND(product.groupBuyPrice)}
              </span>
            </div>
          )}

          {/* Description */}
          {description && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              {description}
            </p>
          )}

          <Separator className="my-3" />

          {/* Product details */}
          <div className="space-y-2.5 text-sm">
            {/* SKU */}
            <div className="flex items-center gap-2">
              <Barcode className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">SKU:</span>
              <span className="font-mono">{product.sku}</span>
            </div>

            {/* Barcode */}
            {product.barcode && (
              <div className="flex items-center gap-2">
                <Barcode className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('Mã vạch', 'Barcode')}:
                </span>
                <span className="font-mono">{product.barcode}</span>
              </div>
            )}

            {/* Manufacturer */}
            {product.manufacturer && (
              <div className="flex items-center gap-2">
                <Factory className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('NSX', 'Mfg')}:
                </span>
                <span>{product.manufacturer.name}</span>
              </div>
            )}

            {/* Distributor */}
            {product.distributor && (
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('NPP', 'Dist')}:
                </span>
                <span>{product.distributor.name}</span>
              </div>
            )}

            {/* Weight */}
            {product.weightKg && (
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t('Trọng lượng', 'Weight')}:
                </span>
                <span>{product.weightKg} kg</span>
              </div>
            )}

            {/* Stock */}
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {t('Tồn kho', 'Stock')}:
              </span>
              <span className={product.stockQuantity === 0 ? 'text-destructive font-medium' : ''}>
                {product.stockQuantity} {product.unit}
              </span>
            </div>

            {/* Min/Max order */}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {t('SL tối thiểu', 'Min qty')}: {product.minOrderQty || 1}
                {product.maxOrderQty && ` | ${t('SL tối đa', 'Max qty')}: ${product.maxOrderQty}`}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom sticky bar — quantity + add to cart */}
        <div className="border-t bg-background px-4 py-3 safe-area-bottom">
          {!isOutOfStock ? (
            <div className="flex items-center gap-3">
              <QuantityStepper
                value={quantity}
                min={product.minOrderQty || 1}
                max={Math.min(product.maxOrderQty || 9999, product.stockQuantity)}
                onChange={setQuantity}
              />
              <div className="flex-1" />
              <div className="text-right mr-2">
                <div className="text-[10px] text-muted-foreground">
                  {t('Thành tiền', 'Total')}
                </div>
                <div className="text-sm font-bold">{formatVND(lineTotal)}</div>
              </div>
              <Button
                onClick={handleAddToCart}
                className="shrink-0 rounded-full px-5"
                size="lg"
              >
                {added
                  ? t('Đã thêm!', 'Added!')
                  : t('Thêm vào giỏ', 'Add to Cart')}
              </Button>
            </div>
          ) : (
            <Button className="w-full rounded-full" size="lg" disabled>
              {t('Hết hàng', 'Out of Stock')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export type { ProductDetailData };
