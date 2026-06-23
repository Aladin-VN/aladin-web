'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useState, useEffect, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { OrderStatusBadge, PaymentMethodBadge, PaymentStatusBadge } from './order-status-badge';
import { formatVND } from '@/lib/security';
import { toast } from 'sonner';
import {
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  Package,
  Truck,
  Phone,
  MapPin,
  RotateCcw,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  unitPriceFormatted: string;
  quantity: number;
  totalPrice: number;
  totalPriceFormatted: string;
  freeQty: number;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  shopDistrict: string;
  shopProvince: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotalAmount: number;
  subtotalAmountFormatted: string;
  discountAmount: number;
  discountAmountFormatted: string;
  deliveryFee: number;
  deliveryFeeFormatted: string;
  totalAmount: number;
  totalAmountFormatted: string;
  paidAmount: number;
  paidAmountFormatted: string;
  creditUsed: number;
  creditUsedFormatted: string;
  customerNotes: string;
  adminNotes: string;
  confirmedAt: string;
  packedAt: string;
  deliveredAt: string;
  cancelledAt: string;
  cancelReason: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

// ============================================
// Status Timeline
// ============================================

const STATUS_FLOW = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Circle className="h-4 w-4" />,
  CONFIRMED: <CheckCircle2 className="h-4 w-4" />,
  PROCESSING: <Loader2 className="h-4 w-4" />,
  PACKED: <Package className="h-4 w-4" />,
  OUT_FOR_DELIVERY: <Truck className="h-4 w-4" />,
  DELIVERED: <CheckCircle2 className="h-4 w-4" />,
  CANCELLED: <XCircle className="h-4 w-4" />,
};

