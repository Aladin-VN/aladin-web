'use client';

import { useAppStore } from '@/stores/app.store';
import { useCartStore } from '@/stores/cart.store';
import { Package, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ============================================
// Types
// ============================================

interface ProductCardData {
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
  category: { id: string; name: string } | null;
  minOrderQty?: number;
  maxOrderQty?: number | null;
}

interface ProductCardProps {
  product: ProductCardData;
  onAddToCart?: (product: ProductCardData) => void;
  onTap?: (product: ProductCardData) => void;
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

function getStockStatus(stock: number, locale: string) {
  if (stock === 0) return { label: locale === 'vi' ? 'Hết hàng' : 'Out of stock', color: 'text-destructive' };
  if (stock <= 10) return { label: locale === 'vi' ? `Còn ${stock}` : `${stock} left`, color: 'text-amber-600' };
  return { label: locale === 'vi' ? 'Còn hàng' : 'In stock', color: 'text-red-600' };
}

// ============================================
// Component
// ============================================

export function ProductCard({ product, onAddToCart, onTap }: ProductCardProps) {
  const locale = useAppStore((s) => s.locale);
  const addItem = useCartStore((s) => s.addItem);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const displayName = locale === 'en' && product.nameEn ? product.nameEn : product.name;
  const stockStatus = getStockStatus(product.stockQuantity, locale);
  const isOutOfStock = product.stockQuantity === 0 || !product.isActive;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem({
      productId: product.id,
      productName: displayName,
      productSku: product.sku,
      unitPrice: product.basePrice,
      imageUrl: product.imageUrl || undefined,
      maxOrderQty: product.maxOrderQty || undefined,
      minOrderQty: product.minOrderQty || undefined,
    });
    onAddToCart?.(product);
  };

  const handleTap = () => {
    if (onTap) {
      onTap(product);
    }
  };

  return (
    <button
      onClick={handleTap}
      className={`flex flex-col rounded-xl border bg-card overflow-hidden text-left transition-all active:scale-[0.98] ${
        isOutOfStock ? 'opacity-60' : 'hover:shadow-md'
      }`}
    >
      {/* Product image */}
      <div className="relative aspect-square bg-muted flex items-center justify-center">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={displayName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <Package className="h-10 w-10 text-muted-foreground/40" />
        )}
        {/* Group buy badge */}
        {product.groupBuyPrice && product.groupBuyPrice < product.basePrice && (
          <Badge className="absolute top-2 left-2 bg-red-500 text-white text-[10px] px-1.5 py-0">
            {t('Mua chung', 'Group Buy')}
          </Badge>
        )}
        {/* Low stock indicator */}
        {product.stockQuantity > 0 && product.stockQuantity <= 10 && (
          <Badge className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0">
            {stockStatus.label}
          </Badge>
        )}
      </div>

      {/* Product info */}
      <div className="flex flex-col gap-1 p-3 flex-1 min-h-0">
        {/* Brand */}
        {product.brand && (
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
            {product.brand}
          </span>
        )}
        {/* Name */}
        <h3 className="text-sm font-medium leading-snug line-clamp-2">{displayName}</h3>
        {/* Category */}
        {product.category && (
          <span className="text-[10px] text-muted-foreground truncate">
            {product.category.name}
          </span>
        )}
        {/* Price & action */}
        <div className="flex items-end justify-between gap-2 mt-auto pt-1">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-primary">
              {formatVND(product.basePrice)}
            </span>
            {product.groupBuyPrice && (
              <span className="text-[10px] text-red-600">
                {formatVND(product.groupBuyPrice)} {t('(mua chung)', '(group buy)')}
              </span>
            )}
          </div>
          <Button
            size="icon"
            variant="outline"
            className={`h-8 w-8 shrink-0 rounded-full ${
              isOutOfStock ? 'invisible' : ''
            }`}
            onClick={handleAddToCart}
            disabled={isOutOfStock}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </button>
  );
}

export type { ProductCardData };
