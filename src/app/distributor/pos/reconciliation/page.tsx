'use client';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { Download, RefreshCw, Calculator, Banknote, CreditCard, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AdminHeader } from '@/components/layout/admin-header';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';

export default function POSReconciliation() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingCash, setClosingCash] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRecon = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/distributor/pos/reconciliation');
      if (res.success) setData(res.data);
    } catch (e) { console.error("[FETCH ERROR]", e); }
    setLoading(false);
  };
  useEffect(() => { fetchRecon(); }, []);

  const closeShift = async () => {
    const cashVal = parseFloat(closingCash);
    if (isNaN(cashVal) || cashVal < 0) {
      toast.error(t('Nhập số tiền hợp lệ', 'Enter a valid amount'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await adminFetch('/api/distributor/pos/reconciliation', {
        method: 'POST',
        body: JSON.stringify({ closingCash: cashVal }),
      });
      if (res.success) {
        toast.success(t('Đã đóng ca thành công!', 'Shift closed successfully!'));
        setCloseDialogOpen(false);
        setClosingCash('');
        fetchRecon();
      } else {
        toast.error(res.error?.message || t('Lỗi đóng ca', 'Failed to close shift'));
      }
    } catch (e) { console.error("[FETCH ERROR]", e); toast.error(t('Lỗi mạng', 'Network error')); }
    setSubmitting(false);
  };

  return (
    <>
      <AdminHeader />
      <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between px-6 py-4">
            <div><h1 className="text-2xl font-bold tracking-tight">{t('Đối soát ca', 'Shift Reconciliation')}</h1>
              <p className="text-sm text-muted-foreground">{t('Tổng kết ca bán hàng POS', 'POS shift summary')}</p></div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild><a href="/api/distributor/export?type=orders" download><Download className="h-4 w-4 mr-1" />CSV</a></Button>
              <Button variant="outline" size="sm" onClick={fetchRecon} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />{t('Làm mới', 'Refresh')}</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" size="sm" onClick={() => setCloseDialogOpen(true)}><Calculator className="h-4 w-4 mr-1" />{t('Đóng ca', 'Close Shift')}</Button>
            </div>
          </div>
          <Separator />
          <div className="flex-1 px-6 py-4 space-y-6">
            {loading ? <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div> : data && (
              <>
                <div className="grid grid-cols-4 gap-4">
                  <Card className="bg-green-50 dark:bg-green-900/20 border-0"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Banknote className="h-4 w-4 text-green-600" /><span className="text-xs text-muted-foreground">{t('Tiền mặt', 'Cash')}</span></div><p className="text-xl font-bold text-green-700">{formatVND(data.summary.CASH)}</p></CardContent></Card>
                  <Card className="bg-blue-50 dark:bg-blue-900/20 border-0"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><CreditCard className="h-4 w-4 text-blue-600" /><span className="text-xs text-muted-foreground">{t('Chuyển khoản', 'Bank Transfer')}</span></div><p className="text-xl font-bold text-blue-700">{formatVND(data.summary.BANK_TRANSFER)}</p></CardContent></Card>
                  <Card className="bg-orange-50 dark:bg-orange-900/20 border-0"><CardContent className="p-4"><div className="flex items-center gap-2 mb-1"><Wallet className="h-4 w-4 text-orange-600" /><span className="text-xs text-muted-foreground">{t('Công nợ', 'Debt')}</span></div><p className="text-xl font-bold text-orange-700">{formatVND(data.summary.CREDIT)}</p></CardContent></Card>
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

      {/* Close Shift Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                <Calculator className="h-4 w-4 text-red-600" />
              </div>
              {t('Đóng ca bán hàng', 'Close Shift')}
            </DialogTitle>
            <DialogDescription>
              {t('Nhập số tiền mặt thực tế trong két để đối soát.', 'Enter actual cash in register to reconcile.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">{t('Tiền mặt theo hệ thống', 'Expected cash')}</p>
              <p className="text-lg font-bold">{data?.summary ? formatVND(data.summary.CASH) : '...'}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t('Tiền mặt thực tế (VND)', 'Actual cash (VND)')}</Label>
              <Input
                type="number"
                min="0"
                placeholder={t('Nhập số tiền...', 'Enter amount...')}
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                className="rounded-lg text-lg font-mono"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)} className="rounded-lg">
              {t('Hủy', 'Cancel')}
            </Button>
            <Button
              onClick={closeShift}
              disabled={submitting || !closingCash}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm"
            >
              {submitting ? t('Đang xử lý...', 'Processing...') : t('Xác nhận đóng ca', 'Confirm Close Shift')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}