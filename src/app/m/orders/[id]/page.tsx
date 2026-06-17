'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { StatusBadge, PaymentMethodLabel } from '@/components/mobile/order-status-badge';
import { OrderTimeline } from '@/components/mobile/order-timeline';
import { ShipmentCard } from '@/components/mobile/shipment-card';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import {
  Package,
  MapPin,
  CreditCard,
  MessageSquare,
  Truck,
  ChevronRight,
  Loader2,
  AlertTriangle,
  ArrowLeftRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { OrderDetail, ShipmentStatus } from '@/types';

// ============================================
// Helpers
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr: string | Date | null | undefined, locale: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ============================================
// Order Detail Page
// ============================================

export default function MobileOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // ---- Fetch order ----
  useEffect(() => {
    if (!params?.id) return;
    const fetchOrder = async () => {
      setLoading(true);
      const res = await api.get<OrderDetail>(`/orders/${params.id}`);
      if (res.success && res.data) {
        setOrder(res.data);
      } else {
        setError(res.error?.message || t('Không tìm thấy đơn hàng', 'Order not found'));
      }
      setLoading(false);
    };
    fetchOrder();
  }, [params?.id]);

  // ---- Cancel order ----
  const handleCancel = async () => {
    if (!order) return;
    if (!confirm(t('Bạn có chắc muốn hủy đơn hàng này?', 'Are you sure you want to cancel this order?'))) return;

    setCancelling(true);
    const res = await api.patch(`/orders/${order.id}/cancel`, { reason: 'Customer cancelled' });
    if (res.success) {
      // Refresh
      const refresh = await api.get<OrderDetail>(`/orders/${order.id}`);
      if (refresh.success && refresh.data) setOrder(refresh.data);
    } else {
      alert(res.error?.message || t('Không thể hủy đơn hàng', 'Cannot cancel order'));
    }
    setCancelling(false);
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Chi tiết đơn hàng', 'Order Detail')} showBack showNotifications={false} />
        <div className="px-4 pt-4 space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error || !order) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Chi tiết đơn hàng', 'Order Detail')} showBack showNotifications={false} />
        <div className="px-4 pt-16 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{error || t('Không tìm thấy đơn hàng', 'Order not found')}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>{t('Quay lại', 'Go back')}</Button>
        </div>
      </div>
    );
  }

  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={order.orderNumber}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-8 pt-2 space-y-4">
        {/* Status header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <StatusBadge status={order.status} type="order" locale={locale} size="md" />
              <span className="text-xs text-muted-foreground">{formatDate(order.createdAt, locale)}</span>
            </div>
            <OrderTimeline
              status={order.status}
              confirmedAt={order.confirmedAt?.toISOString()}
              packedAt={order.packedAt?.toISOString()}
              deliveredAt={order.deliveredAt?.toISOString()}
              cancelledAt={order.cancelledAt?.toISOString()}
              shipmentStatus={order.shipment?.status as ShipmentStatus}
              locale={locale}
            />
          </CardContent>
        </Card>

        {/* Order items */}
        <Card>
          <CardContent className="p-4 space-y-0">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">{t('Sản phẩm', 'Items')} ({order.items.length})</h3>
            </div>
            {order.items.map((item, idx) => (
              <div key={item.id}>
                <div className="flex justify-between items-start py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{item.productName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      SKU: {item.productSku}
                      {item.freeQty > 0 && (
                        <span className="ml-2 text-red-600">
                          +{item.freeQty} {t('miễn phí', 'free')}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-medium">
                      {item.totalPrice ? formatVND(item.totalPrice) : formatVND(item.unitPrice * item.quantity)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatVND(item.unitPrice)} x {item.quantity}
                    </p>
                  </div>
                </div>
                {idx < order.items.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Payment summary */}
        <Card>
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">{t('Thanh toán', 'Payment')}</h3>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('Tạm tính', 'Subtotal')}</span>
              <span>{order.subtotalAmountFormatted || formatVND(order.subtotalAmount)}</span>
            </div>

            {order.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-red-600">{t('Giảm giá', 'Discount')}</span>
                <span className="text-red-600">-{order.discountAmountFormatted || formatVND(order.discountAmount)}</span>
              </div>
            )}

            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('Phí vận chuyển', 'Delivery fee')}</span>
                <span>{order.deliveryFeeFormatted || formatVND(order.deliveryFee)}</span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between items-baseline">
              <span className="text-sm font-semibold">{t('Tổng cộng', 'Total')}</span>
              <span className="text-lg font-bold text-primary">
                {order.totalAmountFormatted || formatVND(order.totalAmount)}
              </span>
            </div>

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('Phương thức', 'Method')}</span>
              <span><PaymentMethodLabel method={order.paymentMethod} locale={locale} /></span>
            </div>

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('Trạng thái TT', 'Payment status')}</span>
              <StatusBadge status={order.paymentStatus} type="payment" locale={locale} />
            </div>

            {order.creditUsed > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('Công nợ sử dụng', 'Credit used')}</span>
                <span>{order.creditUsedFormatted || formatVND(order.creditUsed)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer notes */}
        {order.customerNotes && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('Ghi chú', 'Notes')}</p>
                  <p className="text-sm">{order.customerNotes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shipment info */}
        {order.shipment && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{t('Vận chuyển', 'Shipment')}</h3>
                </div>
                <button
                  onClick={() => router.push(`/m/shipments/${order.shipment!.id}`)}
                  className="flex items-center gap-0.5 text-xs text-primary font-medium"
                >
                  {t('Chi tiết', 'Details')}
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              <ShipmentCard
                shipment={{
                  id: order.shipment.id,
                  orderNumber: order.orderNumber,
                  orderTotal: order.totalAmount,
                  orderTotalFormatted: order.totalAmountFormatted,
                  shopName: order.shopName,
                  type: order.shipment.type,
                  status: order.shipment.status,
                  driverName: order.shipment.assignedDriverName,
                  driverPhone: order.shipment.assignedDriverPhone,
                  dropoffAddress: order.shipment.dropoffAddress,
                  thirdPartyTrackingId: order.shipment.thirdPartyTrackingId,
                  deliveredAt: order.shipment.deliveredAt?.toISOString(),
                }}
                onTap={(s) => router.push(`/m/shipments/${s.id}`)}
              />
            </CardContent>
          </Card>
        )}

        {/* Delivery address */}
        {order.shopAddress && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">{order.shopName}</p>
                  <p>{order.shopAddress}</p>
                  {(order.shopDistrict || order.shopProvince) && (
                    <p>{order.shopDistrict}{order.shopDistrict && ', '}{order.shopProvince}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cancel button */}
        {canCancel && (
          <Button
            variant="outline"
            className={cn('w-full rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10')}
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4 mr-2" />
            )}
            {cancelling ? t('Đang hủy...', 'Cancelling...') : t('Hủy đơn hàng', 'Cancel Order')}
          </Button>
        )}
      </main>
    </div>
  );
}
