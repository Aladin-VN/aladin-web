'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Gift,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit,
  Trash2,
  Eye,
  Factory,
  Calendar,
  BarChart3,
  RotateCcw,
  Loader2,
  TrendingUp,
  Clock,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { PromoTypeBadge } from '@/components/promotions/promo-type-badge';
import { PromoStatusBadge } from '@/components/promotions/promo-status-badge';
import { PromotionFormDialog } from '@/components/promotions/promotion-form-dialog';
import { PromotionDetailDrawer } from '@/components/promotions/promotion-detail-drawer';
import { formatVND } from '@/lib/security';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

interface PromotionListItem {
  id: string;
  title: string;
  titleEn: string | null;
  promoType: string;
  buyQty: number | null;
  getQty: number | null;
  discountPercent: number | null;
  discountAmount: number | null;
  startsAt: string;
  expiresAt: string;
  totalBudget: number | null;
  usedBudget: number;
  totalRedemptions: number;
  isActive: boolean;
  computedStatus: string;
  budgetPercent: number;
  budgetRemaining: number;
  budgetRemainingFormatted: string;
  usedBudgetFormatted: string;
  totalBudgetFormatted: string | null;
  productCount: number;
  orderItemCount: number;
  manufacturer: { id: string; name: string };
}

interface PromotionsResponse {
  items: PromotionListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: { manufacturers: { id: string; name: string }[] };
}

interface PromotionStats {
  totalPromotions: number;
  activePromotions: number;
  upcomingPromotions: number;
  expiredPromotions: number;
  typeDistribution: Record<string, { count: number; label: string; labelVi: string }>;
  topByRedemptions: { id: string; title: string; promoType: string; totalRedemptions: number; usedBudget: number; manufacturer: { name: string } }[];
  budgetSummary: {
    totalBudget: number;
    totalBudgetFormatted: string;
    totalUsedBudget: number;
    totalUsedBudgetFormatted: string;
    budgetUtilizationPercent: number;
    totalRedemptions: number;
  };
}

// ============================================
// Main Promotions Page
// ============================================

