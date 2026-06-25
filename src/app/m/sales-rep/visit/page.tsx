'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Phone,
  MapPin,
  Navigation,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Timer,
  ShoppingCart,
  LogOut,
  StickyNote,
  FileText,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface ShopData {
  id: string;
  name: string;
  phone?: string;
  address: string;
  district: string;
  province: string;
}

interface CheckInResponse {
  visitId: string;
  checkedInAt: string;
}

interface CheckOutResponse {
  visitId: string;
  checkedOutAt: string;
}

// ============================================
// Visit / Check-in Page (wrapped in Suspense for useSearchParams)
// ============================================

function VisitPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopId = searchParams.get('shopId') || '';
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  // Shop data
  const [shop, setShop] = useState<ShopData | null>(null);
  const [loadingShop, setLoadingShop] = useState(true);
  const [shopError, setShopError] = useState('');

  // Check-in state
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState(false);
  const [visitId, setVisitId] = useState('');

  // Timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Notes
  const [note, setNote] = useState('');
  const [currentNotes, setCurrentNotes] = useState('');

  // GPS
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Check-out dialog
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderAmount, setOrderAmount] = useState('');
  const [checkoutNote, setCheckoutNote] = useState('');

  // Success animation
  const [showSuccess, setShowSuccess] = useState(false);

  // ---- Fetch Shop Info ----
  const fetchShop = useCallback(async () => {
    if (!shopId) {
      setShopError(t('Không tìm thấy shopId', 'Shop ID not found'));
      setLoadingShop(false);
      return;
    }
    setLoadingShop(true);
    try {
      const res = await api.get<ShopData>(`/shops/${shopId}`);
      if (res.success && res.data) {
        setShop(res.data);
      } else {
        setShopError(res.error?.message || t('Không tìm thấy cửa hàng', 'Shop not found'));
      }
    } catch {
      setShopError(t('Lỗi kết nối mạng', 'Network error'));
    } finally {
      setLoadingShop(false);
    }
  }, [shopId, locale, t]);

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

  // ---- Mock GPS ----
  useEffect(() => {
    setGpsStatus('loading');
    // Simulate GPS acquisition
    const timer = setTimeout(() => {
      setGpsCoords({ lat: 10.8231 + (Math.random() * 0.01 - 0.005), lng: 106.6297 + (Math.random() * 0.01 - 0.005) });
      setGpsStatus('ready');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // ---- Timer ----
  useEffect(() => {
    if (checkedIn && checkInTime) {
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - checkInTime.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [checkedIn, checkInTime]);

  // Format duration
  const formatDuration = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ---- Check-in ----
  const handleCheckIn = async () => {
    if (!shopId) return;
    setCheckInLoading(true);
    try {
      const res = await api.post<CheckInResponse>('/sales-rep/check-in', {
        shopId,
        note: note.trim() || undefined,
        latitude: gpsCoords?.lat || 0,
        longitude: gpsCoords?.lng || 0,
      });
      if (res.success && res.data) {
        setCheckedIn(true);
        setVisitId(res.data.visitId);
        setCheckInTime(new Date(res.data.checkedInAt));
        setCurrentNotes(note);
      }
    } catch {
      // silent
    } finally {
      setCheckInLoading(false);
    }
  };

  // ---- Check-out ----
  const handleCheckOut = async () => {
    if (!shopId) return;
    setCheckOutLoading(true);
    try {
      const res = await api.post<CheckOutResponse>('/sales-rep/check-out', {
        shopId,
        note: checkoutNote.trim() || undefined,
        orderPlaced,
        orderAmount: orderPlaced && orderAmount ? parseFloat(orderAmount) : undefined,
        orderId: undefined,
      });
      if (res.success) {
        setShowCheckOutDialog(false);
        setShowSuccess(true);
        // Navigate back after animation
        setTimeout(() => {
          router.back();
        }, 2500);
      }
    } catch {
      // silent
    } finally {
      setCheckOutLoading(false);
    }
  };

  // ---- Loading State ----
  if (loadingShop) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Thăm khách hàng', 'Visit Shop')} showBack showNotifications={false} />
        <main className="px-4 pb-24 pt-2">
          <Skeleton className="h-28 rounded-xl mb-4" />
          <Skeleton className="h-14 w-full rounded-xl mb-4" />
          <Skeleton className="h-24 w-full rounded-xl mb-4" />
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  // ---- Error State ----
  if (shopError || !shop) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Thăm khách hàng', 'Visit Shop')} showBack showNotifications={false} />
        <main className="px-4 pb-24 pt-2">
          <div className="text-center py-16">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive/50" />
            <h3 className="text-lg font-semibold mb-2">{t('Lỗi', 'Error')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{shopError || t('Không tìm thấy cửa hàng', 'Shop not found')}</p>
            <Button variant="outline" onClick={() => router.back()}>
              {t('Quay lại', 'Go Back')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // ---- Success Animation ----
  if (showSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-[fadeIn_0.5s_ease-out]">
          <div className="h-20 w-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 animate-[scaleIn_0.5s_ease-out]">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-emerald-700 mb-1">
            {t('Hoàn thành thăm!', 'Visit Complete!')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(`${formatDuration(elapsedSeconds)} tại ${shop.name}`, `${formatDuration(elapsedSeconds)} at ${shop.name}`)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Thăm khách hàng', 'Visit Shop')} showBack showNotifications={false} />

      <main className="px-4 pb-24 pt-2">
        {/* Shop Info Card */}
        <Card className="rounded-xl mb-4 border-primary/20 bg-primary/[0.02]">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h2 className="text-base font-bold leading-tight flex-1 pr-2">{shop.name}</h2>
              {shop.phone && (
                <a
                  href={`tel:${shop.phone}`}
                  className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
            </div>
            <div className="flex items-start gap-1.5 mb-1">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {shop.address}{shop.district ? `, ${shop.district}` : ''}{shop.province ? `, ${shop.province}` : ''}
              </p>
            </div>
            {checkedIn && (
              <Badge variant="outline" className="mt-2 text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t('Đang thăm', 'Visiting')}
              </Badge>
            )}
          </CardContent>
        </Card>

        {!checkedIn ? (
          /* ============ PRE CHECK-IN ============ */
          <>
            {/* GPS Display */}
            <Card className="rounded-xl mb-4">
              <CardContent className="p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Navigation className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">{t('Vị trí GPS', 'GPS Location')}</span>
                </div>
                {gpsStatus === 'loading' ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{t('Đang lấy vị trí...', 'Getting location...')}</span>
                  </div>
                ) : gpsStatus === 'ready' && gpsCoords ? (
                  <p className="text-xs font-mono text-foreground">
                    {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}
                  </p>
                ) : (
                  <p className="text-xs text-destructive">{t('Không lấy được vị trí', 'Unable to get location')}</p>
                )}
              </CardContent>
            </Card>

            {/* Note Input */}
            <div className="mb-5">
              <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" />
                {t('Ghi chú thăm', 'Visit Notes')}
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('Nhập ghi chú (không bắt buộc)...', 'Enter notes (optional)...')}
                rows={3}
                className="rounded-xl text-sm resize-none"
              />
            </div>

            {/* Check-in Button */}
            <Button
              size="lg"
              className="w-full h-14 text-sm font-semibold gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleCheckIn}
              disabled={checkInLoading}
            >
              {checkInLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Navigation className="h-5 w-5" />
              )}
              {t('Check-in', 'Check-in')}
            </Button>
          </>
        ) : (
          /* ============ POST CHECK-IN ============ */
          <>
            {/* Timer Card */}
            <Card className="rounded-xl mb-4 bg-primary/[0.02] border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">{t('Thời gian thăm', 'Visit Duration')}</span>
                </div>
                <p className="text-3xl font-bold font-mono tracking-wider text-center text-primary">
                  {formatDuration(elapsedSeconds)}
                </p>
                {checkInTime && (
                  <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                    {t('Check-in lúc ', 'Checked in at ')}
                    {checkInTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Current Notes */}
            {currentNotes && (
              <Card className="rounded-xl mb-4">
                <CardContent className="p-3.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">{t('Ghi chú', 'Notes')}</span>
                  </div>
                  <p className="text-sm text-foreground">{currentNotes}</p>
                </CardContent>
              </Card>
            )}

            {/* Create Order Button */}
            <Button
              variant="outline"
              size="lg"
              className="w-full h-12 text-sm font-medium gap-2 rounded-xl mb-3"
              onClick={() => router.push(`/m/products?shopId=${shopId}`)}
            >
              <ShoppingCart className="h-4 w-4" />
              {t('Tạo đơn hàng', 'Create Order')}
            </Button>

            {/* Check-out Button */}
            <Dialog open={showCheckOutDialog} onOpenChange={setShowCheckOutDialog}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  className="w-full h-12 text-sm font-semibold gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                >
                  <LogOut className="h-4 w-4" />
                  {t('Check-out', 'Check-out')}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[calc(100vw-2rem)] mx-auto rounded-xl p-4">
                <DialogHeader>
                  <DialogTitle className="text-base">{t('Kết thúc thăm', 'End Visit')}</DialogTitle>
                </DialogHeader>

                {/* Visit summary */}
                <div className="bg-muted/50 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium">{shop.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{shop.district}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Timer className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-mono font-semibold text-primary">{formatDuration(elapsedSeconds)}</span>
                  </div>
                </div>

                {/* Order placed toggle */}
                <div className="mb-4">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <div
                      className={cn(
                        'h-5 w-9 rounded-full transition-colors relative cursor-pointer',
                        orderPlaced ? 'bg-primary' : 'bg-muted'
                      )}
                      onClick={() => setOrderPlaced(!orderPlaced)}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
                          orderPlaced ? 'translate-x-4' : 'translate-x-0.5'
                        )}
                      />
                    </div>
                    <span className="text-sm font-medium">{t('Đã đặt hàng', 'Order Placed')}</span>
                  </label>

                  {orderPlaced && (
                    <div className="mt-2.5 ml-7.5">
                      <Input
                        type="number"
                        placeholder={t('Số tiền (₫)', 'Amount (₫)')}
                        value={orderAmount}
                        onChange={(e) => setOrderAmount(e.target.value)}
                        className="rounded-lg text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Checkout note */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                    {t('Ghi chú check-out', 'Check-out Notes')}
                  </label>
                  <Textarea
                    value={checkoutNote}
                    onChange={(e) => setCheckoutNote(e.target.value)}
                    placeholder={t('Nhập ghi chú (không bắt buộc)...', 'Enter notes (optional)...')}
                    rows={2}
                    className="rounded-lg text-sm resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-11 rounded-xl"
                    onClick={() => setShowCheckOutDialog(false)}
                  >
                    {t('Hủy', 'Cancel')}
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleCheckOut}
                    disabled={checkOutLoading}
                  >
                    {checkOutLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                    {t('Xác nhận', 'Confirm')}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </main>
    </div>
  );
}

export default function SalesRepVisitPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background">
        <div className="px-4 pt-4 space-y-4">
          <div className="h-6 w-40 bg-muted animate-pulse rounded" />
          <div className="h-32 w-full bg-muted animate-pulse rounded-xl" />
          <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    }>
      <VisitPageContent />
    </Suspense>
  );
}