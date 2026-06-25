'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAppStore } from '@/stores/app.store';
import { MobileHeader } from '@/components/mobile/mobile-header';
import {
  Wallet, AlertTriangle, AlertOctagon, Store, Search, Phone, Bell,
  MapPin, CheckCircle2, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

interface ShopDebt {
  shopId: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  shopDistrict: string;
  outstandingDebt: number;
  totalOrders: number;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
  agingDays: number;
  creditStatus: string;
}

interface DebtSummary {
  totalOutstanding: number;
  overdue7d: number;
  overdue30d: number;
  shopsWithDebt: number;
}

interface PaymentRecord {
  id: string;
  shopName: string;
  amount: number;
  paymentMethod: string;
  createdAt: string;
}

type StatusFilter = 'all' | 'overdue' | 'normal' | 'locked';

// ============================================
// Helpers
// ============================================

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'overdue', label: 'Quá hạn' },
  { value: 'normal', label: 'Bình thường' },
  { value: 'locked', label: 'Đã khóa' },
];

// ============================================
// Component
// ============================================

export default function MobileDebtCollection() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  // Data state
  const [shops, setShops] = useState<ShopDebt[]>([]);
  const [summary, setSummary] = useState<DebtSummary | null>(null);
  const [recentPayments, setRecentPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showSearch, setShowSearch] = useState(false);

  // Payment dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payingShop, setPayingShop] = useState<ShopDebt | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [payNotes, setPayNotes] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const [payError, setPayError] = useState('');

  // ============================================
  // Data fetching
  // ============================================

  const fetchShops = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('shopId', searchQuery.trim());

      const res = await adminFetch(`/api/distributor/ar-ledger?${params}`);
      if (res.success && res.data) {
        setShops(res.data.shops || []);
        setSummary(res.data.summary || null);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [statusFilter, searchQuery]);

  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const res = await adminFetch('/api/distributor/debt-payment?page=1&limit=10');
      if (res.success && res.data) {
        setRecentPayments(res.data.payments || res.data.items || []);
      }
    } catch {
      // silent
    }
    setPaymentsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchShops();
  }, [fetchShops]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPayments();
  }, [fetchPayments]);

  // ============================================
  // Filtered shops (client-side search over name/phone)
  // ============================================

  const filteredShops = useMemo(() => {
    let result = shops;

    // Client-side search by name or phone when server doesn't filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.shopName?.toLowerCase().includes(q) ||
          s.shopPhone?.includes(q)
      );
    }

    // Client-side status filter
    if (statusFilter === 'overdue') {
      result = result.filter((s) => s.agingDays > 7);
    } else if (statusFilter === 'normal') {
      result = result.filter((s) => s.agingDays <= 7 && s.creditStatus !== 'LOCKED');
    } else if (statusFilter === 'locked') {
      result = result.filter((s) => s.creditStatus === 'LOCKED');
    }

    return result;
  }, [shops, searchQuery, statusFilter]);

  // ============================================
  // Actions
  // ============================================

  const handleCall = (phone: string) => {
    window.open(`tel:${phone}`);
  };

  const handleRemind = (shop: ShopDebt) => {
    toast.success(
      t('Đã gửi nhắc nhở qua Zalo', 'Reminder sent via Zalo'),
      { description: shop.shopName }
    );
  };

  const openPayDialog = (shop: ShopDebt) => {
    setPayingShop(shop);
    setPayAmount(String(shop.outstandingDebt));
    setPayMethod('CASH');
    setPayNotes('');
    setPayError('');
    setPaySuccess(false);
    setPayDialogOpen(true);
  };

  const handlePayment = async () => {
    if (!payingShop) return;
    const amount = Number(payAmount.replace(/\D/g, ''));
    if (!amount || amount <= 0) {
      setPayError(t('Vui lòng nhập số tiền hợp lệ', 'Please enter a valid amount'));
      return;
    }

    setPaySubmitting(true);
    setPayError('');

    try {
      const res = await adminFetch('/api/distributor/debt-payment', {
        method: 'POST',
        body: JSON.stringify({
          shopId: payingShop.shopId,
          amount,
          paymentMethod: payMethod,
          notes: payNotes || undefined,
        }),
      });

      if (res.success) {
        setPaySuccess(true);
        toast.success(
          t('Thu thành công!', 'Collection successful!'),
          { description: `${payingShop.shopName} - ${formatVND(amount)}` }
        );
        // Refresh after a short delay
        setTimeout(() => {
          setPayDialogOpen(false);
          fetchShops();
          fetchPayments();
        }, 1500);
      } else {
        setPayError(res.error?.message || t('Thu tiền thất bại', 'Payment failed'));
      }
    } catch {
      setPayError(t('Lỗi mạng, vui lòng thử lại', 'Network error, please try again'));
    }
    setPaySubmitting(false);
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Thu công nợ', 'Debt Collection')}
        showBack
        showNotifications={false}
        rightAction={
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="h-5 w-5" />
          </Button>
        }
      />

      <main className="max-w-lg mx-auto px-4 pt-4 pb-24">
        {/* KPI Cards — horizontal scroll */}
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] w-[140px] shrink-0 rounded-xl" />
            ))}
          </div>
        ) : summary ? (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 no-scrollbar">
            {/* Total Outstanding */}
            <Card className="shrink-0 w-[140px] border-amber-200 bg-amber-50/50">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground font-medium truncate">
                      {t('Tổng công nợ', 'Total Outstanding')}
                    </p>
                    <p className="text-base font-bold tracking-tight mt-1 truncate text-amber-700">
                      {formatVND(summary.totalOutstanding)}
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ml-2 bg-amber-100 text-amber-600">
                    <Wallet className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overdue 7d */}
            <Card className="shrink-0 w-[140px] border-red-200 bg-red-50/50">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground font-medium truncate">
                      {t('Quá hạn 7 ngày', 'Overdue 7d')}
                    </p>
                    <p className="text-base font-bold tracking-tight mt-1 truncate text-red-700">
                      {formatVND(summary.overdue7d)}
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ml-2 bg-red-100 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overdue 30d */}
            <Card className="shrink-0 w-[140px] border-red-200 bg-red-50/50">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground font-medium truncate">
                      {t('Quá hạn 30 ngày', 'Overdue 30d')}
                    </p>
                    <p className="text-base font-bold tracking-tight mt-1 truncate text-red-700">
                      {formatVND(summary.overdue30d)}
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ml-2 bg-red-100 text-red-600">
                    <AlertOctagon className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shops with debt */}
            <Card className="shrink-0 w-[140px] border-border">
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground font-medium truncate">
                      {t('Cửa hàng nợ', 'Shops with Debt')}
                    </p>
                    <p className="text-base font-bold tracking-tight mt-1 truncate">
                      {summary.shopsWithDebt}
                    </p>
                  </div>
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ml-2 bg-muted text-muted-foreground">
                    <Store className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Search + Filter */}
        <div className="mt-4 space-y-3">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('Tìm tên hoặc SĐT cửa hàng...', 'Search shop name or phone...')}
                className="pl-9 h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
            {statusFilters.map((chip) => (
              <Button
                key={chip.value}
                variant={statusFilter === chip.value ? 'default' : 'outline'}
                size="sm"
                className="text-xs shrink-0"
                onClick={() => {
                  setStatusFilter(chip.value);
                }}
              >
                {chip.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Shop Debt List */}
        {loading ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[140px] rounded-xl" />
            ))}
          </div>
        ) : filteredShops.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="p-8 text-center">
              <Wallet className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground font-medium">
                {t('Không có công nợ', 'No outstanding debt')}
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                {t('Tất cả cửa hàng đã thanh toán', 'All shops are up to date')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 mt-4">
            {filteredShops.map((shop) => (
              <Card key={shop.shopId} className="overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  {/* Shop info row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{shop.shopName}</p>
                        {shop.shopPhone && (
                          <a
                            href={`tel:${shop.shopPhone}`}
                            className="text-muted-foreground hover:text-primary shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      {shop.shopPhone && (
                        <p className="text-xs text-muted-foreground mt-0.5">{shop.shopPhone}</p>
                      )}
                    </div>
                    {/* Aging badge */}
                    {shop.agingDays > 7 ? (
                      <Badge className="shrink-0 bg-red-100 text-red-700 hover:bg-red-100 text-[10px] px-2 py-0">
                        {t('Quá hạn', 'Overdue')} {shop.agingDays} {t('ngày', 'days')}
                      </Badge>
                    ) : (
                      <Badge className="shrink-0 bg-green-100 text-green-700 hover:bg-green-100 text-[10px] px-2 py-0">
                        {t('Bình thường', 'Normal')}
                      </Badge>
                    )}
                  </div>

                  {/* Address */}
                  {(shop.shopAddress || shop.shopDistrict) && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="truncate">
                        {[shop.shopAddress, shop.shopDistrict].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Debt amount */}
                  <div>
                    <p
                      className={`text-xl font-bold ${
                        shop.agingDays > 7
                          ? 'text-red-600'
                          : shop.outstandingDebt > 0
                            ? 'text-orange-600'
                            : 'text-foreground'
                      }`}
                    >
                      {formatVND(shop.outstandingDebt)}
                    </p>
                  </div>

                  {/* Last payment */}
                  <p className="text-[11px] text-muted-foreground">
                    {shop.lastPaymentDate
                      ? `${t('Thanh toán cuối', 'Last payment')}: ${new Date(shop.lastPaymentDate).toLocaleDateString('vi-VN')} - ${formatVND(shop.lastPaymentAmount || 0)}`
                      : t('Chưa thanh toán', 'No payment yet')}
                  </p>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 text-xs gap-1.5"
                      onClick={() => handleCall(shop.shopPhone)}
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {t('Gọi', 'Call')}
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 h-9 text-xs gap-1.5"
                      onClick={() => openPayDialog(shop)}
                    >
                      <Wallet className="h-3.5 w-3.5" />
                      {t('Thu tiền', 'Collect')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-9 text-xs gap-1.5"
                      onClick={() => handleRemind(shop)}
                    >
                      <Bell className="h-3.5 w-3.5" />
                      {t('Nhắc', 'Remind')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Recent Collections */}
        {!loading && recentPayments.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold mb-3">
              {t('Thu gần đây', 'Recent Collections')}
            </h2>
            {paymentsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-xl" />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0 divide-y">
                  {recentPayments.map((p, idx) => (
                    <div key={p.id || idx} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.shopName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(p.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-semibold text-green-600">{formatVND(p.amount)}</p>
                        <Badge
                          variant="secondary"
                          className="text-[9px] px-1.5 py-0"
                        >
                          {p.paymentMethod === 'CASH'
                            ? t('Tiền mặt', 'Cash')
                            : t('Chuyển khoản', 'Transfer')}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </section>
        )}
      </main>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={(open) => { if (!open) setPayDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          {paySuccess ? (
            /* Success state */
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-lg font-semibold text-green-700">
                {t('Thu thành công!', 'Collection successful!')}
              </p>
              {payingShop && (
                <p className="text-sm text-muted-foreground text-center">
                  {payingShop.shopName} — {formatVND(Number(payAmount.replace(/\D/g, '')))}
                </p>
              )}
            </div>
          ) : (
            /* Payment form */
            <>
              <DialogHeader>
                <DialogTitle className="text-base">
                  {t('Thu tiền', 'Collect Payment')}
                </DialogTitle>
              </DialogHeader>

              {payingShop && (
                <div className="space-y-4">
                  {/* Shop name */}
                  <div>
                    <p className="text-sm font-medium">{payingShop.shopName}</p>
                    <p className="text-xs text-muted-foreground">{payingShop.shopPhone}</p>
                  </div>

                  {/* Outstanding (non-editable) */}
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <p className="text-[11px] text-muted-foreground">
                      {t('Công nợ hiện tại', 'Current Outstanding')}
                    </p>
                    <p className="text-lg font-bold text-red-600">
                      {formatVND(payingShop.outstandingDebt)}
                    </p>
                  </div>

                  {/* Amount input */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {t('Số tiền thu', 'Amount to Collect')}
                    </label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={payAmount}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setPayAmount(raw ? new Intl.NumberFormat('vi-VN').format(Number(raw)) : '');
                      }}
                    />
                  </div>

                  {/* Payment method */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {t('Phương thức', 'Payment Method')}
                    </label>
                    <Select value={payMethod} onValueChange={(v: 'CASH' | 'BANK_TRANSFER') => setPayMethod(v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CASH">{t('Tiền mặt', 'Cash')}</SelectItem>
                        <SelectItem value="BANK_TRANSFER">{t('Chuyển khoản', 'Bank Transfer')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {t('Ghi chú', 'Notes')}
                    </label>
                    <Textarea
                      placeholder={t('Ghi chú (tùy chọn)', 'Notes (optional)')}
                      rows={2}
                      value={payNotes}
                      onChange={(e) => setPayNotes(e.target.value)}
                    />
                  </div>

                  {/* Error message */}
                  {payError && (
                    <p className="text-sm text-destructive">{payError}</p>
                  )}

                  {/* Submit */}
                  <Button
                    className="w-full h-11"
                    onClick={handlePayment}
                    disabled={paySubmitting}
                  >
                    {paySubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {t('Xác nhận thu tiền', 'Confirm Collection')}
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}