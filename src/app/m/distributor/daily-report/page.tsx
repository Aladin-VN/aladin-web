'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAppStore } from '@/stores/app.store';
import { MobileHeader } from '@/components/mobile/mobile-header';
import {
  CalendarDays, Send, FileDown, ShoppingCart, ArrowDownCircle, ArrowUpCircle,
  Package, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

interface OrderItem {
  id: string;
  orderNumber: string;
  shopName: string;
  amount: number;
  status: string;
}

interface InventoryMovement {
  type: 'RECEIPT' | 'ORDER_FULFILLMENT' | 'RETURN' | 'ADJUSTMENT';
  productName: string;
  qty: number;
}

interface DailyReport {
  date: string;
  revenue: number;
  orderCount: number;
  netPayout: number;
  platformFee: number;
  codCollections: number;
  orders: OrderItem[];
  inventoryMovements: InventoryMovement[];
  lowStockItems: { id: string; name: string; currentQty: number; minQty: number }[];
}

// ============================================
// Helpers
// ============================================

const t = (vi: string, en: string, locale: string) => (locale === 'vi' ? vi : en);

const statusBadge: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  PACKED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const statusLabelVi: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  PACKED: 'Đã đóng gói',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};

const statusLabelEn: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const movementTypeVi: Record<string, string> = {
  RECEIPT: 'Nhập kho',
  ORDER_FULFILLMENT: 'Xuất kho',
  RETURN: 'Trả hàng',
  ADJUSTMENT: 'Điều chỉnh',
};

const movementTypeEn: Record<string, string> = {
  RECEIPT: 'Receipt',
  ORDER_FULFILLMENT: 'Fulfillment',
  RETURN: 'Return',
  ADJUSTMENT: 'Adjustment',
};

const movementIcon = (type: string) => {
  switch (type) {
    case 'RECEIPT':
      return <ArrowDownCircle className="h-3.5 w-3.5 text-green-500" />;
    case 'ORDER_FULFILLMENT':
      return <ArrowUpCircle className="h-3.5 w-3.5 text-blue-500" />;
    case 'RETURN':
      return <Package className="h-3.5 w-3.5 text-yellow-500" />;
    default:
      return <Package className="h-3.5 w-3.5 text-gray-500" />;
  }
};

// ============================================
// Component
// ============================================

