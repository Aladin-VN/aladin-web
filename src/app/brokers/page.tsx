'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  RotateCcw,
  Eye,
  Edit,
  MapPin,
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
import { BrokerTierBadge, UserStatusBadge } from '@/components/brokers/broker-tier-badge';
import { BrokerDetailDrawer } from '@/components/brokers/broker-detail-drawer';
import { BrokerFormDialog } from '@/components/brokers/broker-form-dialog';
import { formatVND } from '@/lib/security';

// ============================================
// Types
// ============================================

interface BrokerListItem {
  id: string;
  userId: string;
  tier: string;
  wardId: string | null;
  commissionRate: number;
  totalShopsReferred: number;
  totalCommissionEarned: number;
  totalGmvGenerated: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    phone: string;
    name: string;
    nameEn: string | null;
    email: string | null;
    status: string;
    avatarUrl: string | null;
    createdAt: string;
  };
  ward: {
    id: string;
    name: string;
    nameEn: string | null;
    district: string;
    province: string;
  } | null;
}

interface BrokersResponse {
  items: BrokerListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: {
    wards: { id: string; name: string; district: string }[];
    tiers: { tier: string; count: number }[];
  };
}

interface BrokerStats {
  totalBrokers: number;
  activeBrokers: number;
  newBrokersThisMonth: number;
  totalCommissionEarned: number;
  totalCommissionEarnedFormatted: string;
  totalGmvGenerated: number;
  totalGmvGeneratedFormatted: string;
  avgCommissionPerBroker: number;
  avgGmvPerBroker: number;
  tierDistribution: Record<string, number>;
  topPerformers: {
    id: string;
    name: string;
    phone: string;
    tier: string;
    gmvGenerated: number;
    gmvGeneratedFormatted: string;
    commissionEarned: number;
    commissionEarnedFormatted: string;
    shopsReferred: number;
  }[];
  territoryCoverage: {
    totalWards: number;
    coveredWards: number;
    uncoveredWards: number;
    coveragePercent: number;
  };
  monthlyTrends: {
    month: string;
    brokers: number;
    gmv: number;
    gmvFormatted: string;
    commission: number;
    commissionFormatted: string;
  }[];
}

// ============================================
// Main Brokers Page (Enhanced)
// ============================================

