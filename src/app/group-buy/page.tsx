'use client';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Tag,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit,
  Eye,
  Users,
  Clock,
  BarChart3,
  RotateCcw,
  Loader2,
  TrendingUp,
  CheckCircle,
  XCircle,
  AlertTriangle,
  PiggyBank,
  MapPin,
  Percent,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
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
import { DealStatusBadge } from '@/components/group-buy/deal-status-badge';
import { DealFormDialog } from '@/components/group-buy/deal-form-dialog';
import { DealDetailDrawer } from '@/components/group-buy/deal-detail-drawer';
import { formatVND } from '@/lib/security';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

interface DealListItem {
  id: string;
  title: string;
  titleEn: string | null;
  productId: string;
  targetQty: number;
  currentQty: number;
  originalPrice: number;
  discountPrice: number;
  maxParticipants: number | null;
  startsAt: string;
  expiresAt: string;
  wardId: string | null;
  status: string;
  createdAt: string;
  progressPercent: number;
  savingsPercent: number;
  savingsPerUnit: number;
  savingsPerUnitFormatted: string;
  originalPriceFormatted: string;
  discountPriceFormatted: string;
  timeRemaining: string;
  participantCount: number;
  product: { id: string; name: string; sku: string; basePrice: number };
  ward: { id: string; name: string; district: string } | null;
}

interface DealsResponse {
  items: DealListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: {
    wards: { id: string; name: string }[];
    products: { id: string; name: string; sku: string }[];
  };
}

interface DealStats {
  totalDeals: number;
  activeDeals: number;
  completedDeals: number;
  expiredDeals: number;
  cancelledDeals: number;
  totalSavings: number;
  totalSavingsFormatted: string;
  totalParticipants: number;
  avgCompletionRate: number;
  statusDistribution: Record<string, { count: number; label: string; labelVi: string }>;
}

// ============================================
// Main Group Buy Page
// ============================================

