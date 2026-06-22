'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Package, CheckCircle, Truck, Loader2 } from 'lucide-react';

export default function DistributorOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
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
        alert(res.error?.message || 'Lỗi không xác định');
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi mạng');
    }
    setActionLoading(false);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800';
      case 'PROCESSING': return 'bg-blue-100 text-blue-800';
      case 'PACKED': return 'bg-indigo-100 text-indigo-800';
      case 'DELIVERED': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  const statusLabel = (s: string) => {
    const m: Record<string, string> = { PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', PROCESSING: 'Đang xử lý', PACKED: 'Sẵn sàng giao', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' };
    return m[s] || s;
  };

  const getActionButton = () => {
    if (!order) return null;
    switch (order.status) {
      case 'PENDING':
        return { label: 'Xác nhận đơn hàng', action: 'CONFIRM', icon: CheckCircle, color: 'bg-yellow-500 hover:bg-yellow-600' };
      case 'CONFIRMED':
        return { label: 'Đóng gói đơn hàng', action: 'PACK', icon: Package, color: 'bg-yellow-500 hover:bg-yellow-600' };
      case 'PROCESSING':
        return { label: 'Sẵn sàng giao hàng', action: 'READY_FOR_PICKUP', icon: Truck, color: 'bg-green-500 hover:bg-green-600' };
      default: return null;
    }
  };

  if (loading) {
    return <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 rounded-xl" /><Skeleton className="h-60 rounded-xl" /></div>;
  }

  if (!order) {
    return <div className="max-w-lg mx-auto px-4 pt-4 pb-24 text-center text-muted-foreground py-12">Không tìm thấy đơn hàng</div>;
  }

  const btn = getActionButton();

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-32">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ArrowLeft className="h-4 w-4" /> Quay lại
      </button>

      {/* Order Header */}
      <Card className="mb-3">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-bold">{order.orderNumber}</h1>
            <Badge variant="secondary" className={statusColor(order.status)}>{statusLabel(order.status)}</Badge>
          </div>
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">{order.shopName || 'Chưa xác định'}</p>
            {order.shopAddress && <p>{order.shopAddress}</p>}
            <p>Ngày tạo: {new Date(order.createdAt).toLocaleDateString('vi-VN')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="mb-3">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-semibold">Sản phẩm ({order.items?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="space-y-2">
            {(order.items || []).map((item: any) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{item.productSku} x {item.quantity}</p>
                </div>
                <p className="font-semibold">{formatVND(item.totalPrice)}</p>
              </div>
            ))}
          </div>
          <div className="border-t mt-2 pt-2 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Tạm tính</span><span>{formatVND(order.subtotalAmount)}</span></div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between text-green-600"><span>Giảm giá</span><span>-{formatVND(order.discountAmount)}</span></div>
            )}
            {order.deliveryFee > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Phí giao</span><span>{formatVND(order.deliveryFee)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t">
              <span>Tổng cộng</span><span className="text-yellow-600">{formatVND(order.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky Action Button */}
      {btn && (
        <div className="fixed bottom-16 left-0 right-0 z-40 p-4 bg-background/95 backdrop-blur-md border-t">
          <div className="max-w-lg mx-auto">
            <Button
              onClick={() => handleAction(btn.action)}
              disabled={actionLoading}
              className={`w-full h-12 text-base font-semibold text-white ${btn.color}`}
            >
              {actionLoading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <btn.icon className="h-5 w-5 mr-2" />}
              {btn.label}
            </Button>
          </div>
        </div>
      )}

      {/* Status info for completed orders */}
      {order.status === 'PACKED' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="font-semibold text-green-700">Đơn hàng đã sẵn sàng giao</p>
            <p className="text-xs text-green-600 mt-1">Tài xế sẽ đến lấy hàng</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}