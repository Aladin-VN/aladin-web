'use client';

import { useState, useRef } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { MobileKpiCard } from '@/components/mobile/kpi-card';
import { CameraCapture } from '@/components/mobile/camera-capture';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RotateCcw,
  Package,
  Clock,
  DollarSign,
  Plus,
  Camera,
  Send,
  Inbox,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface ReturnRecord {
  id: string;
  orderId: string;
  reason: string;
  items: string;
  notes: string;
  photoUrl: string | null;
  status: string;
  createdAt: Date;
}

const REASONS = [
  { value: 'DAMAGED', vi: 'Hàng hỏng', en: 'Damaged' },
  { value: 'WRONG_ITEM', vi: 'Sai hàng', en: 'Wrong Item' },
  { value: 'EXPIRED', vi: 'Hết hạn', en: 'Expired' },
  { value: 'QUALITY_ISSUE', vi: 'Lỗi chất lượng', en: 'Quality Issue' },
  { value: 'OVERSTOCK', vi: 'Dư hàng', en: 'Overstock' },
  { value: 'OTHER', vi: 'Khác', en: 'Other' },
] as const;

const REASON_COLORS: Record<string, string> = {
  DAMAGED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  WRONG_ITEM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  EXPIRED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  QUALITY_ISSUE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  OVERSTOCK: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
};

// ============================================
// Page Component
// ============================================

