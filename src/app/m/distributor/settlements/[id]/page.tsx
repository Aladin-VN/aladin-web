'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAppStore } from '@/stores/app.store';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  DollarSign,
  Percent,
  Truck,
  Wallet,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Headphones,
  Download,
  Share2,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface SettlementLineItem {
  id: string;
  orderId: string;
  orderNumber: string;
  orderAmount: number;
  platformFee: number;
  deliveryFee: number;
  distributorAmount: number;
  driverAmount?: number;
  driverId?: string | null;
}

interface Settlement {
  id: string;
  settlementNumber: string;
  periodStart: string;
  periodEnd: string;
  totalOrders: number;
  totalOrderValue: number;
  totalPlatformFee: number;
  totalDeliveryFee: number;
  distributorPayout: number;
  driverPayouts: number;
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED';
  paidAt: string | null;
  paymentRef: string | null;
  notes: string | null;
  createdAt: string;
  lineItems?: SettlementLineItem[];
}

// ============================================
// Helpers
// ============================================

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const statusConfig: Record<
  string,
  { vi: string; en: string; color: string; icon: React.ElementType }
> = {
  PENDING: {
    vi: 'Chờ xử lý',
    en: 'Pending',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Clock,
  },
  PROCESSING: {
    vi: 'Đang xử lý',
    en: 'Processing',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Clock,
  },
  PAID: {
    vi: 'Đã thanh toán',
    en: 'Paid',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: CheckCircle2,
  },
  FAILED: {
    vi: 'Thất bại',
    en: 'Failed',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: XCircle,
  },
};

// ============================================
// Component
// ============================================

