'use client';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Truck,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Package,
  Clock,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Users,
  TrendingUp,
  CalendarDays,
  RotateCcw,
  XCircle,
  Navigation,
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
import { ShipmentStatusBadge, ShipmentTypeBadge } from '@/components/shipments/shipment-status-badge';
import { ShipmentDetailDrawer } from '@/components/shipments/shipment-detail-drawer';
import { ShipmentCreateDialog } from '@/components/shipments/shipment-create-dialog';

// ============================================
// Types
// ============================================

interface ShipmentListItem {
  id: string;
  orderId: string;
  orderNumber: string;
  orderTotal: number;
  orderTotalFormatted: string;
  shopName: string;
  shopProvince: string;
  type: string;
  status: string;
  driverName: string | null;
  driverPhone: string | null;
  driverId: string | null;
  dropoffAddress: string;
  pickupAddress: string | null;
  deliveredAt: string | null;
  thirdPartyTrackingId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ShipmentsResponse {
  items: ShipmentListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ShipmentStats {
  totalShipments: number;
  pendingShipments: number;
  inTransitShipments: number;
  deliveredToday: number;
  failedShipments: number;
  activeDrivers: number;
  unassignedShipments: number;
  avgDeliveryHours: number;
  deliveryRate: number;
  failureRate: number;
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
  subtitle,
  subtitleVi,
}: {
  title: string;
  titleVi: string;
  value: string | number;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger' | 'success' | 'info';
  locale: string;
  subtitle?: string;
  subtitleVi?: string;
}) {
  const label = locale === 'vi' ? titleVi : title;
  const sub = locale === 'vi' ? subtitleVi : subtitle;

  return (
    <Card className={
      variant === 'danger' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30' :
      variant === 'warning' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30' :
      variant === 'success' ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30' :
      variant === 'info' ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30' :
      ''
    }>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-xl font-bold mt-1">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {sub && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
            )}
          </div>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
            variant === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400' :
            variant === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400' :
            variant === 'success' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400' :
            variant === 'info' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' :
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
// Main Shipments Page
// ============================================

export default function ShipmentsPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data state
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ShipmentStats | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Dialog / Drawer state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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