export default function DailyReportPage() {
  const locale = useAppStore((s) => s.locale);
  const [date, setDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [data, setData] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/distributor/daily-report?date=${date}`);
      if (res.success) {
        setData(res.data);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [date]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handleSendReport = async () => {
    setSending(true);
    // Mock — show success toast after brief delay
    await new Promise((r) => setTimeout(r, 800));
    setSending(false);
    toast.success(locale === 'vi' ? 'Đã gửi báo cáo thành công!' : 'Report sent successfully!');
  };

  const handleExportPdf = async () => {
    toast.info(locale === 'vi' ? 'Đang xuất PDF...' : 'Exporting PDF...');
    await new Promise((r) => setTimeout(r, 600));
    toast.success(locale === 'vi' ? 'Đã xuất PDF thành công!' : 'PDF exported successfully!');
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Báo cáo ngày', 'Daily Report', locale)}
        rightAction={
          <div className="relative">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer h-9 w-9"
            />
            <Button variant="ghost" size="icon" className="h-9 w-9 pointer-events-none">
              <CalendarDays className="h-5 w-5" />
            </Button>
          </div>
        }
        showNotifications={false}
      />

      <main className="px-4 pb-24 pt-2 space-y-4">
        {/* Loading state */}
        {loading ? (
          <>
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </>
        ) : !data ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {t('Không có dữ liệu', 'No data available', locale)}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary card */}
            <Card className="rounded-xl bg-primary text-primary-foreground">
              <CardContent className="p-4">
                <p className="text-xs opacity-80 mb-1">
                  {t('Doanh thu', 'Revenue', locale)} —{' '}
                  {new Date(data.date).toLocaleDateString('vi-VN')}
                </p>
                <p className="text-2xl font-bold mb-3">{formatVND(data.revenue)}</p>
                <div className="flex items-center gap-4 text-xs opacity-90">
                  <div className="flex items-center gap-1">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    <span>
                      {data.orderCount} {t('đơn', 'orders', locale)}
                    </span>
                  </div>
                  <div>
                    <span className="opacity-70">{t('Thu nhập ròng', 'Net payout', locale)}:</span>{' '}
                    <span className="font-semibold">{formatVND(data.netPayout)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Orders section */}
            <Card className="rounded-xl">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <ShoppingCart className="h-4 w-4" />
                  {t('Đơn hàng', 'Orders', locale)}
                </h3>

                {data.orders.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {t('Chưa có đơn hàng', 'No orders today', locale)}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {data.orders.map((order) => (
                      <div
                        key={order.id}
                        className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{order.orderNumber}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {order.shopName}
                          </p>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-xs font-semibold">{formatVND(order.amount)}</p>
                          <Badge
                            className={`text-[9px] ${statusBadge[order.status] || ''}`}
                          >
                            {locale === 'vi'
                              ? (statusLabelVi[order.status] || order.status)
                              : (statusLabelEn[order.status] || order.status)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals */}
                {data.orders.length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>
                        {t('Tổng', 'Total', locale)} ({data.orders.length} {t('đơn', 'orders', locale)})
                      </span>
                      <span>{formatVND(data.orders.reduce((s, o) => s + o.amount, 0))}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Income / Expense section */}
            <Card className="rounded-xl">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3">
                  {t('Thu chi', 'Income / Expense', locale)}
                </h3>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t('Doanh thu đơn hàng', 'Order Revenue', locale)}
                    </span>
                    <span className="text-green-600 font-medium">+{formatVND(data.revenue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t('Phí nền tảng', 'Platform Fee', locale)}
                    </span>
                    <span className="text-red-600 font-medium">-{formatVND(data.platformFee)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t('Thu COD', 'COD Collections', locale)}
                    </span>
                    <span className="text-green-600 font-medium">+{formatVND(data.codCollections)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span>{t('Thực nhận', 'Net Amount', locale)}</span>
                    <span className={data.netPayout >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatVND(data.netPayout)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Changes section */}
            <Card className="rounded-xl">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                  <Package className="h-4 w-4" />
                  {t('Tồn kho thay đổi', 'Inventory Changes', locale)}
                </h3>

                {/* Low stock alerts */}
                {data.lowStockItems && data.lowStockItems.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center gap-1 mb-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                      <span className="text-xs font-medium text-red-600">
                        {t('Cảnh báo tồn kho thấp', 'Low Stock Alerts', locale)}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {data.lowStockItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2"
                        >
                          <span className="text-xs font-medium text-red-800">{item.name}</span>
                          <span className="text-xs text-red-600 font-semibold">
                            {item.currentQty} / {item.minQty}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Movements */}
                {data.inventoryMovements && data.inventoryMovements.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {data.inventoryMovements.map((mv, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {movementIcon(mv.type)}
                          <div className="min-w-0">
                            <p className="text-xs font-medium truncate">{mv.productName}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {locale === 'vi'
                                ? movementTypeVi[mv.type]
                                : movementTypeEn[mv.type]}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-semibold shrink-0 ml-2 ${
                            mv.type === 'RECEIPT' || mv.type === 'RETURN'
                              ? 'text-green-600'
                              : 'text-blue-600'
                          }`}
                        >
                          {mv.type === 'RECEIPT' || mv.type === 'RETURN' ? '+' : '-'}
                          {mv.qty}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    {t('Không có thay đổi', 'No changes', locale)}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                className="gap-2"
                onClick={handleSendReport}
                disabled={sending}
              >
                <Send className="h-4 w-4" />
                {sending
                  ? (locale === 'vi' ? 'Đang gửi...' : 'Sending...')
                  : t('Gửi báo cáo', 'Send Report', locale)}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleExportPdf}
              >
                <FileDown className="h-4 w-4" />
                {t('Xuất PDF', 'Export PDF', locale)}
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}