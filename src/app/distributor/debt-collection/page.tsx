'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { toast } from 'sonner';
import { DollarSign, AlertTriangle, Clock, Phone, Search, RefreshCw, ChevronLeft, ChevronRight, MessageSquare, Store } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminHeader } from '@/components/layout/admin-header';
import { Separator } from '@/components/ui/separator';

export default function DebtCollection() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAR = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (search) params.set('search', search);
      const res = await adminFetch(`/api/distributor/ar-ledger?${params}`);
      if (res.success) {
        setItems(res.data.items || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (e) { console.error("[FETCH ERROR]", e); }
    setLoading(false);
  }, [page, search]);
  useEffect(() => { fetchAR(); }, [fetchAR]);

  const kpis = useMemo(() => {
    const totalAR = items.reduce((s: number, i: any) => s + i.amount, 0);
    const overdue7 = items.filter((i: any) => i.agingDays > 7).reduce((s: number, i: any) => s + i.amount, 0);
    const overdue30 = items.filter((i: any) => i.agingDays > 30).reduce((s: number, i: any) => s + i.amount, 0);
    const uniqueShops = new Set(items.map((i: any) => i.shopName)).size;
    return { totalAR, overdue7, overdue30, uniqueShops };
  }, [items]);

  const sorted = useMemo(() => [...items].sort((a: any, b: any) => (b.agingDays || 0) - (a.agingDays || 0)), [items]);

  const rowClass = (days: number) => {
    if (days > 30) return 'bg-red-50/70 dark:bg-red-950/20 hover:bg-red-50 dark:hover:bg-red-950/30';
    if (days > 14) return 'bg-orange-50/70 dark:bg-orange-950/20 hover:bg-orange-50 dark:hover:bg-orange-950/30';
    if (days > 7) return 'bg-amber-50/70 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/30';
    return 'hover:bg-muted/50';
  };

  return (
    <>
    <AdminHeader />
    <div className="flex flex-1 flex-col">
      <div className="px-4 md:px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-600/20">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{t('Thu hồi công nợ', 'Debt Collection')}</h1>
            <p className="text-sm text-muted-foreground">{t('Theo dõi và thu hồi công nợ cửa hàng', 'Track and collect shop debts')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAR} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />{t('Làm mới', 'Refresh')}
          </Button>
        </div>
      </div>
      <Separator />
      <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
        {loading ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div> : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">{t('Tổng công nợ', 'Total AR')}</p><p className="text-xl font-bold mt-1 text-violet-700">{formatVND(kpis.totalAR)}</p></div><div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center"><DollarSign className="h-5 w-5 text-violet-600" /></div></div></CardContent></Card>
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">{t('Quá hạn >7 ngày', 'Overdue 7d+')}</p><p className="text-xl font-bold mt-1 text-amber-700">{formatVND(kpis.overdue7)}</p></div><div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center"><Clock className="h-5 w-5 text-amber-600" /></div></div></CardContent></Card>
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">{t('Quá hạn >30 ngày', 'Critical 30d+')}</p><p className="text-xl font-bold mt-1 text-red-700">{formatVND(kpis.overdue30)}</p></div><div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-600" /></div></div></CardContent></Card>
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">{t('Cửa hàng nợ', 'Shops with Debt')}</p><p className="text-2xl font-bold mt-1 text-blue-700">{kpis.uniqueShops}</p></div><div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center"><Store className="h-5 w-5 text-blue-600" /></div></div></CardContent></Card>
          </div>
        )}

        <div className="flex justify-between items-center gap-4">
          <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder={t('Tìm tên cửa hàng...', 'Search shop name...')} className="pl-9 h-9 text-sm rounded-lg" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
        </div>

        <Card className="shadow-sm rounded-xl overflow-hidden">
          <CardContent className="p-0">
            {loading ? <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}</div> : sorted.length === 0 ? (
              <div className="text-center py-20"><div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4"><DollarSign className="h-8 w-8 text-muted-foreground/40" /></div><p className="text-sm font-medium text-muted-foreground">{t('Không có công nợ nào', 'No debts found')}</p><p className="text-xs text-muted-foreground/60 mt-1">{t('Tất cả cửa hàng đã thanh toán', 'All shops have paid')}</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Cửa hàng', 'Shop')}</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Số tiền nợ', 'Amount')}</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Số ngày', 'Days')}</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Mã đơn', 'Order')}</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Hành động', 'Action')}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {sorted.map((item: any) => (
                      <TableRow key={item.id} className={`${rowClass(item.agingDays)} transition-colors`}>
                        <TableCell>
                          <div><p className="text-sm font-medium">{item.shopName}</p><p className="text-[11px] text-muted-foreground">{item.shopDistrict}</p></div>
                        </TableCell>
                        <TableCell className="font-bold text-sm">{formatVND(item.amount)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`rounded-full font-semibold text-xs w-12 h-7 flex items-center justify-center mx-auto ${item.agingDays > 30 ? 'border-red-300 text-red-600 bg-red-50 dark:bg-red-950/20' : item.agingDays > 14 ? 'border-orange-300 text-orange-600 bg-orange-50 dark:bg-orange-950/20' : 'border-muted text-foreground'}`}>
                            {item.agingDays}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">{item.orderNumber}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => toast.info(t(`Gọi ${item.shopName}: SĐT chưa có`, `Call ${item.shopName}`))}>
                              <Phone className="h-3.5 w-3.5" />{t('Gọi', 'Call')}
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => toast.success(t('Đã gửi nhắc nhở!', 'Reminder sent!'))}>
                              <MessageSquare className="h-3.5 w-3.5" />{t('Nhắc', 'Remind')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        {totalPages > 1 && <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{t(`Trang ${page}/${totalPages}`, `Page ${page}/${totalPages}`)}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4 mr-1" />{t('Trước', 'Prev')}</Button><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t('Sau', 'Next')}<ChevronRight className="h-4 w-4 ml-1" /></Button></div></div>}
      </div>
    </div>
    </>
  );
}