'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import {
  Wallet, RefreshCw, ChevronLeft, ChevronRight, CalendarDays,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

const statusColor = (s: string) => {
  switch (s) {
    case 'PENDING': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'PROCESSING': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
    case 'PAID': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    case 'FAILED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-800';
  }
};
const statusLabel = (s: string) => {
  const m: Record<string, string> = { PENDING: 'Chờ xử lý', PROCESSING: 'Đang xử lý', PAID: 'Đã thanh toán', FAILED: 'Lỗi' };
  return m[s] || s;
};

export default function DistributorSettlements() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/distributor/settlements?page=${page}&limit=20`);
      if (res.success) {
        setSettlements(res.data.items || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch {}
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchSettlements(); }, [fetchSettlements]);

  return (
    <>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('Quyết toán', 'Settlements')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('Lịch sử quyết toán và thanh toán', 'Settlement and payment history')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSettlements} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('Làm mới', 'Refresh')}
            </Button>
          </div>
          <Separator />

          <div className="flex-1 px-6 py-4 space-y-4">
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
                  </div>
                ) : settlements.length === 0 ? (
                  <div className="text-center py-16 text-sm text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    {t('Chưa có kỳ quyết toán nào', 'No settlement periods yet')}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Mã kỳ', 'Period #')}</TableHead>
                        <TableHead>{t('Kỳ đối soát', 'Period')}</TableHead>
                        <TableHead className="text-center">{t('Tổng đơn', 'Orders')}</TableHead>
                        <TableHead className="text-right">{t('Doanh thu', 'Revenue')}</TableHead>
                        <TableHead className="text-right">{t('Phí nền tảng', 'Platform Fee')}</TableHead>
                        <TableHead className="text-right">{t('Thu nhập ròng', 'Net Payout')}</TableHead>
                        <TableHead className="text-center">{t('Trạng thái', 'Status')}</TableHead>
                        <TableHead className="text-right">{t('Ngày TT', 'Paid Date')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {settlements.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.settlementNumber}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {new Date(s.periodStart).toLocaleDateString('vi-VN')} &mdash; {new Date(s.periodEnd).toLocaleDateString('vi-VN')}
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-medium">{s.totalOrders}</TableCell>
                          <TableCell className="text-right">{formatVND(s.totalOrderValue)}</TableCell>
                          <TableCell className="text-right text-red-600">-{formatVND(s.totalPlatformFee)}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">{formatVND(s.distributorPayout)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className={statusColor(s.status)}>
                              {statusLabel(s.status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {s.paidAt ? new Date(s.paidAt).toLocaleDateString('vi-VN') : '-'}
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