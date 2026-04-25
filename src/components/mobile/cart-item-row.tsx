'use client';

import { useAppStore } from '@/stores/app.store';
import { useCartStore } from '@/stores/cart.store';
import { Trash2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QuantityStepper } from './quantity-stepper';
import type { CartItem } from '@/stores/cart.store';

// ============================================
// Types
// ============================================

interface CartItemRowProps {
  item: CartItem;
  onRemove?: (productId: string) => void;
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

export function CartItemRow({ item, onRemove }: CartItemRowProps) {
  const locale = useAppStore((s) => s.locale);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const lineTotal = item.unitPrice * item.quantity;

  const handleRemove = () => {
    removeItem(item.productId);
    onRemove?.(item.productId);
  };

  return (
    <div className="flex gap-3 py-3">
      {/* Product image */}
      <div className="shrink-0 w-20 h-20 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.productName}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="h-8 w-8 text-muted-foreground/40" />
        )}
      </div>

      {/* Product info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <h4 className="text-sm font-medium leading-snug line-clamp-2">
            {item.productName}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            SKU: {item.productSku} | {formatVND(item.unitPrice)}
          </p>
        </div>

        {/* Bottom row: quantity + total + remove */}
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <QuantityStepper
            value={item.quantity}
            min={item.minOrderQty || 1}
            max={item.maxOrderQty || 9999}
            onChange={(qty) => updateQuantity(item.productId, qty)}
          />

          <span className="text-sm font-bold text-primary whitespace-nowrap">
            {formatVND(lineTotal)}
          </span>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={handleRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
