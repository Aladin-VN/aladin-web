'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { toast } from 'sonner';
import { RotateCcw, Plus, Package, Clock, CheckCircle, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminHeader } from '@/components/layout/admin-header';

const REASONS = [
  { value: 'DAMAGED', label: 'Hỏng hỏng', labelEn: 'Damaged' },
  { value: 'WRONG', label: 'Sai hàng', labelEn: 'Wrong Item' },
  { value: 'EXPIRED', label: 'Hết hạn', labelEn: 'Expired' },
  { value: 'EXCESS', label: 'Thừa hàng', labelEn: 'Excess' },
  { value: 'OTHER', label: 'Khác', labelEn: 'Other' },
];

export default function ReturnsPage() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ orderNumber: '', reason: '', notes: '', items: '' });
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/distributor/returns?page=${page}&limit=20`);
      if (res.success) {
        setReturns(res.data.items || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (e: any) {
      toast.error(e?.message || t('Lỗi tải dữ liệu', 'Failed to load'));
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = returns.filter((r: any) => new Date(r.createdAt) >= monthStart).length;
    const totalQty = returns.reduce((s: any, r: any) => s + Math.abs(r.quantity || 0), 0);
    return { total: returns.length, thisMonth, totalQty };
  }, [returns]);

  const handleCreate = async () => {
    if (!form.orderNumber) { toast.error(t('Nhập mã đơn hàng', 'Enter order number')); return; }
    if (!form.reason) { toast.error(t('Chọn lý do trả hàng', 'Select a reason')); return; }
    setSubmitting(true);
    try {
      const res = await adminFetch('/api/distributor/returns', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      if (res.success) {
        toast.success(t('Đã tạo phiếu trả hàng!', 'Return created!'));
        setDialogOpen(false);
        setForm({ orderNumber: '', reason: '', notes: '', items: '' });
        fetchReturns();
      } else {
        toast.error(res.error?.message || t('Lỗi tạo trả hàng', 'Failed to create return'));
      }
    } catch (e: any) {
      toast.error(e?.message || t('Lỗi mạng', 'Network error'));
    }
    setSubmitting(false);
  };

  return (
    <>
      <AdminHeader />
      <div className="flex flex-1 flex-col">
        <div className="px-4 md:px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-600/20">
              <RotateCcw className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight">{t('Trả hàng', 'Returns')}</h1>
              <p className="text-sm text-muted-foreground">{t('Quản lý hàng trả về từ cửa hàng', 'Manage goods returned from shops')}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchReturns} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />{t('Làm mới', 'Refresh')}
              </Button>
              <Button onClick={() => setDialogOpen(true)} className="rounded-lg"><Plus className="h-4 w-4 mr-1" />{t('Tạo phiếu trả hàng', 'New Return')}</Button>
            </div>
          </div>
        </div>
        <Separator />
        <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
          {/* KPI Cards */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/20"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">{t('Tháng này', 'This Month')}</p><p className="text-2xl font-bold mt-1 text-rose-700">{kpis.thisMonth}</p><p className="text-[11px] text-muted-foreground mt-0.5">{t('phiếu trả hàng', 'returns')}</p></div><div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center"><RotateCcw className="h-5 w-5 text-rose-600" /></div></div></CardContent></Card>
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">{t('Tổng sản phẩm trả', 'Total Items Returned')}</p><p className="text-2xl font-bold mt-1 text-red-700">{kpis.totalQty}</p><p className="text-[11px] text-muted-foreground mt-0.5">{t('sản phẩm', 'items')}</p></div><div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center"><AlertTriangle className="h-5 w-5 text-red-600" /></div></div></CardContent></Card>
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-muted-foreground">{t('Tổng phiếu', 'Total Returns')}</p><p className="text-2xl font-bold mt-1 text-emerald-700">{kpis.total}</p><p className="text-[11px] text-muted-foreground mt-0.5">{t('tất cả thời gian', 'all time')}</p></div><div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center"><CheckCircle className="h-5 w-5 text-emerald-600" /></div></div></CardContent></Card>
            </div>
          )}

          {/* Returns Table */}
          <Card className="shadow-sm rounded-xl overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}</div>
              ) : returns.length === 0 ? (
                <div className="text-center py-20">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4"><Package className="h-8 w-8 text-muted-foreground/40" /></div>
                  <p className="text-sm font-medium text-muted-foreground">{t('Chưa có phiếu trả hàng nào', 'No returns yet')}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{t('Nhấn "Tạo phiếu trả hàng" để bắt đầu', 'Click "New Return" to get started')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Ngày', 'Date')}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Sản phẩm', 'Product')}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('SL', 'Qty')}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Đơn hàng', 'Order')}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Lý do', 'Reason')}</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Người thực hiện', 'By')}</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {returns.map((r: any) => (
                        <TableRow key={r.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleString('vi-VN')}</TableCell>
                          <TableCell><p className="text-sm font-medium">{r.productName}</p><p className="text-[11px] text-muted-foreground">{r.productSku}</p></TableCell>
                          <TableCell className="text-center"><Badge variant="secondary" className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-xs font-semibold">+{r.quantity}</Badge></TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">{r.orderNumber || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{r.reason || '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.performedBy || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

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

      {/* New Return Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-rose-100 flex items-center justify-center"><RotateCcw className="h-4 w-4 text-rose-600" /></div>
              {t('Tạo phiếu trả hàng', 'New Return')}
            </DialogTitle>
            <DialogDescription>{t('Nhập thông tin hàng trả về', 'Enter return details')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label className="text-sm font-medium">{t('Mã đơn hàng', 'Order Number')}</Label><Input placeholder={t('VD: ALD-20260618-001', 'e.g. ALD-20260618-001')} value={form.orderNumber} onChange={(e) => setForm({ ...form, orderNumber: e.target.value })} className="rounded-lg" /></div>
            <div className="space-y-2"><Label className="text-sm font-medium">{t('Lý do', 'Reason')}</Label><Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}><SelectTrigger className="rounded-lg"><SelectValue placeholder={t('Chọn lý do...', 'Select reason...')} /></SelectTrigger><SelectContent>{REASONS.map(r => <SelectItem key={r.value} value={r.value}>{locale === 'vi' ? r.label : r.labelEn}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="text-sm font-medium">{t('Sản phẩm trả', 'Items to return')}</Label><Textarea placeholder={t('Nhập tên sản phẩm và số lượng...', 'Enter product names and quantities...')} value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} className="rounded-lg resize-none" rows={3} /></div>
            <div className="space-y-2"><Label className="text-sm font-medium">{t('Ghi chú', 'Notes')}</Label><Textarea placeholder={t('Ghi chú thêm...', 'Additional notes...')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-lg resize-none" rows={2} /></div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-lg">{t('Hủy', 'Cancel')}</Button>
            <Button onClick={handleCreate} disabled={submitting || !form.orderNumber || !form.reason} className="bg-rose-600 hover:bg-rose-700 text-white rounded-lg">{submitting ? t('Đang xử lý...', 'Processing...') : t('Tạo phiếu', 'Create Return')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}