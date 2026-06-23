'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import {
  CreditCard, RefreshCw, ChevronLeft, ChevronRight,
  AlertTriangle, Clock, DollarSign, TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminHeader } from '@/components/layout/admin-header';
import { Separator } from '@/components/ui/separator';

const AGING_TABS = [
  { key: '', label: 'Tat ca', labelEn: 'All' },
  { key: '0-7', label: 'Hien tai (0-7 ngay)', labelEn: 'Current' },
  { key: '8-14', label: 'Qua han (8-14 ngay)', labelEn: 'Overdue 8-14d' },
  { key: '15-30', label: 'Qua han (15-30 ngay)', labelEn: 'Overdue 15-30d' },
  { key: '30+', label: 'Qua han >30 ngay', labelEn: 'Overdue 30d+' },
];

export default function DistributorARLedger() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aging, setAging] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAR = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (aging) params.set('aging', aging);
      const res = await adminFetch(`/api/distributor/ar-ledger?${params}`);
      if (res.success) {
        setItems(res.data.items || []);
        setSummary(res.data.summary);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch {}
    setLoading(false);
  }, [aging, page]);

  useEffect(() => { fetchAR(); }, [fetchAR]);

  const agingColor = (b: string) =>
    b === 'overdue30' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
    b === 'overdue15' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
    b === 'overdue8' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400';

  const agingLabel = (b: string) => {
    const map: Record<string, string> = { current: 'Hien tai', overdue8: '8-14 ngay', overdue15: '15-30 ngay', overdue30: '>30 ngay' };
    return map[b] || b;
  };

  const getAgingBarColor = (b: string) =>
    b === 'overdue30' ? 'bg-red-500' :
    b === 'overdue15' ? 'bg-orange-500' :
    b === 'overdue8' ? 'bg-amber-500' :
    'bg-emerald-500';

  const getAgingBarWidth = (b: string) =>
    b === 'current' ? 25 :
    b === 'overdue8' ? 50 :
    b === 'overdue15' ? 75 :
    100;

  return (
    <>
      <AdminHeader />
      <div className="flex flex-1 flex-col">
        {/* Page Header */}
        <div className="px-4 md:px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-600 to-violet-700 flex items-center justify-center shadow-lg shadow-violet-600/20">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight">{t('Công nợ phải thu', 'AR Ledger')}</h1>
              <p className="text-sm text-muted-foreground">{t('Đơn hàng đã giao chưa đối soát', 'Delivered orders pending settlement')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAR} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('Làm mới', 'Refresh')}
            </Button>
          </div>
        </div>
        <Separator />

        <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
          {/* Summary Cards */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : summary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Tổng công nợ', 'Total AR')}</p>
                      <p className="text-xl font-bold mt-1 text-violet-700 dark:text-violet-400">{formatVND(summary.totalAR)}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Hiện tại (0-7 ngày)', 'Current (0-7d)')}</p>
                      <p className="text-xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{formatVND(summary.current)}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Quá hạn (8-30 ngày)', 'Overdue 8-30d')}</p>
                      <p className="text-xl font-bold mt-1 text-amber-700 dark:text-amber-400">{formatVND((summary.overdue8 || 0) + (summary.overdue15 || 0))}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Quá hạn (>30 ngày)', 'Overdue 30d+')}</p>
                      <p className="text-xl font-bold mt-1 text-red-700 dark:text-red-400">{formatVND(summary.overdue30)}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Aging Distribution Bar */}
          {summary && !loading && (
            <Card className="shadow-sm rounded-xl overflow-hidden">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('Phân bổ tuổi nợ', 'Aging Distribution')}</p>
                </div>
                <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted gap-0.5">
                  {summary.totalAR > 0 && [
                    { key: 'current', value: summary.current || 0, color: 'bg-emerald-500' },
                    { key: 'overdue8', value: summary.overdue8 || 0, color: 'bg-amber-500' },
                    { key: 'overdue15', value: summary.overdue15 || 0, color: 'bg-orange-500' },
                    { key: 'overdue30', value: summary.overdue30 || 0, color: 'bg-red-500' },
                  ].map((bucket) => {
                    const pct = (bucket.value / summary.totalAR) * 100;
                    if (pct === 0) return null;
                    return (
                      <div
                        key={bucket.key}
                        className={`${bucket.color} transition-all duration-700 rounded-full min-w-[4px]`}
                        style={{ width: `${pct}%` }}
                        title={`${agingLabel(bucket.key)}: ${formatVND(bucket.value)}`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                  {[
                    { label: t('Hiện tại', 'Current'), color: 'bg-emerald-500' },
                    { label: '8-14d', color: 'bg-amber-500' },
                    { label: '15-30d', color: 'bg-orange-500' },
                    { label: '30d+', color: 'bg-red-500' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className={`h-2 w-2 rounded-full ${item.color}`} />
                      <span className="text-[11px] text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Aging Filter Tabs */}
          <div className="flex gap-1 flex-wrap">
            {AGING_TABS.map(tab => (
              <Button
                key={tab.key}
                variant={aging === tab.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setAging(tab.key); setPage(1); }}
                className={
                  aging === tab.key
                    ? 'shadow-sm rounded-full px-4'
                    : 'rounded-full px-4 text-muted-foreground hover:text-foreground'
                }
              >
                {locale === 'vi' ? tab.label : tab.labelEn}
              </Button>
            ))}
          </div>

          {/* AR Table */}
          <Card className="shadow-sm rounded-xl overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 md:p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-24 rounded" />
                      <Skeleton className="h-4 w-32 rounded" />
                      <Skeleton className="h-5 w-10 rounded-full" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-4 w-24 rounded ml-auto" />
                      <Skeleton className="h-4 w-20 rounded" />
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-20">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('Không có công nợ', 'No accounts receivable')}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {t('Tất cả đơn hàng đã được đối soát', 'All orders have been settled')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Mã đơn', 'Order#')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Cửa hàng', 'Shop')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Số ngày', 'Days')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Phân loại', 'Bucket')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Số tiền', 'Amount')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Ngày giao', 'Delivered')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => (
                        <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <span className="font-semibold text-sm">{item.orderNumber}</span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="text-sm font-medium">{item.shopName}</span>
                              <p className="text-[11px] text-muted-foreground">{item.shopDistrict}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={`rounded-full font-semibold text-xs w-9 h-9 flex items-center justify-center p-0 ${
                                  item.agingDays > 30 ? 'border-red-300 text-red-600 bg-red-50 dark:bg-red-950/20' :
                                  item.agingDays > 14 ? 'border-orange-300 text-orange-600 bg-orange-50 dark:bg-orange-950/20' :
                                  'border-muted text-foreground'
                                }`}
                              >
                                {item.agingDays}
                              </Badge>
                              <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${getAgingBarColor(item.agingBucket)}`}
                                  style={{ width: `${getAgingBarWidth(item.agingBucket)}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className={`rounded-full text-[11px] font-medium px-2.5 py-0.5 ${agingColor(item.agingBucket)}`}>
                              {agingLabel(item.agingBucket)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatVND(item.amount)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{item.deliveredAt?.slice(0, 10)}</TableCell>
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
              <p className="text-sm text-muted-foreground">{t(`Trang ${page}/${totalPages}`, `Page ${page}/${totalPages}`)}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4 mr-1" />{t('Trước', 'Prev')}</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t('Sau', 'Next')}<ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}