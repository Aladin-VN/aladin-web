'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Truck,
  Phone,
  MapPin,
  Package,
  Clock,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Camera,
  ExternalLink,
  FileText,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ShipmentDetail, ShipmentStatus } from '@/types';

// ============================================
// Types
// ============================================

const STEPS: { status: ShipmentStatus; vi: string; en: string }[] = [
  { status: 'PENDING', vi: 'Chờ lấy hàng', en: 'Pending' },
  { status: 'PICKED_UP', vi: 'Đã lấy hàng', en: 'Picked Up' },
  { status: 'IN_TRANSIT', vi: 'Đang vận chuyển', en: 'In Transit' },
  { status: 'DELIVERED', vi: 'Đã giao', en: 'Delivered' },
];

const ISSUE_TYPES = [
  { value: 'WRONG_ADDRESS', vi: 'Sai địa chỉ', en: 'Wrong Address' },
  { value: 'CUSTOMER_ABSENT', vi: 'Khách vắng mặt', en: 'Customer Absent' },
  { value: 'DAMAGED', vi: 'Hàng hỏng', en: 'Damaged' },
  { value: 'SHORTAGE', vi: 'Thiếu hàng', en: 'Shortage' },
  { value: 'OTHER', vi: 'Khác', en: 'Other' },
];

