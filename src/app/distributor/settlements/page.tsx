'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import {
  Wallet, RefreshCw, ChevronLeft, ChevronRight, CalendarDays,
  CheckCircle2, Clock, DollarSign, FileCheck,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AdminHeader } from '@/components/layout/admin-header';
import { Separator } from '@/components/ui/separator';

const statusColor = (s: string) => {
  switch (s) {
    case 'PENDING': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400';
    case 'PROCESSING': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400';
    case 'PAID': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';
    case 'FAILED': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
    default: return 'bg-gray-100 text-gray-700';
  }
};
const statusLabel = (s: string) => {
  const m: Record<string, string> = { PENDING: 'Chờ xử lý', PROCESSING: 'Đang xử lý', PAID: 'Đã thanh toán', FAILED: 'Lỗi' };
  return m[s] || s;
};
const statusIcon = (s: string) => {
  switch (s) {
    case 'PAID': return <CheckCircle2 className="h-3 w-3" />;
    case 'PENDING': return <Clock className="h-3 w-3" />;
    default: return null;
  }
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

  // Computed KPIs
  const kpis = useMemo(() => {
    const totalSettled = settlements.filter((s: any) => s.status === 'PAID').reduce((sum: number, s: any) => sum + (s.distributorPayout || 0), 0);
    const totalPending = settlements.filter((s: any) => s.status === 'PENDING' || s.status === 'PROCESSING').reduce((sum: number, s: any) => sum + (s.distributorPayout || 0), 0);
    const totalFee = settlements.reduce((sum: number, s: any) => sum + (s.totalPlatformFee || 0), 0);
    const totalRevenue = settlements.reduce((sum: number, s: any) => sum + (s.totalOrderValue || 0), 0);
    return { totalSettled, totalPending, totalFee, totalRevenue };
  }, [settlements]);

  return (
    <>
      <AdminHeader />
      <div className="flex flex-1 flex-col">
        {/* Page Header */}
        <div className="px-4 md:px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-600/20">
              <Wallet className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
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
        </div>
        <Separator />

        <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
          {/* KPI Summary Cards */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Tổng doanh thu', 'Total Revenue')}</p>
                      <p className="text-xl font-bold mt-1 text-amber-700 dark:text-amber-400">{formatVND(kpis.totalRevenue)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('từ tất cả kỳ', 'from all periods')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Đã nhận', 'Total Settled')}</p>
                      <p className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{formatVND(kpis.totalSettled)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('đã chuyển khoản', 'transferred')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Chờ thanh toán', 'Pending')}</p>
                      <p className="text-xl font-bold mt-1 text-sky-700 dark:text-sky-400">{formatVND(kpis.totalPending)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('đang xử lý', 'processing')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Tổng phí NT', 'Platform Fee')}</p>
                      <p className="text-xl font-bold mt-1 text-red-700 dark:text-red-400">-{formatVND(kpis.totalFee)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('phí nền tảng', 'platform commission')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                      <FileCheck className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Settlements Table */}
          <Card className="shadow-sm rounded-xl overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 md:p-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-24 rounded" />
                      <Skeleton className="h-4 w-32 rounded" />
                      <Skeleton className="h-4 w-12 rounded" />
                      <Skeleton className="h-4 w-24 rounded ml-auto" />
                      <Skeleton className="h-4 w-20 rounded" />
                      <Skeleton className="h-4 w-24 rounded" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-4 w-16 rounded" />
                    </div>
                  ))}
                </div>
              ) : settlements.length === 0 ? (
                <div className="text-center py-20">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Wallet className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('Chưa có kỳ quyết toán nào', 'No settlement periods yet')}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {t('Kỳ quyết toán sẽ được tạo tự động', 'Settlements are created automatically')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Mã kỳ', 'Period #')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Kỳ đối soát', 'Period')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Tổng đơn', 'Orders')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Doanh thu', 'Revenue')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Phí nền tảng', 'Platform Fee')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Thu nhập ròng', 'Net Payout')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Trạng thái', 'Status')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Ngày TT', 'Paid Date')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {settlements.map((s: any) => (
                        <TableRow key={s.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <span className="font-semibold text-sm">{s.settlementNumber}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                              <span className="text-xs">
                                {new Date(s.periodStart).toLocaleDateString('vi-VN')} &mdash; {new Date(s.periodEnd).toLocaleDateString('vi-VN')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-muted text-xs font-semibold">
                              {s.totalOrders}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-sm">{formatVND(s.totalOrderValue)}</TableCell>
                          <TableCell className="text-right text-sm text-red-600 dark:text-red-400">-{formatVND(s.totalPlatformFee)}</TableCell>
                          <TableCell className="text-right font-bold text-sm text-emerald-600 dark:text-emerald-400">{formatVND(s.distributorPayout)}</TableCell>
                          <TableCell className="text-center">
                            <Badge
                              variant="secondary"
                              className={`rounded-full text-[11px] font-medium px-2.5 py-0.5 ${statusColor(s.status)}`}
                            >
                              <span className="flex items-center gap-1">
                                {statusIcon(s.status)}
                                {statusLabel(s.status)}
                              </span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {s.paidAt ? new Date(s.paidAt).toLocaleDateString('vi-VN') : <span className="text-muted-foreground/50">—</span>}
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
    </>
  );
}