export default function GroupBuyPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data state
  const [deals, setDeals] = useState<DealListItem[]>([]);
  const [stats, setStats] = useState<DealStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [wards, setWards] = useState<{ id: string; name: string }[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [wardFilter, setWardFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<DealListItem | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [detailDealId, setDetailDealId] = useState<string | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusAction, setStatusAction] = useState<'COMPLETED' | 'CANCELLED'>('COMPLETED');
  const [updating, setUpdating] = useState(false);

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

  // Fetch deals
  const fetchDeals = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
      });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (wardFilter && wardFilter !== 'all') params.set('wardId', wardFilter);

      const res = await fetch(`/api/group-deals?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        const data: DealsResponse = json.data;
        setDeals(data.items || []);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
        setWards(data.filters?.wards || []);
      }
    } catch (err) {
      console.error('Failed to fetch group deals:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, wardFilter, limit]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/group-deals/stats');
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch group deal stats:', err);
    }
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Handlers
  const handleCreate = () => {
    setSelectedDeal(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (deal: DealListItem) => {
    setSelectedDeal(deal);
    setFormDialogOpen(true);
  };

  const handleView = (deal: DealListItem) => {
    setDetailDealId(deal.id);
    setDetailDrawerOpen(true);
  };

  const handleStatusChange = (deal: DealListItem, newStatus: 'COMPLETED' | 'CANCELLED') => {
    setSelectedDeal(deal);
    setStatusAction(newStatus);
    setStatusDialogOpen(true);
  };

  const confirmStatusChange = async () => {
    if (!selectedDeal) return;
    try {
      setUpdating(true);
      const res = await fetch(`/api/group-deals/${selectedDeal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusAction }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(
          statusAction === 'COMPLETED'
            ? t('Deal marked as completed', 'Đánh dấu deal hoàn thành')
            : t('Deal cancelled', 'Hủy deal thành công')
        );
        setStatusDialogOpen(false);
        setSelectedDeal(null);
        fetchDeals();
        fetchStats();
      } else {
        toast.error(json.error?.message || t('Failed to update', 'Không thể cập nhật'));
      }
    } catch {
      toast.error(t('Network error', 'Lỗi mạng'));
    } finally {
      setUpdating(false);
    }
  };

  const handleSaved = () => {
    fetchDeals();
    fetchStats();
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setWardFilter('all');
    setPage(1);
  };

  const hasFilters = debouncedSearch || (statusFilter && statusFilter !== 'all') || (wardFilter && wardFilter !== 'all');

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
                {t('Group Buy Engine', 'Deal Mua Chung')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t(
                  'Pinduoduo-style group buying — consolidate orders, unlock volume discounts',
                  'Mô hình Pinduoduo — gom đơn hàng, mở khóa chiết khấu số lượng lớn'
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { fetchDeals(); fetchStats(); }}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Làm mới')}
              </Button>
              <Button size="sm" onClick={handleCreate} className="bg-red-600 hover:bg-red-700 text-white">
                <Plus className="h-4 w-4 mr-1" />
                {t('Create Deal', 'Tạo Deal')}
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
                    <p className="text-xs text-muted-foreground font-medium">{t('Active Deals', 'Deal hoạt động')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.activeDeals || 0}</p>
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
                    <p className="text-xs text-muted-foreground font-medium">{t('Completed Deals', 'Deal hoàn thành')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.completedDeals || 0}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Total Savings', 'Tổng tiết kiệm')}</p>
                    <p className="text-sm font-bold mt-1">{stats?.totalSavingsFormatted || formatVND(0)}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-green-100 text-green-600 flex items-center justify-center">
                    <PiggyBank className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Participants', 'Người tham gia')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.totalParticipants || 0}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Distribution */}
          {stats?.statusDistribution && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">{t('Distribution by Status', 'Phân bố theo trạng thái')}</p>
                <div className="flex gap-3 flex-wrap">
                  {Object.entries(stats.statusDistribution).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <DealStatusBadge status={key as 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED'} locale={locale} />
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
                    placeholder={t('Search deals, products...', 'Tìm deal, sản phẩm...')}
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="h-9 w-[140px] text-xs">
                      <SelectValue placeholder={t('All Status', 'Tất cả TT')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('All Status', 'Tất cả TT')}</SelectItem>
                      <SelectItem value="ACTIVE">{t('Active', 'Hoạt động')}</SelectItem>
                      <SelectItem value="COMPLETED">{t('Completed', 'Hoàn thành')}</SelectItem>
                      <SelectItem value="EXPIRED">{t('Expired', 'Hết hạn')}</SelectItem>
                      <SelectItem value="CANCELLED">{t('Cancelled', 'Đã hủy')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={wardFilter} onValueChange={(v) => { setWardFilter(v); setPage(1); }}>
                    <SelectTrigger className="h-9 w-[160px] text-xs">
                      <SelectValue placeholder={t('All Wards', 'Tất cả phường')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('All Wards', 'Tất cả phường')}</SelectItem>
                      {wards.map((w) => (
                        <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasFilters && (
                    <Button variant="ghost" size="sm" className="h-9" onClick={resetFilters}>
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      {t('Reset', 'Đặt lại')}
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
              ) : deals.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Tag className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">{t('No group deals found', 'Không tìm thấy deal mua chung')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t(
                      'Create your first group buy deal to unlock volume discounts',
                      'Tạo deal mua chung đầu tiên để mở khóa chiết khấu số lượng'
                    )}
                  </p>
                  <Button className="mt-4 bg-red-600 hover:bg-red-700 text-white" onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('Create First Deal', 'Tạo Deal đầu tiên')}
                  </Button>
                </div>
              ) : (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>{t('Deal', 'Deal')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Progress', 'Tiến độ')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('Savings', 'Tiết kiệm')}</TableHead>
                        <TableHead className="hidden sm:table-cell text-center">{t('Participants', 'Tham gia')}</TableHead>
                        <TableHead className="hidden xl:table-cell">{t('Ward', 'Phường')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('Status', 'TT')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Expiry', 'Hết hạn')}</TableHead>
                        <TableHead className="text-right">{t('Actions', 'TH')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deals.map((deal) => (
                        <TableRow
                          key={deal.id}
                          className="hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleView(deal)}
                        >
                          {/* Deal */}
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium truncate max-w-[200px]">{deal.title}</p>
                              <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                {deal.product.name} · {deal.product.sku}
                              </p>
                            </div>
                          </TableCell>

                          {/* Progress */}
                          <TableCell className="hidden md:table-cell">
                            <div className="min-w-[120px]">
                              <div className="flex items-center justify-between text-[10px] mb-0.5">
                                <span>{deal.currentQty.toLocaleString()}/{deal.targetQty.toLocaleString()}</span>
                                <span className="font-medium">{deal.progressPercent}%</span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    deal.progressPercent >= 100
                                      ? 'bg-red-500'
                                      : deal.progressPercent >= 50
                                        ? 'bg-blue-500'
                                        : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(100, deal.progressPercent)}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>

                          {/* Savings */}
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-1">
                              <Percent className="h-3 w-3 text-red-600" />
                              <span className="text-sm font-medium text-red-600">-{deal.savingsPercent}%</span>
                              <span className="text-[10px] text-muted-foreground">
                                ({deal.savingsPerUnitFormatted}/{t('unit', 'sp')})
                              </span>
                            </div>
                          </TableCell>

                          {/* Participants */}
                          <TableCell className="hidden sm:table-cell text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Users className="h-3.5 w-3.5 text-purple-600" />
                              <span className="text-sm font-medium">{deal.participantCount}</span>
                              {deal.maxParticipants && (
                                <span className="text-[10px] text-muted-foreground">/{deal.maxParticipants}</span>
                              )}
                            </div>
                          </TableCell>

                          {/* Ward */}
                          <TableCell className="hidden xl:table-cell">
                            {deal.ward ? (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs">{deal.ward.name}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">{t('All wards', 'Toàn thành')}</span>
                            )}
                          </TableCell>

                          {/* Status */}
                          <TableCell className="hidden sm:table-cell">
                            <DealStatusBadge
                              status={deal.status as 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'}
                              locale={locale}
                            />
                          </TableCell>

                          {/* Expiry */}
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className={`text-xs ${deal.timeRemaining === 'Đã hết hạn' ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                {deal.timeRemaining === 'Đã hết hạn' ? t('Expired', 'Đã hết hạn') : deal.timeRemaining}
                              </span>
                            </div>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleView(deal)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleEdit(deal)}>
                                <Edit className="h-3.5 w-3.5 mr-1" />
                                {t('Edit', 'Sửa')}
                              </Button>
                              {deal.status === 'ACTIVE' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs text-blue-600 hover:text-blue-700"
                                    onClick={() => handleStatusChange(deal, 'COMPLETED')}
                                  >
                                    <CheckCircle className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs text-red-600 hover:text-red-700"
                                    onClick={() => handleStatusChange(deal, 'CANCELLED')}
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
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
                          `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} of ${totalCount} deals`,
                          `Hiển thị ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} / ${totalCount} deal`
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

          {/* Info Banner */}
          <Card className="border-yellow-100 bg-yellow-50/50 dark:bg-emerald-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-yellow-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{t('Pinduoduo Model', 'Mô hình Pinduoduo')}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(
                      'Group buying consolidates demand from multiple shops to negotiate better wholesale prices with distributors. Deals auto-expire if target quantity is not met. Shops in the same ward get priority for zone-scoped deals.',
                      'Mua chung gom nhu cầu từ nhiều cửa hàng để đàm phán giá sỉ tốt hơn với nhà phân phối. Deal tự hết hạn nếu không đạt số lượng mục tiêu. Các cửa hàng cùng phường được ưu tiên cho deal theo khu vực.'
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>

        {/* Form Dialog */}
        <DealFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          deal={selectedDeal}
          locale={locale}
          onSaved={handleSaved}
          wards={wards}
        />

        {/* Detail Drawer */}
        <DealDetailDrawer
          open={detailDrawerOpen}
          onOpenChange={setDetailDrawerOpen}
          dealId={detailDealId}
          locale={locale}
        />

        {/* Status Change Confirmation */}
        <AlertDialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className={`flex items-center gap-2 ${statusAction === 'COMPLETED' ? 'text-blue-600' : 'text-red-600'}`}>
                {statusAction === 'COMPLETED' ? (
                  <><CheckCircle className="h-5 w-5" />{t('Complete Deal', 'Hoàn thành Deal')}</>
                ) : (
                  <><XCircle className="h-5 w-5" />{t('Cancel Deal', 'Hủy Deal')}</>
                )}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {statusAction === 'COMPLETED' ? (
                  t(
                    `Mark "${selectedDeal?.title || ''}" as completed? This will set the group buy price on the product.`,
                    `Đánh dấu "${selectedDeal?.title || ''}" hoàn thành? Giá mua chung sẽ được áp dụng cho sản phẩm.`
                  )
                ) : (
                  t(
                    `Cancel "${selectedDeal?.title || ''}"? This action cannot be undone.`,
                    `Hủy "${selectedDeal?.title || ''}"? Hành động này không thể hoàn tác.`
                  )
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {selectedDeal && selectedDeal.participantCount > 0 && (
              <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded p-3">
                {t(
                  `This deal has ${selectedDeal.participantCount} participant(s). They will be notified.`,
                  `Deal này có ${selectedDeal.participantCount} cửa hàng tham gia. Họ sẽ được thông báo.`
                )}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={updating}>{t('Cancel', 'Hủy')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmStatusChange}
                disabled={updating}
                className={statusAction === 'COMPLETED'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
                }
              >
                {updating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {statusAction === 'COMPLETED' ? t('Complete', 'Hoàn thành') : t('Cancel Deal', 'Hủy Deal')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </div>
  );
}
