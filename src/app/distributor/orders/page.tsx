'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import {
  Search, ChevronLeft, ChevronRight, RefreshCw, Loader2, Filter,
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
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
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
    case 'PENDING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'CONFIRMED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'PROCESSING': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'PACKED': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
    case 'DELIVERED': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'CANCELLED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
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

  return (
    <>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
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
          <Separator />

          <div className="flex-1 px-6 py-4 space-y-4">
            {/* Tabs + Search */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-1">
                {STATUS_TABS.map((tab) => (
                  <Button
                    key={tab.key}
                    variant={activeTab === tab.key ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => { setActiveTab(tab.key); setPage(1); }}
                    className="text-xs"
                  >
                    {locale === 'vi' ? tab.label : tab.labelEn}
                  </Button>
                ))}
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('Tìm mã đơn, cửa hàng...', 'Search order #, shop...')}
                  className="pl-9 h-9 text-sm"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>

            {/* Orders Table */}
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-16 text-sm text-muted-foreground">
                    {t('Không có đơn hàng nào', 'No orders found')}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Mã đơn', 'Order #')}</TableHead>
                        <TableHead>{t('Cửa hàng', 'Shop')}</TableHead>
                        <TableHead>{t('Khu vực', 'District')}</TableHead>
                        <TableHead>{t('Sản phẩm', 'Items')}</TableHead>
                        <TableHead>{t('Trạng thái', 'Status')}</TableHead>
                        <TableHead className="text-right">{t('Tổng tiền', 'Total')}</TableHead>
                        <TableHead className="text-right">{t('Ngày tạo', 'Date')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order: any) => (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/distributor/orders/${order.id}`)}
                        >
                          <TableCell className="font-medium">{order.orderNumber}</TableCell>
                          <TableCell>{order.shopName}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {order.shopDistrict}{order.shopProvince ? `, ${order.shopProvince}` : ''}
                          </TableCell>
                          <TableCell>{order.itemCount || '-'}</TableCell>
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
      </SidebarInset>
    </>
  );
}