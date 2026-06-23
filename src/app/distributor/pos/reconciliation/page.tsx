'use client';
import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { Download, RefreshCw, Calculator, Banknote, CreditCard, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function POSReconciliation() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchRecon = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/distributor/pos/reconciliation');
      if (res.success) setData(res.data);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { fetchRecon(); }, []);

  const closeShift = async () => {
    if (!confirm(t('Đóng ca hiện tại?', 'Close current shift?'))) return;
    const cash = prompt(t('Nhập số tiền mặt thực tế trong két:', 'Enter actual cash in register:'));
    if (cash === null) return;
    try {
      await adminFetch('/api/distributor/pos/reconciliation', { method: 'POST', body: JSON.stringify({ closingCash: parseFloat(cash) }) });
      alert(t('Đã đóng ca thành công!', 'Shift closed!'));
      fetchRecon();
    } catch {}
  };

  return (
    <>
      <AdminSidebar /><SidebarInset><AdminHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between px-6 py-4">
            <div><h1 className="text-2xl font-bold tracking-tight">{t('Đối soát ca', 'Shift Reconciliation')}</h1>
              <p className="text-sm text-muted-foreground">{t('Tổng kết ca bán hàng POS', 'POS shift summary')}</p></div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild><a href="/api/distributor/export?type=orders" download><Download className="h-4 w-4 mr-1" />CSV</a></Button>
              <Button variant="outline" size="sm" onClick={fetchRecon} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />{t('Làm mới', 'Refresh')}</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" size="sm" onClick={closeShift}><Calculator className="h-4 w-4 mr-1" />{t('Đóng ca', 'Close Shift')}</Button>
            </div>
          </div>
          <Separator />
          <div className="flex-1 px-6 py-4 space-y-6">
            {loading ? <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div> : data && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <Card className="bg-green-50 dark:bg-green-900/20 border-0"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Banknote className="h-4 w-4 text-green-600" /><span className="text-xs text-muted-foreground">{t('Tiền mặt', 'Cash')}</span></div><p className="text-xl font-bold text-green-700">{formatVND(data.summary.cashSales)}</p></CardContent></Card>
                  <Card className="bg-blue-50 dark:bg-blue-900/20 border-0"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><CreditCard className="h-4 w-4 text-blue-600" /><span className="text-xs text-muted-foreground">{t('Chuyển khoản', 'Bank Transfer')}</span></div><p className="text-xl font-bold text-blue-700">{formatVND(data.summary.bankSales)}</p></CardContent></Card>
                  <Card className="bg-orange-50 dark:bg-orange-900/20 border-0"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Wallet className="h-4 w-4 text-orange-600" /><span className="text-xs text-muted-foreground">{t('Công nợ', 'Debt')}</span></div><p className="text-xl font-bold text-orange-700">{formatVND(data.summary.debtSales)}</p></CardContent></Card>
                  <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-0"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Wallet className="h-4 w-4 text-yellow-600" /><span className="text-xs text-muted-foreground">{t('Tổng doanh thu', 'Total')}</span></div><p className="text-xl font-bold text-yellow-700">{formatVND(data.summary.total)}</p></CardContent></Card>
                </div>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t(`Giao dịch hôm nay (${data.summary.count})`, `Today (${data.summary.count})`)}</CardTitle></CardHeader>
                  <CardContent className="p-0">
                    <Table><TableHeader><TableRow><TableHead>{t('Mã', '#')}</TableHead><TableHead className="text-right">{t('Tổng tiền', 'Total')}</TableHead><TableHead className="text-right">{t('Thời gian', 'Time')}</TableHead></TableRow></TableHeader>
                      <TableBody>{(data.transactions || []).map((tx: any) => (
                        <TableRow key={tx.id}><TableCell className="font-mono text-xs">{tx.orderNumber}</TableCell>
                          <TableCell className="text-right font-semibold">{formatVND(tx.totalAmount)}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleTimeString('vi-VN')}</TableCell>
                        </TableRow>
                      ))}</TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </SidebarInset>
    </>
  );
}