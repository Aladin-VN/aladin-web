'use client';
import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import {
  ShoppingCart, Banknote, Leaf, PackageOpen, Printer, RefreshCw,
  CalendarDays, ArrowRightLeft, Truck, Package, AlertCircle, CheckCircle2, Clock, XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminHeader } from '@/components/layout/admin-header';
import { toast } from 'sonner';

// ---- Status badge helpers ----
const orderStatusConfig: Record<string, { label_vi: string; label_en: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label_vi: 'Chờ xử lý', label_en: 'Pending', variant: 'outline' },
  CONFIRMED: { label_vi: 'Đã xác nhận', label_en: 'Confirmed', variant: 'secondary' },
  PROCESSING: { label_vi: 'Đang xử lý', label_en: 'Processing', variant: 'secondary' },
  PACKED: { label_vi: 'Đã đóng gói', label_en: 'Packed', variant: 'default' },
  OUT_FOR_DELIVERY: { label_vi: 'Đang giao', label_en: 'Out for Delivery', variant: 'default' },
  DELIVERED: { label_vi: 'Đã giao', label_en: 'Delivered', variant: 'secondary' },
  CANCELLED: { label_vi: 'Đã hủy', label_en: 'Cancelled', variant: 'destructive' },
  REFUNDED: { label_vi: 'Hoàn tiền', label_en: 'Refunded', variant: 'destructive' },
};

const shipmentStatusConfig: Record<string, { label_vi: string; label_en: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label_vi: 'Chờ xử lý', label_en: 'Pending', variant: 'outline' },
  PICKED_UP: { label_vi: 'Đã lấy hàng', label_en: 'Picked Up', variant: 'secondary' },
  IN_TRANSIT: { label_vi: 'Đang vận chuyển', label_en: 'In Transit', variant: 'default' },
  DELIVERED: { label_vi: 'Đã giao', label_en: 'Delivered', variant: 'secondary' },
  FAILED: { label_vi: 'Giao thất bại', label_en: 'Failed', variant: 'destructive' },
};

const movementTypeConfig: Record<string, { label_vi: string; label_en: string; color: string; icon: typeof ArrowRightLeft }> = {
  RECEIPT: { label_vi: 'Nhập kho', label_en: 'Receipt', color: 'text-green-600', icon: Package },
  ADJUSTMENT: { label_vi: 'Điều chỉnh', label_en: 'Adjustment', color: 'text-blue-600', icon: ArrowRightLeft },
  ORDER_FULFILLMENT: { label_vi: 'Xuất đơn', label_en: 'Order Fulfillment', color: 'text-purple-600', icon: ShoppingCart },
  RETURN: { label_vi: 'Trả hàng', label_en: 'Return', color: 'text-orange-600', icon: ArrowRightLeft },
  DAMAGE: { label_vi: 'Hư hỏng', label_en: 'Damage', color: 'text-red-600', icon: AlertCircle },
} as const;

const defaultMovementIcon = ArrowRightLeft;

