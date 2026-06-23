'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAuth, useLocale } from '@/providers/app-provider';
import {
  ShoppingCart, DollarSign, Wallet, AlertTriangle, Package, CheckCircle,
  ArrowRight, RefreshCw, TrendingUp, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

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

const statusColor = (s: string) => {
  switch (s) {
    case 'PENDING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'CONFIRMED': case 'PROCESSING': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'PACKED': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'DELIVERED': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'CANCELLED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800';
  }
};
const statusLabel = (s: string) => {
  const m: Record<string, string> = {
    PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', PROCESSING: 'Đang xử lý',
    PACKED: 'Đã đóng gói', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy',
  };
  return m[s] || s;
};

export default function DistributorDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
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
      if (res.success) setRecentOrders(res.data.items || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchDashboard(); }, []);

  const kpis = data ? [
    { label: t('Đơn chờ xử lý', 'Pending Orders'), value: data.pendingOrders, icon: Clock, bg: 'bg-yellow-50 dark:bg-yellow-900/20', iconColor: 'text-yellow-600' },
    { label: t('Doanh thu hôm nay', 'Today Revenue'), value: formatVND(data.todayRevenue), icon: DollarSign, bg: 'bg-green-50 dark:bg-green-900/20', iconColor: 'text-green-600' },
    { label: t('Thu nhập ròng hôm nay', 'Today Net Payout'), value: formatVND(data.todayNetPayout), icon: TrendingUp, bg: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-600' },
    { label: t('Thanh toán chờ', 'Pending Payout'), value: formatVND(data.pendingPayout), icon: Wallet, bg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600' },
    { label: t('Cảnh báo tồn kho', 'Low Stock Alerts'), value: data.lowStockCount, icon: AlertTriangle, bg: 'bg-red-50 dark:bg-red-900/20', iconColor: 'text-red-600' },
    { label: t('Hoàn thành tuần này', 'This Week Fulfilled'), value: data.weekFulfilled, icon: CheckCircle, bg: 'bg-purple-50 dark:bg-purple-900/20', iconColor: 'text-purple-600' },
  ] : [];

  return (
    <>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t('Xin chào', 'Hello')}, {user?.name?.split(' ').pop()}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('Bảng điều khiển kho hàng', 'Distributor Warehouse Dashboard')}
                {user?.distributor && (
                  <span className="ml-2">
                    &mdash; {user.distributor.name}
                  </span>
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchDashboard} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('Làm mới', 'Refresh')}
            </Button>
          </div>
          <Separator />

          <div className="flex-1 px-6 py-4 space-y-6">
            {/* Commission Rate Banner */}
            {data && (
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 dark:from-yellow-900/20 dark:to-amber-900/20 dark:border-yellow-800/50">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t('Phí nền tảng (tỷ lệ hoa hồng)', 'Platform Fee (Commission Rate)')}</p>
                    <p className="text-xl font-bold text-yellow-700 dark:text-yellow-400">{(data.commissionRate * 100).toFixed(1)}%</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t('Thu nhập ròng hôm nay', 'Today Net Payout')}</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatVND(data.todayNetPayout)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{t('Tổng sản phẩm', 'Total Products')}</p>
                  <p className="text-xl font-bold">{data.totalProducts}</p>
                </div>
              </div>
            )}

            {/* KPI Grid */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {kpis.map((kpi) => (
                  <Card key={kpi.label} className={`${kpi.bg} border-0`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
                        <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                      </div>
                      <p className={`text-xl font-bold ${kpi.iconColor}`}>{kpi.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={() => router.push('/distributor/orders')}>
                <ShoppingCart className="h-4 w-4 text-yellow-600" />
                {t('Quản lý đơn hàng', 'Manage Orders')}
                {data?.pendingOrders ? (
                  <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-[10px] px-1">{data.pendingOrders}</Badge>
                ) : null}
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => router.push('/distributor/inventory')}>
                <Package className="h-4 w-4 text-purple-600" />
                {t('Kiểm tra kho', 'Check Inventory')}
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => router.push('/distributor/settlements')}>
                <Wallet className="h-4 w-4 text-blue-600" />
                {t('Quyết toán', 'Settlements')}
              </Button>
            </div>

            {/* Recent Orders Table */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold">
                  {t('Đơn hàng gần đây', 'Recent Orders')}
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => router.push('/distributor/orders')}>
                  {t('Xem tất cả', 'View All')} <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                  </div>
                ) : recentOrders.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {t('Chưa có đơn hàng nào', 'No orders yet')}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Mã đơn', 'Order #')}</TableHead>
                        <TableHead>{t('Cửa hàng', 'Shop')}</TableHead>
                        <TableHead>{t('Trạng thái', 'Status')}</TableHead>
                        <TableHead className="text-right">{t('Tổng tiền', 'Total')}</TableHead>
                        <TableHead className="text-right">{t('Ngày tạo', 'Date')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentOrders.map((order) => (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/distributor/orders/${order.id}`)}
                        >
                          <TableCell className="font-medium">{order.orderNumber}</TableCell>
                          <TableCell>{order.shopName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-[10px] ${statusColor(order.status)}`}>
                              {statusLabel(order.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatVND(order.totalAmount)}</TableCell>
                          <TableCell className="text-right text-muted-foreground text-xs">
                            {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </>
  );
}