'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAppStore } from '@/stores/app.store';
import { MobileHeader } from '@/components/mobile/mobile-header';
import {
  Phone, Printer, Package, Users, ShoppingCart, Clock, Target, CheckCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ============================================
// Types
// ============================================

interface SubOrder {
  id: string;
  orderNumber: string;
  shopName: string;
  qty: number;
  amount: number;
  status: string;
}

interface Participant {
  id: string;
  name: string;
  phone: string;
  district?: string;
  orderCount: number;
  totalAmount: number;
}

interface GroupBuyDetail {
  id: string;
  name: string;
  productName: string;
  pricePerUnit: number;
  targetQty: number;
  currentQty: number;
  status: string;
  deadline?: string;
  orders: SubOrder[];
  participants: Participant[];
  pickingList: { productName: string; totalQty: number }[];
}

// ============================================
// Helpers
// ============================================

const t = (vi: string, en: string, locale: string) => (locale === 'vi' ? vi : en);

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-green-100 text-green-800',
};

const statusLabelVi: Record<string, string> = {
  ACTIVE: 'Đang diễn ra',
  COMPLETED: 'Hoàn thành',
  EXPIRED: 'Hết hạn',
  PENDING: 'Chờ xử lý',
  PROCESSING: 'Đang xử lý',
  PACKED: 'Đã đóng gói',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};

const statusLabelEn: Record<string, string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

// ============================================
// Component
// ============================================

export default function GroupBuyDetailPage() {
  const locale = useAppStore((s) => s.locale);
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<GroupBuyDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/distributor/group-buy?id=${id}`);
      if (res.success) {
        setData(res.data);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const statusCounts = data?.orders
    ? data.orders.reduce(
        (acc, o) => {
          acc[o.status] = (acc[o.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      )
    : {};

  const pct = data && data.targetQty > 0
    ? Math.min(Math.round((data.currentQty / data.targetQty) * 100), 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Chi tiết mua chung', 'Group Buy Detail', locale)} showBack showNotifications={false} />
        <main className="px-4 pb-24 pt-2 space-y-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </main>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Chi tiết mua chung', 'Group Buy Detail', locale)} showBack showNotifications={false} />
        <main className="px-4 pb-24 pt-2">
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            {t('Không tìm thấy đơn mua chung', 'Group deal not found', locale)}
          </CardContent></Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={data.name}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-24 pt-2 space-y-4">
        {/* Deal info card */}
        <Card className="rounded-xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">
                  {t('Sản phẩm', 'Product', locale)}
                </p>
                <p className="text-sm font-semibold">{data.productName}</p>
              </div>
              <Badge className={`text-[10px] shrink-0 ${statusBadge[data.status] || ''}`}>
                {locale === 'vi'
                  ? (statusLabelVi[data.status] || data.status)
                  : (statusLabelEn[data.status] || data.status)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground">
                  {t('Đơn giá', 'Unit Price', locale)}
                </p>
                <p className="text-sm font-bold">{formatVND(data.pricePerUnit)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">
                  {t('Số lượng', 'Quantity', locale)}
                </p>
                <p className="text-sm font-bold">
                  {data.currentQty} / {data.targetQty} ({pct}%)
                </p>
              </div>
            </div>

            {data.deadline && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {t('Hạn:', 'Deadline:', locale)}{' '}
                  {new Date(data.deadline).toLocaleDateString('vi-VN')}
                </span>
              </div>
            )}

            {/* Progress bar */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">{pct}%</span>
              </div>
              <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-10">
            <TabsTrigger value="orders" className="text-xs gap-1">
              <ShoppingCart className="h-3.5 w-3.5" />
              {t('Đơn hàng', 'Orders', locale)}
            </TabsTrigger>
            <TabsTrigger value="picking" className="text-xs gap-1">
              <Package className="h-3.5 w-3.5" />
              {t('Lấy hàng', 'Picking', locale)}
            </TabsTrigger>
            <TabsTrigger value="participants" className="text-xs gap-1">
              <Users className="h-3.5 w-3.5" />
              {t('Tham gia', 'Participants', locale)}
            </TabsTrigger>
          </TabsList>

          {/* Orders tab */}
          <TabsContent value="orders" className="mt-3 space-y-3">
            {/* Status summary */}
            {Object.keys(statusCounts).length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <Badge
                    key={status}
                    variant="outline"
                    className="text-[10px]"
                  >
                    {count} {locale === 'vi'
                      ? (statusLabelVi[status] || status).toLowerCase()
                      : (statusLabelEn[status] || status).toLowerCase()}
                  </Badge>
                ))}
              </div>
            )}

            {data.orders.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  {t('Chưa có đơn hàng', 'No orders yet', locale)}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data.orders.map((order) => (
                  <Card key={order.id} className="rounded-xl">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {order.shopName}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{formatVND(order.amount)}</p>
                          <Badge
                            className={`text-[10px] ${statusBadge[order.status] || ''}`}
                          >
                            {locale === 'vi'
                              ? (statusLabelVi[order.status] || order.status)
                              : (statusLabelEn[order.status] || order.status)}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('SL:', 'Qty:', locale)} {order.qty}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Picking List tab */}
          <TabsContent value="picking" className="mt-3 space-y-3">
            {(!data.pickingList || data.pickingList.length === 0) ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  {t('Chưa có danh sách', 'No picking list', locale)}
                </CardContent>
              </Card>
            ) : (
              <>
                {data.pickingList.map((item, i) => (
                  <Card key={i} className="rounded-xl">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {t('Tổng cần lấy', 'Total needed', locale)}
                          </p>
                        </div>
                        <p className="text-base font-bold text-primary">
                          {item.totalQty}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.print();
                    }
                  }}
                >
                  <Printer className="h-4 w-4" />
                  {t('In danh sách', 'Print List', locale)}
                </Button>
              </>
            )}
          </TabsContent>

          {/* Participants tab */}
          <TabsContent value="participants" className="mt-3 space-y-3">
            {data.participants.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  {t('Chưa có người tham gia', 'No participants yet', locale)}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {data.participants.map((p) => (
                  <Card key={p.id} className="rounded-xl">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{p.name}</p>
                          <a
                            href={`tel:${p.phone}`}
                            className="text-xs text-primary flex items-center gap-1 mt-0.5"
                          >
                            <Phone className="h-3 w-3" />
                            {p.phone}
                          </a>
                          {p.district && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {p.district}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{formatVND(p.totalAmount)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {p.orderCount} {t('đơn', 'orders', locale)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}