// ============================================
// Helpers
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function formatDate(dateStr: string | Date | null | undefined, locale: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ============================================
// Page Component
// ============================================

export default function DriverDeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // POD state
  const [otpCode, setOtpCode] = useState('');
  const [podPhotoUrl, setPodPhotoUrl] = useState<string | null>(null);
  const [podNote, setPodNote] = useState('');
  const [submittingPod, setSubmittingPod] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Issue dialog
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueType, setIssueType] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [issuePhotoUrl, setIssuePhotoUrl] = useState<string | null>(null);
  const [submittingIssue, setSubmittingIssue] = useState(false);

  // Camera ref for issue photo
  const issueFileRef = useRef<HTMLInputElement>(null);

  // ---- Fetch shipment ----
  useEffect(() => {
    if (!params?.id) return;
    const fetchShipment = async () => {
      setLoading(true);
      const res = await api.get<ShipmentDetail>(`/shipments/${params.id}`);
      if (res.success && res.data) {
        setShipment(res.data);
      } else {
        setError(res.error?.message || t('Không tìm thấy chuyến giao', 'Delivery not found'));
      }
      setLoading(false);
    };
    fetchShipment();
  }, [params?.id, t]);

  // ---- POD photo capture ----
  const handlePodPhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPodPhotoUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // ---- Issue photo capture ----
  const handleIssuePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setIssuePhotoUrl(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // ---- Submit POD ----
  const handleSubmitPod = async () => {
    if (!shipment || otpCode.length < 6) return;
    setSubmittingPod(true);

    const res = await api.post(`/driver/deliveries/${shipment.id}/pod`, {
      photoUrl: podPhotoUrl,
      otpCode,
      note: podNote,
    });

    if (res.success) {
      // Also update the shipment status
      await api.patch(`/driver/deliveries/${shipment.id}/status`, {
        status: 'DELIVERED',
        podPhotoUrl,
        podOtp: otpCode,
      });
      setShowSuccess(true);
    } else {
      alert(res.error?.message || t('Không thể xác nhận giao hàng', 'Cannot confirm delivery'));
    }

    setSubmittingPod(false);
  };

  // ---- Submit issue ----
  const handleSubmitIssue = async () => {
    if (!shipment || !issueType) return;
    setSubmittingIssue(true);

    const res = await api.post(`/driver/deliveries/${shipment.id}/issue`, {
      type: issueType,
      description: issueDescription,
      photoUrl: issuePhotoUrl,
    });

    if (res.success) {
      setIssueDialogOpen(false);
      setIssueType('');
      setIssueDescription('');
      setIssuePhotoUrl(null);
      // Refresh to get updated status
      const refresh = await api.get<ShipmentDetail>(`/shipments/${shipment.id}`);
      if (refresh.success && refresh.data) setShipment(refresh.data);
    } else {
      alert(res.error?.message || t('Không thể báo cáo vấn đề', 'Cannot report issue'));
    }

    setSubmittingIssue(false);
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader showBack showNotifications={false} />
        <div className="px-4 pt-4 space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader showBack showNotifications={false} />
        <div className="px-4 pt-16 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => router.back()}>
            {t('Quay lại', 'Go back')}
          </Button>
        </div>
      </div>
    );
  }

  const currentStepIdx = STEPS.findIndex((s) => s.status === shipment.status);
  const isDelivered = shipment.status === 'DELIVERED';
  const isFailed = shipment.status === 'FAILED';
  const isInTransit = shipment.status === 'IN_TRANSIT';
  const isCod = shipment.order?.paymentMethod === 'COD';

  // Google Maps URL
  const mapsUrl = shipment.dropoffLat && shipment.dropoffLng
    ? `https://www.google.com/maps/dir/?api=1&destination=${shipment.dropoffLat},${shipment.dropoffLng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shipment.dropoffAddress)}`;

  // ---- Success Screen ----
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center pb-24">
        <div className="relative mb-6">
          <div className="h-24 w-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center animate-pulse">
              <CheckCircle2 className="h-14 w-14 text-green-600" />
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-2">
          {t('Giao hàng thành công!', 'Delivery Confirmed!')}
        </h2>

        <div className="bg-card border rounded-xl p-4 w-full max-w-sm mb-6 text-left space-y-2 mt-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('Mã đơn', 'Order No.')}</span>
            <span className="font-mono font-semibold">{shipment.orderNumber || shipment.id.slice(0, 8)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('Cửa hàng', 'Shop')}</span>
            <span className="font-medium text-right max-w-[60%] truncate">{shipment.order?.shop?.name}</span>
          </div>
          {shipment.order?.orderTotal != null && (
            <Separator />
          )}
          {shipment.order?.orderTotal != null && (
            <div className="flex justify-between">
              <span className="text-sm font-semibold">{t('Tổng cộng', 'Total')}</span>
              <span className="text-base font-bold text-primary">
                {shipment.order.orderTotalFormatted || formatVND(shipment.order.orderTotal)}
              </span>
            </div>
          )}
          {isCod && shipment.order && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 text-center">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                {t('⭐ Thu COD', '⭐ COD Collection')}
              </p>
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                {shipment.order.orderTotalFormatted || formatVND(shipment.order.orderTotal)}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 w-full max-w-sm">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-xl"
            onClick={() => {
              setShowSuccess(false);
              router.push('/m/driver/deliveries');
            }}
          >
            {t('Danh sách', 'Deliveries')}
          </Button>
          <Button
            className="flex-1 h-12 rounded-xl"
            onClick={() => {
              setShowSuccess(false);
              router.push('/m/driver');
            }}
          >
            {t('Về trang chính', 'Dashboard')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={shipment.orderNumber || shipment.id.slice(0, 8)}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-24 pt-2 space-y-4">
        {/* ============================================ */}
        {/* Status Timeline */}
        {/* ============================================ */}
        <Card className="rounded-xl">
          <CardContent className="p-4">
            {isFailed ? (
              <div className="flex flex-col items-center py-4">
                <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-2">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <p className="text-sm font-semibold text-red-600">
                  {t('Giao thất bại', 'Delivery Failed')}
                </p>
              </div>
            ) : (
              <div className="py-1">
                {STEPS.map((step, idx) => {
                  const isCompleted = idx <= currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  const isDeliveredStep = step.status === 'DELIVERED' && isDelivered;

                  // Find timestamp for completed steps
                  const stepTimestamp = isDeliveredStep && shipment.deliveredAt
                    ? formatDate(shipment.deliveredAt as unknown as string, locale)
                    : isCurrent && !isDelivered
                    ? formatDate(shipment.createdAt as unknown as string, locale)
                    : null;

                  return (
                    <div key={step.status} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            'h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold border-2 transition-all',
                            isCompleted
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'bg-background border-muted-foreground/30 text-muted-foreground',
                            isCurrent && !isDelivered && 'ring-4 ring-primary/20 animate-pulse'
                          )}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <span>{idx + 1}</span>
                          )}
                        </div>
                        {idx < STEPS.length - 1 && (
                          <div
                            className={cn(
                              'w-0.5 flex-1 min-h-[24px] transition-colors',
                              idx < currentStepIdx ? 'bg-primary' : 'bg-muted-foreground/20'
                            )}
                          />
                        )}
                      </div>
                      <div className="pb-5 flex-1 min-w-0">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            isCurrent ? 'text-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {t(step.vi, step.en)}
                        </p>
                        {stepTimestamp && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {stepTimestamp}
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

        {/* ============================================ */}
        {/* Shop Info Card */}
        {/* ============================================ */}
        {shipment.order?.shop && (
          <Card className="rounded-xl">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold">{shipment.order?.shop?.name}</h3>

              {/* Call button */}
              <button
                className="flex items-center gap-2 w-full h-12 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-medium text-sm px-4 active:scale-[0.98] transition-transform"
                onClick={() => window.open(`tel:${shipment.order?.shop?.phone ?? ''}`, '_self')}
              >
                <Phone className="h-5 w-5" />
                {shipment.order?.shop?.phone}
                <span className="ml-auto text-xs">{t('Gọi ngay', 'Call now')}</span>
              </button>

              {/* Address */}
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  {shipment.dropoffAddress}
                  {shipment.order?.shop?.district && `, ${shipment.order.shop.district}`}
                </p>
              </div>

              {/* Map placeholder */}
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-20 rounded-xl bg-muted/50 border border-dashed border-muted-foreground/30 text-sm text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                {t('Mở bản đồ', 'Open Map')}
              </a>
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* Order Items Card */}
        {/* ============================================ */}
        {shipment.order && shipment.order.items && shipment.order.items.length > 0 && (() => {
          const order = shipment.order;
          return (
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  {t('Hàng hóa', 'Items')} ({order.items.length})
                </h3>
                {order.orderTotal != null && (
                  <span className="ml-auto text-sm font-bold text-primary">
                    {order.orderTotalFormatted || formatVND(order.orderTotal)}
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                {order.items.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm">
                      <div className="flex-1 min-w-0 mr-2">
                        <p className="font-medium truncate">{item.productName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{item.productSku}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-medium">{formatVND(item.totalPrice)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatVND(item.unitPrice)} × {item.quantity}
                        </p>
                      </div>
                    </div>
                    {idx < order.items.length - 1 && (
                      <Separator className="mt-2.5" />
                    )}
                  </div>
                ))}
              </div>

              {/* COD highlight */}
              {isCod && order.orderTotal != null && (
                <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                      {t('Thu tiền mặt (COD)', 'Cash on Delivery (COD)')}
                    </p>
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                      {order.orderTotalFormatted || formatVND(order.orderTotal)}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          );
        })()}

        {/* ============================================ */}
        {/* POD Section — only when IN_TRANSIT */}
        {/* ============================================ */}
        {isInTransit && (
          <Card className="rounded-xl border-primary/30">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h3 className="text-sm font-bold text-green-700 dark:text-green-400">
                  {t('Xác nhận giao hàng', 'Confirm Delivery')}
                </h3>
              </div>

              {/* OTP Input */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t('Mã OTP xác nhận (6 số)', 'Verification OTP (6 digits)')}
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="h-14 text-center text-2xl font-mono tracking-[0.5em] rounded-xl"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {t('Nhập mã OTP từ khách hàng', 'Enter OTP from the customer')}
                </p>
              </div>

              {/* Photo capture */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t('Ảnh giao hàng', 'Delivery Photo')}
                </label>
                {podPhotoUrl ? (
                  <div className="relative rounded-xl overflow-hidden border">
                    <img src={podPhotoUrl} alt="POD" className="w-full h-48 object-cover" />
                    <button
                      onClick={() => setPodPhotoUrl(null)}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 flex items-center justify-center text-white"
                    >
                      ×
                    </button>
                    <div className="absolute bottom-2 left-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-600 text-white text-[10px] font-medium">
                        <CheckCircle2 className="h-3 w-3" /> {t('Đã chụp', 'Captured')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => document.getElementById('pod-photo-input')?.click()}
                    className="w-full h-40 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors active:bg-muted/50"
                  >
                    <Camera className="h-8 w-8" />
                    <span className="text-sm font-medium">
                      {t('Chụp ảnh giao hàng', 'Take delivery photo')}
                    </span>
                  </button>
                )}
                <input
                  id="pod-photo-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePodPhotoCapture}
                />
              </div>

              {/* Note */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {t('Ghi chú (tùy chọn)', 'Note (optional)')}
                </label>
                <Textarea
                  placeholder={t('Nhập ghi chú...', 'Enter note...')}
                  value={podNote}
                  onChange={(e) => setPodNote(e.target.value)}
                  className="rounded-xl min-h-[60px] resize-none"
                  rows={2}
                />
              </div>

              {/* Submit POD button */}
              <Button
                className="w-full h-14 rounded-xl text-base font-bold bg-green-600 hover:bg-green-700 text-white"
                onClick={handleSubmitPod}
                disabled={submittingPod || otpCode.length < 6}
              >
                {submittingPod ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                )}
                {t('Xác nhận đã giao', 'Confirm Delivered')}
              </Button>
              {otpCode.length < 6 && (
                <p className="text-[10px] text-center text-muted-foreground">
                  {t('Nhập đủ 6 số OTP để xác nhận', 'Enter all 6 OTP digits to confirm')}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* ============================================ */}
        {/* Issue Report Section — not when DELIVERED */}
        {/* ============================================ */}
        {!isDelivered && (
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-900/20 dark:text-red-400 dark:hover:text-red-300"
            onClick={() => setIssueDialogOpen(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            {t('Báo cáo vấn đề', 'Report Issue')}
          </Button>
        )}

        {/* POD data if already delivered */}
        {isDelivered && shipment.podPhotoUrl && (
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-2">{t('Xác nhận giao hàng (POD)', 'Proof of Delivery')}</h3>
              <img src={shipment.podPhotoUrl} alt="POD" className="w-full h-48 object-cover rounded-lg" />
              {shipment.podOtp && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  OTP: <span className="font-mono font-bold">{shipment.podOtp}</span>
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* ============================================ */}
      {/* Issue Report Dialog */}
      {/* ============================================ */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {t('Báo cáo vấn đề', 'Report Issue')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Issue type selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {t('Loại vấn đề', 'Issue Type')}
              </label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder={t('Chọn loại vấn đề', 'Select issue type')} />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((it) => (
                    <SelectItem key={it.value} value={it.value}>
                      {locale === 'vi' ? it.vi : it.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {t('Mô tả chi tiết', 'Description')}
              </label>
              <Textarea
                placeholder={t('Mô tả vấn đề bạn gặp phải...', 'Describe the issue you encountered...')}
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                className="rounded-xl min-h-[80px] resize-none"
                rows={3}
              />
            </div>

            {/* Photo */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {t('Ảnh minh chứng', 'Photo Evidence')}
              </label>
              {issuePhotoUrl ? (
                <div className="relative rounded-xl overflow-hidden border">
                  <img src={issuePhotoUrl} alt="Issue" className="w-full h-40 object-cover" />
                  <button
                    onClick={() => setIssuePhotoUrl(null)}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 flex items-center justify-center text-white"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => issueFileRef.current?.click()}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-xs font-medium">
                    {t('Chụp ảnh minh chứng', 'Take evidence photo')}
                  </span>
                </button>
              )}
              <input
                ref={issueFileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleIssuePhotoCapture}
              />
            </div>

            {/* Submit */}
            <Button
              className="w-full h-12 rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white"
              onClick={handleSubmitIssue}
              disabled={submittingIssue || !issueType}
            >
              {submittingIssue ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-2" />
              )}
              {t('Gửi báo cáo', 'Submit Report')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}