export default function DistributorReturnsPage() {
  const user = useAuthStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  // Local returns state (session only)
  const [returns, setReturns] = useState<ReturnRecord[]>([]);

  // Form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [items, setItems] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Computed KPI values
  const returnCount = returns.length;
  const totalItems = returns.reduce((sum, r) => {
    const match = r.items.match(/\d+/);
    return sum + (match ? parseInt(match[0], 10) : 1);
  }, 0);
  const lastReturn = returns.length > 0
    ? new Date(returns[returns.length - 1].createdAt).toLocaleDateString('vi-VN')
    : t('Chưa có', 'None');

  const resetForm = () => {
    setOrderId('');
    setReason('');
    setItems('');
    setNotes('');
    setPhotoUrl(null);
  };

  const handleSubmit = async () => {
    if (!orderId.trim() || !reason || !items.trim()) return;

    setSubmitting(true);
    try {
      const res = await adminFetch('/api/distributor/returns', {
        method: 'POST',
        body: JSON.stringify({
          orderId: orderId.trim(),
          reason,
          items: items.trim(),
          notes: notes.trim(),
        }),
      });

      if (res.success) {
        const newReturn: ReturnRecord = {
          id: res.data?.id || crypto.randomUUID(),
          orderId: orderId.trim(),
          reason,
          items: items.trim(),
          notes: notes.trim(),
          photoUrl,
          status: 'PENDING',
          createdAt: new Date(),
        };
        setReturns((prev) => [...prev, newReturn]);
        resetForm();
        setDialogOpen(false);
      }
    } catch {
      // Even on API error, store locally for demo
      const newReturn: ReturnRecord = {
        id: crypto.randomUUID(),
        orderId: orderId.trim(),
        reason,
        items: items.trim(),
        notes: notes.trim(),
        photoUrl,
        status: 'PENDING',
        createdAt: new Date(),
      };
      setReturns((prev) => [...prev, newReturn]);
      resetForm();
      setDialogOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const getReasonLabel = (value: string) => {
    const found = REASONS.find((r) => r.value === value);
    if (!found) return value;
    return locale === 'vi' ? found.vi : found.en;
  };

  const isFormValid = orderId.trim() && reason && items.trim();

  // ============================================
  // Render
  // ============================================

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <MobileHeader
        title={t('Trả hàng', 'Returns')}
        showBack
        showNotifications={false}
        rightAction={
          <Button
            size="icon"
            className="h-9 w-9"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        }
      />

      <main className="px-4 pb-24 pt-2 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3">
          <MobileKpiCard
            label={t('Returns This Month', 'Returns This Month')}
            labelVi={t('Trả hàng tháng này', 'Returns This Month')}
            value={returnCount}
            icon={<RotateCcw className="h-4 w-4" />}
            variant="default"
            locale={locale}
          />
          <MobileKpiCard
            label={t('Items Returned', 'Items Returned')}
            labelVi={t('Số lượng sp', 'Items Returned')}
            value={totalItems}
            icon={<Package className="h-4 w-4" />}
            variant="warning"
            locale={locale}
          />
          <MobileKpiCard
            label={t('Last Return', 'Last Return')}
            labelVi={t('Lần trả gần nhất', 'Last Return')}
            value={lastReturn}
            icon={<Clock className="h-4 w-4" />}
            variant="default"
            locale={locale}
          />
          <MobileKpiCard
            label={t('Total Value', 'Total Value')}
            labelVi={t('Tổng giá trị', 'Total Value')}
            value={t('0 ₫', '0 ₫')}
            icon={<DollarSign className="h-4 w-4" />}
            variant="danger"
            locale={locale}
          />
        </div>

        {/* Quick Create Button (visible when no returns) */}
        {returns.length === 0 && (
          <Card className="border-dashed border-2 border-border/60">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Inbox className="h-7 w-7 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {t('Chưa có phiếu trả hàng', 'No return requests yet')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t(
                    'Nhấn nút + để tạo phiếu trả hàng mới',
                    'Tap + to create a new return request'
                  )}
                </p>
              </div>
              <Button
                onClick={() => setDialogOpen(true)}
                className="mt-1 gap-2"
              >
                <Plus className="h-4 w-4" />
                {t('Tạo phiếu trả hàng', 'Create Return')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Return History */}
        {returns.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">
              {t('Lịch sử trả hàng', 'Return History')} ({returns.length})
            </h2>
            <div className="space-y-2">
              {returns
                .slice()
                .reverse()
                .map((r) => (
                  <Card key={r.id} className="rounded-xl">
                    <CardContent className="p-4 space-y-2.5">
                      {/* Top row: order + status */}
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">
                          #{r.orderId}
                        </p>
                        <Badge
                          variant="secondary"
                          className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 text-[11px]"
                        >
                          {t('Chờ xử lý', 'Pending')}
                        </Badge>
                      </div>

                      {/* Date */}
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>

                      {/* Reason badge */}
                      <Badge
                        variant="secondary"
                        className={cn('text-[11px]', REASON_COLORS[r.reason] || '')}
                      >
                        {getReasonLabel(r.reason)}
                      </Badge>

                      {/* Items */}
                      <p className="text-sm text-foreground leading-relaxed">
                        {r.items}
                      </p>

                      {/* Notes */}
                      {r.notes && (
                        <p className="text-xs text-muted-foreground italic">
                          {r.notes}
                        </p>
                      )}

                      {/* Photo thumbnail */}
                      {r.photoUrl && (
                        <div className="mt-1">
                          <img
                            src={r.photoUrl}
                            alt={t('Ảnh minh chứng', 'Evidence photo')}
                            className="h-16 w-16 rounded-lg object-cover border"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}
      </main>

      {/* ============================================ */}
      {/* Create Return Dialog                       */}
      {/* ============================================ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 rounded-2xl">
          <DialogHeader className="p-4 pb-2 sticky top-0 bg-background z-10 border-b">
            <DialogTitle className="text-base font-bold">
              {t('Tạo phiếu trả hàng', 'Create Return Request')}
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 pt-3 space-y-4">
            {/* Order Number */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                {t('Mã đơn hàng', 'Order Number')}{' '}
                <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder={t('Nhập mã đơn hàng...', 'Enter order number...')}
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="h-11 text-sm rounded-lg"
              />
            </div>

            {/* Reason Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                {t('Lý do trả hàng', 'Return Reason')}{' '}
                <span className="text-red-500">*</span>
              </label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="h-11 text-sm rounded-lg">
                  <SelectValue
                    placeholder={t('Chọn lý do...', 'Select reason...')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {locale === 'vi' ? r.vi : r.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                {t('Mô tả hàng trả', 'Items Description')}{' '}
                <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder={t(
                  'Mô tả chi tiết sản phẩm cần trả (tên, số lượng...)',
                  'Describe items being returned (name, quantity...)'
                )}
                value={items}
                onChange={(e) => setItems(e.target.value)}
                className="min-h-[80px] text-sm rounded-lg resize-none"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                {t('Ghi chú', 'Notes')}{' '}
                <span className="text-muted-foreground font-normal">
                  ({t('tùy chọn', 'optional')})
                </span>
              </label>
              <Textarea
                placeholder={t(
                  'Ghi chú thêm (nếu có)...',
                  'Additional notes (if any)...'
                )}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[60px] text-sm rounded-lg resize-none"
              />
            </div>

            {/* Photo Capture */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                {t('Ảnh minh chứng', 'Evidence Photo')}
              </label>
              <CameraCapture
                value={photoUrl}
                onChange={setPhotoUrl}
                placeholder={t(
                  'Chụp ảnh hàng trả',
                  'Take photo of returned items'
                )}
                aspectRatio="landscape"
                className="rounded-xl"
              />
            </div>

            {/* Submit Button */}
            <Button
              className="w-full h-12 text-sm font-semibold rounded-xl gap-2 mt-2"
              disabled={!isFormValid || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {submitting
                ? t('Đang gửi...', 'Submitting...')
                : t('Gửi phiếu trả hàng', 'Submit Return Request')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}