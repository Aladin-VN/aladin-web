'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  UserCircle,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit,
  Users,
  RotateCcw,
  DollarSign,
  TrendingUp,
  CheckCircle,
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
import { BrokerFormDialog } from '@/components/brokers/broker-form-dialog';
import { BrokerDetailDrawer } from '@/components/brokers/broker-detail-drawer';

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
  user: {
    id: string;
    phone: string;
    name: string;
    nameEn: string | null;
    email: string | null;
    status: string;
  } | null;
  ward: {
    id: string;
    name: string;
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
  totalCommissionEarned: number;
  totalCommissionEarnedFormatted: string;
  totalGmvGenerated: number;
  totalGmvGeneratedFormatted: string;
  tierDistribution: Record<string, number>;
}

interface BrokerDetailData {
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
    zaloId: string | null;
    createdAt: string;
    lastLoginAt: string | null;
    shop: { id: string; name: string; district: string | null; province: string } | null;
  };
  ward: {
    id: string;
    name: string;
    nameEn: string | null;
    district: string;
    province: string;
    shopCount: number;
  } | null;
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
// Main Brokers Page
// ============================================

export default function BrokersPage() {
  const [locale, setLocale] = useState('vi');
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data state
  const [brokers, setBrokers] = useState<BrokerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BrokerStats | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Filter options from API
  const [wardOptions, setWardOptions] = useState<{ id: string; name: string; district: string }[]>([]);

  // Dialog / Drawer state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<BrokerListItem | BrokerDetailData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerBrokerId, setDrawerBrokerId] = useState<string | null>(null);

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
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/brokers?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        const data: BrokersResponse = json.data;
        setBrokers(data.items || []);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
        if (data.filters?.wards) {
          setWardOptions(data.filters.wards);
        }
      }
    } catch (err) {
      console.error('Failed to fetch brokers:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, tierFilter, statusFilter, limit]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/brokers/stats');
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch broker stats:', err);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchBrokers(); }, [fetchBrokers]);

  // Handlers
  const handleCreate = () => {
    setSelectedBroker(null);
    setFormDialogOpen(true);
  };

  const handleEditFromTable = (e: React.MouseEvent, broker: BrokerListItem) => {
    e.stopPropagation();
    setSelectedBroker(broker);
    setFormDialogOpen(true);
  };

  const handleEditFromDrawer = (broker: BrokerDetailData) => {
    setSelectedBroker(broker);
    setFormDialogOpen(true);
  };

  const handleRowClick = (brokerId: string) => {
    setDrawerBrokerId(brokerId);
    setDrawerOpen(true);
  };

  const handleDataChanged = () => {
    fetchBrokers();
    fetchStats();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setTierFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  const hasActiveFilters = debouncedSearch || tierFilter !== 'all' || statusFilter !== 'all';

  // Pagination
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
      <AdminSidebar locale={locale} userName="Quyet Dinh" userRole="ADMIN" />
      <SidebarInset>
        <AdminHeader locale={locale} onLocaleChange={setLocale} />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t('Broker Network', 'Mang Dai ly')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t(
                  'Manage broker network, territories, commissions, and performance',
                  'Quan ly mang dai ly, khu vuc, hoa hong va hieu suat'
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { fetchBrokers(); fetchStats(); }}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Lam moi')}
              </Button>
              <Button size="sm" onClick={handleCreate} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="h-4 w-4 mr-1" />
                {t('Add Broker', 'Them dai ly')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCardMini
              title="Total Brokers"
              titleVi="Tong dai ly"
              value={stats?.totalBrokers || 0}
              icon={<UserCircle className="h-4 w-4" />}
              variant="default"
              locale={locale}
            />
            <StatCardMini
              title="Active Brokers"
              titleVi="Dai ly HD"
              value={stats?.activeBrokers || 0}
              icon={<CheckCircle className="h-4 w-4" />}
              variant="success"
              locale={locale}
            />
            <StatCardMini
              title="Total Commission"
              titleVi="Tong hoa hong"
              value={stats?.totalCommissionEarnedFormatted || '0 VND'}
              icon={<DollarSign className="h-4 w-4" />}
              variant="default"
              locale={locale}
              isSensitive={true}
            />
            <StatCardMini
              title="Total GMV"
              titleVi="Tong GMV"
              value={stats?.totalGmvGeneratedFormatted || '0 VND'}
              icon={<TrendingUp className="h-4 w-4" />}
              variant="default"
              locale={locale}
              isSensitive={true}
            />
          </div>

          {/* Tier Distribution */}
          {stats && stats.tierDistribution && Object.keys(stats.tierDistribution).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {[
                { tier: 'WARD_LEVEL', color: 'bg-blue-500' },
                { tier: 'CATEGORY_SPECIALIST', color: 'bg-purple-500' },
                { tier: 'FACTORY_GATE', color: 'bg-orange-500' },
              ].map(({ tier, color }) => {
                const count = stats.tierDistribution[tier] || 0;
                if (count === 0) return null;
                return (
                  <div key={tier} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs">
                    <span className={`h-2 w-2 rounded-full ${color}`} />
                    <BrokerTierBadge tier={tier} locale={locale} />
                    <span className="text-muted-foreground">({count})</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={t('Search by name, phone, ward...', 'Tim theo ten, SDT, phuong...')}
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Tier Filter */}
                <Select value={tierFilter} onValueChange={(val) => { setTierFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[170px] h-9">
                    <SelectValue placeholder={t('Broker Tier', 'Cap dai ly')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Tiers', 'Tat cap')}</SelectItem>
                    <SelectItem value="WARD_LEVEL">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        {t('Ward Level', 'Cap Phuong')}
                      </span>
                    </SelectItem>
                    <SelectItem value="CATEGORY_SPECIALIST">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-purple-500" />
                        {t('Category Specialist', 'Chuyen gia DM')}
                      </span>
                    </SelectItem>
                    <SelectItem value="FACTORY_GATE">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-orange-500" />
                        {t('Factory Gate', 'Cong Nhap')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[145px] h-9">
                    <SelectValue placeholder={t('Status', 'Trang thai')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Status', 'Tat ca')}</SelectItem>
                    <SelectItem value="ACTIVE">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {t('Active', 'Hoat dong')}
                      </span>
                    </SelectItem>
                    <SelectItem value="INACTIVE">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-gray-400" />
                        {t('Inactive', 'Ngung')}
                      </span>
                    </SelectItem>
                    <SelectItem value="LOCKED">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        {t('Locked', 'Bi khoa')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Reset */}
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-9" onClick={handleResetFilters}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {t('Reset', 'Dat lai')}
                  </Button>
                )}
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
              ) : brokers.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <UserCircle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">{t('No brokers found', 'Khong tim thay dai ly')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasActiveFilters
                      ? t('Try adjusting your search or filters.', 'Thu thay doi tim kiem hoac bo loc.')
                      : t('Add your first broker to get started.', 'Them dai ly dau tien de bat dau.')}
                  </p>
                  {!hasActiveFilters && (
                    <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreate}>
                      <Plus className="h-4 w-4 mr-2" />
                      {t('Add First Broker', 'Them dai ly dau tien')}
                    </Button>
                  )}
                </div>
              ) : (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>{t('Broker', 'Dai ly')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('Tier', 'Cap')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Ward', 'Phuong')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('Commission', 'Hoa hong')}</TableHead>
                        <TableHead className="hidden lg:table-cell text-center">{t('Shops', 'CH')}</TableHead>
                        <TableHead className="hidden lg:table-cell text-right">{t('GMV', 'GMV')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Status', 'TT')}</TableHead>
                        <TableHead className="text-right">{t('Actions', 'TH')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brokers.map((b) => (
                        <TableRow
                          key={b.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleRowClick(b.id)}
                        >
                          {/* Broker name + phone */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                                <UserCircle className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium truncate max-w-[160px]">
                                  {b.user?.name || '-'}
                                </p>
                                {b.user?.phone && (
                                  <p className="text-[10px] text-muted-foreground">
                                    <SensitiveValue value={b.user.phone} maskType="phone" />
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Tier */}
                          <TableCell className="hidden sm:table-cell">
                            <BrokerTierBadge tier={b.tier} locale={locale} />
                          </TableCell>

                          {/* Ward */}
                          <TableCell className="hidden md:table-cell">
                            {b.ward ? (
                              <span className="text-xs text-muted-foreground">
                                {b.ward.name}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>

                          {/* Commission Rate */}
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-xs font-medium">
                              {(b.commissionRate * 100).toFixed(1)}%
                            </span>
                          </TableCell>

                          {/* Shops Referred */}
                          <TableCell className="hidden lg:table-cell text-center">
                            <span className="text-xs text-muted-foreground">
                              {b.totalShopsReferred}
                            </span>
                          </TableCell>

                          {/* GMV */}
                          <TableCell className="hidden lg:table-cell text-right">
                            <span className="text-xs font-semibold">
                              <SensitiveValue value={b.totalGmvGenerated} maskType="amount" formatOptions={{ formatCurrency: true }} />
                            </span>
                          </TableCell>

                          {/* Status */}
                          <TableCell className="hidden md:table-cell">
                            <UserStatusBadge status={b.user?.status || 'ACTIVE'} locale={locale} />
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={(e) => handleEditFromTable(e, b)}
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
                          `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} of ${totalCount} brokers`,
                          `Hien thi ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} / ${totalCount} dai ly`
                        )}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {getPageNumbers().map((p) => (
                          <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon"
                            className={`h-8 w-8 text-xs ${p === page ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
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
        </main>

        {/* Form Dialog */}
        <BrokerFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          broker={selectedBroker ? {
            id: selectedBroker.id,
            userId: selectedBroker.userId,
            tier: selectedBroker.tier,
            wardId: selectedBroker.wardId,
            commissionRate: selectedBroker.commissionRate,
            user: {
              id: selectedBroker.user?.id || selectedBroker.userId,
              phone: selectedBroker.user?.phone || '',
              name: selectedBroker.user?.name || '',
            },
          } : null}
          locale={locale}
          wards={wardOptions}
          onSaved={handleDataChanged}
        />

        {/* Detail Drawer */}
        <BrokerDetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          brokerId={drawerBrokerId}
          locale={locale}
          onBrokerUpdated={handleDataChanged}
          onEdit={handleEditFromDrawer}
        />
      </SidebarInset>
    </div>
  );
}