function StatusTimeline({
  status,
  order,
  locale,
}: {
  status: string;
  order: OrderDetail;
  locale: string;
}) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  if (status === 'CANCELLED') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-red-600">
          <XCircle className="h-4 w-4" />
          <span className="text-sm font-medium">{t('Order Cancelled', 'Đơn hàng đã hủy')}</span>
        </div>
        {order.cancelReason && (
          <p className="text-xs text-muted-foreground ml-6">
            {t('Reason', 'Lý do')}: {order.cancelReason}
          </p>
        )}
        {order.cancelledAt && (
          <p className="text-xs text-muted-foreground ml-6">
            {new Date(order.cancelledAt).toLocaleString('vi-VN')}
          </p>
        )}
      </div>
    );
  }

  const currentIdx = STATUS_FLOW.indexOf(status);

  return (
    <div className="space-y-3">
      {STATUS_FLOW.map((step, idx) => {
        const isCompleted = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        const timestamp =
          step === 'CONFIRMED' ? order.confirmedAt :
          step === 'PACKED' ? order.packedAt :
          step === 'DELIVERED' ? order.deliveredAt : null;

        return (
          <div key={step} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div className={`rounded-full flex items-center justify-center ${
                isCompleted
                  ? isCurrent
                    ? 'bg-yellow-50 text-red-600'
                    : 'bg-red-500 text-white'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {isCompleted
                  ? <CheckCircle2 className="h-4 w-4" />
                  : STATUS_ICONS[step] || <Circle className="h-4 w-4" />
                }
              </div>
              {idx < STATUS_FLOW.length - 1 && (
                <div className={`w-0.5 h-4 ${
                  idx < currentIdx ? 'bg-yellow-400' : 'bg-muted'
                }`} />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <p className={`text-xs font-medium ${
                isCurrent ? 'text-red-700' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
              }`}>
                <OrderStatusBadge status={step} locale={locale} />
              </p>
              {timestamp && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {new Date(timestamp).toLocaleString('vi-VN')}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Next Status Actions
// ============================================

function getNextAction(status: string, locale: string): { nextStatus: string; label: string; variant: 'primary' | 'destructive' } | null {
  const actions: Record<string, { nextStatus: string; labelEn: string; labelVi: string; variant: 'primary' | 'destructive' }> = {
    PENDING: { nextStatus: 'CONFIRMED', labelEn: 'Confirm', labelVi: 'Xác nhận', variant: 'primary' },
    CONFIRMED: { nextStatus: 'PROCESSING', labelEn: 'Start Processing', labelVi: 'Bắt đầu xử lý', variant: 'primary' },
    PROCESSING: { nextStatus: 'PACKED', labelEn: 'Pack', labelVi: 'Đóng gói', variant: 'primary' },
    PACKED: { nextStatus: 'OUT_FOR_DELIVERY', labelEn: 'Out for Delivery', labelVi: 'Giao hàng', variant: 'primary' },
    OUT_FOR_DELIVERY: { nextStatus: 'DELIVERED', labelEn: 'Delivered', labelVi: 'Đã giao', variant: 'primary' },
  };

  const action = actions[status];
  if (!action) return null;

  return {
    nextStatus: action.nextStatus,
    label: locale === 'vi' ? action.labelVi : action.labelEn,
    variant: action.variant,
  };
}

// ============================================
// Order Detail Drawer Component
// ============================================

interface OrderDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  locale: string;
  onStatusChanged?: () => void;
}

export function OrderDetailDrawer({
  open,
  onOpenChange,
  orderId,
  locale,
  onStatusChanged,
}: OrderDetailDrawerProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await adminFetch(`/api/orders/${orderId}`);
      if (res.success) {
        setOrder(res.data);
      } else {
        toast.error(t('Failed to load order', 'Không thể tải đơn hàng'));
      }
    } catch (err) {
      console.error('Fetch order detail error:', err);
      toast.error(t('Network error', 'Lỗi mạng'));
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    if (open && orderId) {
      fetchOrder();
    }
    if (!open) {
      setOrder(null);
      setCancelReason('');
    }
  }, [open, orderId, fetchOrder]);

  // Advance status
  const handleAdvanceStatus = async () => {
    if (!order) return;
    const action = getNextAction(order.status, locale);
    if (!action) return;

    try {
      setActionLoading(true);
      const res = await adminFetch(`/api/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action.nextStatus }),
      });
      if (res.success) {
        toast.success(t(
          `Order status updated to ${action.nextStatus}`,
          `Cập nhật trạng thái đơn hàng thành ${action.nextStatus}`
        ));
        fetchOrder();
        onStatusChanged?.();
      } else {
        toast.error(res.error?.message || t('Failed to update status', 'Không thể cập nhật trạng thái'));
      }
    } catch (err) {
      console.error('Status update error:', err);
      toast.error(t('Network error', 'Lỗi mạng'));
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel order
  const handleCancel = async () => {
    if (!order || !cancelReason.trim()) return;

    try {
      setActionLoading(true);
      const res = await adminFetch(`/api/orders/${order.id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      if (res.success) {
        toast.success(t('Order cancelled successfully', 'Hủy đơn hàng thành công'));
        setCancelDialogOpen(false);
        setCancelReason('');
        fetchOrder();
        onStatusChanged?.();
      } else {
        toast.error(res.error?.message || t('Failed to cancel', 'Không thể hủy'));
      }
    } catch (err) {
      console.error('Cancel error:', err);
      toast.error(t('Network error', 'Lỗi mạng'));
    } finally {
      setActionLoading(false);
    }
  };

  const canCancel = order && ['PENDING', 'CONFIRMED'].includes(order.status);
  const nextAction = order ? getNextAction(order.status, locale) : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
          <SheetHeader className="pr-6">
            <SheetTitle className="flex items-center gap-2 text-base">
              {loading ? (
                <Skeleton className="h-5 w-40" />
              ) : order ? (
                <>
                  <span className="font-mono text-sm">{order.orderNumber}</span>
                  <OrderStatusBadge status={order.status} locale={locale} size="md" />
                </>
              ) : (
                <span>{t('Order Detail', 'Chi tiết đơn hàng')}</span>
              )}
            </SheetTitle>
            <SheetDescription>
              {loading ? (
                <Skeleton className="h-4 w-24" />
              ) : order ? (
                new Date(order.createdAt).toLocaleString('vi-VN')
              ) : (
                <span>{t('Loading...', 'Đang tải...')}</span>
              )}
            </SheetDescription>
          </SheetHeader>

          {loading ? (
            <div className="flex-1 p-4 space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : order ? (
            <div className="flex-1 space-y-5 px-4 pb-6">
              {/* Shop Info */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="text-sm font-semibold">{t('Shop Information', 'Thông tin cửa hàng')}</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{order.shopName}</span>
                  </div>
                  {order.shopAddress && (
                    <p className="text-xs text-muted-foreground ml-5.5">
                      {order.shopAddress}{order.shopDistrict ? `, ${order.shopDistrict}` : ''}{order.shopProvince ? `, ${order.shopProvince}` : ''}
                    </p>
                  )}
                  {order.shopPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <SensitiveValue value={order.shopPhone} maskType="phone" />
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="text-sm font-semibold">
                  {t('Order Items', 'Sản phẩm')} ({order.items.length})
                </h4>
                <div className="max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">{t('Product', 'SP')}</TableHead>
                        <TableHead className="text-xs text-center">{t('Qty', 'SL')}</TableHead>
                        <TableHead className="text-xs text-right">{t('Total', 'Tổng')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="py-2">
                            <p className="text-xs font-medium">{item.productName}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{item.productSku}</p>
                            {item.freeQty > 0 && (
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-yellow-50 text-red-600 mt-0.5">
                                +{item.freeQty} {t('free', 'tặng')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <span className="text-xs">{item.quantity}</span>
                            <p className="text-[10px] text-muted-foreground">
                              <SensitiveValue value={item.unitPrice} maskType="amount" formatOptions={{ formatCurrency: true }} />
                            </p>
                          </TableCell>
                          <TableCell className="text-right py-2">
                            <span className="text-xs font-semibold">
                              <SensitiveValue value={item.totalPrice} maskType="amount" formatOptions={{ formatCurrency: true }} />
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Payment Section */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="text-sm font-semibold">{t('Payment Details', 'Chi tiết thanh toán')}</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t('Method', 'Phương thức')}</span>
                    <PaymentMethodBadge method={order.paymentMethod} locale={locale} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t('Status', 'Trạng thái TT')}</span>
                    <PaymentStatusBadge status={order.paymentStatus} locale={locale} />
                  </div>
                  <Separator />
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{t('Subtotal', 'Tạm tính')}</span>
                    <span><SensitiveValue value={order.subtotalAmount} maskType="amount" formatOptions={{ formatCurrency: true }} /></span>
                  </div>
                  {order.discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-red-600">
                      <span>{t('Discount (2% pay now)', 'Giảm giá (2% trả ngay)')}</span>
                      <span>-{formatVND(order.discountAmount)}</span>
                    </div>
                  )}
                  {order.deliveryFee > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t('Delivery Fee', 'Phí giao hàng')}</span>
                      <span>{formatVND(order.deliveryFee)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-sm font-bold">
                    <span>{t('Total', 'Tổng thanh tiền')}</span>
                    <span className="text-red-700">
                      <SensitiveValue value={order.totalAmount} maskType="amount" formatOptions={{ formatCurrency: true }} />
                    </span>
                  </div>
                  {order.paidAmount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t('Paid Amount', 'Đã thanh toán')}</span>
                      <span className="font-medium">
                        <SensitiveValue value={order.paidAmount} maskType="amount" formatOptions={{ formatCurrency: true }} />
                      </span>
                    </div>
                  )}
                  {order.creditUsed > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t('Credit Used', 'Công nợ đã dùng')}</span>
                      <span className="font-medium text-blue-600">
                        <SensitiveValue value={order.creditUsed} maskType="amount" formatOptions={{ formatCurrency: true }} />
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {(order.customerNotes || order.adminNotes) && (
                <div className="rounded-lg border p-4 space-y-2">
                  <h4 className="text-sm font-semibold">{t('Notes', 'Ghi chú')}</h4>
                  {order.customerNotes && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">
                        {t('Customer', 'Khách hàng')}
                      </p>
                      <p className="text-xs bg-muted/50 rounded p-2">{order.customerNotes}</p>
                    </div>
                  )}
                  {order.adminNotes && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">
                        {t('Admin', 'Quản trị')}
                      </p>
                      <p className="text-xs bg-amber-50 dark:bg-amber-950/30 rounded p-2">{order.adminNotes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Status Timeline */}
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="text-sm font-semibold">{t('Status History', 'Lịch sử trạng thái')}</h4>
                <StatusTimeline status={order.status} order={order} locale={locale} />
              </div>

              {/* Action Buttons */}
              {(nextAction || canCancel) && (
                <div className="flex gap-2">
                  {nextAction && (
                    <Button
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                      size="sm"
                      onClick={handleAdvanceStatus}
                      disabled={actionLoading}
                    >
                      {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                      {nextAction.label}
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => setCancelDialogOpen(true)}
                      disabled={actionLoading}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      {t('Cancel', 'Hủy')}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <p className="text-sm text-muted-foreground">{t('No order selected', 'Chưa chọn đơn hàng')}</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              {t('Cancel Order', 'Hủy đơn hàng')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `Are you sure you want to cancel order ${order?.orderNumber || ''}? This will restore product stock and credit if applicable.`,
                `Bạn có chắc muốn hủy đơn hàng ${order?.orderNumber || ''}? Sản phẩm và công nợ (nếu có) sẽ được hoàn lại.`
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="cancelReason" className="text-sm font-medium">
              {t('Reason (required)', 'Lý do hủy (bắt buộc)')}
            </Label>
            <Textarea
              id="cancelReason"
              placeholder={t('Enter cancellation reason...', 'Nhập lý do hủy...')}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>
              {t('Back', 'Quay lại')}
            </AlertDialogCancel>
            <Button
              onClick={(e) => { e.preventDefault(); handleCancel(); }}
              disabled={!cancelReason.trim() || actionLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('Confirm Cancel', 'Xác nhận hủy')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
