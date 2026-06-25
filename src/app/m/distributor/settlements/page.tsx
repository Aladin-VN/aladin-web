'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DistributorSettlements() {
  const router = useRouter();
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/distributor/settlements?page=${page}&limit=20`);
      if (res.success) {
        setSettlements(res.data.items);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch {}
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchSettlements(); }, [fetchSettlements]);

  const statusColor = (s: string) => {
    switch (s) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'PROCESSING': return 'bg-blue-100 text-blue-800';
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  const statusLabel = (s: string) => {
    const m: Record<string, string> = { PENDING: 'Chờ xử lý', PROCESSING: 'Đang xử lý', PAID: 'Đã thanh toán', FAILED: 'Lỗi' };
    return m[s] || s;
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="h-5 w-5 text-yellow-600" />
        <h1 className="text-xl font-bold">Lịch sử quyết toán</h1>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : settlements.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Chưa có kỳ quyết toán nào</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {settlements.map((s: any) => (
            <Card key={s.id} className={cn('cursor-pointer hover:bg-accent/30 transition-colors')} onClick={() => router.push(`/m/distributor/settlements/${s.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-bold">{s.settlementNumber}</p>
                  <Badge variant="secondary" className={statusColor(s.status)}>{statusLabel(s.status)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {new Date(s.periodStart).toLocaleDateString('vi-VN')} — {new Date(s.periodEnd).toLocaleDateString('vi-VN')}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted rounded-lg p-2">
                    <p className="text-muted-foreground">Tổng đơn</p>
                    <p className="font-bold">{s.totalOrders}</p>
                  </div>
                  <div className="bg-muted rounded-lg p-2">
                    <p className="text-muted-foreground">Doanh thu</p>
                    <p className="font-bold">{formatVND(s.totalOrderValue)}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2">
                    <p className="text-red-500">Phí nền tảng</p>
                    <p className="font-bold text-red-600">-{formatVND(s.totalPlatformFee)}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-green-600">Thu nhập ròng</p>
                    <p className="font-bold text-green-700">{formatVND(s.distributorPayout)}</p>
                  </div>
                </div>
                {s.paidAt && (
                  <p className="text-xs text-muted-foreground mt-2">Đã thanh toán: {new Date(s.paidAt).toLocaleDateString('vi-VN')}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 text-sm rounded-lg bg-muted disabled:opacity-50">Trước</button>
          <span className="px-3 py-1 text-sm">{page}/{totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 text-sm rounded-lg bg-muted disabled:opacity-50">Sau</button>
        </div>
      )}
    </div>
  );
}