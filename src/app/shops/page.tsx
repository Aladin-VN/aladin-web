'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Store,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Edit,
  MapPin,
  TrendingUp,
  Users,
  AlertTriangle,
  Crown,
  Plus,
  RotateCcw,
  ArrowUpDown,
  Download,
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
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import {
  LoyaltyTierBadge,
  CreditStatusBadge,
  ShopTypeBadge,
} from '@/components/shops/shop-status-badge';
import { ShopDetailDrawer } from '@/components/shops/shop-detail-drawer';
import { ShopEditDialog } from '@/components/shops/shop-edit-dialog';

// ============================================
// Types
// ============================================

interface ShopListItem {
  id: string;
  name: string;
  nameEn: string | null;
  district: string | null;
  province: string;
  address: string | null;
  shopType: string;
  loyaltyTier: string;
  creditStatus: string;
  creditLimit: number;
  creditLimitFormatted: string;
  creditBalance: number;
  creditBalanceFormatted: string;
  creditAvailable: number;
  creditAvailableFormatted: string;
  totalOrders: number;
  totalGmv: number;
  totalGmvFormatted: string;
  avgOrderValue: number;
  avgOrderValueFormatted: string;
  createdAt: string;
  ward: { id: string; name: string } | null;
  user: { id: string; phone: string; name: string; status: string; zaloId: string | null } | null;
}

