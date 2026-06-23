'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

interface SettlementItem {
  id: string;
  settlementNumber: string;
  distributorId: string;
  distributor: { name: string };
  periodStart: string;
  periodEnd: string;
  totalOrders: number;
  totalOrderValue: number;
  totalPlatformFee: number;
  totalDeliveryFee: number;
  distributorPayout: number;
  driverPayouts: number;
  status: string;
  paidAt: string | null;
  paymentRef: string | null;
  notes: string | null;
  createdAt: string;
  lineItems?: SettlementLineItem[];
}

interface SettlementLineItem {
  id: string;
  orderId: string;
  orderNumber: string;
  orderAmount: number;
  platformFee: number;
  deliveryFee: number;
  distributorAmount: number;
  driverAmount: number;
  driverId: string | null;
}

interface SettlementsResponse {
  items: SettlementItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface DistributorOption {
  id: string;
  name: string;
}

// ============================================
// Status Badge
// ============================================

function StatusBadge({ status, locale }: { status: string; locale: string }) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const config: Record<string, { label: string; labelVi: string; className: string }> = {
    PENDING: { label: 'Pending', labelVi: 'Chờ xử lý', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    PROCESSING: { label: 'Processing', labelVi: 'Đang xử lý', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    PAID: { label: 'Paid', labelVi: 'Đã thanh toán', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
    FAILED: { label: 'Failed', labelVi: 'Thất bại', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
  };
  const c = config[status] || config.PENDING;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.className}`}>
      {locale === 'vi' ? c.labelVi : c.label}
    </span>
  );
}

// ============================================
// Stat Card
// ============================================

function StatCard({
  title, titleVi, value, icon, variant = 'default', locale, isSensitive = false,
}: {
  title: string; titleVi: string; value: string | number;
  icon: React.ReactNode; variant?: 'default' | 'warning' | 'success' | 'danger';
  locale: string; isSensitive?: boolean;
}) {
  const label = locale === 'vi' ? titleVi : title;
  return (
    <Card className={
      variant === 'danger' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30' :
      variant === 'warning' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30' :
      variant === 'success' ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30' :
      ''
    }>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-xl font-bold mt-1">
              {isSensitive ? (
                <SensitiveValue value={String(value)} maskType="amount" formatOptions={{ formatCurrency: true }} />
              ) : (
                typeof value === 'number' ? value.toLocaleString() : value
              )}
            </p>
          </div>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
            variant === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400' :
            variant === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400' :
            variant === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' :
            'bg-muted text-muted-foreground'
          }`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// Format VND helper
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}

// ============================================
// Main Settlements Page
// ============================================

export default function SettlementsPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data state
  const [settlements, setSettlements] = useState<SettlementItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');
  const [distributorFilter, setDistributorFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Generate dialog state
  const [showGenerate, setShowGenerate] = useState(false);
  const [distributors, setDistributors] = useState<DistributorOption[]>([]);
  const [genDistributorId, setGenDistributorId] = useState('');
  const [genPeriodStart, setGenPeriodStart] = useState('');
  const [genPeriodEnd, setGenPeriodEnd] = useState('');
  const [generating, setGenerating] = useState(false);

  // Detail drawer state
  const [detailSettlement, setDetailSettlement] = useState<SettlementItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Pay dialog state
  const [showPay, setShowPay] = useState(false);
  const [payingSettlement, setPayingSettlement] = useState<SettlementItem | null>(null);
  const [payRef, setPayRef] = useState('');
  const [paying, setPaying] = useState(false);

  // Computed stats
  const pendingPayout = settlements.filter(s => s.status === 'PENDING' || s.status === 'PROCESSING')
    .reduce((sum, s) => sum + s.distributorPayout, 0);
  const paidTotal = settlements.filter(s => s.status === 'PAID')
    .reduce((sum, s) => sum + s.distributorPayout, 0);

  // ============================================
  // Fetch settlements
  // ============================================
  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (distributorFilter !== 'all') params.set('distributorId', distributorFilter);

      const json = await adminFetch(`/api/settlements?${params}`);
      if (json.success) {
        const data: SettlementsResponse = json.data;
        setSettlements(data.items);
        setTotal(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (err) {
      console.error('Fetch settlements error:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, distributorFilter]);

  useEffect(() => { fetchSettlements(); }, [fetchSettlements]);

  // Fetch distributors for generate dialog + filter dropdown
  const fetchDistributors = useCallback(async () => {
    try {
      const json = await adminFetch('/api/distributors?limit=100');
      if (json.success) {
        setDistributors(json.data.items.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })));
      }
    } catch (err) {
      console.error('Fetch distributors error:', err);
    }
  }, []);

  useEffect(() => { fetchDistributors(); }, [fetchDistributors]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [statusFilter, distributorFilter]);

  // ============================================
  // Generate settlement
  // ============================================
  const handleGenerate = async () => {
    if (!genDistributorId || !genPeriodStart || !genPeriodEnd) {
      toast.error(t('Please fill all fields', 'Vui lòng điền đầy đủ thông tin'));
      return;
    }
    setGenerating(true);
    try {
      const res = await adminFetch('/api/settlements', {
        method: 'POST',
        body: JSON.stringify({
          distributorId: genDistributorId,
          periodStart: genPeriodStart,
          periodEnd: genPeriodEnd,
        }),
      });
      if (json.success) {
        toast.success(t('Settlement generated', 'Tạo kỳ đối soát thành công'));
        setShowGenerate(false);
        setGenDistributorId('');
        setGenPeriodStart('');
        setGenPeriodEnd('');
        fetchSettlements();
      } else {
        toast.error(json.error?.message || t('Failed to generate', 'Không thể tạo kỳ đối soát'));
      }
    } catch (err) {
      console.error('Generate settlement error:', err);
      toast.error(t('Network error', 'Lỗi mạng'));
    } finally {
      setGenerating(false);
    }
  };

  // ============================================
  // Fetch settlement detail (with line items)
  // ============================================
  const handleViewDetail = async (s: SettlementItem) => {
    setDetailSettlement(s);
    setDetailLoading(true);
    try {
      // Fetch line items via a separate query (we need an API for this)
      // For now, the detail shows the settlement summary from the list
      setDetailLoading(false);
    } catch {
      setDetailLoading(false);
    }
  };

  // ============================================
  // Pay settlement
  // ============================================
  const handlePay = async () => {
    if (!payingSettlement) return;
    setPaying(true);
    try {
      const res = await adminFetch(`/api/settlements/${payingSettlement.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ paymentRef: payRef.trim() || undefined }),
      });
      if (json.success) {
        toast.success(t('Settlement marked as paid', 'Đã đánh dấu thanh toán'));
        setShowPay(false);
        setPayRef('');
        setPayingSettlement(null);
        fetchSettlements();
      } else {
        toast.error(json.error?.message || t('Payment failed', 'Thanh toán thất bại'));
      }
    } catch (err) {
      console.error('Pay settlement error:', err);
      toast.error(t('Network error', 'Lỗi mạng'));
    } finally {
      setPaying(false);
    }
  };

  // ============================================
  // Open pay dialog
  // ============================================
  const openPayDialog = (s: SettlementItem) => {
    setPayingSettlement(s);
    setPayRef('');
    setShowPay(true);
  };

  return (
    <>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex-1 p-4 pt-0 space-y-4">
            {/* Page Header */}
            <div className="flex items-center justify-between pt-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <Wallet className="h-6 w-6 text-red-600" />
                  {t('Settlements', 'Đối soát thanh toán')}
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('Manage distributor cash-flow settlements', 'Quản lý đối soát thanh toán nhà phân phối')}
                </p>
              </div>
              <Button
                onClick={() => setShowGenerate(true)}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('Generate Settlement', 'Tạo kỳ đối soát')}
              </Button>
            </div>

            <Separator />

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard title="Total Settlements" titleVi="Tổng kỳ đối soát" value={total}
                icon={<Wallet className="h-4 w-4" />} locale={locale} />
              <StatCard title="Pending Payout" titleVi="Chờ thanh toán" value={pendingPayout}
                icon={<Clock className="h-4 w-4" />} variant="warning" locale={locale} isSensitive />
              <StatCard title="Paid Total" titleVi="Đã thanh toán" value={paidTotal}
                icon={<CheckCircle2 className="h-4 w-4" />} variant="success" locale={locale} isSensitive />
              <StatCard title="Platform Fees" titleVi="Phí nền tảng" value={
                settlements.reduce((sum, s) => sum + s.totalPlatformFee, 0)
              }
                icon={<CreditCard className="h-4 w-4" />} locale={locale} isSensitive />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder={t('Status', 'Trạng thái')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All Statuses', 'Tất cả trạng thái')}</SelectItem>
                  <SelectItem value="PENDING">{t('Pending', 'Chờ xử lý')}</SelectItem>
                  <SelectItem value="PROCESSING">{t('Processing', 'Đang xử lý')}</SelectItem>
                  <SelectItem value="PAID">{t('Paid', 'Đã thanh toán')}</SelectItem>
                  <SelectItem value="FAILED">{t('Failed', 'Thất bại')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={distributorFilter} onValueChange={setDistributorFilter}>
                <SelectTrigger className="w-[200px] h-9">
                  <SelectValue placeholder={t('Distributor', 'Nhà phân phối')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All Distributors', 'Tất cả NPP')}</SelectItem>
                  {distributors.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => fetchSettlements()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                {t('Refresh', 'Làm mới')}
              </Button>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">{t('Settlement #', 'Mã đối soát')}</TableHead>
                      <TableHead>{t('Distributor', 'Nhà phân phối')}</TableHead>
                      <TableHead className="text-right">{t('Period', 'Kỳ')}</TableHead>
                      <TableHead className="text-right">{t('Orders', 'Đơn hàng')}</TableHead>
                      <TableHead className="text-right">{t('Order Value', 'Giá trị ĐH')}</TableHead>
                      <TableHead className="text-right">{t('Platform Fee', 'Phí Nền tảng')}</TableHead>
                      <TableHead className="text-right">{t('Payout', 'Thanh toán NPP')}</TableHead>
                      <TableHead>{t('Status', 'Trạng thái')}</TableHead>
                      <TableHead className="text-right">{t('Actions', 'Hành động')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 9 }).map((_, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : settlements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                          <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          <p>{t('No settlements found', 'Không có kỳ đối soát nào')}</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      settlements.map((s) => (
                        <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleViewDetail(s)}>
                          <TableCell className="font-mono text-xs font-medium">{s.settlementNumber}</TableCell>
                          <TableCell className="font-medium">{s.distributor.name}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">
                            {new Date(s.periodStart).toLocaleDateString('vi-VN')} – {new Date(s.periodEnd).toLocaleDateString('vi-VN')}
                          </TableCell>
                          <TableCell className="text-right">{s.totalOrders}</TableCell>
                          <TableCell className="text-right">
                            <SensitiveValue value={String(s.totalOrderValue)} maskType="amount" formatOptions={{ formatCurrency: true }} />
                          </TableCell>
                          <TableCell className="text-right text-red-600 dark:text-red-400">
                            <SensitiveValue value={String(s.totalPlatformFee)} maskType="amount" formatOptions={{ formatCurrency: true }} />
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <SensitiveValue value={String(s.distributorPayout)} maskType="amount" formatOptions={{ formatCurrency: true }} />
                          </TableCell>
                          <TableCell><StatusBadge status={s.status} locale={locale} /></TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            {(s.status === 'PENDING' || s.status === 'PROCESSING') && (
                              <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 hover:text-emerald-700"
                                onClick={() => openPayDialog(s)}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {t('Pay', 'TT')}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {t(`Page ${page} of ${totalPages} (${total} total)`, `Trang ${page}/${totalPages} (${total} tổng)`)}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SidebarInset>

      {/* ============================================ */}
      {/* Generate Settlement Dialog                  */}
      {/* ============================================ */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-red-600" />
              {t('Generate Settlement', 'Tạo kỳ đối soát')}
            </DialogTitle>
            <DialogDescription>
              {t('Create a settlement for delivered orders in a period', 'Tạo kỳ đối soát cho các đơn hàng đã giao trong một khoảng thời gian')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('Distributor', 'Nhà phân phối')} <span className="text-red-500">*</span></Label>
              <Select value={genDistributorId} onValueChange={setGenDistributorId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('Select distributor...', 'Chọn nhà phân phối...')} />
                </SelectTrigger>
                <SelectContent>
                  {distributors.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('Period Start', 'Bắt đầu kỳ')} <span className="text-red-500">*</span></Label>
                <Input type="date" value={genPeriodStart} onChange={(e) => setGenPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('Period End', 'Kết thúc kỳ')} <span className="text-red-500">*</span></Label>
                <Input type="date" value={genPeriodEnd} onChange={(e) => setGenPeriodEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowGenerate(false)} disabled={generating}>
              {t('Cancel', 'Hủy')}
            </Button>
            <Button onClick={handleGenerate} disabled={generating || !genDistributorId || !genPeriodStart || !genPeriodEnd}
              className="bg-red-600 hover:bg-red-700 text-white">
              {generating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {t('Generate', 'Tạo')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* Pay Settlement Dialog                       */}
      {/* ============================================ */}
      <Dialog open={showPay} onOpenChange={setShowPay}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              {t('Confirm Payment', 'Xác nhận thanh toán')}
            </DialogTitle>
            <DialogDescription>
              {t('Mark this settlement as paid', 'Đánh dấu kỳ đối soát đã thanh toán')}
            </DialogDescription>
          </DialogHeader>
          {payingSettlement && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('Settlement', 'Mã đối soát')}</span>
                  <span className="font-mono font-medium">{payingSettlement.settlementNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('Distributor', 'Nhà phân phối')}</span>
                  <span className="font-medium">{payingSettlement.distributor.name}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>{t('Payout Amount', 'Số tiền TT')}</span>
                  <span className="text-emerald-600 dark:text-emerald-400">{formatVND(payingSettlement.distributorPayout)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-ref">{t('Payment Reference (optional)', 'Mã giao dịch (tuỳ chọn)')}</Label>
                <Input id="pay-ref" value={payRef} onChange={(e) => setPayRef(e.target.value)}
                  placeholder={t('Bank transfer reference...', 'Mã CK ngân hàng...')} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPay(false)} disabled={paying}>
              {t('Cancel', 'Hủy')}
            </Button>
            <Button onClick={handlePay} disabled={paying}
              className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {paying && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {t('Confirm Payment', 'Xác nhận TT')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* Settlement Detail Drawer                    */}
      {/* ============================================ */}
      <Dialog open={!!detailSettlement} onOpenChange={(open) => { if (!open) setDetailSettlement(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-red-600" />
              {detailSettlement?.settlementNumber}
            </DialogTitle>
            <DialogDescription>
              {detailSettlement && (
                <>{detailSettlement.distributor.name} &middot; {t('Settlement Detail', 'Chi tiết kỳ đối soát')}</>
              )}
            </DialogDescription>
          </DialogHeader>
          {detailSettlement && (
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
              {detailLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : (
                <>
                  {/* Status + Period */}
                  <div className="flex items-center gap-3">
                    <StatusBadge status={detailSettlement.status} locale={locale} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(detailSettlement.createdAt).toLocaleString('vi-VN')}
                    </span>
                  </div>

                  {/* Period */}
                  <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('Period', 'Kỳ')}</span>
                      <span>
                        {new Date(detailSettlement.periodStart).toLocaleDateString('vi-VN')} – {new Date(detailSettlement.periodEnd).toLocaleDateString('vi-VN')}
                      </span>
                    </div>
                    {detailSettlement.paidAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('Paid At', 'Ngày TT')}</span>
                        <span>{new Date(detailSettlement.paidAt).toLocaleString('vi-VN')}</span>
                      </div>
                    )}
                    {detailSettlement.paymentRef && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('Payment Ref', 'Mã GĐ')}</span>
                        <span className="font-mono">{detailSettlement.paymentRef}</span>
                      </div>
                    )}
                  </div>

                  {/* Financial Summary */}
                  <div className="border-t pt-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {t('Financial Summary', 'Tóm tắt tài chính')}
                    </p>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('Total Orders', 'Tổng đơn hàng')}</span>
                        <span className="font-medium">{detailSettlement.totalOrders}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('Total Order Value', 'Tổng giá trị ĐH')}</span>
                        <span className="font-medium">{formatVND(detailSettlement.totalOrderValue)}</span>
                      </div>
                      <div className="flex justify-between text-red-600 dark:text-red-400">
                        <span>{t('Platform Fee', 'Phí nền tảng')}</span>
                        <span className="font-medium">- {formatVND(detailSettlement.totalPlatformFee)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('Delivery Fees', 'Phí giao hàng')}</span>
                        <span className="font-medium">{formatVND(detailSettlement.totalDeliveryFee)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('Driver Payouts', 'TT Tài xế')}</span>
                        <span className="font-medium">{formatVND(detailSettlement.driverPayouts)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-bold text-emerald-600 dark:text-emerald-400">
                        <span>{t('Distributor Payout', 'TT Nhà phân phối')}</span>
                        <span>{formatVND(detailSettlement.distributorPayout)}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}