export default function PromotionsPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data state
  const [promotions, setPromotions] = useState<PromotionListItem[]>([]);
  const [stats, setStats] = useState<PromotionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [manufacturers, setManufacturers] = useState<{ id: string; name: string }[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [promoTypeFilter, setPromoTypeFilter] = useState('all');
  const [manufacturerFilter, setManufacturerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<PromotionListItem | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailPromotionId, setDetailPromotionId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  // Fetch promotions
  const fetchPromotions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
      });
      if (promoTypeFilter && promoTypeFilter !== 'all') params.set('promoType', promoTypeFilter);
      if (manufacturerFilter && manufacturerFilter !== 'all') params.set('manufacturerId', manufacturerFilter);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);

      const json = await adminFetch(`/api/promotions?${params.toString()}`);
      if (json.success) {
        const data: PromotionsResponse = json.data;
        setPromotions(data.items || []);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
        setManufacturers(data.filters?.manufacturers || []);
      }
    } catch (err) {
      console.error('Failed to fetch promotions:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, promoTypeFilter, manufacturerFilter, statusFilter, limit]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const json = await adminFetch('/api/promotions/stats');
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch promotion stats:', err);
    }
  }, []);

  useEffect(() => { fetchPromotions(); }, [fetchPromotions]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Handlers
  const handleCreate = () => {
    setSelectedPromotion(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (promo: PromotionListItem) => {
    setSelectedPromotion(promo);
    setFormDialogOpen(true);
  };

  const handleView = (promo: PromotionListItem) => {
    setDetailPromotionId(promo.id);
    setDetailDrawerOpen(true);
  };

  const handleDelete = (promo: PromotionListItem) => {
    setSelectedPromotion(promo);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedPromotion) return;
    try {
      setDeleting(true);
      const json = await adminFetch(`/api/promotions/${selectedPromotion.id}`, { method: 'DELETE' });
      if (json.success) {
        toast.success(t('Promotion deleted', 'Xoa khuyen mai thanh cong'));
        setDeleteDialogOpen(false);
        setSelectedPromotion(null);
        fetchPromotions();
        fetchStats();
      } else {
        toast.error(json.error?.message || t('Failed to delete', 'Khong the xoa'));
      }
    } catch {
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setDeleting(false);
    }
  };

  const handleSaved = () => {
    fetchPromotions();
    fetchStats();
  };

  const resetFilters = () => {
    setSearchQuery('');
    setPromoTypeFilter('all');
    setManufacturerFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  const hasFilters = debouncedSearch || (promoTypeFilter && promoTypeFilter !== 'all') || (manufacturerFilter && manufacturerFilter !== 'all') || (statusFilter && statusFilter !== 'all');

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
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t('Promotions & Schemes', 'Khuyen mai & Chuong trinh')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t(
                  'Manage manufacturer-funded promotions, track redemptions and budgets',
                  'Quan ly chuong trinh khuyen mai tu nha san xuat, theo doi ap dung va ngan sach'
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { fetchPromotions(); fetchStats(); }}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Lam moi')}
              </Button>
              <Button size="sm" onClick={handleCreate} className="bg-red-600 hover:bg-red-700 text-white">
                <Plus className="h-4 w-4 mr-1" />
                {t('Create Promotion', 'Tao khuyen mai')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Active', 'Hoat dong')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.activePromotions || 0}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-yellow-50 text-red-600 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Upcoming', 'Sap dien ra')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.upcomingPromotions || 0}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Total Redemptions', 'Tong ap dung')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.budgetSummary?.totalRedemptions || 0}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Budget Used', 'Ngan sach da dung')}</p>
                    <p className="text-sm font-bold mt-1">{stats?.budgetSummary?.totalUsedBudgetFormatted || formatVND(0)}</p>
                    {stats?.budgetSummary?.totalBudget > 0 && (
                      <p className="text-[10px] text-muted-foreground">{stats.budgetSummary.budgetUtilizationPercent}% {t('utilized', 'da su dung')}</p>
                    )}
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                    <Gift className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Promo Type Distribution */}
          {stats?.typeDistribution && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('Distribution by Type', 'Phan bo theo loai')}</p>
                <div className="flex gap-3 flex-wrap">
                  {Object.entries(stats.typeDistribution).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <PromoTypeBadge type={key} locale={locale} />
                      <span className="text-sm font-medium">{val.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search + Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={t('Search by title, manufacturer...', 'Tim theo ten, nha SX...')}
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={promoTypeFilter} onValueChange={(v) => { setPromoTypeFilter(v); setPage(1); }}>
                    <SelectTrigger className="h-9 w-[140px] text-xs">
                      <SelectValue placeholder={t('All Types', 'Tat loai')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('All Types', 'Tat loai')}</SelectItem>
                      <SelectItem value="BUY_X_GET_Y">{t('Buy X Get Y', 'Mua X Tang Y')}</SelectItem>
                      <SelectItem value="PERCENT_OFF">{t('Percentage Off', 'Giam theo %')}</SelectItem>
                      <SelectItem value="FIXED_DISCOUNT">{t('Fixed Discount', 'Giam co dinh')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={manufacturerFilter} onValueChange={(v) => { setManufacturerFilter(v); setPage(1); }}>
                    <SelectTrigger className="h-9 w-[160px] text-xs">
                      <SelectValue placeholder={t('All Manufacturers', 'Tat ca NSX')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('All Manufacturers', 'Tat ca NSX')}</SelectItem>
                      {manufacturers.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="h-9 w-[130px] text-xs">
                      <SelectValue placeholder={t('All Status', 'Tat ca TT')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('All Status', 'Tat ca TT')}</SelectItem>
                      <SelectItem value="active">{t('Active', 'Hoat dong')}</SelectItem>
                      <SelectItem value="upcoming">{t('Upcoming', 'Sap dien ra')}</SelectItem>
                      <SelectItem value="expired">{t('Expired', 'Het han')}</SelectItem>
                    </SelectContent>
                  </Select>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      {t('Reset', 'Dat lai')}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : promotions.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Gift className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">{t('No promotions found', 'Khong tim thay khuyen mai')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('Create your first manufacturer-funded promotion', 'Tao chuong trinh khuyen mai dau tien')}
                  </p>
                  <Button className="mt-4 bg-red-600 hover:bg-red-700 text-white" onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('Create First Promotion', 'Tao khuyen mai dau tien')}
                  </Button>
                </div>
              ) : (
                <div className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>{t('Promotion', 'Khuyen mai')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Type', 'Loai')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('Manufacturer', 'Nha SX')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('Validity', 'Hieu luc')}</TableHead>
                        <TableHead className="hidden xl:table-cell text-center">{t('Budget', 'NS')}</TableHead>
                        <TableHead className="hidden lg:table-cell text-center">{t('Redeemed', 'Ap dung')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('Status', 'TT')}</TableHead>
                        <TableHead className="text-right">{t('Actions', 'TH')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {promotions.map((promo) => (
                        <TableRow key={promo.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{promo.title}</p>
                              <p className="text-[10px] text-muted-foreground">{promo.productCount} {t('products', 'SP')}</p>
                            </div>
                          </TableCell>

                          <TableCell className="hidden md:table-cell">
                            <PromoTypeBadge
                              type={promo.promoType}
                              buyQty={promo.buyQty}
                              getQty={promo.getQty}
                              discountPercent={promo.discountPercent}
                              discountAmount={promo.discountAmount}
                              locale={locale}
                            />
                          </TableCell>

                          <TableCell className="hidden sm:table-cell">
                            <span className="text-xs flex items-center gap-1">
                              <Factory className="h-3 w-3 text-muted-foreground" />
                              {promo.manufacturer.name}
                            </span>
                          </TableCell>

                          <TableCell className="hidden lg:table-cell">
                            <div className="text-[10px] space-y-0.5">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                {new Date(promo.startsAt).toLocaleDateString('vi-VN')}
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                {new Date(promo.expiresAt).toLocaleDateString('vi-VN')}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="hidden xl:table-cell text-center">
                            {promo.totalBudget ? (
                              <div>
                                <p className="text-xs">{promo.usedBudgetFormatted}</p>
                                <div className="h-1 bg-muted rounded-full w-16 mx-auto mt-1 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${promo.budgetPercent > 80 ? 'bg-red-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(100, promo.budgetPercent)}%` }}
                                  />
                                </div>
                                <p className="text-[10px] text-muted-foreground">{promo.budgetPercent}%</p>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">{t('No limit', 'Khong gioi han')}</span>
                            )}
                          </TableCell>

                          <TableCell className="hidden lg:table-cell text-center">
                            <span className="text-sm font-medium">{promo.totalRedemptions}</span>
                          </TableCell>

                          <TableCell className="hidden sm:table-cell">
                            <PromoStatusBadge status={promo.computedStatus as 'active' | 'upcoming' | 'expired'} isActive={promo.isActive} locale={locale} />
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleView(promo)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleEdit(promo)}>
                                <Edit className="h-3.5 w-3.5 mr-1" />
                                {t('Edit', 'Sua')}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700" onClick={() => handleDelete(promo)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        {t(
                          `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} of ${totalCount} promotions`,
                          `Hien thi ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} / ${totalCount} khuyen mai`
                        )}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {getPageNumbers().map((p) => (
                          <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon"
                            className={`h-8 w-8 text-xs ${p === page ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
                            onClick={() => setPage(p)}>{p}</Button>
                        ))}
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scheme Engine Info */}
          <Card className="border-yellow-100 bg-yellow-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-yellow-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{t('Scheme Engine', 'He thong Khuyen mai')}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(
                      'Automatically applies manufacturer promotions at checkout. Guarantees 100% promo penetration. AI detects eligible promotions and suggests them to shop owners during ordering.',
                      'Tu dong ap dung khuyen mai tu nha san xuat khi thanh toan. Dam bao 100% ty le ap dung. AI phat hien khuyen mai phu hop va goi y cho chu cua hang trong qua trinh dat hang.'
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>

        {/* Form Dialog */}
        <PromotionFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          promotion={selectedPromotion}
          locale={locale}
          onSaved={handleSaved}
          manufacturers={manufacturers}
        />

        {/* Detail Drawer */}
        <PromotionDetailDrawer
          open={detailDrawerOpen}
          onOpenChange={setDetailDrawerOpen}
          promotionId={detailPromotionId}
          locale={locale}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                {t('Delete Promotion', 'Xoa khuyen mai')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  `Are you sure you want to delete "${selectedPromotion?.title || ''}"? This action cannot be undone.`,
                  `Ban co chac chan muon xoa "${selectedPromotion?.title || ''}"? Hanh dong nay khong the hoan tac.`
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {selectedPromotion && selectedPromotion.orderItemCount > 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded p-3">
                {t(
                  `This promotion has been applied to ${selectedPromotion.orderItemCount} order item(s). Only promotions with zero usage can be deleted. Try deactivating instead.`,
                  `Khuyen mai nay da ap dung cho ${selectedPromotion.orderItemCount} san pham trong don. Chi khuyen mai chua su dung moi co the xoa. Hay ngung hoat dong thay vi xoa.`
                )}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{t('Cancel', 'Huy')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={deleting || (selectedPromotion?.orderItemCount ?? 0) > 0}
                className="bg-red-600 hover:bg-red-700 text-white">
                {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {t('Delete', 'Xoa')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </div>
  );
}