export default function BrokersPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data state
  const [brokers, setBrokers] = useState<BrokerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BrokerStats | null>(null);
  const [wards, setWards] = useState<{ id: string; name: string; district: string }[]>([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [wardFilter, setWardFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Dialog / Drawer state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<BrokerListItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // Fetch brokers
  const fetchBrokers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
      });
      if (tierFilter !== 'all') params.set('tier', tierFilter);
      if (wardFilter !== 'all') params.set('wardId', wardFilter);

      const json = await adminFetch(`/api/brokers?${params.toString()}`);
      if (json.success) {
        const data: BrokersResponse = json.data;
        setBrokers(data.items || []);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
        if (data.filters?.wards) setWards(data.filters.wards);
      }
    } catch (err) {
      console.error('Failed to fetch brokers:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, tierFilter, wardFilter, limit]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const json = await adminFetch('/api/brokers/stats?period=month');
      if (json.success) setStats(json.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchBrokers(); }, [fetchBrokers]);

  const handleRowClick = (broker: BrokerListItem) => {
    setSelectedBroker(broker);
    setDrawerOpen(true);
  };

  const handleEdit = (broker: BrokerListItem) => {
    setSelectedBroker(broker);
    setEditDialogOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setTierFilter('all');
    setWardFilter('all');
    setPage(1);
  };

  const handleDataChanged = () => {
    fetchBrokers();
    fetchStats();
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

  const hasActiveFilters = debouncedSearch || tierFilter !== 'all' || wardFilter !== 'all';

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
                {t('Broker Network', 'Mạng Đại lý')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Manage brokers, track performance, and territory coverage', 'Quản lý đại lý, theo dõi hiệu suất và phạm vi khu vực')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDataChanged}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Làm mới')}
              </Button>
              <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="bg-red-600 hover:bg-red-700 text-white">
                <Plus className="h-4 w-4 mr-1" />
                {t('Add Broker', 'Thêm đại lý')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Total Brokers', 'Tổng đại lý')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.totalBrokers || 0}</p>
                    {stats?.newBrokersThisMonth ? (
                      <p className="text-[10px] text-red-600">+{stats.newBrokersThisMonth} {t('this month', 'tháng này')}</p>
                    ) : null}
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-yellow-100 bg-yellow-50/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Active', 'Hoạt động')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.activeBrokers || 0}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-yellow-50 flex items-center justify-center">
                    <Users className="h-4 w-4 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Total GMV', 'Tổng GMV')}</p>
                    <p className="text-lg font-bold mt-1 text-blue-700">
                      <SensitiveValue value={stats?.totalGmvGenerated || 0} maskType="amount" formatOptions={{ formatCurrency: true, compact: true }} />
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Commission', 'Hoa hồng')}</p>
                    <p className="text-lg font-bold mt-1 text-red-700">
                      <SensitiveValue value={stats?.totalCommissionEarned || 0} maskType="amount" formatOptions={{ formatCurrency: true, compact: true }} />
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-yellow-50 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={stats?.territoryCoverage?.coveragePercent && stats.territoryCoverage.coveragePercent >= 80 ? 'border-yellow-100 bg-yellow-50/50' : stats?.territoryCoverage?.coveragePercent && stats.territoryCoverage.coveragePercent >= 50 ? 'border-amber-200 bg-amber-50/50' : 'border-red-200 bg-red-50/50'}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Coverage', 'Phủ sóng')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.territoryCoverage?.coveragePercent || 0}%</p>
                    <p className="text-[10px] text-muted-foreground">{stats?.territoryCoverage?.coveredWards || 0}/{stats?.territoryCoverage?.totalWards || 0} {t('wards', 'phường')}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Avg GMV/Broker', 'TB GMV/ĐL')}</p>
                    <p className="text-lg font-bold mt-1">
                      <SensitiveValue value={stats?.avgGmvPerBroker || 0} maskType="amount" formatOptions={{ formatCurrency: true, compact: true }} />
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers */}
          {stats?.topPerformers && stats.topPerformers.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {t('Top Performers (This Month)', 'Đại lý Xuất sắc (Tháng này)')}
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {stats.topPerformers.slice(0, 5).map((p, i) => (
                    <div key={p.id} className="flex-shrink-0 rounded-lg border p-3 min-w-[160px]">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'
                        }`}>
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate max-w-[100px]">{p.name}</p>
                          <BrokerTierBadge tier={p.tier} locale={locale} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">{t('GMV', 'GMV')}</span>
                          <span className="font-medium">{p.gmvGeneratedFormatted}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">{t('Commission', 'Hoa hồng')}</span>
                          <span className="font-medium text-red-600">{p.commissionEarnedFormatted}</span>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-muted-foreground">{t('Shops', 'Cửa hàng')}</span>
                          <span className="font-medium">{p.shopsReferred}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={t('Search by name, phone, ward...', 'Tìm theo tên, SĐT, phường...')}
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <Select value={tierFilter} onValueChange={(val) => { setTierFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[170px] h-9">
                    <SelectValue placeholder={t('All Tiers', 'Tất cả cấp')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Tiers', 'Tất cả cấp')}</SelectItem>
                    <SelectItem value="WARD_LEVEL">{t('Ward Level', 'Cấp Phường')}</SelectItem>
                    <SelectItem value="CATEGORY_SPECIALIST">{t('Category Specialist', 'Chuyên gia DM')}</SelectItem>
                    <SelectItem value="FACTORY_GATE">{t('Factory Gate', 'Cổng Nhập')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={wardFilter} onValueChange={(val) => { setWardFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[170px] h-9">
                    <SelectValue placeholder={t('All Wards', 'Tất cả phường')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Wards', 'Tất cả phường')}</SelectItem>
                    {wards.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.district})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-9" onClick={handleResetFilters}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {t('Reset', 'Đặt lại')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Brokers Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : brokers.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">{t('No brokers found', 'Không tìm thấy đại lý')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasActiveFilters
                      ? t('Try adjusting your search or filters.', 'Thử thay đổi tìm kiếm hoặc bộ lọc.')
                      : t('Add your first broker to get started.', 'Thêm đại lý đầu tiên để bắt đầu.')}
                  </p>
                  {!hasActiveFilters && (
                    <Button className="mt-4 bg-red-600 hover:bg-red-700 text-white" onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />{t('Add First Broker', 'Thêm đại lý đầu tiên')}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>{t('Broker', 'Đại lý')}</TableHead>
                        <TableHead>{t('Tier', 'Cấp')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('Territory', 'Khu vực')}</TableHead>
                        <TableHead>{t('Commission', 'Hoa hồng')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Shops', 'Cửa hàng')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('GMV', 'GMV')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('Earned', 'Đã kiếm')}</TableHead>
                        <TableHead className="text-right">{t('Actions', 'TH')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brokers.map((b) => (
                        <TableRow key={b.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(b)}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-blue-700">{b.user.name.charAt(0)}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate max-w-[150px]">{b.user.name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  <SensitiveValue value={b.user.phone} maskType="phone" />
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <BrokerTierBadge tier={b.tier} locale={locale} />
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {b.ward ? (
                              <span className="text-xs text-muted-foreground">{b.ward.name}, {b.ward.district}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">{t('None', 'Chưa phân')}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-semibold">{(b.commissionRate * 100).toFixed(1)}%</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-xs">{b.totalShopsReferred}</span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className="text-xs font-medium">
                              <SensitiveValue value={b.totalGmvGenerated} maskType="amount" formatOptions={{ formatCurrency: true, compact: true }} />
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-xs font-medium text-red-600">
                              <SensitiveValue value={b.totalCommissionEarned} maskType="amount" formatOptions={{ formatCurrency: true, compact: true }} />
                            </span>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleRowClick(b)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleEdit(b)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t">
                      <p className="text-xs text-muted-foreground">
                        {t(`Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} of ${totalCount}`, `Hiển thị ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} / ${totalCount}`)}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {getPageNumbers().map(p => (
                          <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon" className={`h-8 w-8 text-xs ${p === page ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`} onClick={() => setPage(p)}>
                            {p}
                          </Button>
                        ))}
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
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

        <BrokerDetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          brokerId={selectedBroker?.id || null}
          locale={locale}
          onBrokerUpdated={handleDataChanged}
          onEdit={(broker) => {
            setSelectedBroker(broker);
            setEditDialogOpen(true);
          }}
        />

        <BrokerFormDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          locale={locale}
          wards={wards}
          onSaved={handleDataChanged}
        />

        <BrokerFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          broker={selectedBroker ? {
            id: selectedBroker.id,
            userId: selectedBroker.userId,
            tier: selectedBroker.tier,
            wardId: selectedBroker.wardId,
            commissionRate: selectedBroker.commissionRate,
            user: { id: selectedBroker.user.id, phone: selectedBroker.user.phone, name: selectedBroker.user.name },
          } : null}
          locale={locale}
          wards={wards}
          onSaved={handleDataChanged}
        />
      </SidebarInset>
    </div>
  );
}
