'use client';

import { useAppStore } from '@/stores/app.store';
import { CheckCircle2, Package, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

// ============================================
// Types
// ============================================

interface OrderSuccessScreenProps {
  orderNumber: string;
  totalAmount: number;
  itemCount: number;
  paymentMethod: string;
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

function getPaymentMethodLabel(method: string, locale: string): string {
  const labels: Record<string, { vi: string; en: string }> = {
    CREDIT: { vi: 'Công nợ', en: 'Credit' },
    DIGITAL: { vi: 'Thanh toán số', en: 'Digital Pay' },
    COD: { vi: 'COD', en: 'COD' },
  };
  const label = labels[method];
  return label ? (locale === 'vi' ? label.vi : label.en) : method;
}

// ============================================
// Component
// ============================================

export function OrderSuccessScreen({
  orderNumber,
  totalAmount,
  itemCount,
  paymentMethod,
}: OrderSuccessScreenProps) {
  const locale = useAppStore((s) => s.locale);
  const router = useRouter();
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      {/* Success animation */}
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center animate-bounce-once">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
      </div>

      {/* Title */}
      <h2 className="text-xl font-bold mb-2">
        {t('Đặt hàng thành công!', 'Order Placed Successfully!')}
      </h2>

      {/* Order details card */}
      <div className="bg-card border rounded-xl p-4 w-full max-w-sm mb-6 text-left space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('Mã đơn hàng', 'Order No.')}</span>
          <span className="font-mono font-semibold">{orderNumber}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('Số lượng', 'Items')}</span>
          <span>{itemCount} {t('sản phẩm', 'items')}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t('Thanh toán', 'Payment')}</span>
          <span>{getPaymentMethodLabel(paymentMethod, locale)}</span>
        </div>
        <div className="border-t pt-2 flex justify-between">
          <span className="text-sm font-semibold">{t('Tổng cộng', 'Total')}</span>
          <span className="text-base font-bold text-primary">{formatVND(totalAmount)}</span>
        </div>
      </div>

      {/* Info message */}
      <p className="text-sm text-muted-foreground mb-8 max-w-sm">
        {t(
          'Đơn hàng của bạn đang được xử lý. Bạn có thể theo dõi trạng thái đơn hàng trong mục Đơn hàng.',
          'Your order is being processed. Track order status in the Orders tab.'
        )}
      </p>

      {/* Actions */}
      <div className="flex gap-3 w-full max-w-sm">
        <Button
          variant="outline"
          className="flex-1 rounded-xl"
          onClick={() => router.push('/m/products')}
        >
          <Package className="h-4 w-4 mr-2" />
          {t('Tiếp tục mua', 'Continue Shopping')}
        </Button>
        <Button
          className="flex-1 rounded-xl"
          onClick={() => router.push('/m/orders')}
        >
          {t('Xem đơn hàng', 'View Orders')}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