interface ShopsResponse {
  items: ShopListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ShopStats {
  totalShops: number;
  activeShops: number;
  lockedShops: number;
  overdueShops: number;
  platinumShops: number;
  newThisMonth: number;
  totalGmv: number;
  totalGmvFormatted: string;
  totalCreditExposure: number;
  totalCreditExposureFormatted: string;
  tierDistribution: Record<string, number>;
  creditDistribution: Record<string, number>;
  topDistricts: { district: string; count: number }[];
  shopTypeDistribution: Record<string, number>;
}

// ============================================
// Stat Card Mini
// ============================================

function StatCardMini({
  title,
  titleVi,
  value,
  icon,
  variant = 'default',
  locale,
  isSensitive = false,
}: {
  title: string;
  titleVi: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger' | 'success';
  locale: string;
  isSensitive?: boolean;
}) {
  const label = locale === 'vi' ? titleVi : title;

  return (
    <Card className={
      variant === 'danger' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30' :
      variant === 'warning' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30' :
      variant === 'success' ? 'border-yellow-100 bg-yellow-50/50 dark:border-red-900 dark:bg-emerald-950/30' :
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
            variant === 'success' ? 'bg-yellow-50 text-red-600 dark:bg-red-900/50 dark:text-yellow-500' :
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
// Main Shops Page
// ============================================

export default function ShopsPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data state
  const [shops, setShops] = useState<ShopListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ShopStats | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [creditStatusFilter, setCreditStatusFilter] = useState('all');
  const [loyaltyTierFilter, setLoyaltyTierFilter] = useState('all');
  const [shopTypeFilter, setShopTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalShopsCount, setTotalShopsCount] = useState(0);
  const limit = 20;

  // Dialog / Drawer state
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Refs
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Fetch shops
  const fetchShops = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
        sortBy,
        sortOrder,
      });

      if (creditStatusFilter !== 'all') params.set('creditStatus', creditStatusFilter);
      if (loyaltyTierFilter !== 'all') params.set('loyaltyTier', loyaltyTierFilter);
      if (shopTypeFilter !== 'all') params.set('shopType', shopTypeFilter);

      const res = await adminFetch(`/api/shops?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        const data: ShopsResponse = json.data;
        setShops(data.items || []);
        setTotalPages(data.pagination.totalPages);
        setTotalShopsCount(data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch shops:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, creditStatusFilter, loyaltyTierFilter, shopTypeFilter, sortBy, sortOrder, limit]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await adminFetch('/api/shops/stats');
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch shop stats:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Re-fetch on filter/page change
  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  // Row click handler
  const handleRowClick = (shopId: string) => {
    setSelectedShopId(shopId);
    setDrawerOpen(true);
  };

  // Edit handler
  const handleEdit = (e: React.MouseEvent, shopId: string) => {
    e.stopPropagation();
    setSelectedShopId(shopId);
    setEditDialogOpen(true);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setCreditStatusFilter('all');
    setLoyaltyTierFilter('all');
    setShopTypeFilter('all');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
  };

  // Refresh
  const handleRefresh = () => {
    fetchShops();
    fetchStats();
  };

  // After edit
  const handleDataChanged = () => {
    fetchShops();
    fetchStats();
  };

  // Toggle sort direction
  const handleSortToggle = () => {
    setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'asc'));
  };

  // Page range for pagination
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const hasActiveFilters = debouncedSearch || creditStatusFilter !== 'all' || loyaltyTierFilter !== 'all' || shopTypeFilter !== 'all';

  // Export CSV
  const handleExportCSV = () => {
    if (shops.length === 0) return;
    const headers = locale === 'vi'
      ? ['Ten', 'Chu', 'Dien thoai', 'Quan', 'Tinh', 'Loai', 'Cap TV', 'Trang thai no', 'Han muc', 'Da dung', 'Con lai', 'Tong DH', 'Tong GMV', 'Ngay tao']
      : ['Name', 'Owner', 'Phone', 'District', 'Province', 'Type', 'Tier', 'Credit Status', 'Limit', 'Used', 'Available', 'Orders', 'GMV', 'Created'];

    const rows = shops.map((s) => [
      s.name,
      s.user?.name || '',
      s.user?.phone || '',
      s.district || '',
      s.province,
      s.shopType,
      s.loyaltyTier,
      s.creditStatus,
      s.creditLimit,
      s.creditBalance,
      s.creditAvailable,
      s.totalOrders,
      s.totalGmv,
      s.createdAt,
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aladin-shops-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />

        <main className="flex-1 p-4 md:p-6 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t('Shops Management', 'Quan ly Cua hang')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Manage mom-and-pop shops, track credit, and loyalty tiers', 'Quan ly cua hang tap hoa, theo doi cong no va cap thanh vien')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Lam moi')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={shops.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                {t('Export', 'Xuat')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCardMini
              title="Total Shops"
              titleVi="Tong cua hang"
              value={stats?.totalShops || 0}
              icon={<Store className="h-4 w-4" />}
              variant="default"
              locale={locale}
            />
            <StatCardMini
              title="New This Month"
              titleVi="Moi trong thang"
              value={stats?.newThisMonth || 0}
              icon={<Plus className="h-4 w-4" />}
              variant="success"
              locale={locale}
            />
            <StatCardMini
              title="Overdue"
              titleVi="Qua han"
              value={stats?.overdueShops || 0}
              icon={<AlertTriangle className="h-4 w-4" />}
              variant="danger"
              locale={locale}
            />
            <StatCardMini
              title="Total GMV"
              titleVi="Tong GMV"
              value={stats?.totalGmvFormatted || '0 VND'}
              icon={<TrendingUp className="h-4 w-4" />}
              variant="default"
              locale={locale}
              isSensitive={true}
            />
          </div>

          {/* District Quick Stats */}
          {stats && stats.topDistricts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {stats.topDistricts.slice(0, 6).map((d) => (
                <div
                  key={d.district}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs"
                >
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="font-medium">{d.district || t('Unknown', 'Khong ro')}</span>
                  <span className="text-muted-foreground">({d.count})</span>
                </div>
              ))}
            </div>
          )}

          {/* Filters Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={t('Search by name, phone, district...', 'Tim theo ten, SDT, quan...')}
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Credit Status Filter */}
                <Select value={creditStatusFilter} onValueChange={(val) => { setCreditStatusFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[155px] h-9">
                    <SelectValue placeholder={t('Credit Status', 'TT cong no')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Credit', 'Tat ca')}</SelectItem>
                    <SelectItem value="ACTIVE">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        {t('Active', 'Hoat dong')}
                      </span>
                    </SelectItem>
                    <SelectItem value="LOCKED">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        {t('Locked', 'Bi khoa')}
                      </span>
                    </SelectItem>
                    <SelectItem value="OVERDUE">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        {t('Overdue', 'Qua han')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Loyalty Tier Filter */}
                <Select value={loyaltyTierFilter} onValueChange={(val) => { setLoyaltyTierFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[140px] h-9">
                    <SelectValue placeholder={t('Loyalty Tier', 'Cap TV')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Tiers', 'Tat cap')}</SelectItem>
                    <SelectItem value="BRONZE">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-orange-500" />
                        {t('Bronze', 'Dong')}
                      </span>
                    </SelectItem>
                    <SelectItem value="SILVER">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-gray-400" />
                        {t('Silver', 'Bac')}
                      </span>
                    </SelectItem>
                    <SelectItem value="GOLD">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        {t('Gold', 'Vang')}
                      </span>
                    </SelectItem>
                    <SelectItem value="PLATINUM">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-purple-500" />
                        {t('Platinum', 'Bach Kim')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Shop Type Filter */}
                <Select value={shopTypeFilter} onValueChange={(val) => { setShopTypeFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[145px] h-9">
                    <SelectValue placeholder={t('Shop Type', 'Loai CH')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Types', 'Tat loai')}</SelectItem>
                    <SelectItem value="TAPHOA">{t('Mom-and-pop', 'Tap hoa')}</SelectItem>
                    <SelectItem value="CONVENIENCE">{t('Convenience', 'Tien loi')}</SelectItem>
                    <SelectItem value="FACTORY">{t('Factory', 'Cong nghiep')}</SelectItem>
                  </SelectContent>
                </Select>

                {/* Sort */}
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-[140px] h-9">
                    <SelectValue placeholder={t('Sort by', 'Sap xep')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">{t('Newest', 'Moi nhat')}</SelectItem>
                    <SelectItem value="name">{t('Name', 'Ten')}</SelectItem>
                    <SelectItem value="totalGmv">{t('Total GMV', 'Tong GMV')}</SelectItem>
                    <SelectItem value="totalOrders">{t('Orders', 'Don hang')}</SelectItem>
                    <SelectItem value="creditBalance">{t('Credit Used', 'No da dung')}</SelectItem>
                    <SelectItem value="avgOrderValue">{t('Avg Order', 'TB don hang')}</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  title={sortOrder === 'desc' ? t('Descending', 'Giam dan') : t('Ascending', 'Tang dan')}
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>

                {/* Reset */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    onClick={handleResetFilters}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {t('Reset', 'Dat lai')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shops Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : shops.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Store className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {t('No shops found', 'Khong tim thay cua hang')}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    {hasActiveFilters
                      ? t(
                          'Try adjusting your search or filters to find what you are looking for.',
                          'Thu thay doi tim kiem hoac bo loc de tim cua hang.'
                        )
                      : t(
                          'Shops will appear here once owners register via Zalo bot.',
                          'Cua hang se xuat hien o day khi chu cua hang dang ky qua bot Zalo.'
                        )}
                  </p>
                </div>
              ) : (
                <div className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>{t('Shop', 'Cua hang')}</TableHead>
                        <TableHead>{t('Tier', 'Cap')}</TableHead>
                        <TableHead>{t('Credit', 'Cong no')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Type', 'Loai')}</TableHead>
                        <TableHead className="hidden sm:table-cell text-center">{t('Orders', 'DH')}</TableHead>
                        <TableHead className="hidden lg:table-cell text-right">{t('GMV', 'GMV')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('District', 'Quan')}</TableHead>
                        <TableHead className="hidden xl:table-cell">{t('Joined', 'Ngay TH')}</TableHead>
                        <TableHead className="text-right">{t('Actions', 'TH')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shops.map((shop) => (
                        <TableRow
                          key={shop.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleRowClick(shop.id)}
                        >
                          {/* Shop Name + Phone */}
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium truncate max-w-[180px]">
                                {shop.name}
                              </p>
                              {shop.user?.phone && (
                                <p className="text-[10px] text-muted-foreground">
                                  <SensitiveValue value={shop.user.phone} maskType="phone" />
                                </p>
                              )}
                            </div>
                          </TableCell>

                          {/* Loyalty Tier */}
                          <TableCell>
                            <LoyaltyTierBadge tier={shop.loyaltyTier} locale={locale} />
                          </TableCell>

                          {/* Credit Status + Available */}
                          <TableCell>
                            <div className="space-y-0.5">
                              <CreditStatusBadge status={shop.creditStatus} locale={locale} />
                              <p className="text-[10px] text-muted-foreground">
                                <SensitiveValue value={shop.creditAvailable} maskType="amount" formatOptions={{ formatCurrency: true }} />
                                {' '}{t('left', 'con lai')}
                              </p>
                            </div>
                          </TableCell>

                          {/* Shop Type */}
                          <TableCell className="hidden md:table-cell">
                            <ShopTypeBadge type={shop.shopType} locale={locale} />
                          </TableCell>

                          {/* Orders */}
                          <TableCell className="hidden sm:table-cell text-center">
                            <span className="text-xs text-muted-foreground">
                              {shop.totalOrders}
                            </span>
                          </TableCell>

                          {/* GMV */}
                          <TableCell className="hidden lg:table-cell text-right">
                            <span className="text-xs font-semibold">
                              <SensitiveValue value={shop.totalGmv} maskType="amount" formatOptions={{ formatCurrency: true }} />
                            </span>
                          </TableCell>

                          {/* District */}
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {shop.district || '-'}
                            </span>
                          </TableCell>

                          {/* Created */}
                          <TableCell className="hidden xl:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {new Date(shop.createdAt).toLocaleDateString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={(e) => handleEdit(e, shop.id)}
                            >
                              <Edit className="h-3.5 w-3.5 mr-1" />
                              {t('Edit', 'Sua')}
                            </Button>
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
                          `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalShopsCount)} of ${totalShopsCount} shops`,
                          `Hien thi ${(page - 1) * limit + 1}–${Math.min(page * limit, totalShopsCount)} / ${totalShopsCount} cua hang`
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

          {/* Loyalty Tier Distribution */}
          {stats && stats.tierDistribution && (
            <Card>
              <CardContent className="p-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  {t('Loyalty Tier Distribution', 'Phan bo cap thanh vien')}
                </h4>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { tier: 'BRONZE', color: 'bg-orange-500', icon: '&#9679;' },
                    { tier: 'SILVER', color: 'bg-gray-400', icon: '&#9679;' },
                    { tier: 'GOLD', color: 'bg-yellow-500', icon: '&#9733;' },
                    { tier: 'PLATINUM', color: 'bg-purple-500', icon: '&#9670;' },
                  ].map(({ tier, color }) => {
                    const count = stats.tierDistribution[tier] || 0;
                    const pct = stats.totalShops > 0 ? Math.round((count / stats.totalShops) * 100) : 0;
                    return (
                      <div key={tier} className="text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
                          <LoyaltyTierBadge tier={tier} locale={locale} />
                        </div>
                        <p className="text-lg font-bold">{count}</p>
                        <p className="text-xs text-muted-foreground">{pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </main>

        {/* Shop Detail Drawer */}
        <ShopDetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          shopId={selectedShopId}
          locale={locale}
          onShopUpdated={handleDataChanged}
        />

        {/* Shop Edit Dialog */}
        <ShopEditDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          shopId={selectedShopId}
          locale={locale}
          onUpdated={handleDataChanged}
        />
      </SidebarInset>
    </div>
  );
}
