'use client';

import { useState } from 'react';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { CartItemRow } from '@/components/mobile/cart-item-row';
import { OrderSummaryCard } from '@/components/mobile/order-summary-card';
import { PaymentMethodSelector } from '@/components/mobile/payment-method-selector';
import { OrderSuccessScreen } from '@/components/mobile/order-success-screen';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { useCartStore } from '@/stores/cart.store';
import { api } from '@/lib/mobile/api';
import {
  ShoppingCart,
  Package,
  Trash2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { PaymentMethod } from '@/types';

// ============================================
// Cart Page with Order Placement
// ============================================

type CartStep = 'view' | 'checkout' | 'confirming' | 'success';

interface OrderResult {
  orderNumber: string;
  totalAmount: number;
  itemCount: number;
  paymentMethod: string;
}

export default function MobileCartPage() {
  const locale = useAppStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const isEmpty = useCartStore((s) => s.isEmpty());
  const clearCart = useCartStore((s) => s.clearCart);
  const setShopId = useCartStore((s) => s.setShopId);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  // State
  const [step, setStep] = useState<CartStep>('view');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [customerNotes, setCustomerNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  // ---- Handle remove item with animation ----
  const handleRemoveItem = (productId: string) => {
    setRemovingItemId(productId);
    setTimeout(() => {
      useCartStore.getState().removeItem(productId);
      setRemovingItemId(null);
    }, 300);
  };

  // ---- Proceed to checkout ----
  const handleGoToCheckout = () => {
    // Auto-set shop ID from user's shop
    if (user?.shop?.id) {
      setShopId(user.shop.id);
    }
    setStep('checkout');
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- Place order ----
  const handlePlaceOrder = async () => {
    setConfirming(true);
    setOrderError(null);

    const cartItems = useCartStore.getState().items;
    const shopId = useCartStore.getState().shopId || user?.shop?.id;

    if (!shopId) {
      setOrderError(t('Không tìm thấy thông tin cửa hàng', 'Shop information not found'));
      setConfirming(false);
      return;
    }

    // Build order payload
    const payload = {
      shopId,
      items: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      paymentMethod,
      customerNotes: customerNotes.trim() || undefined,
      // Idempotency key to prevent double orders
      idempotencyKey: `mobile-${shopId}-${Date.now()}-${cartItems.map((i) => i.productId).sort().join(',')}`,
    };

    try {
      const res = await api.post<{
        order: {
          id: string;
          orderNumber: string;
          totalAmount: number;
          items: { id: string }[];
          paymentMethod: string;
        };
        message: string;
      }>('/orders', payload);

      if (res.success && res.data) {
        const order = res.data.order;
        setOrderResult({
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          itemCount: order.items?.length || cartItems.length,
          paymentMethod: order.paymentMethod,
        });
        clearCart();
        setStep('success');
      } else {
        const errorCode = res.error?.code;
        const errorMsg = res.error?.message;

        // Handle specific error codes
        if (errorCode === 'INSUFFICIENT_CREDIT') {
          setOrderError(t('Công nợ không đủ để đặt hàng', 'Insufficient credit for this order'));
        } else if (errorCode === 'CREDIT_LOCKED') {
          setOrderError(t('Công nợ đã bị khóa', 'Credit account is locked'));
        } else if (errorCode === 'VALIDATION_ERROR') {
          // Show first validation error if available
          const details = res.error?.details as { errors?: string[] } | undefined;
          if (details?.errors?.length) {
            setOrderError(details.errors[0]);
          } else {
            setOrderError(errorMsg || t('Dữ liệu không hợp lệ', 'Invalid data'));
          }
        } else {
          setOrderError(
            errorMsg || t('Không thể đặt hàng. Vui lòng thử lại.', 'Failed to place order. Please try again.')
          );
        }
      }
    } catch {
      setOrderError(t('Lỗi kết nối. Vui lòng kiểm tra mạng.', 'Network error. Please check connection.'));
    } finally {
      setConfirming(false);
    }
  };

  // ---- Success screen ----
  if (step === 'success' && orderResult) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Đặt hàng thành công', 'Order Success')}
          showBack={false}
          showNotifications={false}
        />
        <OrderSuccessScreen {...orderResult} />
      </div>
    );
  }

  // ---- Empty cart state ----
  if (isEmpty) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Giỏ hàng', 'Cart')}
          showBack={step !== 'view'}
          showNotifications={false}
        />
        <main className="px-4 pb-24 pt-3">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-20 w-20 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <ShoppingCart className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {t('Giỏ hàng trống', 'Your cart is empty')}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-[240px]">
              {t(
                'Khám phá danh sách sản phẩm và thêm vào giỏ hàng',
                'Browse products and add items to your cart'
              )}
            </p>
            <Button
              className="rounded-full px-6"
              onClick={() => (window.location.href = '/m/products')}
            >
              <Package className="h-4 w-4 mr-2" />
              {t('Xem sản phẩm', 'Browse Products')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ---- Cart view / checkout ----
  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={
          step === 'checkout'
            ? t('Thanh toán', 'Checkout')
            : t('Giỏ hàng', 'Cart')
        }
        showBack={step !== 'view'}
        onBack={() => {
          if (step === 'checkout') setStep('view');
          else window.history.back();
        }}
        showNotifications={false}
      />

      <main className="px-4 pb-40 pt-3">
        {/* === CART ITEMS SECTION === */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">
              {t('Sản phẩm', 'Items')} ({items.length})
            </h2>
            {step === 'view' && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                onClick={clearCart}
              >
                <Trash2 className="h-3 w-3" />
                {t('Xóa tất cả', 'Clear all')}
              </Button>
            )}
          </div>

          <div className="divide-y">
            {items.map((item) => (
              <div
                key={item.productId}
                className={cn(
                  'transition-all duration-300',
                  removingItemId === item.productId && 'opacity-0 translate-x-full h-0 overflow-hidden'
                )}
              >
                <CartItemRow item={item} onRemove={handleRemoveItem} />
              </div>
            ))}
          </div>
        </div>

        <Separator className="my-3" />

        {/* === CHECKOUT SECTION === */}
        {step === 'checkout' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Payment method */}
            <PaymentMethodSelector
              value={paymentMethod}
              onChange={setPaymentMethod}
            />

            <Separator />

            {/* Customer notes */}
            <div>
              <button
                onClick={() => setShowNotes(!showNotes)}
                className="flex items-center gap-2 text-sm font-medium w-full"
              >
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                {t('Ghi chú đơn hàng', 'Order notes')}
                {showNotes ? (
                  <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
                )}
              </button>
              {showNotes && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Textarea
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder={t(
                      'Ghi chú giao hàng, yêu cầu đặc biệt...',
                      'Delivery notes, special requests...'
                    )}
                    className="min-h-[80px] text-sm resize-none"
                    maxLength={500}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1 text-right">
                    {customerNotes.length}/500
                  </p>
                </div>
              )}
            </div>

            <Separator />

            {/* Order summary */}
            <OrderSummaryCard
              paymentMethod={paymentMethod}
              customerNotes={customerNotes.trim() || undefined}
            />

            {/* Error message */}
            {orderError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-destructive font-medium">
                    {t('Không thể đặt hàng', 'Cannot place order')}
                  </p>
                  <p className="text-xs text-destructive/80 mt-0.5">{orderError}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1 h-7 text-xs text-destructive p-0"
                    onClick={() => setOrderError(null)}
                  >
                    {t('Đóng', 'Dismiss')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* === BOTTOM STICKY BAR === */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-background border-t safe-area-bottom">
        <div className="max-w-lg mx-auto px-4 py-3">
          {step === 'view' ? (
            /* View mode: subtotal + checkout button */
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{t('Tạm tính', 'Subtotal')}</p>
                <p className="text-lg font-bold">{formatVND(subtotal)}</p>
              </div>
              <Button
                onClick={handleGoToCheckout}
                className="rounded-full px-6 h-12 text-sm font-semibold"
              >
                {t('Đặt hàng', 'Checkout')}
                <ChevronDown className="h-4 w-4 ml-1 rotate-[-90deg]" />
              </Button>
            </div>
          ) : (
            /* Checkout mode: place order button */
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="rounded-full px-4 h-12"
                onClick={() => setStep('view')}
              >
                {t('Quay lại', 'Back')}
              </Button>
              <Button
                onClick={handlePlaceOrder}
                disabled={confirming || items.length === 0}
                className="flex-1 rounded-full h-12 text-sm font-semibold"
              >
                {confirming ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('Đang đặt hàng...', 'Placing order...')}
                  </>
                ) : (
                  t(
                    `Xác nhận đặt hàng — ${formatVND(subtotal)}`,
                    `Confirm Order — ${formatVND(subtotal)}`
                  )
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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
