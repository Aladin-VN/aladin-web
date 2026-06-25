'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { ClipboardList, RefreshCw, ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminHeader } from '@/components/layout/admin-header';
import { Separator } from '@/components/ui/separator';

const TYPE_TABS = [
  { key: '', label: 'Tất cả', labelEn: 'All' },
  { key: 'RECEIPT', label: 'Nhập kho', labelEn: 'Stock In' },
  { key: 'ADJUSTMENT', label: 'Điều chỉnh', labelEn: 'Adjustment' },
  { key: 'ORDER_FULFILLMENT', label: 'Xuất đơn', labelEn: 'Order Out' },
  { key: 'POS_SALE', label: 'POS bán', labelEn: 'POS Sale' },
  { key: 'RETURN', label: 'Trả hàng', labelEn: 'Return' },
  { key: 'DAMAGE', label: 'Hư hỏng', labelEn: 'Damage' },
];

const typeBadge = (t: string) => {
  const m: Record<string, string> = {
    RECEIPT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    ADJUSTMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    ORDER_FULFILLMENT: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
    POS_SALE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
    RETURN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    DAMAGE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  };
  return m[t] || 'bg-gray-100 text-gray-700';
};
const typeLabel = (t: string) => {
  const m: Record<string, string> = { RECEIPT: 'Nhập kho', ADJUSTMENT: 'Điều chỉnh', ORDER_FULFILLMENT: 'Xuất đơn', POS_SALE: 'POS bán', RETURN: 'Trả hàng', DAMAGE: 'Hư hỏng' };
  return m[t] || t;
};

export default function InventoryMovements() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeType, setActiveType] = useState('');
  const [search, setSearch] = useState('');

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (activeType) params.set('type', activeType);
      if (search) params.set('search', search);
      const res = await adminFetch(`/api/distributor/inventory/movements?${params}`);
      if (res.success) { setItems(res.data.items || []); setTotalPages(res.data.pagination?.totalPages || 1); }
    } catch (e) { console.error("[FETCH ERROR]", e); }
    setLoading(false);
  }, [activeType, page, search]);
  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  const kpis = useMemo(() => {
    const today = items.filter((i: any) => { const d = new Date(i.createdAt); return d.toDateString() === new Date().toDateString(); }).length;
    const ins = items.filter((i: any) => i.quantity > 0).length;
    const outs = items.filter((i: any) => i.quantity < 0).length;
    return { total: items.length, today, ins, outs };
  }, [items]);

  return (
    <>
    <AdminHeader />
    <div className="flex flex-1 flex-col">
      <div className="px-4 md:px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <ClipboardList className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{t('Lịch sử nhập xuất', 'Inventory Movements')}</h1>
            <p className="text-sm text-muted-foreground">{t('Theo dõi mọi thay đổi tồn kho', 'Track all inventory changes')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchMovements} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />{t('Làm mới', 'Refresh')}
          </Button>
        </div>
      </div>
      <Separator />
      <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
        {loading ? <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div> : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">{t('Tổng hoạt động', 'Total')}</p><p className="text-2xl font-bold mt-1 text-blue-700">{kpis.total}</p></div><div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center"><ClipboardList className="h-5 w-5 text-blue-600" /></div></div></CardContent></Card>
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">{t('Hôm nay', 'Today')}</p><p className="text-2xl font-bold mt-1 text-amber-700">{kpis.today}</p></div><div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center"><RefreshCw className="h-5 w-5 text-amber-600" /></div></div></CardContent></Card>
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">{t('Nhập kho', 'Stock In')}</p><p className="text-2xl font-bold mt-1 text-emerald-700">{kpis.ins}</p></div><div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center"><ArrowDownCircle className="h-5 w-5 text-emerald-600" /></div></div></CardContent></Card>
            <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/20"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">{t('Xuất kho', 'Stock Out')}</p><p className="text-2xl font-bold mt-1 text-red-700">{kpis.outs}</p></div><div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center"><ArrowUpCircle className="h-5 w-5 text-red-600" /></div></div></CardContent></Card>
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex gap-1 flex-wrap">
            {TYPE_TABS.map(tab => (
              <Button key={tab.key} variant={activeType === tab.key ? 'default' : 'outline'} size="sm" onClick={() => { setActiveType(tab.key); setPage(1); }} className={activeType === tab.key ? 'shadow-sm rounded-full px-4' : 'rounded-full px-4 text-muted-foreground hover:text-foreground'}>
                {locale === 'vi' ? tab.label : tab.labelEn}
              </Button>
            ))}
          </div>
          <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder={t('Tìm sản phẩm...', 'Search products...')} className="pl-9 h-9 text-sm rounded-lg" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></div>
        </div>
        <Card className="shadow-sm rounded-xl overflow-hidden">
          <CardContent className="p-0">
            {loading ? <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}</div> : items.length === 0 ? (
              <div className="text-center py-20"><div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4"><ClipboardList className="h-8 w-8 text-muted-foreground/40" /></div><p className="text-sm font-medium text-muted-foreground">{t('Không có hoạt động nào', 'No movements found')}</p></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="hover:bg-transparent">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Ngày', 'Date')}</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Sản phẩm', 'Product')}</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Loại', 'Type')}</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('SL', 'Qty')}</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Trước', 'Before')}</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Sau', 'After')}</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Lý do', 'Reason')}</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {items.map((item: any) => (
                      <TableRow key={item.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(item.createdAt).toLocaleString('vi-VN')}</TableCell>
                        <TableCell><p className="text-sm font-medium">{item.productName}</p><p className="text-[11px] text-muted-foreground">{item.productSku}</p></TableCell>
                        <TableCell className="text-center"><Badge variant="secondary" className={`rounded-full text-[11px] font-medium px-2.5 py-0.5 ${typeBadge(item.type)}`}>{typeLabel(item.type)}</Badge></TableCell>
                        <TableCell className="text-center"><span className={`text-sm font-bold ${item.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{item.quantity > 0 ? `+${item.quantity}` : item.quantity}</span></TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{item.previousQty}</TableCell>
                        <TableCell className="text-center text-sm font-medium">{item.newQty}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{item.reason || '—'}</TableCell>
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