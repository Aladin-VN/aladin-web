'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import {
  ArrowLeft, Package, CheckCircle, Truck, Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

const statusColor = (s: string) => {
  switch (s) {
    case 'PENDING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'CONFIRMED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'PROCESSING': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'PACKED': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'DELIVERED': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    default: return 'bg-gray-100 text-gray-800';
  }
};
const statusLabel = (s: string) => {
  const m: Record<string, string> = {
    PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', PROCESSING: 'Đang xử lý',
    PACKED: 'Sẵn sàng giao', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy',
  };
  return m[s] || s;
};

export default function DistributorOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/orders/${id}`);
      if (res.success) setOrder(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const handleAction = async (action: string) => {
    setActionLoading(true);
    try {
      const res = await adminFetch(`/api/distributor/orders/${id}/fulfill`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      if (res.success) {
        fetchOrder();
      } else {
        alert(res.error?.message || t('Lỗi không xác định', 'Unknown error'));
      }
    } catch (e: any) {
      alert(e.message || t('Lỗi mạng', 'Network error'));
    }
    setActionLoading(false);
  };

  const getActionButton = () => {
    if (!order) return null;
    switch (order.status) {
      case 'PENDING':
        return { label: t('Xác nhận đơn hàng', 'Confirm Order'), action: 'CONFIRM', icon: CheckCircle, color: 'bg-yellow-500 hover:bg-yellow-600 text-white' };
      case 'CONFIRMED':
        return { label: t('Đóng gói đơn hàng', 'Pack Order'), action: 'PACK', icon: Package, color: 'bg-indigo-500 hover:bg-indigo-600 text-white' };
      case 'PROCESSING':
        return { label: t('Sẵn sàng giao hàng', 'Ready for Pickup'), action: 'READY_FOR_PICKUP', icon: Truck, color: 'bg-green-500 hover:bg-green-600 text-white' };
      default: return null;
    }
  };

  if (loading) {
    return (
      <>
        <AdminSidebar />
        <SidebarInset>
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-60 rounded-xl" />
          </div>
        </SidebarInset>
      </>
    );
  }

  if (!order) {
    return (
      <>
        <AdminSidebar />
        <SidebarInset>
          <div className="p-6 text-center text-muted-foreground py-16">
            {t('Không tìm thấy đơn hàng', 'Order not found')}
          </div>
        </SidebarInset>
      </>
    );
  }

  const btn = getActionButton();

  return (
    <>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-1" /> {t('Quay lại', 'Back')}
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <h1 className="text-2xl font-bold tracking-tight">{order.orderNumber}</h1>
              <Badge variant="secondary" className={statusColor(order.status)}>{statusLabel(order.status)}</Badge>
            </div>
            {btn && (
              <Button
                onClick={() => handleAction(btn.action)}
                disabled={actionLoading}
                className={btn.color}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <btn.icon className="h-4 w-4 mr-2" />}
                {btn.label}
              </Button>
            )}
          </div>
          <Separator />

          <div className="flex-1 px-6 py-4 space-y-6">
            {/* Order Info + Shop Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">{t('Thông tin cửa hàng', 'Shop Info')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="font-medium text-base">{order.shopName || t('Chưa xác định', 'Unknown')}</p>
                  {order.shopAddress && <p className="text-muted-foreground">{order.shopAddress}</p>}
                  <p className="text-muted-foreground">
                    {t('Ngày tạo', 'Created')}: {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                  </p>
                </CardContent>
              </Card>

              {order.status === 'PACKED' && (
                <Card className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800/50">
                  <CardContent className="p-6 flex items-center justify-center gap-3">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="font-semibold text-green-700 dark:text-green-400">{t('Đơn hàng đã sẵn sàng giao', 'Order ready for delivery')}</p>
                      <p className="text-xs text-green-600 dark:text-green-500 mt-1">{t('Tài xế sẽ đến lấy hàng', 'Driver will pick up the order')}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Items */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">
                  {t(`Sản phẩm (${order.items?.length || 0})`, `Items (${order.items?.length || 0})`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('Sản phẩm', 'Product')}</TableHead>
                      <TableHead className="text-center">{t('SKU', 'SKU')}</TableHead>
                      <TableHead className="text-center">{t('Số lượng', 'Qty')}</TableHead>
                      <TableHead className="text-right">{t('Đơn giá', 'Price')}</TableHead>
                      <TableHead className="text-right">{t('Thành tiền', 'Total')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(order.items || []).map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.productName}</TableCell>
                        <TableCell className="text-center text-muted-foreground text-xs">{item.productSku}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatVND(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatVND(item.totalPrice)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Totals */}
                <div className="border-t mt-4 pt-4 space-y-2 text-sm max-w-xs ml-auto">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('Tạm tính', 'Subtotal')}</span>
                    <span>{formatVND(order.subtotalAmount)}</span>
                  </div>
                  {order.discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>{t('Giảm giá', 'Discount')}</span>
                      <span>-{formatVND(order.discountAmount)}</span>
                    </div>
                  )}
                  {order.deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Phí giao', 'Delivery Fee')}</span>
                      <span>{formatVND(order.deliveryFee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>{t('Tổng cộng', 'Total')}</span>
                    <span className="text-yellow-600">{formatVND(order.totalAmount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </>
  );
}