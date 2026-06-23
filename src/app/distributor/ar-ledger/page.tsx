'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { CreditCard, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
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

  const agingColor = (b: string) =>
    b === 'overdue30' ? 'bg-red-100 text-red-800' :
    b === 'overdue15' ? 'bg-orange-100 text-orange-800' :
    b === 'overdue8' ? 'bg-yellow-100 text-yellow-800' :
    'bg-green-100 text-green-800';

  const agingLabel = (b: string) => {
    const map: Record<string, string> = { current: 'Hien tai', overdue8: '8-14 ngay', overdue15: '15-30 ngay', overdue30: '>30 ngay' };
    return map[b] || b;
  };

  return (
    <>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('Cong no phai thu', 'AR Ledger')}</h1>
              <p className="text-sm text-muted-foreground">{t('Don hang da giao chua doi so', 'Delivered orders pending settlement')}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAR} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              {t('Lam moi', 'Refresh')}
            </Button>
          </div>
          <Separator />
          <div className="flex-1 px-6 py-4 space-y-4">
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50 dark:bg-blue-900/20 border-0"><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{t('Tong cong no', 'Total AR')}</p>
                  <p className="text-xl font-bold text-blue-700">{formatVND(summary.totalAR)}</p>
                </CardContent></Card>
                <Card className="bg-green-50 dark:bg-green-900/20 border-0"><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{t('Hien tai (0-7 ngay)', 'Current (0-7d)')}</p>
                  <p className="text-xl font-bold text-green-700">{formatVND(summary.current)}</p>
                </CardContent></Card>
                <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-0"><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{t('Qua han (8-30 ngay)', 'Overdue 8-30d')}</p>
                  <p className="text-xl font-bold text-yellow-700">{formatVND(summary.overdue8 + summary.overdue15)}</p>
                </CardContent></Card>
                <Card className="bg-red-50 dark:bg-red-900/20 border-0"><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{t('Qua han (>30 ngay)', 'Overdue 30d+')}</p>
                  <p className="text-xl font-bold text-red-700">{formatVND(summary.overdue30)}</p>
                </CardContent></Card>
              </div>

            <div className="flex gap-1 flex-wrap">
              {AGING_TABS.map(tab => (
                <Button key={tab.key} variant={aging === tab.key ? 'default' : 'outline'} size="sm" onClick={() => { setAging(tab.key); setPage(1); }} className="text-xs">{locale === 'vi' ? tab.label : tab.labelEn}</Button>
              ))}
            </div>

            <Card><CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
              ) : items.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">{t('Khong co cong no', 'No AR')}</div>
              ) : (
                <Table><TableHeader><TableRow>
                  <TableHead><TableHead>{t('Ma don', 'Order#')}</TableHead><TableHead>{t('Cua hang', 'Shop')}</TableHead><TableHead className="text-center">{t('So ngay', 'Days')}</TableHead><TableHead className="text-center">{t('Phan loai', 'Bucket')}</TableHead><TableHead className="text-right">{t('So tien', 'Amount')}</TableHead></TableRow></TableHeader>
                    <TableBody>{items.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.orderNumber}</TableCell>
                          <TableCell>{item.shopName}<br /><span className="text-xs text-muted-foreground">{item.shopDistrict}</span></TableCell>
                          <TableCell className="text-center"><Badge variant="outline" className={item.agingDays > 14 ? 'border-red-300 text-red-600' : ''}>{item.agingDays}</Badge></TableCell>
                          <TableCell className="text-center"><Badge variant="secondary" className={agingColor(item.agingBucket)}>{agingLabel(item.agingBucket)}</Badge></TableCell>
                          <TableCell className="text-right font-semibold">{formatVND(item.amount)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{item.deliveredAt?.slice(0, 10)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody></Table>
                )}
              </CardContent></Card>
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t(`Trang ${page}/${totalPages}`, `Page ${page}/${totalPages}`)}</p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-4 w-4 mr-1" />{t('Truoc', 'Prev')}</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>{t('Sau', 'Next')}<ChevronRight className="h-4 w-4 ml-1" /></Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </>
  );
}