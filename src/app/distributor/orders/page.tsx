'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import {
  Search, ChevronLeft, ChevronRight, RefreshCw,
  ShoppingCart, Clock, DollarSign, Package,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AdminHeader } from '@/components/layout/admin-header';
import { Separator } from '@/components/ui/separator';

const STATUS_TABS = [
  { key: '', label: 'Tất cả', labelEn: 'All' },
  { key: 'PENDING', label: 'Chờ xử lý', labelEn: 'Pending' },
  { key: 'PROCESSING', label: 'Đang xử lý', labelEn: 'Processing' },
  { key: 'PACKED', label: 'Đã đóng gói', labelEn: 'Packed' },
  { key: 'DELIVERED', label: 'Đã giao', labelEn: 'Delivered' },
];

const statusColor = (s: string) => {
  switch (s) {
    case 'PENDING': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400';
    case 'CONFIRMED': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
    case 'PROCESSING': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400';
    case 'PACKED': return 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400';
    case 'DELIVERED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
    case 'CANCELLED': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-700';
  }
};
const statusLabel = (s: string) => {
  const m: Record<string, string> = {
    PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', PROCESSING: 'Đang xử lý',
    PACKED: 'Sẵn sàng giao', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy',
  };
  return m[s] || s;
};

export default function DistributorOrders() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (activeTab) params.set('status', activeTab);
      if (search) params.set('search', search);
      const res = await adminFetch(`/api/distributor/orders?${params}`);
      if (res.success) {
        setOrders(res.data.items || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch {}
    setLoading(false);
  }, [activeTab, page, search]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Computed KPIs from orders data
  const kpis = useMemo(() => {
    const pending = orders.filter((o: any) => o.status === 'PENDING').length;
    const today = orders.filter((o: any) => {
      const d = new Date(o.createdAt);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    const revenue = orders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
    return { pending, today, revenue, total: orders.length };
  }, [orders]);

  return (
    <>
      <AdminHeader />
      <div className="flex flex-1 flex-col">
        {/* Page Header */}
        <div className="px-4 md:px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight">{t('Đơn hàng', 'Orders')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('Quản lý đơn hàng được giao đến kho', 'Manage orders assigned to your warehouse')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchOrders} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('Làm mới', 'Refresh')}
            </Button>
          </div>
        </div>
        <Separator />

        <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
          {/* KPI Summary Cards */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Chờ xử lý', 'Pending')}</p>
                      <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-400">{kpis.pending}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('đơn hàng chờ xử lý', 'orders pending')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Đơn hôm nay', 'Today&apos;s Orders')}</p>
                      <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{kpis.today}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('đơn hàng mới', 'new orders')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Tổng doanh thu', 'Total Revenue')}</p>
                      <p className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-400">{formatVND(kpis.revenue)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('từ', 'from')} {kpis.total} {t('đơn hàng', 'orders')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Status Filter Tabs + Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-1 flex-wrap">
              {STATUS_TABS.map((tab) => (
                <Button
                  key={tab.key}
                  variant={activeTab === tab.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setActiveTab(tab.key); setPage(1); }}
                  className={
                    activeTab === tab.key
                      ? 'shadow-sm rounded-full px-4'
                      : 'rounded-full px-4 text-muted-foreground hover:text-foreground'
                  }
                >
                  {locale === 'vi' ? tab.label : tab.labelEn}
                </Button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('Tìm mã đơn, cửa hàng...', 'Search order #, shop...')}
                className="pl-9 h-9 text-sm rounded-lg"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {/* Orders Table */}
          <Card className="shadow-sm rounded-xl overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 md:p-6 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-24 rounded" />
                      <Skeleton className="h-4 w-32 rounded" />
                      <Skeleton className="h-4 w-20 rounded" />
                      <Skeleton className="h-4 w-16 rounded" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-4 w-24 rounded ml-auto" />
                      <Skeleton className="h-4 w-20 rounded" />
                    </div>
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-20">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Package className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('Không có đơn hàng nào', 'No orders found')}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {t('Đơn hàng mới sẽ xuất hiện ở đây', 'New orders will appear here')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Mã đơn', 'Order #')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Cửa hàng', 'Shop')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Khu vực', 'District')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Sản phẩm', 'Items')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Trạng thái', 'Status')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Tổng tiền', 'Total')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Ngày tạo', 'Date')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order: any) => (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => router.push(`/distributor/orders/${order.id}`)}
                        >
                          <TableCell>
                            <span className="font-semibold text-sm">{order.orderNumber}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">{order.shopName}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {order.shopDistrict}{order.shopProvince ? `, ${order.shopProvince}` : ''}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-muted text-xs font-medium">
                              {order.itemCount || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`rounded-full text-[11px] font-medium px-2.5 py-0.5 ${statusColor(order.status)}`}>
                              {statusLabel(order.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatVND(order.totalAmount)}</TableCell>
                          <TableCell className="text-right text-muted-foreground text-xs">
                            {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t(`Trang ${page}/${totalPages}`, `Page ${page}/${totalPages}`)}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> {t('Trước', 'Prev')}
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  {t('Sau', 'Next')} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}