  // Fetch shipments
  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
      });

      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/shipments?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        const data: ShipmentsResponse = json.data;
        setShipments(data.items || []);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch shipments:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, typeFilter, dateFrom, dateTo, limit]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/shipments/stats');
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Re-fetch on filter/page change
  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  // Row click handler
  const handleRowClick = (shipmentId: string) => {
    setSelectedShipmentId(shipmentId);
    setDrawerOpen(true);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  // Refresh
  const handleRefresh = () => {
    fetchShipments();
    fetchStats();
  };

  // After create / status change
  const handleDataChanged = () => {
    fetchShipments();
    fetchStats();
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

  const hasActiveFilters = debouncedSearch || statusFilter !== 'all' || typeFilter !== 'all' || dateFrom || dateTo;

  // Get driver initial for avatar
  const getDriverInitial = (name: string | null) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  return (
    <div className="flex min-h-screen">
      <AdminSidebar locale={locale} userName="Quyet Dinh" userRole="ADMIN" />
      <SidebarInset>
        <AdminHeader />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t('Shipments & Delivery', 'Vận chuyển & Giao hàng')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Track shipments, assign drivers, and manage delivery logistics', 'Theo dõi chuyến giao, phân công tài xế, quản lý vận chuyển')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Làm mới')}
              </Button>
              <Button
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('New Shipment', 'Tạo chuyến giao')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCardMini
              title="Total"
              titleVi="Tổng chuyến"
              value={stats?.totalShipments || 0}
              icon={<Truck className="h-4 w-4" />}
              variant="default"
              locale={locale}
            />
            <StatCardMini
              title="Pending"
              titleVi="Chờ lấy hàng"
              value={stats?.pendingShipments || 0}
              icon={<Clock className="h-4 w-4" />}
              variant="warning"
              locale={locale}
              subtitle={stats?.unassignedShipments ? `${stats.unassignedShipments} unassigned` : undefined}
              subtitleVi={stats?.unassignedShipments ? `${stats.unassignedShipments} chưa phân công` : undefined}
            />
            <StatCardMini
              title="In Transit"
              titleVi="Đang vận chuyển"
              value={stats?.inTransitShipments || 0}
              icon={<Navigation className="h-4 w-4" />}
              variant="info"
              locale={locale}
              subtitle={`${stats?.activeDrivers || 0} drivers`}
              subtitleVi={`${stats?.activeDrivers || 0} tài xế`}
            />
            <StatCardMini
              title="Delivered Today"
              titleVi="Giao hôm nay"
              value={stats?.deliveredToday || 0}
              icon={<CheckCircle2 className="h-4 w-4" />}
              variant="success"
              locale={locale}
            />
            <StatCardMini
              title="Failed"
              titleVi="Thất bại"
              value={stats?.failedShipments || 0}
              icon={<XCircle className="h-4 w-4" />}
              variant="danger"
              locale={locale}
              subtitle={stats?.failureRate ? `${stats.failureRate}% rate` : undefined}
              subtitleVi={stats?.failureRate ? `Tỷ lệ ${stats.failureRate}%` : undefined}
            />
            <StatCardMini
              title="Success Rate"
              titleVi="Tỷ lệ thành công"
              value={`${stats?.deliveryRate || 0}%`}
              icon={<TrendingUp className="h-4 w-4" />}
              variant={stats?.deliveryRate && stats.deliveryRate >= 80 ? 'success' : stats?.deliveryRate && stats.deliveryRate >= 50 ? 'warning' : 'danger'}
              locale={locale}
              subtitle={stats?.avgDeliveryHours ? `Avg ${stats.avgDeliveryHours}h` : undefined}
              subtitleVi={stats?.avgDeliveryHours ? `TB ${stats.avgDeliveryHours}h` : undefined}
            />
          </div>

          {/* Filters Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={t('Search by order #, shop, address...', 'Tìm theo mã đơn, cửa hàng, địa chỉ...')}
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[170px] h-9">
                    <SelectValue placeholder={t('All Status', 'Tất cả trạng thái')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Status', 'Tất cả trạng thái')}</SelectItem>
                    <SelectItem value="PENDING">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-yellow-500" />
                        {t('Pending', 'Chờ lấy hàng')}
                      </span>
                    </SelectItem>
                    <SelectItem value="PICKED_UP">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        {t('Picked Up', 'Đã lấy hàng')}
                      </span>
                    </SelectItem>
                    <SelectItem value="IN_TRANSIT">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-indigo-500" />
                        {t('In Transit', 'Đang vận chuyển')}
                      </span>
                    </SelectItem>
                    <SelectItem value="DELIVERED">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {t('Delivered', 'Đã giao')}
                      </span>
                    </SelectItem>
                    <SelectItem value="FAILED">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        {t('Failed', 'Thất bại')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Type Filter */}
                <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[160px] h-9">
                    <SelectValue placeholder={t('All Types', 'Tất cả loại')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Types', 'Tất cả loại')}</SelectItem>
                    <SelectItem value="INTERNAL">{t('Internal Fleet', 'Xe nội bộ')}</SelectItem>
                    <SelectItem value="THIRD_PARTY">{t('3rd Party', 'Bên thứ 3')}</SelectItem>
                  </SelectContent>
                </Select>

                {/* Date From */}
                <div className="relative">
                  <CalendarDays className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="date"
                    className="pl-8 h-9 w-[145px]"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    max={dateTo || undefined}
                  />
                </div>

                {/* Date To */}
                <div className="relative">
                  <CalendarDays className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="date"
                    className="pl-8 h-9 w-[145px]"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    min={dateFrom || undefined}
                  />
                </div>

                {/* Reset */}
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    onClick={handleResetFilters}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {t('Reset', 'Đặt lại')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Shipments Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : shipments.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Truck className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {t('No shipments found', 'Không tìm thấy chuyến giao hàng')}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    {hasActiveFilters
                      ? t(
                          'Try adjusting your search or filters to find what you are looking for.',
                          'Thử thay đổi tìm kiếm hoặc bộ lọc để tìm chuyến giao hàng.'
                        )
                      : t(
                          'Get started by creating a shipment for an existing order.',
                          'Bắt đầu bằng cách tạo chuyến giao hàng cho đơn hàng đã có.'
                        )}
                  </p>
                  {!hasActiveFilters && (
                    <Button
                      className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setCreateDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('Create First Shipment', 'Tạo chuyến giao đầu tiên')}
                    </Button>
                  )}
                </div>
              ) : (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[110px]">{t('Order #', 'Mã ĐH')}</TableHead>
                        <TableHead>{t('Shop', 'Cửa hàng')}</TableHead>
                        <TableHead>{t('Status', 'TT')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('Type', 'Loại')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Driver', 'Tài xế')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('Route', 'Lộ trình')}</TableHead>
                        <TableHead className="text-right">{t('Value', 'Giá trị')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('Date', 'Ngày')}</TableHead>
                        <TableHead className="text-right">{t('Actions', 'TH')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shipments.map((s) => (
                        <TableRow
                          key={s.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleRowClick(s.id)}
                        >
                          {/* Order Number */}
                          <TableCell className="font-mono text-xs font-medium">
                            {s.orderNumber}
                          </TableCell>

                          {/* Shop Name */}
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium truncate block max-w-[150px]">
                                {s.shopName}
                              </span>
                            </div>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <ShipmentStatusBadge status={s.status} locale={locale} size="sm" showIcon />
                          </TableCell>

                          {/* Type */}
                          <TableCell className="hidden sm:table-cell">
                            <ShipmentTypeBadge type={s.type} locale={locale} />
                          </TableCell>

                          {/* Driver */}
                          <TableCell className="hidden md:table-cell">
                            {s.driverName ? (
                              <div className="flex items-center gap-1.5">
                                <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                  <span className="text-[9px] font-bold text-blue-700">
                                    {getDriverInitial(s.driverName)}
                                  </span>
                                </div>
                                <span className="text-xs truncate max-w-[100px]">{s.driverName}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                <span className="text-[10px] text-muted-foreground">
                                  {t('Unassigned', 'Chưa phân công')}
                                </span>
                              </div>
                            )}
                          </TableCell>

                          {/* Route */}
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-start gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                              <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                {s.dropoffAddress}
                              </span>
                            </div>
                          </TableCell>

                          {/* Order Value */}
                          <TableCell className="text-right">
                            <span className="text-sm font-semibold">
                              <SensitiveValue
                                value={s.orderTotal}
                                maskType="amount"
                                formatOptions={{ formatCurrency: true }}
                              />
                            </span>
                          </TableCell>

                          {/* Created Date */}
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {new Date(s.createdAt).toLocaleDateString('vi-VN', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => handleRowClick(s.id)}
                            >
                              {t('View', 'Xem')}
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
                          `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} of ${totalCount} shipments`,
                          `Hiển thị ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} / ${totalCount} chuyến giao`
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
                            className={`h-8 w-8 text-xs ${p === page ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
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

        {/* Shipment Detail Drawer */}
        <ShipmentDetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          shipmentId={selectedShipmentId}
          locale={locale}
          onStatusChanged={handleDataChanged}
        />

        {/* Create Shipment Dialog */}
        <ShipmentCreateDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          locale={locale}
          onCreated={handleDataChanged}
        />
      </SidebarInset>
    </div>
  );
}
