'use client';

import { useEffect, useState, useMemo } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { toast } from 'sonner';
import {
  ArrowLeft, Users, TrendingUp, RefreshCw, Search,
  PackageCheck, ShoppingCart, Printer, CalendarDays,
  MapPin, Package, CheckCircle2,
  XCircle, AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { AdminHeader } from '@/components/layout/admin-header';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Types ─────────────────────────────────────────────────────────
interface GroupDealListItem {
  id: string;
  title: string;
  titleEn?: string | null;
  status: string;
  product: { id: string; name: string; sku: string; unit?: string };
  originalPrice: number;
  discountPrice: number;
  targetQty: number;
  currentQty: number;
  participantCount: number;
  orderSummary: {
    total: number;
    byStatus: Record<string, number>;
    fulfillmentPct: number;
  };
  totalQty: number;
  totalValue: number;
  ward?: { id: string; name: string; district: string } | null;
  startsAt: string;
  expiresAt: string;
  createdAt: string;
}

interface OrderTracking {
  id: string;
  orderNumber: string;
  shop: { id: string; name: string; district: string; province: string; address: string } | null;
  status: string;
  totalAmount: number;
  itemCount: number;
  totalQty: number;
  totalFreeQty: number;
  deliveredAt: string | null;
  shipmentStatus: string | null;
  timeline: Array<{ status: string; timestamp: string | null }>;
  createdAt: string;
}

interface PickingItem {
  productId: string;
  productName: string;
  productSku: string;
  totalQty: number;
  totalFreeQty: number;
  unitPrice: number;
  totalValue: number;
  orderCount: number;
}

interface Participant {
  id: string;
  shopId: string;
  shopName: string;
  shopDistrict: string;
  shopProvince: string;
}

interface GroupDealDetail {
  id: string;
  title: string;
  titleEn?: string | null;
  description?: string | null;
  status: string;
  product: { id: string; name: string; nameEn?: string | null; sku: string; unit: string; basePrice: number };
  originalPrice: number;
  discountPrice: number;
  targetQty: number;
  currentQty: number;
  maxParticipants?: number;
  ward?: { id: string; name: string; nameEn?: string | null; district: string; province: string } | null;
  startsAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  orderSummary: { total: number; byStatus: Record<string, number>; fulfillmentPct: number };
  totalValue: number;
  participantCount: number;
  participants: Participant[];
  orders: OrderTracking[];
  pickingList: { items: PickingItem[]; summary: { totalProducts: number; totalQty: number; totalFreeQty: number; totalValue: number } };
}

// ─── Status helpers ────────────────────────────────────────────────
const statusBadgeClass = (s: string) => {
  switch (s) {
    case 'ACTIVE': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
    case 'COMPLETED': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
    case 'CANCELLED': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
    case 'EXPIRED': return 'bg-gray-100 text-gray-600 dark:bg-gray-800/40 dark:text-gray-400';
    default: return 'bg-gray-100 text-gray-700';
  }
};

const statusLabel = (s: string, vi: boolean) => {
  const m: Record<string, { vi: string; en: string }> = {
    ACTIVE: { vi: 'Đang mở', en: 'Active' },
    COMPLETED: { vi: 'Hoàn thành', en: 'Completed' },
    CANCELLED: { vi: 'Đã hủy', en: 'Cancelled' },
    EXPIRED: { vi: 'Hết hạn', en: 'Expired' },
  };
  const entry = m[s] || { vi: s, en: s };
  return vi ? entry.vi : entry.en;
};

const orderStatusBadge = (s: string) => {
  switch (s) {
    case 'PENDING': return 'border border-gray-300 text-gray-700 bg-white';
    case 'CONFIRMED': return 'bg-secondary text-secondary-foreground';
    case 'PROCESSING': return 'bg-secondary text-secondary-foreground';
    case 'PACKED': return 'bg-primary text-primary-foreground';
    case 'OUT_FOR_DELIVERY': return 'bg-primary text-primary-foreground';
    case 'DELIVERED': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
    case 'CANCELLED': return 'bg-destructive text-destructive-foreground';
    default: return 'bg-secondary text-secondary-foreground';
  }
};

const orderStatusLabel = (s: string, vi: boolean) => {
  const m: Record<string, { vi: string; en: string }> = {
    PENDING: { vi: 'Chờ xử lý', en: 'Pending' },
    CONFIRMED: { vi: 'Đã xác nhận', en: 'Confirmed' },
    PROCESSING: { vi: 'Đang xử lý', en: 'Processing' },
    PACKED: { vi: 'Đã đóng gói', en: 'Packed' },
    OUT_FOR_DELIVERY: { vi: 'Đang giao', en: 'Out for Delivery' },
    DELIVERED: { vi: 'Đã giao', en: 'Delivered' },
    CANCELLED: { vi: 'Đã hủy', en: 'Cancelled' },
    REFUNDED: { vi: 'Đã hoàn', en: 'Refunded' },
  };
  const entry = m[s] || { vi: s, en: s };
  return vi ? entry.vi : entry.en;
};

const shipmentStatusLabel = (s: string | null, vi: boolean) => {
  if (!s) return '-';
  const m: Record<string, { vi: string; en: string }> = {
    PENDING: { vi: 'Chờ', en: 'Pending' },
    PICKED_UP: { vi: 'Đã lấy', en: 'Picked Up' },
    IN_TRANSIT: { vi: 'Đang vận chuyển', en: 'In Transit' },
    DELIVERED: { vi: 'Đã giao', en: 'Delivered' },
    FAILED: { vi: 'Thất bại', en: 'Failed' },
  };
  const entry = m[s] || { vi: s, en: s };
  return vi ? entry.vi : entry.en;
};

const fulfillmentColor = (pct: number) => {
  if (pct < 30) return '[&>div]:bg-red-500';
  if (pct < 70) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-emerald-500';
};

const STATUS_FILTERS = [
  { key: '', vi: 'Tất cả', en: 'All' },
  { key: 'ACTIVE', vi: 'Đang mở', en: 'Active' },
  { key: 'COMPLETED', vi: 'Hoàn thành', en: 'Completed' },
  { key: 'CANCELLED', vi: 'Đã hủy', en: 'Cancelled' },
  { key: 'EXPIRED', vi: 'Hết hạn', en: 'Expired' },
];

// ─── Main Component ────────────────────────────────────────────────
export default function DistributorGroupBuy() {
  const { locale } = useLocale();
  const vi = locale === 'vi';
  const t = (v: string, e: string) => (vi ? v : e);

  // List state
  const [items, setItems] = useState<GroupDealListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Detail state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupDealDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');

  // ─── Fetch list & detail ───────────────────────────────────────
  const loadList = async (signal?: AbortSignal) => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await adminFetch(`/api/distributor/group-buy?${params}`);
      if (signal?.aborted) return;
      if (res.success) {
        let result = res.data.items || [];
        if (search.trim()) {
          const q = search.toLowerCase();
          result = result.filter(
            (item: GroupDealListItem) =>
              item.title.toLowerCase().includes(q) ||
              item.product?.name?.toLowerCase().includes(q) ||
              item.product?.sku?.toLowerCase().includes(q),
          );
        }
        setItems(result);
        setTotalPages(res.data.pagination?.totalPages || 1);
      } else {
        toast.error(res.error?.message || t('Lỗi tải danh sách', 'Failed to load'));
      }
    } catch (e) {
      if (!signal?.aborted) {
        console.error('[GROUP-BUY LIST ERROR]', e);
        toast.error(t('Lỗi kết nối', 'Connection error'));
      }
    }
    setListLoading(false);
  };

  const loadDetail = async (id: string, signal?: AbortSignal) => {
    setDetailLoading(true);
    setActiveTab('orders');
    try {
      const res = await adminFetch(`/api/distributor/group-buy?id=${id}`);
      if (signal?.aborted) return;
      if (res.success) {
        setDetail(res.data);
      } else {
        toast.error(res.error?.message || t('Lỗi tải chi tiết', 'Failed to load detail'));
        setSelectedId(null);
      }
    } catch (e) {
      if (!signal?.aborted) {
        console.error('[GROUP-BUY DETAIL ERROR]', e);
        toast.error(t('Lỗi kết nối', 'Connection error'));
        setSelectedId(null);
      }
    }
    setDetailLoading(false);
  };

  const refreshKey = `${page}-${statusFilter}-${search}-${selectedId}`;
  useEffect(() => {
    const ac = new AbortController();
    if (selectedId) {
      loadDetail(selectedId, ac.signal);
    } else {
      loadList(ac.signal);
    }
    return () => ac.abort();
  }, [refreshKey]);

  // ─── KPIs ────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const active = items.filter((d) => d.status === 'ACTIVE').length;
    const completed = items.filter((d) => d.status === 'COMPLETED').length;
    const totalValue = items
      .filter((d) => d.status === 'ACTIVE')
      .reduce((sum, d) => sum + (d.totalValue || 0), 0);
    const totalParticipants = items
      .filter((d) => d.status === 'ACTIVE')
      .reduce((sum, d) => sum + (d.participantCount || 0), 0);
    return { active, completed, totalValue, totalParticipants };
  }, [items]);

  // ─── Back handler ───────────────────────────────────────────────
  const handleBack = () => {
    setSelectedId(null);
    setDetail(null);
  };

  // ═══════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════════════════════════════════════════
  if (selectedId && detailLoading) {
    return (
      <>
        <AdminHeader />
        <div className="flex-1 px-4 md:px-6 py-6 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg w-full" />
          ))}
        </div>
      </>
    );
  }

  if (selectedId && detail) {
    const pctReached = detail.targetQty > 0
      ? Math.round((detail.currentQty / detail.targetQty) * 1000) / 10
      : 0;
    const fulfillPct = detail.orderSummary.fulfillmentPct;

    return (
      <>
        <AdminHeader />
        <div className="flex flex-1 flex-col">
          <div className="px-4 md:px-6 py-6 space-y-6">
            {/* Back + Title */}
            <div className="flex items-start gap-4">
              <Button variant="outline" size="sm" onClick={handleBack} className="mt-0.5 shrink-0">
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                {t('Quay lại', 'Back')}
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                    {vi ? detail.title : (detail.titleEn || detail.title)}
                  </h1>
                  <Badge variant="secondary" className={`rounded-full text-[11px] font-semibold px-2.5 py-0.5 ${statusBadgeClass(detail.status)}`}>
                    {statusLabel(detail.status, vi)}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{detail.product.name}</span>
                  <Badge variant="outline" className="text-[11px] font-mono">{detail.product.sku}</Badge>
                  {detail.ward && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {detail.ward.district}{detail.ward.province ? `, ${detail.ward.province}` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Info Cards Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Pricing */}
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/20">
                <CardContent className="p-4">
                  <p className="text-[11px] font-medium text-muted-foreground">{t('Giá mua chung', 'Group Price')}</p>
                  <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">{formatVND(detail.discountPrice)}</p>
                  <p className="text-xs text-muted-foreground line-through">{formatVND(detail.originalPrice)}</p>
                </CardContent>
              </Card>
              {/* Progress */}
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/20">
                <CardContent className="p-4">
                  <p className="text-[11px] font-medium text-muted-foreground">{t('Tiến độ nhóm', 'Group Progress')}</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400 mt-1">
                    {detail.currentQty} / {detail.targetQty}
                  </p>
                  <p className="text-xs text-muted-foreground">{pctReached}% {t('đạt mục tiêu', 'of target')}</p>
                </CardContent>
              </Card>
              {/* Dates */}
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20">
                <CardContent className="p-4">
                  <p className="text-[11px] font-medium text-muted-foreground">{t('Thời gian', 'Duration')}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs font-medium">
                      {new Date(detail.startsAt).toLocaleDateString('vi-VN')} — {new Date(detail.expiresAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {detail.participantCount} {t('người tham gia', 'participants')}
                  </p>
                </CardContent>
              </Card>
              {/* Fulfillment */}
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20">
                <CardContent className="p-4">
                  <p className="text-[11px] font-medium text-muted-foreground">{t('Đã giao', 'Fulfilled')}</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 mt-1">{fulfillPct}%</p>
                  <p className="text-xs text-muted-foreground">
                    {detail.orderSummary.total} {t('đơn hàng', 'orders')}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Progress bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="shadow-sm rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{t('Tiến độ số lượng', 'Quantity Progress')}</span>
                  <span className="text-sm font-bold text-blue-600">{pctReached}%</span>
                </div>
                <Progress value={pctReached} className={`h-3 rounded-full ${fulfillmentColor(pctReached)}`} />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {detail.currentQty} / {detail.targetQty} {detail.product.unit || t('sản phẩm', 'units')}
                </p>
              </Card>
              <Card className="shadow-sm rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{t('Tiến độ giao hàng', 'Delivery Progress')}</span>
                  <span className="text-sm font-bold text-emerald-600">{fulfillPct}%</span>
                </div>
                <Progress value={fulfillPct} className={`h-3 rounded-full ${fulfillmentColor(fulfillPct)}`} />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {detail.orderSummary.total} {t('đơn hàng', 'orders')}
                </p>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-10">
                <TabsTrigger value="orders" className="gap-1.5 text-sm">
                  <ShoppingCart className="h-4 w-4" />
                  {t('Đơn hàng', 'Orders')}
                  <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center">
                    {detail.orders.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="picking" className="gap-1.5 text-sm">
                  <PackageCheck className="h-4 w-4" />
                  {t('Danh sách lấy hàng', 'Picking List')}
                </TabsTrigger>
                <TabsTrigger value="participants" className="gap-1.5 text-sm">
                  <Users className="h-4 w-4" />
                  {t('Người tham gia', 'Participants')}
                </TabsTrigger>
              </TabsList>

              {/* ── Tab: Orders ──────────────────────────────────────── */}
              <TabsContent value="orders">
                <Card className="shadow-sm rounded-xl overflow-hidden">
                  <CardContent className="p-0">
                    {detail.orders.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                          <ShoppingCart className="h-7 w-7 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {t('Chưa có đơn hàng nào', 'No orders yet')}
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="font-semibold text-xs uppercase tracking-wider w-10">#</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Mã ĐH', 'Order #')}</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Cửa hàng', 'Shop')}</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Quận', 'District')}</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Trạng thái', 'Status')}</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('SL', 'Qty')}</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Thành tiền', 'Total')}</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Giao hàng', 'Shipment')}</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Ngày giao', 'Delivered')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail.orders.map((order, idx) => (
                              <TableRow key={order.id} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                                <TableCell>
                                  <span className="font-semibold text-sm">{order.orderNumber}</span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm font-medium">{order.shop?.name || '-'}</span>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                  {order.shop?.district || '-'}{order.shop?.province ? `, ${order.shop.province}` : ''}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className={`rounded-full text-[11px] font-medium px-2.5 py-0.5 ${orderStatusBadge(order.status)}`}>
                                    {orderStatusLabel(order.status, vi)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span className="inline-flex items-center justify-center h-6 min-w-6 rounded-full bg-muted text-xs font-medium px-1.5">
                                    {order.totalQty}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-semibold text-sm">{formatVND(order.totalAmount)}</TableCell>
                                <TableCell className="text-center">
                                  {order.shipmentStatus ? (
                                    <Badge variant="secondary" className="rounded-full text-[11px] font-medium px-2 py-0.5 bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400">
                                      {shipmentStatusLabel(order.shipmentStatus, vi)}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                  {order.deliveredAt
                                    ? new Date(order.deliveredAt).toLocaleDateString('vi-VN')
                                    : '-'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Tab: Picking List ──────────────────────────────── */}
              <TabsContent value="picking">
                <div className="print-area" id="picking-list-print">
                  {/* Print Header */}
                  <div className="hidden print:block print:mb-4 print:text-center">
                    <h2 className="text-xl font-bold print:text-lg">
                      {t('DANH SÁCH LẤY HÀNG', 'PICKING LIST')}
                    </h2>
                    <p className="text-sm print:text-xs mt-1">
                      {vi ? detail.title : (detail.titleEn || detail.title)} — {new Date().toLocaleDateString('vi-VN')}
                    </p>
                    <hr className="mt-2" />
                  </div>

                  <Card className="shadow-sm rounded-xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-3 print:pb-2">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <PackageCheck className="h-5 w-5 text-emerald-600" />
                        {t('Danh sách lấy hàng tổng hợp', 'Consolidated Picking List')}
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 print:hidden"
                        onClick={() => window.print()}
                      >
                        <Printer className="h-4 w-4" />
                        {t('In danh sách', 'Print')}
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      {detail.pickingList.items.length === 0 ? (
                        <div className="text-center py-16">
                          <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                            <Package className="h-7 w-7 text-muted-foreground/40" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">
                            {t('Chưa có sản phẩm nào', 'No products yet')}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent">
                                <TableHead className="font-semibold text-xs uppercase tracking-wider w-10">#</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Sản phẩm', 'Product')}</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Tổng SL', 'Total Qty')}</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('SL tặng', 'Free Qty')}</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Đơn giá', 'Unit Price')}</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Thành tiền', 'Total')}</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Số ĐH chứa', 'Orders')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detail.pickingList.items.map((item, idx) => (
                                <TableRow key={item.productId} className="hover:bg-muted/50 transition-colors">
                                  <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                                  <TableCell>
                                    <div>
                                      <span className="text-sm font-medium">{item.productName}</span>
                                      <p className="text-[11px] text-muted-foreground font-mono">{item.productSku}</p>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <span className="inline-flex items-center justify-center h-7 min-w-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-sm font-bold px-2">
                                      {item.totalQty}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {item.totalFreeQty > 0 ? (
                                      <span className="inline-flex items-center justify-center h-7 min-w-7 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-sm font-bold px-2">
                                        {item.totalFreeQty}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">0</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right text-sm">{formatVND(item.unitPrice)}</TableCell>
                                  <TableCell className="text-right font-semibold text-sm">{formatVND(item.totalValue)}</TableCell>
                                  <TableCell className="text-center">
                                    <span className="inline-flex items-center justify-center h-6 min-w-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium px-1.5">
                                      {item.orderCount}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Picking Summary */}
                  {detail.pickingList.items.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                      <Card className="shadow-sm rounded-xl border-0 bg-blue-50 dark:bg-blue-950/30 print:shadow-none print:border print:border-gray-300">
                        <CardContent className="p-4">
                          <p className="text-[11px] font-medium text-muted-foreground">{t('Tổng sản phẩm', 'Total Products')}</p>
                          <p className="text-xl font-bold text-blue-700 dark:text-blue-400 mt-1">
                            {detail.pickingList.summary.totalProducts}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="shadow-sm rounded-xl border-0 bg-emerald-50 dark:bg-emerald-950/30 print:shadow-none print:border print:border-gray-300">
                        <CardContent className="p-4">
                          <p className="text-[11px] font-medium text-muted-foreground">{t('Tổng số lượng', 'Total Qty')}</p>
                          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                            {detail.pickingList.summary.totalQty}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="shadow-sm rounded-xl border-0 bg-amber-50 dark:bg-amber-950/30 print:shadow-none print:border print:border-gray-300">
                        <CardContent className="p-4">
                          <p className="text-[11px] font-medium text-muted-foreground">{t('Tổng miễn phí', 'Total Free')}</p>
                          <p className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">
                            {detail.pickingList.summary.totalFreeQty}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="shadow-sm rounded-xl border-0 bg-rose-50 dark:bg-rose-950/30 print:shadow-none print:border print:border-gray-300">
                        <CardContent className="p-4">
                          <p className="text-[11px] font-medium text-muted-foreground">{t('Tổng giá trị', 'Total Value')}</p>
                          <p className="text-lg font-bold text-rose-700 dark:text-rose-400 mt-1">
                            {formatVND(detail.pickingList.summary.totalValue)}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── Tab: Participants ──────────────────────────────── */}
              <TabsContent value="participants">
                <Card className="shadow-sm rounded-xl overflow-hidden">
                  <CardContent className="p-0">
                    {detail.participants.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                          <Users className="h-7 w-7 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                          {t('Chưa có người tham gia', 'No participants yet')}
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="font-semibold text-xs uppercase tracking-wider w-10">#</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Cửa hàng', 'Shop')}</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Quận/Huyện', 'District')}</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Tỉnh/Thành', 'Province')}</TableHead>
                              <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Trạng thái', 'Status')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detail.participants.map((p, idx) => (
                              <TableRow key={p.id} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                                      <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <span className="text-sm font-medium">{p.shopName}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">{p.shopDistrict || '-'}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{p.shopProvince || '-'}</TableCell>
                                <TableCell className="text-center">
                                  <Badge variant="secondary" className="rounded-full text-[11px] font-medium px-2.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                                    {t('Tham gia', 'Active')}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════════
  return (
    <>
      <AdminHeader />
      <div className="flex flex-1 flex-col">
        {/* Page Header */}
        <div className="px-4 md:px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <ShoppingCart className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight">{t('Mua chung', 'Group Buy')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('Theo dõi lô mua chung — lấy hàng & giao hàng', 'Track group buy batches — picking & delivery')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => loadList()} disabled={listLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${listLoading ? 'animate-spin' : ''}`} />
              {t('Làm mới', 'Refresh')}
            </Button>
          </div>
        </div>
        <Separator />

        <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
          {/* KPI Cards */}
          {listLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {/* Active */}
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Đang hoạt động', 'Active')}</p>
                      <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{kpis.active}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('lô mua chung', 'group deals')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Completed */}
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-blue-50 to-sky-50 dark:from-blue-950/30 dark:to-sky-950/20 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Đã hoàn thành', 'Completed')}</p>
                      <p className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-400">{kpis.completed}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('lô hoàn tất', 'deals done')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Total Value */}
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/20 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Tổng giá trị', 'Total Value')}</p>
                      <p className="text-lg font-bold mt-1 text-rose-700 dark:text-rose-400">{formatVND(kpis.totalValue)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('lô đang mở', 'active deals')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
                      <Package className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              {/* Participants */}
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Số tham gia', 'Participants')}</p>
                      <p className="text-2xl font-bold mt-1 text-amber-700 dark:text-amber-400">{kpis.totalParticipants}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('người tham gia', 'participants')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                      <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTERS.map((filter) => (
                <Button
                  key={filter.key}
                  variant={statusFilter === filter.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter(filter.key); setPage(1); }}
                  className={
                    statusFilter === filter.key
                      ? 'shadow-sm rounded-full px-4'
                      : 'rounded-full px-4 text-muted-foreground hover:text-foreground'
                  }
                >
                  {vi ? filter.vi : filter.en}
                </Button>
              ))}
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('Tìm theo tên, SKU...', 'Search by name, SKU...')}
                className="pl-9 h-9 text-sm rounded-lg"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {/* Group Buy Cards Grid */}
          {listLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="shadow-sm rounded-xl">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('Không có lô mua chung nào', 'No group buy deals found')}
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {t('Lô mua chung mới sẽ xuất hiện ở đây', 'New group buy deals will appear here')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map((deal) => {
                const qtyPct = deal.targetQty > 0
                  ? Math.round((deal.currentQty / deal.targetQty) * 1000) / 10
                  : 0;
                const fPct = deal.orderSummary.fulfillmentPct;
                const byStatus = deal.orderSummary.byStatus || {};

                return (
                  <Card
                    key={deal.id}
                    className="shadow-sm rounded-xl border hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => setSelectedId(deal.id)}
                  >
                    <CardContent className="p-5 space-y-4">
                      {/* Title + Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-base leading-snug group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors truncate">
                            {vi ? deal.title : (deal.titleEn || deal.title)}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">{deal.product.name}</span>
                            <Badge variant="outline" className="text-[10px] font-mono h-5 px-1.5">{deal.product.sku}</Badge>
                          </div>
                        </div>
                        <Badge variant="secondary" className={`rounded-full text-[11px] font-semibold px-2.5 py-0.5 shrink-0 ${statusBadgeClass(deal.status)}`}>
                          {statusLabel(deal.status, vi)}
                        </Badge>
                      </div>

                      {/* Pricing */}
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-muted-foreground line-through">{formatVND(deal.originalPrice)}</span>
                        <span className="text-lg font-bold text-rose-600 dark:text-rose-400">{formatVND(deal.discountPrice)}</span>
                        {deal.originalPrice > 0 && (
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded">
                            -{Math.round(((deal.originalPrice - deal.discountPrice) / deal.originalPrice) * 100)}%
                          </span>
                        )}
                      </div>

                      {/* Quantity Progress */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">{t('Tiến độ số lượng', 'Quantity Progress')}</span>
                          <span className="font-semibold text-blue-700 dark:text-blue-400">{deal.currentQty}/{deal.targetQty} ({qtyPct}%)</span>
                        </div>
                        <Progress value={qtyPct} className="h-2 rounded-full" />
                      </div>

                      {/* Fulfillment Progress */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">{t('Tiến độ giao hàng', 'Delivery Progress')}</span>
                          <span className="font-semibold">
                            <span className={fPct < 30 ? 'text-red-600 dark:text-red-400' : fPct < 70 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                              {fPct}%
                            </span>
                          </span>
                        </div>
                        <Progress value={fPct} className={`h-2 rounded-full ${fulfillmentColor(fPct)}`} />
                      </div>

                      {/* Order Breakdown */}
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(byStatus).map(([status, count]) => (
                          <span
                            key={status}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-muted-foreground"
                          >
                            {orderStatusLabel(status, vi)}: {count as number}
                          </span>
                        ))}
                        {Object.keys(byStatus).length === 0 && (
                          <span className="text-[11px] text-muted-foreground">{t('Chưa có đơn hàng', 'No orders yet')}</span>
                        )}
                      </div>

                      <Separator />

                      {/* Bottom Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span className="font-medium text-foreground">{deal.participantCount}</span>
                          <span>{t('tham gia', 'participants')}</span>
                        </div>
                        <div className="text-sm font-semibold">
                          {formatVND(deal.totalValue)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

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
                  {t('Trước', 'Prev')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  {t('Sau', 'Next')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}