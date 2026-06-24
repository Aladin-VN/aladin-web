'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { toast } from 'sonner';
import {
  Truck,
  MapPin,
  Phone,
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminHeader } from '@/components/layout/admin-header';
import { Separator } from '@/components/ui/separator';

// ============================================
// Status config
// ============================================

const STATUS_TABS = [
  { key: '', label: 'Tất cả', labelEn: 'All' },
  { key: 'PACKED', label: 'Chờ lấy hàng', labelEn: 'Packed' },
  { key: 'OUT_FOR_DELIVERY', label: 'Đang giao', labelEn: 'In Transit' },
  { key: 'DELIVERED', label: 'Đã giao', labelEn: 'Delivered' },
];

const statusColor = (s: string) => {
  switch (s) {
    case 'PACKED':
      return 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400';
    case 'OUT_FOR_DELIVERY':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
    case 'DELIVERED':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const statusLabel = (s: string) => {
  const m: Record<string, string> = {
    PACKED: 'Chờ lấy hàng',
    OUT_FOR_DELIVERY: 'Đang giao',
    DELIVERED: 'Đã giao',
  };
  return m[s] || s;
};

// ============================================
// Types
// ============================================

interface DeliveryItem {
  id: string;
  orderNumber: string;
  status: string;
  shopName: string;
  shopDistrict: string;
  shopAddress: string;
  shopPhone: string;
  itemCount: number;
  totalAmount: number;
  shipmentStatus: string | null;
  deliveredAt: string | null;
  packedAt: string | null;
  fulfilledByDistributorAt: string | null;
}

// ============================================
// Component
// ============================================

export default function DistributorDeliveries() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  // -------------------------------------------
  // Fetch
  // -------------------------------------------

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (activeTab) params.set('status', activeTab);
      if (search) params.set('search', search);
      const res = await adminFetch(`/api/distributor/deliveries?${params}`);
      if (res.success) {
        setDeliveries(res.data.items || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
      } else {
        toast.error(res.error?.message || t('Lỗi tải dữ liệu', 'Failed to load data'));
      }
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi kết nối', 'Connection error'));
    }
    setLoading(false);
  }, [activeTab, page, search, t]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  // -------------------------------------------
  // KPIs
  // -------------------------------------------

  const kpis = useMemo(() => {
    const packed = deliveries.filter((d) => d.status === 'PACKED').length;
    const inTransit = deliveries.filter((d) => d.status === 'OUT_FOR_DELIVERY').length;
    const delivered = deliveries.filter((d) => d.status === 'DELIVERED').length;
    return { packed, inTransit, delivered, total: deliveries.length };
  }, [deliveries]);

  // -------------------------------------------
  // Format date helper
  // -------------------------------------------

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // -------------------------------------------
  // Render
  // -------------------------------------------

  return (
    <div>
    <AdminHeader />
    <div className="flex flex-1 flex-col">
      {/* Page Header */}
      <div className="px-4 md:px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-lg shadow-violet-600/20">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {t('Giao hàng', 'Deliveries')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t(
                'Theo dõi đơn hàng đã đóng gói và đang giao',
                'Track packed and in-transit orders',
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDeliveries} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('Làm mới', 'Refresh')}
          </Button>
        </div>
      </div>
      <Separator />

      <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Packed */}
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('Đang chờ', 'Packed')}
                    </p>
                    <p className="text-2xl font-bold mt-1 text-violet-700 dark:text-violet-400">
                      {kpis.packed}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t('chờ lấy hàng', 'ready for pickup')}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                    <Package className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* In Transit */}
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('Đang giao', 'In Transit')}
                    </p>
                    <p className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-400">
                      {kpis.inTransit}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t('đang vận chuyển', 'on the way')}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                    <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delivered */}
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('Đã giao', 'Delivered')}
                    </p>
                    <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">
                      {kpis.delivered}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t('giao thành công', 'successfully delivered')}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                    <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total */}
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('Tổng', 'Total')}
                    </p>
                    <p className="text-2xl font-bold mt-1 text-orange-700 dark:text-orange-400">
                      {kpis.total}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t('đơn giao hàng', 'delivery orders')}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />
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
                onClick={() => {
                  setActiveTab(tab.key);
                  setPage(1);
                }}
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
            <Truck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('Tìm mã đơn...', 'Search order #...')}
              className="pl-9 h-9 text-sm rounded-lg"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>

        {/* Deliveries Table */}
        <Card className="shadow-sm rounded-xl overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 md:p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-4 w-36 rounded" />
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-4 w-12 rounded" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-4 w-24 rounded ml-auto" />
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                ))}
              </div>
            ) : deliveries.length === 0 ? (
              <div className="text-center py-20">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Truck className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('Không có đơn giao hàng nào', 'No delivery orders found')}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {t(
                    'Đơn hàng đã đóng gói sẽ xuất hiện ở đây',
                    'Packed orders will appear here',
                  )}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">
                        {t('Mã đơn', 'Order #')}
                      </TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">
                        {t('Cửa hàng', 'Shop')}
                      </TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">
                        {t('Khu vực', 'District')}
                      </TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">
                        {t('Số SP', 'Items')}
                      </TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">
                        {t('Trạng thái', 'Status')}
                      </TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">
                        {t('Tiền', 'Amount')}
                      </TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">
                        {t('Ngày giao', 'Delivery Date')}
                      </TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">
                        {t('Hành động', 'Actions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map((d) => (
                      <TableRow
                        key={d.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => router.push(`/distributor/orders/${d.id}`)}
                      >
                        <TableCell>
                          <span className="font-semibold text-sm">{d.orderNumber}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{d.shopName}</span>
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {d.shopPhone || '—'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {d.shopDistrict || d.shopAddress || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center h-6 min-w-[24px] rounded-full bg-muted text-xs font-medium px-1.5">
                            {d.itemCount || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`rounded-full text-[11px] font-medium px-2.5 py-0.5 ${statusColor(d.status)}`}
                          >
                            {statusLabel(d.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          {formatVND(d.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {d.status === 'DELIVERED'
                              ? formatDate(d.deliveredAt)
                              : d.status === 'PACKED'
                                ? formatDate(d.packedAt)
                                : formatDate(d.fulfilledByDistributorAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/distributor/orders/${d.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </Button>
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
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('Trước', 'Prev')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('Sau', 'Next')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}