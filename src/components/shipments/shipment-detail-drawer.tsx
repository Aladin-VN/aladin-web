'use client';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  MapPin,
  Package,
  Truck,
  User,
  Phone,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatVND } from '@/lib/security';
import { ShipmentStatusBadge, ShipmentTypeBadge } from './shipment-status-badge';

interface ShipmentDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId: string | null;
  locale?: string;
  onStatusChanged: () => void;
}

interface ShipmentDetail {
  id: string;
  orderId: string;
  type: string;
  status: string;
  assignedDriver: { id: string; name: string; phone: string; avatarUrl?: string | null } | null;
  pickupAddress: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  deliveredAt: string | null;
  podPhotoUrl: string | null;
  podSignatureUrl: string | null;
  podOtp: string | null;
  thirdPartyTrackingId: string | null;
  thirdPartyStatus: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    orderStatus: string;
    orderTotal: number;
    orderTotalFormatted: string;
    paymentMethod: string;
    items: {
      productName: string;
      productSku: string;
      quantity: number;
      unitPrice: number;
      unitPriceFormatted: string;
      totalPrice: number;
      totalPriceFormatted: string;
    }[];
    shop: {
      id: string;
      name: string;
      phone: string;
      address: string;
      district: string;
      province: string;
    };
  };
}

// Status transition options
const NEXT_STATUS_OPTIONS: Record<string, { value: string; labelEn: string; labelVi: string; color: string }[]> = {
  PENDING: [
    { value: 'PICKED_UP', labelEn: 'Picked Up', labelVi: 'Đã lấy hàng', color: 'bg-blue-600 hover:bg-blue-700' },
    { value: 'FAILED', labelEn: 'Failed', labelVi: 'Giao thất bại', color: 'bg-red-600 hover:bg-red-700' },
  ],
  PICKED_UP: [
    { value: 'IN_TRANSIT', labelEn: 'In Transit', labelVi: 'Đang vận chuyển', color: 'bg-indigo-600 hover:bg-indigo-700' },
    { value: 'FAILED', labelEn: 'Failed', labelVi: 'Giao thất bại', color: 'bg-red-600 hover:bg-red-700' },
  ],
  IN_TRANSIT: [
    { value: 'DELIVERED', labelEn: 'Delivered', labelVi: 'Đã giao hàng', color: 'bg-red-600 hover:bg-red-700' },
    { value: 'FAILED', labelEn: 'Failed', labelVi: 'Giao thất bại', color: 'bg-red-600 hover:bg-red-700' },
  ],
  DELIVERED: [],
  FAILED: [
    { value: 'PENDING', labelEn: 'Retry (Reset)', labelVi: 'Thử lại (Đặt lại)', color: 'bg-yellow-600 hover:bg-yellow-700' },
  ],
};