export default function DistributorSettlementDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch settlement by finding it in the list
  useEffect(() => {
    let cancelled = false;

    async function fetchSettlement() {
      setLoading(true);
      setError(null);
      try {
        const res = await adminFetch(
          `/api/distributor/settlements?limit=100`
        );
        if (res.success && res.data?.items) {
          const found = res.data.items.find(
            (s: Settlement) => s.id === id
          );
          if (!cancelled) {
            if (found) {
              setSettlement(found);
            } else {
              setError('NOT_FOUND');
            }
          }
        } else {
          if (!cancelled) setError('FETCH_ERROR');
        }
      } catch {
        if (!cancelled) setError('NETWORK_ERROR');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSettlement();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Status helpers
  const getStatus = () => statusConfig[settlement?.status || ''] || statusConfig.PENDING;
  const StatusIcon = getStatus().icon;

  // Actions
  const handleContactSupport = () => {
    toast({
      title: t('Liên hệ hỗ trợ', 'Contact Support'),
      description: t(
        'Yêu cầu hỗ trợ đã được gửi, chúng tôi sẽ liên hệ lại sớm.',
        'Support request sent, we will get back to you soon.'
      ),
    });
  };

  const handleDownloadReceipt = () => {
    toast({
      title: t('Tải biên lai', 'Download Receipt'),
      description: t(
        'Biên lai đang được chuẩn bị...',
        'Receipt is being prepared...'
      ),
    });
  };

  const handleShare = () => {
    toast({
      title: t('Chia sẻ', 'Share'),
      description: t(
        'Đã sao chép thông tin quyết toán.',
        'Settlement info copied to clipboard.'
      ),
    });
  };

  // ============================================
  // Loading state
  // ============================================
  if (loading) {
    return (
      <div className="pb-8">
        <MobileHeader
          title="..."
          showBack
          showNotifications={false}
        />
        <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  // ============================================
  // Error state
  // ============================================
  if (error === 'NOT_FOUND' || (!settlement && !loading)) {
    return (
      <div className="pb-8">
        <MobileHeader
          title={t('Quyết toán', 'Settlement')}
          showBack
          showNotifications={false}
        />
        <div className="max-w-lg mx-auto px-4 pt-16 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">
              {t('Không tìm thấy kỳ quyết toán', 'Settlement not found')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                'Kỳ quyết toán này có thể đã bị xóa hoặc không tồn tại.',
                'This settlement may have been deleted or does not exist.'
              )}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.back()}
            >
              {t('Quay lại', 'Go Back')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pb-8">
        <MobileHeader
          title={t('Quyết toán', 'Settlement')}
          showBack
          showNotifications={false}
        />
        <div className="max-w-lg mx-auto px-4 pt-16 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-base font-semibold text-foreground">
              {t('Đã xảy ra lỗi', 'An error occurred')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                'Không thể tải thông tin quyết toán. Vui lòng thử lại.',
                'Unable to load settlement details. Please try again.'
              )}
            </p>
            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => router.back()}
              >
                {t('Quay lại', 'Go Back')}
              </Button>
              <Button onClick={() => window.location.reload()}>
                {t('Thử lại', 'Retry')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // Main content
  // ============================================
  if (!settlement) return null;

  const status = getStatus();
  const items = settlement.lineItems || [];

  return (
    <div className="pb-8">
      <MobileHeader
        title={settlement.settlementNumber}
        showBack
        showNotifications={false}
      />

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* ---- Status Banner ---- */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <StatusIcon className="h-5 w-5" />
                <Badge
                  variant="outline"
                  className={cn(
                    'text-sm px-3 py-1 font-semibold',
                    status.color
                  )}
                >
                  {locale === 'vi' ? status.vi : status.en}
                </Badge>
              </div>
              {settlement.paidAt && (
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(settlement.paidAt)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {t('Từ', 'From')} {formatDate(settlement.periodStart)}{' '}
                — {t('Đến', 'to')} {formatDate(settlement.periodEnd)}
              </span>
            </div>
            {settlement.paymentRef && (
              <p className="text-xs text-muted-foreground mt-2">
                {t('Mã giao dịch', 'Ref')}: {settlement.paymentRef}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ---- Financial Summary (2x2 grid) ---- */}
        <div className="grid grid-cols-2 gap-3">
          {/* Total Revenue */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-green-700" />
                </div>
                <span className="text-xs text-muted-foreground leading-tight">
                  {t('Tổng doanh thu', 'Total Revenue')}
                </span>
              </div>
              <p className="text-base font-bold text-green-700">
                {formatVND(settlement.totalOrderValue)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {settlement.totalOrders} {t('đơn hàng', 'orders')}
              </p>
            </CardContent>
          </Card>

          {/* Platform Fee */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <Percent className="h-4 w-4 text-red-700" />
                </div>
                <span className="text-xs text-muted-foreground leading-tight">
                  {t('Phí nền tảng', 'Platform Fee')}
                </span>
              </div>
              <p className="text-base font-bold text-red-600">
                -{formatVND(settlement.totalPlatformFee)}
              </p>
            </CardContent>
          </Card>

          {/* Delivery Fees */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Truck className="h-4 w-4 text-orange-700" />
                </div>
                <span className="text-xs text-muted-foreground leading-tight">
                  {t('Phí vận chuyển', 'Delivery Fees')}
                </span>
              </div>
              <p className="text-base font-bold text-orange-600">
                -{formatVND(settlement.totalDeliveryFee)}
              </p>
            </CardContent>
          </Card>

          {/* Net Payout (highlighted) */}
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                  <Wallet className="h-4 w-4" />
                </div>
                <span className="text-xs text-primary-foreground/80 leading-tight">
                  {t('Thực nhận', 'Net Payout')}
                </span>
              </div>
              <p className="text-lg font-bold">
                {formatVND(settlement.distributorPayout)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ---- Orders Breakdown ---- */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold">
                {t('Chi tiết đơn hàng', 'Order Details')}{' '}
                <span className="text-muted-foreground font-normal">
                  ({settlement.totalOrders})
                </span>
              </h2>
            </div>

            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {t(
                  'Chi tiết đơn hàng sẽ được hiển thị khi kỳ quyết toán được xử lý.',
                  'Order details will appear when the settlement is processed.'
                )}
              </p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {items.map((item, index) => (
                  <div key={item.id}>
                    <button
                      className="w-full text-left py-3 flex items-center justify-between gap-2"
                      onClick={() =>
                        router.push(
                          `/m/distributor/orders/${item.orderId}`
                        )
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-medium truncate">
                            {item.orderNumber}
                          </p>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatVND(item.orderAmount)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-red-500">
                          -{formatVND(item.platformFee)}
                        </p>
                        <p className="text-sm font-bold text-green-700">
                          {formatVND(item.distributorAmount)}
                        </p>
                      </div>
                    </button>
                    {index < items.length - 1 && <Separator />}
                  </div>
                ))}

                {/* Summary row */}
                <Separator className="my-1" />
                <div className="flex items-center justify-between pt-3">
                  <p className="text-sm font-semibold">
                    {t('Tổng cộng', 'Total')}
                  </p>
                  <p className="text-base font-bold text-green-700">
                    {formatVND(settlement.distributorPayout)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---- Timeline ---- */}
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold mb-4">
              {t('Tiến trình', 'Timeline')}
            </h2>
            <div className="relative pl-6 space-y-6">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

              {/* Created */}
              <TimelineItem
                icon={
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                    <FileText className="h-3 w-3 text-primary-foreground" />
                  </div>
                }
                label={t('Tạo quyết toán', 'Settlement Created')}
                date={formatDateTime(settlement.createdAt)}
                active
              />

              {/* Processing */}
              <TimelineItem
                icon={
                  <div
                    className={cn(
                      'h-5 w-5 rounded-full flex items-center justify-center',
                      settlement.status !== 'PENDING'
                        ? 'bg-blue-500'
                        : 'bg-muted-foreground/20'
                    )}
                  >
                    <Clock
                      className={cn(
                        'h-3 w-3',
                        settlement.status !== 'PENDING'
                          ? 'text-white'
                          : 'text-muted-foreground/50'
                      )}
                    />
                  </div>
                }
                label={t('Đang xử lý', 'Processing')}
                date={
                  settlement.status !== 'PENDING'
                    ? t(
                        'Đang xử lý',
                        'In progress'
                      )
                    : t('Chờ xử lý', 'Pending')
                }
                active={settlement.status !== 'PENDING'}
              />

              {/* Paid */}
              <TimelineItem
                icon={
                  <div
                    className={cn(
                      'h-5 w-5 rounded-full flex items-center justify-center',
                      settlement.status === 'PAID'
                        ? 'bg-green-500'
                        : settlement.status === 'FAILED'
                          ? 'bg-red-500'
                          : 'bg-muted-foreground/20'
                    )}
                  >
                    {settlement.status === 'PAID' ? (
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    ) : settlement.status === 'FAILED' ? (
                      <XCircle className="h-3 w-3 text-white" />
                    ) : (
                      <Wallet className="h-3 w-3 text-muted-foreground/50" />
                    )}
                  </div>
                }
                label={t('Thanh toán', 'Payment')}
                date={
                  settlement.paidAt
                    ? formatDateTime(settlement.paidAt)
                    : settlement.status === 'FAILED'
                      ? t('Thất bại', 'Failed')
                      : t('Chưa thanh toán', 'Not yet paid')
                }
                active={
                  settlement.status === 'PAID' ||
                  settlement.status === 'FAILED'
                }
                failed={settlement.status === 'FAILED'}
              />
            </div>
          </CardContent>
        </Card>

        {/* ---- Action Buttons ---- */}
        <div className="space-y-3 pb-4">
          {/* Conditional actions */}
          {settlement.status === 'PENDING' && (
            <Button
              variant="outline"
              className="w-full h-12 text-base"
              onClick={handleContactSupport}
            >
              <Headphones className="h-5 w-5 mr-2" />
              {t('Liên hệ hỗ trợ', 'Contact Support')}
            </Button>
          )}

          {settlement.status === 'PAID' && (
            <Button
              variant="outline"
              className="w-full h-12 text-base"
              onClick={handleDownloadReceipt}
            >
              <Download className="h-5 w-5 mr-2" />
              {t('Tải biên lai', 'Download Receipt')}
            </Button>
          )}

          {/* Share — always visible */}
          <Button
            variant="outline"
            className="w-full h-12 text-base"
            onClick={handleShare}
          >
            <Share2 className="h-5 w-5 mr-2" />
            {t('Chia sẻ', 'Share')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Timeline Item Sub-component
// ============================================

function TimelineItem({
  icon,
  label,
  date,
  active,
  failed,
}: {
  icon: React.ReactNode;
  label: string;
  date: string;
  active: boolean;
  failed?: boolean;
}) {
  return (
    <div className="relative flex items-start gap-3 -ml-6">
      <div className="relative z-10 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <p
          className={cn(
            'text-sm font-medium',
            active && !failed && 'text-foreground',
            !active && 'text-muted-foreground',
            failed && 'text-red-600'
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            'text-xs',
            active && !failed && 'text-muted-foreground',
            !active && 'text-muted-foreground/60',
            failed && 'text-red-500'
          )}
        >
          {date}
        </p>
      </div>
    </div>
  );
}