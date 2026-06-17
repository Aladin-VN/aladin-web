'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { ShipmentStatusBadge, SHIPMENT_STATUS_CONFIG } from '@/components/mobile/shipment-card';
import { PodCapture } from '@/components/mobile/pod-capture';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/mobile/api';
import {
  Truck,
  Phone,
  MapPin,
  Package,
  Clock,
  User,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ShipmentDetail, ShipmentStatus } from '@/types';

// ============================================
// Shipment Status Pipeline
// ============================================

const SHIPMENT_STEPS: { status: ShipmentStatus; vi: string; en: string }[] = [
  { status: 'PENDING',    vi: 'Chờ lấy hàng',    en: 'Pending' },
  { status: 'PICKED_UP',  vi: 'Đã lấy hàng',    en: 'Picked Up' },
  { status: 'IN_TRANSIT', vi: 'Đang vận chuyển', en: 'In Transit' },
  { status: 'DELIVERED',  vi: 'Đã giao',        en: 'Delivered' },
];

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
// Shipment Detail Page
// ============================================

export default function MobileShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [podPhoto, setPodPhoto] = useState<string | null>(null);

  const isDriver = user?.role === 'DRIVER';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SALES_REP';
  const canUpdateStatus = isDriver || isAdmin;

  // ---- Fetch shipment ----
  useEffect(() => {
    if (!params?.id) return;
    const fetchShipment = async () => {
      setLoading(true);
      const res = await api.get<ShipmentDetail>(`/shipments/${params.id}`);
      if (res.success && res.data) {
        setShipment(res.data);
        if (res.data.podPhotoUrl) setPodPhoto(res.data.podPhotoUrl);
      } else {
        setError(res.error?.message || t('Không tìm thấy lô hàng', 'Shipment not found'));
      }
      setLoading(false);
    };
    fetchShipment();
  }, [params?.id]);

  // ---- Update shipment status ----
  const handleUpdateStatus = async (newStatus: ShipmentStatus) => {
    if (!shipment) return;

    const body: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'DELIVERED') {
      body.deliveredAt = new Date().toISOString();
      if (podPhoto) body.podPhotoUrl = podPhoto;
    }

    setUpdatingStatus(true);
    const res = await api.patch(`/shipments/${shipment.id}/status`, body);
    if (res.success) {
      const refresh = await api.get<ShipmentDetail>(`/shipments/${shipment.id}`);
      if (refresh.success && refresh.data) setShipment(refresh.data);
    } else {
      alert(res.error?.message || t('Không thể cập nhật trạng thái', 'Cannot update status'));
    }
    setUpdatingStatus(false);
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Chi tiết vận chuyển', 'Shipment Detail')} showBack showNotifications={false} />
        <div className="px-4 pt-4 space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Chi tiết vận chuyển', 'Shipment Detail')} showBack showNotifications={false} />
        <div className="px-4 pt-16 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>{t('Quay lại', 'Go back')}</Button>
        </div>
      </div>
    );
  }

  const currentStepIdx = SHIPMENT_STEPS.findIndex((s) => s.status === shipment.status);
  const isFailed = shipment.status === 'FAILED';
  const isDelivered = shipment.status === 'DELIVERED';
  const isTerminal = isDelivered || isFailed;

  // Next valid status transitions
  const nextTransitions: Partial<Record<ShipmentStatus, ShipmentStatus>> = {
    PENDING: 'PICKED_UP',
    PICKED_UP: 'IN_TRANSIT',
    IN_TRANSIT: 'DELIVERED',
    FAILED: 'PENDING', // retry
  };
  const nextStatus = nextTransitions[shipment.status];

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={shipment.orderNumber || shipment.id.slice(0, 8)}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-8 pt-2 space-y-4">
        {/* Status header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <ShipmentStatusBadge status={shipment.status} locale={locale} />
              <span className="text-xs text-muted-foreground">
                {t(shipment.type === 'INTERNAL' ? 'Nội bộ' : 'Bên thứ 3', shipment.type === 'INTERNAL' ? 'Internal' : 'Third Party')}
              </span>
            </div>

            {/* Timeline */}
            {isFailed ? (
              <div className="flex flex-col items-center py-4">
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-2">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-sm font-semibold text-red-600">{t('Giao thất bại', 'Delivery Failed')}</p>
              </div>
            ) : (
              <div className="py-2">
                {SHIPMENT_STEPS.map((step, idx) => {
                  const isCompleted = idx <= currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div key={step.status} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                          isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        )}>
                          {isCompleted ? '✓' : idx + 1}
                        </div>
                        {idx < SHIPMENT_STEPS.length - 1 && (
                          <div className={cn('w-0.5 flex-1 min-h-[20px]', idx < currentStepIdx ? 'bg-primary' : 'bg-muted')} />
                        )}
                      </div>
                      <div className="pb-4 flex-1 min-w-0">
                        <p className={cn('text-xs font-medium', isCurrent ? 'text-foreground' : 'text-muted-foreground')}>
                          {t(step.vi, step.en)}
                        </p>
                        {isCurrent && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDate(shipment.createdAt, locale)}
                          </p>
                        )}
                        {isDelivered && step.status === 'DELIVERED' && shipment.deliveredAt && (
                          <p className="text-[10px] text-red-600 mt-0.5">
                            {formatDate(shipment.deliveredAt, locale)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Driver info */}
        {shipment.assignedDriver && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{t('Tài xế', 'Driver')}</h3>
              </div>
              <div className="flex items-center gap-3">
                {shipment.assignedDriver && shipment.assignedDriver.avatarUrl && (
                  <img src={shipment.assignedDriver.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                )}
                {!shipment.assignedDriver?.avatarUrl && (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-primary">
                    {shipment.assignedDriver?.name?.slice(0, 1) || '?'}
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">{shipment.assignedDriver?.name}</p>
                  <button
                    className="flex items-center gap-1 text-xs text-primary mt-0.5"
                    onClick={() => shipment.assignedDriver?.phone && window.open(`tel:${shipment.assignedDriver.phone}`, '_self')}
                  >
                    <Phone className="h-3 w-3" />
                    {shipment.assignedDriver?.phone}
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Addresses */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="h-3 w-3 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('Điểm lấy', 'Pickup')}</p>
                <p className="text-sm">{shipment.pickupAddress || t('Kho ALADIN', 'ALADIN Warehouse')}</p>
              </div>
            </div>
            <div className="ml-2.5 border-l-2 border-dashed border-muted-foreground/30 h-4" />
            <div className="flex items-start gap-2">
              <div className="h-5 w-5 rounded-full bg-yellow-50 dark:bg-red-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="h-3 w-3 text-red-600" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('Điểm giao', 'Dropoff')}</p>
                <p className="text-sm">{shipment.dropoffAddress}</p>
                {shipment.order?.shop && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {shipment.order.shop.name} · {shipment.order.shop.phone}
                    {shipment.order.shop.district && ` · ${shipment.order.shop.district}`}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order items (if loaded) */}
        {shipment.order?.items && shipment.order.items.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  {t('Hàng hóa', 'Items')} ({shipment.order.items.length})
                </h3>
                {shipment.order?.orderTotal && (
                  <span className="ml-auto text-sm font-bold text-primary">
                    {shipment.order.orderTotalFormatted || formatVND(shipment.order.orderTotal)}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {shipment.order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground line-clamp-1 flex-1">
                      {item.productName} ({item.productSku})
                    </span>
                    <span className="shrink-0 ml-2">
                      {formatVND(item.unitPrice)} x {item.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* POD section (driver view or if POD data exists) */}
        {(isDriver || shipment.podPhotoUrl || shipment.podSignatureUrl || shipment.podOtp) && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Check className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{t('Xác nhận giao hàng (POD)', 'Proof of Delivery')}</h3>
              </div>
              <PodCapture
                photoUrl={shipment.podPhotoUrl || podPhoto}
                signatureUrl={shipment.podSignatureUrl}
                otp={shipment.podOtp}
              />
            </CardContent>
          </Card>
        )}

        {/* Third-party tracking */}
        {shipment.thirdPartyTrackingId && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-sm">
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('Mã vận đơn', 'Tracking ID')}:</span>
                <span className="font-mono font-medium">{shipment.thirdPartyTrackingId}</span>
                {shipment.thirdPartyStatus && (
                  <span className="ml-auto text-xs text-muted-foreground">{shipment.thirdPartyStatus}</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action buttons (driver/admin only) */}
        {canUpdateStatus && nextStatus && !isTerminal && (
          <div className="space-y-2">
            <Button
              className="w-full rounded-xl h-12 font-semibold"
              onClick={() => handleUpdateStatus(nextStatus)}
              disabled={updatingStatus}
            >
              {updatingStatus ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              {nextStatus === 'PICKED_UP' && t('Xác nhận đã lấy hàng', 'Confirm Picked Up')}
              {nextStatus === 'IN_TRANSIT' && t('Xác nhận đang vận chuyển', 'Confirm In Transit')}
              {nextStatus === 'DELIVERED' && t('Xác nhận đã giao hàng', 'Confirm Delivered')}
              {nextStatus === 'PENDING' && t('Thử giao lại', 'Retry Delivery')}
            </Button>
            {nextStatus === 'PICKED_UP' && (
              <p className="text-[10px] text-center text-muted-foreground">
                {t('Bấm để xác nhận bạn đã lấy hàng từ kho', 'Tap to confirm you picked up from warehouse')}
              </p>
            )}
          </div>
        )}

        {/* View order button */}
        <Button
          variant="outline"
          className="w-full rounded-xl"
          onClick={() => shipment.orderId && router.push(`/m/orders/${shipment.orderId}`)}
        >
          <Package className="h-4 w-4 mr-2" />
          {t('Xem đơn hàng', 'View Order')}
        </Button>
      </main>
    </div>
  );
}
