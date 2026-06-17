'use client';

import { useAppStore } from '@/stores/app.store';
import { useCartStore } from '@/stores/cart.store';
import { Separator } from '@/components/ui/separator';
import type { PaymentMethod } from '@/types';

// ============================================
// Types
// ============================================

interface OrderSummaryCardProps {
  paymentMethod?: PaymentMethod;
  deliveryFee?: number;
  discountAmount?: number;
  customerNotes?: string;
  showConfirmButton?: boolean;
  confirmLoading?: boolean;
  onConfirm?: () => void;
}

// ============================================
// Constants
// ============================================

const PAY_NOW_DISCOUNT = 0.02; // 2%
const COD_DELIVERY_FEE = 15000;

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

export function OrderSummaryCard({
  paymentMethod = 'COD',
  deliveryFee,
  discountAmount,
  customerNotes,
  showConfirmButton = false,
  confirmLoading = false,
  onConfirm,
}: OrderSummaryCardProps) {
  const locale = useAppStore((s) => s.locale);
  const itemCount = useCartStore((s) => s.itemCount());
  const subtotal = useCartStore((s) => s.subtotal());
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  // Calculate values
  const delivery = deliveryFee ?? (paymentMethod === 'COD' ? COD_DELIVERY_FEE : 0);
  const discount = discountAmount ?? (paymentMethod === 'DIGITAL' ? Math.round(subtotal * PAY_NOW_DISCOUNT) : 0);
  const total = Math.max(0, subtotal - discount + delivery);

  return (
    <div className="bg-card border rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold">{t('Tóm tắt đơn hàng', 'Order Summary')}</h3>

      <Separator />

      {/* Subtotal */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          {t('Tạm tính', 'Subtotal')} ({itemCount} {itemCount > 1 ? (locale === 'vi' ? 'SP' : 'items') : (locale === 'vi' ? 'SP' : 'item')})
        </span>
        <span className="font-medium">{formatVND(subtotal)}</span>
      </div>

      {/* Discount (DIGITAL payment) */}
      {discount > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-red-600">
            {t('Giảm giá thanh toán số (2%)', 'Digital payment discount (2%)')}
          </span>
          <span className="font-medium text-red-600">-{formatVND(discount)}</span>
        </div>
      )}

      {/* Delivery fee */}
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">
          {t('Phí vận chuyển', 'Delivery fee')}
        </span>
        <span className="font-medium">
          {delivery > 0 ? formatVND(delivery) : t('Miễn phí', 'Free')}
        </span>
      </div>

      {/* Customer notes */}
      {customerNotes && (
        <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
          <span className="font-medium">{t('Ghi chú', 'Notes')}: </span>
          {customerNotes}
        </div>
      )}

      <Separator />

      {/* Total */}
      <div className="flex justify-between items-baseline">
        <span className="text-sm font-semibold">{t('Tổng cộng', 'Total')}</span>
        <span className="text-lg font-bold text-primary">{formatVND(total)}</span>
      </div>

      {/* Payment method note */}
      <p className="text-[10px] text-muted-foreground">
        {paymentMethod === 'CREDIT' && t('Thanh toán bằng công nợ', 'Payment via credit')}
        {paymentMethod === 'DIGITAL' && t('Thanh toán qua ZaloPay/MoMo (giảm 2%)', 'Payment via ZaloPay/MoMo (2% off)')}
        {paymentMethod === 'COD' && t('Thanh toán khi nhận hàng (phí ship 15K)', 'Cash on delivery (15K shipping fee)')}
      </p>

      {/* Confirm button */}
      {showConfirmButton && onConfirm && (
        <button
          onClick={onConfirm}
          disabled={confirmLoading || subtotal === 0}
          className="w-full mt-2 h-12 bg-primary text-primary-foreground rounded-xl font-semibold text-sm
            transition-colors disabled:opacity-50 disabled:pointer-events-none
            active:bg-primary/90"
        >
          {confirmLoading
            ? t('Đang đặt hàng...', 'Placing order...')
            : t(`Đặt hàng — ${formatVND(total)}`, `Place Order — ${formatVND(total)}`)}
        </button>
      )}
    </div>
  );
}
