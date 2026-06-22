'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'PENDING', label: 'Chờ xử lý' },
  { key: 'PROCESSING', label: 'Đang xử lý' },
  { key: 'PACKED', label: 'Đã đóng gói' },
];

export default function DistributorOrders() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (activeTab) params.set('status', activeTab);
      const res = await adminFetch(`/api/distributor/orders?${params}`);
      if (res.success) {
        setOrders(res.data.items);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch {}
    setLoading(false);
  }, [activeTab, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800';
      case 'PROCESSING': return 'bg-blue-100 text-blue-800';
      case 'PACKED': return 'bg-indigo-100 text-indigo-800';
      case 'DELIVERED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  const statusLabel = (s: string) => {
    const m: Record<string, string> = { PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', PROCESSING: 'Đang xử lý', PACKED: 'Sẵn sàng', DELIVERED: 'Đã giao', CANCELLED: 'Đã hủy' };
    return m[s] || s;
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
      <h1 className="text-xl font-bold mb-4">Đơn hàng</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key ? 'bg-yellow-500 text-white' : 'bg-muted text-muted-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Order List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Không có đơn hàng nào</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {orders.map((order: any) => (
            <Card
              key={order.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => router.push(`/m/distributor/orders/${order.id}`)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <p className="text-sm font-semibold">{order.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{order.shopName}</p>
                    {order.shopDistrict && (
                      <p className="text-xs text-muted-foreground">{order.shopDistrict}, {order.shopProvince}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className={`text-[10px] ${statusColor(order.status)}`}>
                    {statusLabel(order.status)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{order.itemCount} sản phẩm</span>
                  <span className="text-sm font-bold">{formatVND(order.totalAmount)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-3 py-1 text-sm rounded-lg bg-muted disabled:opacity-50"
          >Trước</button>
          <span className="px-3 py-1 text-sm">{page}/{totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-3 py-1 text-sm rounded-lg bg-muted disabled:opacity-50"
          >Sau</button>
        </div>
      )}
    </div>
  );
}