export function ShipmentDetailDrawer({
  open,
  onOpenChange,
  shipmentId,
  locale = 'vi',
  onStatusChanged,
}: ShipmentDetailDrawerProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [nextStatus, setNextStatus] = useState('all');

  const fetchShipment = useCallback(async () => {
    if (!shipmentId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/shipments/${shipmentId}`);
      const json = await res.json();
      if (json.success) {
        setShipment(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch shipment:', err);
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    if (open && shipmentId) {
      fetchShipment();
      setNextStatus('all');
    } else {
      setShipment(null);
    }
  }, [open, shipmentId, fetchShipment]);

  const handleStatusUpdate = async () => {
    if (!shipmentId || !nextStatus || nextStatus === 'all') return;

    setUpdating(true);
    try {
      const res = await fetch(`/api/shipments/${shipmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(
          locale === 'vi'
            ? `Cập nhật: ${json.data.previousStatus} → ${json.data.newStatus}`
            : `Updated: ${json.data.previousStatus} → ${json.data.newStatus}`
        );
        fetchShipment();
        onStatusChanged();
        setNextStatus('all');
      } else {
        toast.error(json.error?.message || t('Failed to update', 'Không thể cập nhật'));
      }
    } catch {
      toast.error(t('Network error', 'Lỗi mạng'));
    } finally {
      setUpdating(false);
    }
  };

  // Timeline steps
  const getTimelineSteps = () => {
    if (!shipment) return [];
    const steps = [
      { key: 'PENDING', label: t('Pending', 'Chờ lấy hàng') },
      { key: 'PICKED_UP', label: t('Picked Up', 'Đã lấy hàng') },
      { key: 'IN_TRANSIT', label: t('In Transit', 'Đang vận chuyển') },
      { key: 'DELIVERED', label: t('Delivered', 'Đã giao') },
    ];
    const statusOrder = ['PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];
    const currentIndex = statusOrder.indexOf(shipment.status);
    return steps.map((step, i) => ({
      ...step,
      completed: i <= currentIndex && shipment.status !== 'FAILED',
      isFailed: shipment.status === 'FAILED' && i === currentIndex,
      isCurrent: i === currentIndex,
    }));
  };

  const nextOptions = shipment ? (NEXT_STATUS_OPTIONS[shipment.status] || []) : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Separator />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !shipment ? (
          <div className="p-6 text-center text-muted-foreground">
            {t('No shipment selected', 'Chưa chọn chuyến giao hàng')}
          </div>
        ) : (
          <>
            <SheetHeader className="px-6 pt-6 pb-2">
              <div className="flex items-center justify-between">
                <SheetTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  <span className="font-mono text-sm">{shipment.order.orderNumber}</span>
                </SheetTitle>
                <ShipmentStatusBadge status={shipment.status} locale={locale} size="md" showIcon />
              </div>
              <SheetDescription className="flex items-center gap-2">
                <ShipmentTypeBadge type={shipment.type} locale={locale} />
                <span className="text-xs text-muted-foreground">
                  {t('Created', 'Tạo lúc')} {new Date(shipment.createdAt).toLocaleString('vi-VN')}
                </span>
              </SheetDescription>
            </SheetHeader>

            <div className="px-6 py-4 space-y-5">
              {/* Status Timeline */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('Delivery Timeline', 'Tiến trình giao hàng')}
                </h4>
                <div className="flex items-center justify-between">
                  {getTimelineSteps().map((step, i) => (
                    <div key={step.key} className="flex flex-col items-center flex-1">
                      <div className="flex items-center w-full">
                        {i > 0 && (
                          <div className={`flex-1 h-0.5 mx-1 ${step.completed ? 'bg-red-500' : 'bg-muted'}`} />
                        )}
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          step.isFailed
                            ? 'bg-red-100 text-red-600'
                            : step.completed
                              ? 'bg-yellow-50 text-red-600'
                              : 'bg-muted text-muted-foreground'
                        }`}>
                          {step.isFailed ? <XCircle className="h-3.5 w-3.5" /> : step.completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3 w-3" />}
                        </div>
                        {i < getTimelineSteps().length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 ${step.completed ? 'bg-red-500' : 'bg-muted'}`} />
                        )}
                      </div>
                      <span className={`text-[10px] mt-1.5 text-center ${
                        step.isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Shop & Order Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('Order Information', 'Thông tin đơn hàng')}
                </h4>
                <div className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('Shop', 'Cửa hàng')}</span>
                    <span className="text-xs font-medium">{shipment.order.shop.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('Address', 'Địa chỉ')}</span>
                    <span className="text-xs text-right max-w-[200px]">{shipment.order.shop.address || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('Phone', 'Điện thoại')}</span>
                    <span className="text-xs font-mono">{shipment.order.shop.phone}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('Order Total', 'Tổng đơn')}</span>
                    <span className="text-xs font-semibold">{shipment.order.orderTotalFormatted}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{t('Items', 'Sản phẩm')}</span>
                    <span className="text-xs">{shipment.order.items.length} {t('items', 'SP')}</span>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('Items', 'Sản phẩm')}
                </h4>
                <div className="rounded-md border divide-y">
                  {shipment.order.items.map((item, i) => (
                    <div key={i} className="px-3 py-2 flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.productName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.productSku} · {formatVND(item.unitPrice)} x {item.quantity}
                        </p>
                      </div>
                      <span className="text-xs font-medium shrink-0">{item.totalPriceFormatted}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Driver Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('Driver', 'Tài xế')}
                </h4>
                {shipment.assignedDriver ? (
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs font-medium">{shipment.assignedDriver.name}</p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {shipment.assignedDriver.phone}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50/50 p-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span className="text-xs text-amber-700">{t('No driver assigned', 'Chưa phân công tài xế')}</span>
                  </div>
                )}
              </div>

              {/* Route Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t('Route', 'Lộ trình')}
                </h4>
                <div className="rounded-md border p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-yellow-50 flex items-center justify-center mt-0.5 shrink-0">
                      <div className="h-2 w-2 rounded-full bg-red-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">{t('Pickup', 'Lấy hàng')}</p>
                      <p className="text-xs">{shipment.pickupAddress || t('Not set', 'Chưa đặt')}</p>
                    </div>
                  </div>
                  <div className="ml-2.5 border-l-2 border-dashed border-muted h-3" />
                  <div className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5 shrink-0">
                      <MapPin className="h-2.5 w-2.5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">{t('Dropoff', 'Giao hàng')}</p>
                      <p className="text-xs">{shipment.dropoffAddress}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Third Party Info */}
              {shipment.type === 'THIRD_PARTY' && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('3rd Party Tracking', 'Theo dõi bên thứ 3')}
                  </h4>
                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('Tracking ID', 'Mã theo dõi')}</span>
                      <span className="text-xs font-mono">
                        {shipment.thirdPartyTrackingId || '-'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('Status', 'Trạng thái')}</span>
                      <span className="text-xs">{shipment.thirdPartyStatus || '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* POD */}
              {shipment.status === 'DELIVERED' && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('Proof of Delivery', 'Xác nhận giao hàng')}
                  </h4>
                  <div className="rounded-md border border-yellow-100 bg-yellow-50/50 p-3 space-y-2">
                    {shipment.deliveredAt && (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-red-600" />
                        <span className="text-xs text-red-700">
                          {t('Delivered at', 'Giao lúc')} {new Date(shipment.deliveredAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                    )}
                    {shipment.podOtp && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t('OTP Confirmed', 'OTP xác nhận')}</span>
                        <Badge variant="outline" className="text-[10px]">{shipment.podOtp}</Badge>
                      </div>
                    )}
                    {shipment.podPhotoUrl && (
                      <div className="flex items-center gap-1 text-xs text-blue-600">
                        <ExternalLink className="h-3 w-3" />
                        <span>{t('View POD Photo', 'Xem ảnh POD')}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Status Transition Actions */}
              {nextOptions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('Update Status', 'Cập nhật trạng thái')}
                  </h4>
                  <div className="flex gap-2">
                    <Select value={nextStatus} onValueChange={setNextStatus}>
                      <SelectTrigger className="h-9 text-xs flex-1">
                        <SelectValue placeholder={t('Select next status...', 'Chọn trạng thái tiếp...')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('Select...', 'Chọn...')}</SelectItem>
                        {nextOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {locale === 'vi' ? opt.labelVi : opt.labelEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleStatusUpdate}
                      disabled={updating || !nextStatus || nextStatus === 'all'}
                      size="sm"
                      className={`h-9 text-xs text-white ${
                        nextOptions.find(o => o.value === nextStatus)?.color || 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {updating && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                      {t('Update', 'Cập nhật')}
                    </Button>
                  </div>
                </div>
              )}

              {/* Refresh */}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                onClick={fetchShipment}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                {t('Refresh', 'Làm mới')}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
