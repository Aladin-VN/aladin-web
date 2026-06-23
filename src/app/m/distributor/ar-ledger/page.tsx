'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import {
  CreditCard, Clock, AlertTriangle, RefreshCw, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================
// Types
// ============================================

interface ArOrder {
  id: string;
  orderNumber: string;
  shopName: string;
  shopDistrict: string;
  totalAmount: number;
  deliveredAt: string;
  agingDays: number;
  agingBucket: string;
  itemCount: number;
  paymentStatus: string;
  items: { productName: string; quantity: number; totalPrice: number }[];
}

interface ArSummary {
  totalAR: number;
  totalOrders: number;
  currentAmount: number;
  currentCount: number;
  overdue8_14Amount: number;
  overdue8_14Count: number;
  overdue15_30Amount: number;
  overdue15_30Count: number;
  overdue30plusAmount: number;
  overdue30plusCount: number;
  totalOverdue: number;
  totalOverdueAmount: number;
}

type AgingFilter = 'all' | '0-7' | '8-14' | '15-30' | '30+';

const agingChips: { value: AgingFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: '0-7', label: '0-7 ngày' },
  { value: '8-14', label: '8-14 ngày' },
  { value: '15-30', label: '15-30 ngày' },
  { value: '30+', label: '30+ ngày' },
];

function agingColor(days: number): string {
  if (days <= 7) return 'bg-green-100 text-green-800';
  if (days <= 14) return 'bg-yellow-100 text-yellow-800';
  if (days <= 30) return 'bg-orange-100 text-orange-800';
  return 'bg-red-100 text-red-800';
}

// ============================================
// Component
// ============================================

export default function MobileArLedger() {
  const [orders, setOrders] = useState<ArOrder[]>([]);
  const [summary, setSummary] = useState<ArSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [agingFilter, setAgingFilter] = useState<AgingFilter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async (p: number, aging: AgingFilter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' });
      if (aging !== 'all') params.set('aging', aging);
      const res = await adminFetch(`/api/distributor/ar-ledger?${params}`);
      if (res.success) {
        setOrders(res.data.items);
        setSummary(res.data.summary);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(page, agingFilter); }, [page, agingFilter, fetchData]);

  const handleFilter = (f: AgingFilter) => {
    setAgingFilter(f);
    setPage(1);
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Sổ công nợ</h1>
          <p className="text-sm text-muted-foreground">Đơn đã giao chờ quyết toán</p>
        </div>
        <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => fetchData(page, agingFilter)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card className="bg-yellow-50 border-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CreditCard className="h-3.5 w-3.5 text-yellow-600" />
                <span className="text-[11px] text-muted-foreground">Tổng công nợ</span>
              </div>
              <p className="text-base font-bold text-yellow-700">{formatVND(summary.totalAR)}</p>
              <p className="text-[10px] text-muted-foreground">{summary.totalOrders} đơn</p>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3.5 w-3.5 text-green-600" />
                <span className="text-[11px] text-muted-foreground">Hiện tại (0-7d)</span>
              </div>
              <p className="text-base font-bold text-green-700">{formatVND(summary.currentAmount)}</p>
              <p className="text-[10px] text-muted-foreground">{summary.currentCount} đơn</p>
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-orange-600" />
                <span className="text-[11px] text-muted-foreground">Quá hạn (8-30d)</span>
              </div>
              <p className="text-base font-bold text-orange-700">
                {formatVND(summary.overdue8_14Amount + summary.overdue15_30Amount)}
              </p>
              <p className="text-[10px] text-muted-foreground">{summary.overdue8_14Count + summary.overdue15_30Count} đơn</p>
            </CardContent>
          </Card>

          <Card className="bg-red-50 border-0">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                <span className="text-[11px] text-muted-foreground">Quá hạn (30+d)</span>
              </div>
              <p className="text-base font-bold text-red-700">{formatVND(summary.overdue30plusAmount)}</p>
              <p className="text-[10px] text-muted-foreground">{summary.overdue30plusCount} đơn</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Aging Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4 no-scrollbar">
        {agingChips.map((chip) => (
          <Button
            key={chip.value}
            variant={agingFilter === chip.value ? 'default' : 'outline'}
            size="sm"
            className="text-xs shrink-0"
            onClick={() => handleFilter(chip.value)}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {/* Order List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CreditCard className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Không có công nợ</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardContent
                className="p-3 cursor-pointer"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{order.shopName}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold">{formatVND(order.totalAmount)}</p>
                    <Badge variant="secondary" className={`text-[9px] ${agingColor(order.agingDays)}`}>
                      {order.agingDays} ngày
                    </Badge>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-muted-foreground ml-1 transition-transform ${expanded === order.id ? 'rotate-90' : ''}`} />
                </div>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                  <span>{new Date(order.deliveredAt).toLocaleDateString('vi-VN')}</span>
                  <span>•</span>
                  <span>{order.itemCount} SP</span>
                </div>

                {/* Expanded Details */}
                {expanded === order.id && (
                  <div className="mt-3 pt-3 border-t space-y-1.5">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{item.productName} x{item.quantity}</span>
                        <span className="font-medium">{formatVND(item.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">Trang {page}/{totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="text-xs">
                  Trước
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="text-xs">
                  Tiếp
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export */}
      <Button variant="outline" className="w-full gap-2 mt-4" asChild>
        <a href="/api/distributor/export?type=orders" download>
          <RefreshCw className="h-4 w-4" />
          Xuất CSV công nợ
        </a>
      </Button>
    </div>
  );
}