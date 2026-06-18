'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  CreditCard,
  AlertTriangle,
  Lock,
  Clock,
  Percent,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ScrollText,
  SlidersHorizontal,
  Loader2,
  ShieldCheck,
  Zap,
  Phone,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { CreditStatusBadge } from '@/components/credit/credit-status-badge';
import { CreditAdjustDialog } from '@/components/credit/credit-adjust-dialog';
import { TransactionLedgerDialog } from '@/components/credit/transaction-ledger-dialog';
import { formatVND } from '@/lib/security';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

interface CreditSummary {
  exposure: {
    total: number;
    overdueAmount: number;
    overdueCount: number;
    lockedCount: number;
  };
  creditLines: {
    total: number;
    active: number;
    overdue: number;
    locked: number;
  };
  collection: {
    totalUsed: number;
    totalRepaid: number;
    collectionRate: number;
  };
  thisMonth: {
    creditExtended: number;
    totalRepaid: number;
  };
}

interface ShopCreditItem {
  shopId: string;
  shopName: string;
  district: string | null;
  province: string;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  creditStatus: string;
  utilizationPercent: number;
  daysUntilDue: number | null;
  lastTransactionDate: string | null;
  totalOrders: number;
  loyaltyTier: string;
}

interface ShopsResponse {
  items: ShopCreditItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type StatusTab = 'all' | 'active' | 'overdue' | 'locked';

// ============================================
// Main Credit Page
// ============================================

export default function CreditPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Summary state
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Shops state
  const [shops, setShops] = useState<ShopCreditItem[]>([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalShops, setTotalShops] = useState(0);
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const limit = 15;

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Dialogs
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [ledgerDialogOpen, setLedgerDialogOpen] = useState(false);
  const [selectedShop, setSelectedShop] = useState<ShopCreditItem | null>(null);

  // Process overdue
  const [processingOverdue, setProcessingOverdue] = useState(false);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      setSummaryLoading(true);
      const res = await adminFetch('/api/credit/summary');
      const json = await res.json();
      if (json.success) setSummary(json.data);
    } catch (err) {
      console.error('Failed to fetch credit summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Fetch shops
  const fetchShops = useCallback(async () => {
    try {
      setShopsLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });

      if (statusTab !== 'all') {
        params.set('status', statusTab.toUpperCase());
      }

      const res = await adminFetch(`/api/credit/shops?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        const data: ShopsResponse = json.data;
        let items = data.items || [];
        // Client-side search filter
        if (debouncedSearch) {
          const q = debouncedSearch.toLowerCase();
          items = items.filter((s) =>
            s.shopName.toLowerCase().includes(q) ||
            (s.district && s.district.toLowerCase().includes(q)) ||
            (s.province && s.province.toLowerCase().includes(q))
          );
        }
        setShops(items);
        setTotalPages(data.pagination.totalPages);
        setTotalShops(data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch shops:', err);
    } finally {
      setShopsLoading(false);
    }
  }, [page, statusTab, limit, debouncedSearch]);

  // Initial load
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  // Handlers
  const handleOpenAdjust = (shop: ShopCreditItem) => {
    setSelectedShop(shop);
    setAdjustDialogOpen(true);
  };

  const handleOpenLedger = (shop: ShopCreditItem) => {
    setSelectedShop(shop);
    setLedgerDialogOpen(true);
  };

  const handleProcessOverdue = async () => {
    setProcessingOverdue(true);
    try {
      const res = await adminFetch('/api/credit/process-overdue', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        const locked = json.data.lockedCount;
        const already = json.data.alreadyOverdue;
        toast.success(
          locale === 'vi'
            ? `Da khoa ${locked} cua hang qua han. Tong: ${already + locked} cua hang qua han.`
            : `Locked ${locked} overdue shops. Total overdue: ${already + locked}.`
        );
        fetchSummary();
        fetchShops();
      } else {
        toast.error(json.error?.message || 'Failed to process overdue');
      }
    } catch {
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setProcessingOverdue(false);
    }
  };

  // Helpers
  const getUtilizationColor = (percent: number) => {
    if (percent >= 80) return '[&>div]:bg-red-500';
    if (percent >= 50) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-red-500';
  };

  const getDaysColor = (days: number | null, status: string) => {
    if (status === 'OVERDUE') return 'text-red-600 font-bold';
    if (status === 'LOCKED') return 'text-amber-600 font-medium';
    if (days === null) return 'text-muted-foreground';
    if (days <= 0) return 'text-red-600 font-bold';
    if (days <= 3) return 'text-amber-600 font-medium';
    return 'text-red-600';
  };

  const formatLastActivity = (dateStr: string | null) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t('Credit & Finance', 'Cong no & Tai chinh')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t(
                  'Manage 7-day micro-credit system, track exposure, and monitor repayments',
                  'Quan ly he thong tin dung 7 ngay, theo doi no va giam sat thanh toan'
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { fetchSummary(); fetchShops(); }}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Lam moi')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* ====== 1. CREDIT SUMMARY CARDS ====== */}
          {summaryLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : summary ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Total Credit Exposure */}
              <Card className="border-yellow-100 bg-yellow-50/50 dark:border-red-900 dark:bg-emerald-950/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        {t('Total Exposure', 'Tong no cong no')}
                      </p>
                      <div className="text-xl font-bold mt-1">
                        <SensitiveValue value={String(summary.exposure.total)} maskType="amount" formatOptions={{ formatCurrency: true }} />
                      </div>
                      {summary.exposure.overdueAmount > 0 && (
                        <p className="text-[11px] text-red-600 mt-1">
                          <AlertTriangle className="h-3 w-3 inline mr-0.5" />
                          {t('Overdue', 'Qua han')}: <SensitiveValue value={String(summary.exposure.overdueAmount)} maskType="amount" formatOptions={{ formatCurrency: true }} />
                        </p>
                      )}
                    </div>
                    <div className="h-9 w-9 rounded-lg bg-yellow-50 text-red-600 dark:bg-red-900/50 dark:text-yellow-500 flex items-center justify-center">
                      <CreditCard className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Active Credit Lines */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        {t('Active Credit Lines', 'Han muc dang hoat dong')}
                      </p>
                      <p className="text-xl font-bold mt-1">{summary.creditLines.active}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t(`of ${summary.creditLines.total} shops`, `/ ${summary.creditLines.total} cua hang`)}
                      </p>
                    </div>
                    <div className="h-9 w-9 rounded-lg bg-yellow-50 text-red-600 dark:bg-red-900/50 dark:text-yellow-500 flex items-center justify-center">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Overdue Accounts */}
              <Card className={summary.creditLines.overdue > 0 ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        {t('Overdue Accounts', 'Tai khoan qua han')}
                      </p>
                      <p className={`text-xl font-bold mt-1 ${summary.creditLines.overdue > 0 ? 'text-red-600' : ''}`}>
                        {summary.creditLines.overdue}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t(`${summary.creditLines.locked} locked`, `${summary.creditLines.locked} bi khoa`)}
                      </p>
                    </div>
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                      summary.creditLines.overdue > 0
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Collection Rate */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        {t('Collection Rate', 'Ty thu')}
                      </p>
                      <p className={`text-xl font-bold mt-1 ${
                        summary.collection.collectionRate >= 80 ? 'text-red-600' :
                        summary.collection.collectionRate >= 50 ? 'text-amber-600' :
                        'text-red-600'
                      }`}>
                        {summary.collection.collectionRate}%
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t(
                          `${formatVND(summary.collection.totalRepaid)} / ${formatVND(summary.collection.totalUsed)}`,
                          `${formatVND(summary.collection.totalRepaid)} / ${formatVND(summary.collection.totalUsed)}`
                        )}
                      </p>
                    </div>
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                      summary.collection.collectionRate >= 80
                        ? 'bg-yellow-50 text-red-600 dark:bg-red-900/50 dark:text-yellow-500'
                        : 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400'
                    }`}>
                      <Percent className="h-4 w-4" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* ====== 2. AUTOMATION RULES PANEL ====== */}
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-red-600" />
                  {t('Automation Rules', 'Quy tac Tu dong hoa')}
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                  onClick={handleProcessOverdue}
                  disabled={processingOverdue}
                >
                  {processingOverdue ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4 mr-1" />
                  )}
                  {t('Process Overdue', 'Xu ly qua han')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Rule 1: Auto-Lock */}
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{t('Credit Auto-Lock (Day 7)', 'Tu khoa Cong no (Ngay 7)')}</p>
                      <Badge variant="secondary" className="bg-yellow-50 text-red-700 hover:bg-yellow-50 text-[10px] px-1.5 py-0">
                        {t('Active', 'Hoat dong')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t(
                        'Shops unpaid after 7 days are auto-locked from placing new orders',
                        'Cua hang chua tra no sau 7 ngay se bi tu dong khoa khong dat duoc don hang moi'
                      )}
                    </p>
                  </div>
                </div>

                {/* Rule 2: Day 5 Reminder */}
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{t('Day 5 Reminder', 'Nhac nho Ngay 5')}</p>
                      <Badge variant="secondary" className="bg-yellow-50 text-red-700 hover:bg-yellow-50 text-[10px] px-1.5 py-0">
                        {t('Active', 'Hoat dong')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t(
                        'Auto Zalo reminder sent on Day 5 for all unpaid credit',
                        'Tu dong gui nhac nho Zalo vao Ngay 5 cho tat ca no chua tra'
                      )}
                    </p>
                  </div>
                </div>

                {/* Rule 3: Pay Now Discount */}
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-yellow-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{t('Pay Now Discount', 'Giam gia Tra ngay')}</p>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] px-1.5 py-0">
                        {t('Configured', 'Da cau hinh')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t(
                        '2% instant discount for digital payment (MoMo/ZaloPay)',
                        'Giam gia 2% khi thanh toan qua so (MoMo/ZaloPay)'
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ====== 3. SHOP CREDIT OVERVIEW TABLE ====== */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base">
                    {t('Shop Credit Overview', 'Tong quan Tin dung Cua hang')}
                  </CardTitle>
                  <CardDescription>
                    {t(`${totalShops} shops total`, `${totalShops} cua hang tong cong`)}
                  </CardDescription>
                </div>
              </div>

              {/* Search */}
              <div className="flex flex-col sm:flex-row gap-3 mt-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={t('Search by shop name...', 'Tim theo ten cua hang...')}
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Status Tabs */}
              <div className="px-4 pt-2 pb-0">
                <Tabs value={statusTab} onValueChange={(val) => { setStatusTab(val as StatusTab); setPage(1); }}>
                  <TabsList>
                    <TabsTrigger value="all">
                      {t('All Shops', 'Tat ca')}
                      {summary && (
                        <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0">{summary.creditLines.total}</Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="active">
                      {t('Active', 'Hoat dong')}
                      {summary && (
                        <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0 text-red-600">{summary.creditLines.active}</Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="overdue">
                      {t('Overdue', 'Qua han')}
                      {summary && summary.creditLines.overdue > 0 && (
                        <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0 text-red-600">{summary.creditLines.overdue}</Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="locked">
                      {t('Locked', 'Bi khoa')}
                      {summary && summary.creditLines.locked > 0 && (
                        <Badge variant="outline" className="ml-1.5 text-[10px] px-1.5 py-0 text-amber-600">{summary.creditLines.locked}</Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Table */}
              {shopsLoading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : shops.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <CreditCard className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {t('No shops found', 'Khong tim thay cua hang')}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    {t(
                      'No shops match your current filters.',
                      'Khong co cua hang phu hop voi bo loc hien tai.'
                    )}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead>{t('Shop Name', 'Ten Cua hang')}</TableHead>
                          <TableHead className="text-right hidden sm:table-cell">{t('Credit Limit', 'Han muc')}</TableHead>
                          <TableHead className="text-right">{t('Credit Used', 'Da dung')}</TableHead>
                          <TableHead className="text-right hidden md:table-cell">{t('Available', 'Con lai')}</TableHead>
                          <TableHead className="text-center">{t('Usage', 'Su dung')}</TableHead>
                          <TableHead className="text-center">{t('Status', 'TT')}</TableHead>
                          <TableHead className="text-center hidden lg:table-cell">{t('Due In', 'Con han')}</TableHead>
                          <TableHead className="hidden xl:table-cell">{t('Last Activity', 'Hoat dong cuoi')}</TableHead>
                          <TableHead className="text-right">{t('Actions', 'TH')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shops.map((shop) => (
                          <TableRow key={shop.shopId}>
                            {/* Shop Name */}
                            <TableCell>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate max-w-[180px]">
                                  {shop.shopName}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {[shop.district, shop.province].filter(Boolean).join(', ')}
                                </p>
                              </div>
                            </TableCell>

                            {/* Credit Limit */}
                            <TableCell className="text-right hidden sm:table-cell">
                              <span className="text-sm">
                                <SensitiveValue value={String(shop.creditLimit)} maskType="amount" formatOptions={{ formatCurrency: true }} />
                              </span>
                            </TableCell>

                            {/* Credit Used */}
                            <TableCell className="text-right">
                              <span className="text-sm font-medium">
                                <SensitiveValue value={String(shop.creditUsed)} maskType="amount" formatOptions={{ formatCurrency: true }} />
                              </span>
                            </TableCell>

                            {/* Available */}
                            <TableCell className="text-right hidden md:table-cell">
                              <span className={`text-sm ${shop.creditAvailable === 0 ? 'text-red-600 font-medium' : ''}`}>
                                <SensitiveValue value={String(shop.creditAvailable)} maskType="amount" formatOptions={{ formatCurrency: true }} />
                              </span>
                            </TableCell>

                            {/* Usage Progress */}
                            <TableCell className="text-center min-w-[100px]">
                              <div className="flex flex-col items-center gap-1">
                                <Progress
                                  value={shop.utilizationPercent}
                                  className={`h-1.5 w-16 ${getUtilizationColor(shop.utilizationPercent)}`}
                                />
                                <span className="text-[10px] text-muted-foreground">
                                  {shop.utilizationPercent}%
                                </span>
                              </div>
                            </TableCell>

                            {/* Status */}
                            <TableCell className="text-center">
                              <CreditStatusBadge status={shop.creditStatus} locale={locale} />
                            </TableCell>

                            {/* Days Until Due */}
                            <TableCell className="text-center hidden lg:table-cell">
                              {shop.daysUntilDue !== null ? (
                                <span className={`text-xs ${getDaysColor(shop.daysUntilDue, shop.creditStatus)}`}>
                                  {shop.creditStatus === 'OVERDUE' ? (
                                    <>{t('Overdue', 'Qua han')}</>
                                  ) : shop.creditStatus === 'LOCKED' ? (
                                    <>{t('Locked', 'Khoa')}</>
                                  ) : shop.daysUntilDue === 0 ? (
                                    <>{t('Due today', 'Hom nay')}</>
                                  ) : (
                                    <>{shop.daysUntilDue}d</>
                                  )}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>

                            {/* Last Activity */}
                            <TableCell className="hidden xl:table-cell">
                              <span className="text-xs text-muted-foreground">
                                {formatLastActivity(shop.lastTransactionDate)}
                              </span>
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleOpenLedger(shop)}
                                >
                                  <ScrollText className="h-3.5 w-3.5 mr-1" />
                                  {t('Ledger', 'So cai')}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => handleOpenAdjust(shop)}
                                >
                                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                                  {t('Limit', 'Han muc')}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        {t(
                          `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalShops)} of ${totalShops} shops`,
                          `Hien thi ${(page - 1) * limit + 1}–${Math.min(page * limit, totalShops)} / ${totalShops} cua hang`
                        )}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={page <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {getPageNumbers().map((p) => (
                          <Button
                            key={p}
                            variant={p === page ? 'default' : 'outline'}
                            size="icon"
                            className={`h-8 w-8 text-xs ${p === page ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
                            onClick={() => setPage(p)}
                          >
                            {p}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={page >= totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        {/* ====== DIALOGS ====== */}
        <CreditAdjustDialog
          open={adjustDialogOpen}
          onOpenChange={setAdjustDialogOpen}
          shop={selectedShop}
          locale={locale}
          onSuccess={() => {
            fetchShops();
            fetchSummary();
          }}
        />

        <TransactionLedgerDialog
          open={ledgerDialogOpen}
          onOpenChange={setLedgerDialogOpen}
          shop={selectedShop}
          locale={locale}
        />
      </SidebarInset>
    </div>
  );
}
