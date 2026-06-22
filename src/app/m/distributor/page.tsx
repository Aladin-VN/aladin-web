'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAuthStore } from '@/stores/auth.store';
import {
  ShoppingCart, DollarSign, Wallet, AlertTriangle, Package, CheckCircle,
  ArrowRight, RefreshCw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardData {
  pendingOrders: number;
  todayOrders: number;
  todayRevenue: number;
  todayNetPayout: number;
  platformFeeToday: number;
  pendingPayout: number;
  totalPayouts: number;
  lowStockCount: number;
  totalProducts: number;
  weekFulfilled: number;
  commissionRate: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  shopName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

export default function DistributorDashboard() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/distributor/dashboard');
      if (res.success) setData(res.data);
    } catch {}
    try {
      const res = await adminFetch('/api/distributor/orders?limit=5');
      if (res.success) setRecentOrders(res.data.items);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchDashboard(); }, []);

  const statusColor = (s: string) => {
    switch (s) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED': case 'PROCESSING': return 'bg-blue-100 text-blue-800';
      case 'PACKED': return 'bg-indigo-100 text-indigo-800';
      case 'DELIVERED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  const statusLabel = (s: string) => {
    const m: Record<string, string> = { PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', PROCESSING: 'Đang xử lý', PACKED: 'Đã đóng gói', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' };
    return m[s] || s;
  };

  const kpis = data ? [
    { label: 'Đơn chờ xử lý', value: data.pendingOrders, icon: ShoppingCart, bg: 'bg-yellow-50', iconColor: 'text-yellow-600' },
    { label: 'Doanh thu hôm nay', value: formatVND(data.todayRevenue), icon: DollarSign, bg: 'bg-green-50', iconColor: 'text-green-600' },
    { label: 'Thanh toán chờ', value: formatVND(data.pendingPayout), icon: Wallet, bg: 'bg-blue-50', iconColor: 'text-blue-600' },
    { label: 'Cảnh báo tồn kho', value: data.lowStockCount, icon: AlertTriangle, bg: 'bg-red-50', iconColor: 'text-red-600' },
    { label: 'Tổng sản phẩm', value: data.totalProducts, icon: Package, bg: 'bg-purple-50', iconColor: 'text-purple-600' },
    { label: 'Hoàn thành tuần này', value: data.weekFulfilled, icon: CheckCircle, bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  ] : [];

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl font-bold">Xin chào, {user?.name?.split(' ').pop()}</h1>
        <p className="text-sm text-muted-foreground">Bảng điều khiển kho hàng</p>
      </div>

      {/* Commission Rate Banner */}
      {data && (
        <Card className="mb-4 border-yellow-300 bg-yellow-50">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Phí nền tảng</p>
              <p className="text-lg font-bold text-yellow-700">{(data.commissionRate * 100).toFixed(0)}%</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Thu nhập ròng hôm nay</p>
              <p className="text-lg font-bold text-green-700">{formatVND(data.todayNetPayout)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPI Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className={`${kpi.bg} border-0`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
                  <span className="text-[11px] text-muted-foreground font-medium">{kpi.label}</span>
                </div>
                <p className={`text-lg font-bold ${kpi.iconColor}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <Button variant="outline" className="h-auto py-3 flex-col gap-1 text-xs" onClick={() => router.push('/m/distributor/orders')}>
          <ShoppingCart className="h-5 w-5 text-yellow-600" />
          Nhận đơn hàng
        </Button>
        <Button variant="outline" className="h-auto py-3 flex-col gap-1 text-xs" onClick={() => router.push('/m/distributor/inventory')}>
          <Package className="h-5 w-5 text-purple-600" />
          Kiểm tra kho
        </Button>
        <Button variant="outline" className="h-auto py-3 flex-col gap-1 text-xs" onClick={() => router.push('/m/distributor/settlements')}>
          <Wallet className="h-5 w-5 text-blue-600" />
          Quyết toán
        </Button>
      </div>

      {/* Recent Orders */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Đơn hàng gần đây</h2>
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => router.push('/m/distributor/orders')}>
          Xem tất cả <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : recentOrders.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Chưa có đơn hàng</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {recentOrders.map((order) => (
            <Card key={order.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => router.push(`/m/distributor/orders/${order.id}`)}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{order.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">{order.shopName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatVND(order.totalAmount)}</p>
                  <Badge variant="secondary" className={`text-[10px] ${statusColor(order.status)}`}>
                    {statusLabel(order.status)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* FAB Refresh */}
      <button
        onClick={fetchDashboard}
        className="fixed bottom-20 right-4 w-12 h-12 bg-yellow-500 text-white rounded-full shadow-lg flex items-center justify-center z-40"
      >
        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}