export default function DailyReportPage() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Default to today
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });

  const fetchReport = async (date: string, loc: string) => {
    setLoading(true);
    const tFn = (vi: string, en: string) => loc === 'vi' ? vi : en;
    try {
      const qs = date ? `?date=${date}` : '';
      const res = await adminFetch(`/api/distributor/daily-report${qs}`);
      if (res.success) {
        setData(res.data);
      } else {
        toast.error(res.error?.message || tFn('Lỗi tải báo cáo', 'Failed to load report'));
      }
    } catch (e: any) {
      toast.error(e?.message || tFn('Lỗi mạng', 'Network error'));
    }
    setLoading(false);
  };

  useEffect(() => { fetchReport(selectedDate, locale); }, [selectedDate, locale]);

  const handlePrint = () => {
    window.print();
  };

  const kpiCards = data ? [
    {
      label: t('Tổng đơn hàng', 'Total Orders'),
      value: `${data.orders.total}`,
      icon: ShoppingCart,
      gradient: 'bg-gradient-to-br from-blue-500 to-blue-600',
      iconBg: 'bg-blue-400/30',
    },
    {
      label: t('Doanh thu POS', 'POS Revenue'),
      value: formatVND(data.pos.totalCash + data.pos.totalBank + data.pos.totalDebt),
      icon: Banknote,
      gradient: 'bg-gradient-to-br from-green-500 to-green-600',
      iconBg: 'bg-green-400/30',
    },
    {
      label: t('Doanh thu giao hàng', 'Delivered Revenue'),
      value: formatVND(data.orders.deliveredRevenue),
      icon: Leaf,
      gradient: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
      iconBg: 'bg-emerald-400/30',
    },
    {
      label: t('Nhập xuất kho', 'Inventory Movements'),
      value: `${data.inventory.movements}`,
      icon: PackageOpen,
      gradient: 'bg-gradient-to-br from-amber-500 to-amber-600',
      iconBg: 'bg-amber-400/30',
    },
  ] : [];

  return (
    <>
      <AdminHeader />
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t('Báo cáo chốt ngày', 'Daily Closing Report')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t('Tổng hợp hoạt động kinh doanh theo ngày', 'Comprehensive daily business summary')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              {t('In báo cáo', 'Print Report')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => fetchReport(selectedDate, locale)} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              {t('Làm mới', 'Refresh')}
            </Button>
          </div>
        </div>
        <Separator />

        <div className="flex-1 px-6 py-4 space-y-6">
          {/* Date Picker */}
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {t('Ngày báo cáo', 'Report Date')}
              </Label>
              <Input
                type="date"
                className="h-9 w-44 text-sm rounded-lg"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
            {data && (
              <div className="pb-1">
                <Badge variant="outline" className="text-xs">
                  {data.date}
                </Badge>
              </div>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))
              : kpiCards.map((kpi) => (
                  <Card key={kpi.label} className={`${kpi.gradient} border-0 text-white shadow-lg`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-white/80 font-medium">{kpi.label}</span>
                        <div className={`h-8 w-8 rounded-lg ${kpi.iconBg} flex items-center justify-center`}>
                          <kpi.icon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <p className="text-xl font-bold tracking-tight">{kpi.value}</p>
                    </CardContent>
                  </Card>
                ))}
          </div>

          {/* POS Shift Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                {t('Tổng hợp ca POS', 'POS Shift Summary')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : data && data.pos.shifts.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">{t('Mở ca', 'Opened')}</TableHead>
                        <TableHead className="text-xs">{t('Đóng ca', 'Closed')}</TableHead>
                        <TableHead className="text-xs text-right">{t('Tiền mặt', 'Cash')}</TableHead>
                        <TableHead className="text-xs text-right">{t('Chuyển khoản', 'Bank')}</TableHead>
                        <TableHead className="text-xs text-right">{t('Công nợ', 'Debt')}</TableHead>
                        <TableHead className="text-xs text-right">{t('Giao dịch', 'Txns')}</TableHead>
                        <TableHead className="text-xs text-right">{t('Chênh lệch', 'Diff')}</TableHead>
                        <TableHead className="text-xs">{t('Trạng thái', 'Status')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.pos.shifts.map((shift: any) => (
                        <TableRow key={shift.id}>
                          <TableCell className="text-xs">
                            {new Date(shift.openedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell className="text-xs">
                            {shift.closedAt
                              ? new Date(shift.closedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium">{formatVND(shift.cashTotal)}</TableCell>
                          <TableCell className="text-right text-xs font-medium">{formatVND(shift.bankTransferTotal)}</TableCell>
                          <TableCell className="text-right text-xs font-medium">{formatVND(shift.debtTotal)}</TableCell>
                          <TableCell className="text-right text-xs">{shift.salesCount}</TableCell>
                          <TableCell className="text-right text-xs">
                            <span className={shift.cashDifference === 0 ? 'text-green-600' : shift.cashDifference > 0 ? 'text-blue-600' : 'text-red-600'}>
                              {formatVND(shift.cashDifference ?? 0)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={shift.status === 'CLOSED' ? 'secondary' : 'outline'} className="text-[10px]">
                              {shift.status === 'CLOSED'
                                ? t('Đã đóng', 'Closed')
                                : t('Đang mở', 'Open')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Banknote className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">{t('Không có ca POS nào trong ngày', 'No POS shifts for this day')}</p>
                </div>
              )}

              {/* POS Totals Row */}
              {!loading && data && data.pos.shifts.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-4 rounded-lg bg-muted/50 p-3">
                  <div className="text-xs">
                    <span className="text-muted-foreground">{t('Tổng tiền mặt: ', 'Total Cash: ')}</span>
                    <span className="font-bold text-green-600">{formatVND(data.pos.totalCash)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">{t('Tổng CK: ', 'Total Bank: ')}</span>
                    <span className="font-bold text-blue-600">{formatVND(data.pos.totalBank)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">{t('Tổng nợ: ', 'Total Debt: ')}</span>
                    <span className="font-bold text-orange-600">{formatVND(data.pos.totalDebt)}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">{t('Tổng GD: ', 'Total Txns: ')}</span>
                    <span className="font-bold">{data.pos.totalTransactions}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Two columns: Order Status + Inventory Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Order Status Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  {t('Trạng thái đơn hàng', 'Order Status Breakdown')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : data && Object.keys(data.orders.byStatus).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(data.orders.byStatus)
                      .sort(([, a], [, b]) => (b as number) - (a as number))
                      .map(([status, count]) => {
                        const cfg = orderStatusConfig[status] || { label_vi: status, label_en: status, variant: 'outline' as const };
                        return (
                          <div key={status} className="flex items-center justify-between rounded-lg border px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Badge variant={cfg.variant} className="text-xs">
                                {t(cfg.label_vi, cfg.label_en)}
                              </Badge>
                            </div>
                            <span className="text-sm font-bold">{count as number}</span>
                          </div>
                        );
                      })}
                    <Separator />
                    <div className="flex items-center justify-between px-1 pt-1">
                      <span className="text-xs text-muted-foreground">{t('Tổng đơn', 'Total Orders')}</span>
                      <span className="text-sm font-bold">{data.orders.total}</span>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs text-muted-foreground">{t('Doanh thu đã giao', 'Delivered Revenue')}</span>
                      <span className="text-sm font-bold text-green-600">{formatVND(data.orders.deliveredRevenue)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <ShoppingCart className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">{t('Không có đơn hàng nào', 'No orders for this day')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Inventory Activity */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <PackageOpen className="h-4 w-4" />
                  {t('Hoạt động tồn kho', 'Inventory Activity')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                  </div>
                ) : data && Object.keys(data.inventory.byType).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(data.inventory.byType)
                      .sort(([, a], [, b]) => ((a as any).count) - ((b as any).count))
                      .reverse()
                      .map(([type, info]: [string, any]) => {
                        const cfg = movementTypeConfig[type] || { label_vi: type, label_en: type, color: 'text-gray-600', icon: defaultMovementIcon };
                        const IconComp = cfg.icon;
                        return (
                          <div key={type} className="flex items-center justify-between rounded-lg border px-3 py-2">
                            <div className="flex items-center gap-2">
                              <IconComp className={`h-4 w-4 ${cfg.color}`} />
                              <span className="text-sm">{t(cfg.label_vi, cfg.label_en)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold">{info.count}</span>
                              <span className="text-xs text-muted-foreground ml-1">
                                ({info.quantity > 0 ? '+' : ''}{info.quantity})
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    <Separator />
                    <div className="flex items-center justify-between px-1 pt-1">
                      <span className="text-xs text-muted-foreground">{t('Tổng nghiệp vụ', 'Total Movements')}</span>
                      <span className="text-sm font-bold">{data.inventory.movements}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <PackageOpen className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">{t('Không có hoạt động kho nào', 'No inventory activity for this day')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Delivery Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4" />
                {t('Trạng thái giao hàng', 'Delivery Status')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
              ) : data && Object.keys(data.deliveries.byStatus).length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {Object.entries(data.deliveries.byStatus).map(([status, count]) => {
                    const cfg = shipmentStatusConfig[status] || { label_vi: status, label_en: status, variant: 'outline' as const };
                    const statusColors: Record<string, string> = {
                      PENDING: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200',
                      PICKED_UP: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200',
                      IN_TRANSIT: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200',
                      DELIVERED: 'bg-green-50 dark:bg-green-900/20 border-green-200',
                      FAILED: 'bg-red-50 dark:bg-red-900/20 border-red-200',
                    };
                    const statusIcons: Record<string, typeof Clock> = {
                      PENDING: Clock,
                      PICKED_UP: Package,
                      IN_TRANSIT: Truck,
                      DELIVERED: CheckCircle2,
                      FAILED: XCircle,
                    };
                    const IconComp = statusIcons[status] || Clock;
                    const statusColorMap: Record<string, string> = {
                      PENDING: 'text-gray-500',
                      PICKED_UP: 'text-blue-600',
                      IN_TRANSIT: 'text-yellow-600',
                      DELIVERED: 'text-green-600',
                      FAILED: 'text-red-600',
                    };
                    return (
                      <div
                        key={status}
                        className={`rounded-xl border p-3 ${statusColors[status] || 'bg-muted/50'}`}
                      >
                        <div className="flex items-center gap-1.5 mb-2">
                          <IconComp className={`h-3.5 w-3.5 ${statusColorMap[status] || 'text-muted-foreground'}`} />
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {t(cfg.label_vi, cfg.label_en)}
                          </span>
                        </div>
                        <p className={`text-2xl font-bold ${statusColorMap[status] || 'text-foreground'}`}>
                          {count as number}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Truck className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">{t('Không có giao hàng nào', 'No deliveries for this day')}</p>
                </div>
              )}

              {!loading && data && (
                <div className="mt-3 text-xs text-muted-foreground text-right">
                  {t('Tổng số chuyến giao: ', 'Total deliveries: ')}
                  <span className="font-bold text-foreground">{data.deliveries.total}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}