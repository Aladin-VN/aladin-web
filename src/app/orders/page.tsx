'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShoppingCart,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  Package,
  Clock,
  CheckCircle2,
  CalendarDays,
  RotateCcw,
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
import { OrderStatusBadge, PaymentMethodBadge, PaymentStatusBadge } from '@/components/orders/order-status-badge';
import { OrderDetailDrawer } from '@/components/orders/order-detail-drawer';
import { OrderCreateDialog } from '@/components/orders/order-create-dialog';

// ============================================
// Types
// ============================================

interface OrderListItem {
  id: string;
  orderNumber: string;
  shopName: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  totalAmountFormatted: string;
  itemCount: number;
  createdAt: string;
}

interface OrdersResponse {
  items: OrderListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  todayOrders: number;
  monthlyGmvFormatted: string;
  processingOrders: number;
  deliveredToday: number;
  ordersByStatus: Record<string, number>;
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
// Main Orders Page
// ============================================

export default function OrdersPage() {
  const [locale, setLocale] = useState('vi');
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data state
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OrderStats | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrdersCount, setTotalOrdersCount] = useState(0);
  const limit = 20;

  // Dialog / Drawer state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
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

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
      });

      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (paymentMethodFilter !== 'all') params.set('paymentMethod', paymentMethodFilter);
      if (paymentStatusFilter !== 'all') params.set('paymentStatus', paymentStatusFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/orders?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        const data: OrdersResponse = json.data;
        setOrders(data.items || []);
        setTotalPages(data.pagination.totalPages);
        setTotalOrdersCount(data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, paymentMethodFilter, paymentStatusFilter, dateFrom, dateTo, limit]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/orders/stats');
      const json = await res.json();
      if (json.success) {
        const data = json.data;
        setStats({
          totalOrders: data.totalOrders || 0,
          pendingOrders: data.pendingOrders || 0,
          todayOrders: data.todayOrders || 0,
          monthlyGmvFormatted: data.monthlyGmvFormatted || '0 ₫',
          processingOrders: data.ordersByStatus?.PROCESSING || 0,
          deliveredToday: data.todayOrders || 0,
          ordersByStatus: data.ordersByStatus || {},
        });
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
    fetchOrders();
  }, [fetchOrders]);

  // Row click handler
  const handleRowClick = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDrawerOpen(true);
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPaymentMethodFilter('all');
    setPaymentStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  // Refresh
  const handleRefresh = () => {
    fetchOrders();
    fetchStats();
  };

  // After create / status change
  const handleDataChanged = () => {
    fetchOrders();
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

  const hasActiveFilters = debouncedSearch || statusFilter !== 'all' || paymentMethodFilter !== 'all' || paymentStatusFilter !== 'all' || dateFrom || dateTo;

  return (
    <div className="flex min-h-screen">
      <AdminSidebar locale={locale} userName="Quyet Dinh" userRole="ADMIN" />
      <SidebarInset>
        <AdminHeader locale={locale} onLocaleChange={setLocale} />

        <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t('Orders', 'Đơn hàng')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Manage orders, track fulfillment, and payments', 'Quản lý đơn hàng, theo dõi xử lý và thanh toán')}
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
                {t('Create Order', 'Tạo đơn hàng')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCardMini
              title="Total Orders"
              titleVi="Tổng đơn hàng"
              value={stats?.totalOrders || 0}
              icon={<ShoppingCart className="h-4 w-4" />}
              variant="default"
              locale={locale}
            />
            <StatCardMini
              title="Pending"
              titleVi="Chờ xác nhận"
              value={stats?.pendingOrders || 0}
              icon={<Clock className="h-4 w-4" />}
              variant="warning"
              locale={locale}
            />
            <StatCardMini
              title="Processing"
              titleVi="Đang xử lý"
              value={stats?.processingOrders || 0}
              icon={<Package className="h-4 w-4" />}
              variant="default"
              locale={locale}
            />
            <StatCardMini
              title="Delivered Today"
              titleVi="Giao hôm nay"
              value={stats?.deliveredToday || 0}
              icon={<CheckCircle2 className="h-4 w-4" />}
              variant="success"
              locale={locale}
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
                    placeholder={t('Search by order number, shop name...', 'Tìm theo mã đơn, tên cửa hàng...')}
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
                        {t('Pending', 'Chờ xác nhận')}
                      </span>
                    </SelectItem>
                    <SelectItem value="CONFIRMED">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        {t('Confirmed', 'Đã xác nhận')}
                      </span>
                    </SelectItem>
                    <SelectItem value="PROCESSING">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-indigo-500" />
                        {t('Processing', 'Đang xử lý')}
                      </span>
                    </SelectItem>
                    <SelectItem value="PACKED">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-purple-500" />
                        {t('Packed', 'Đã đóng gói')}
                      </span>
                    </SelectItem>
                    <SelectItem value="OUT_FOR_DELIVERY">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-cyan-500" />
                        {t('Out for Delivery', 'Đang giao')}
                      </span>
                    </SelectItem>
                    <SelectItem value="DELIVERED">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {t('Delivered', 'Đã giao')}
                      </span>
                    </SelectItem>
                    <SelectItem value="CANCELLED">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        {t('Cancelled', 'Đã hủy')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Payment Method Filter */}
                <Select value={paymentMethodFilter} onValueChange={(val) => { setPaymentMethodFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[160px] h-9">
                    <SelectValue placeholder={t('Payment Method', 'PT thanh toán')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Methods', 'Tất cả PT')}</SelectItem>
                    <SelectItem value="CREDIT">{t('7-Day Credit', 'Công nợ 7 ngày')}</SelectItem>
                    <SelectItem value="DIGITAL">{t('Digital', 'Thanh toán số')}</SelectItem>
                    <SelectItem value="COD">COD</SelectItem>
                  </SelectContent>
                </Select>

                {/* Payment Status Filter */}
                <Select value={paymentStatusFilter} onValueChange={(val) => { setPaymentStatusFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[130px] h-9">
                    <SelectValue placeholder={t('Payment', 'Thanh toán')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All', 'Tất cả')}</SelectItem>
                    <SelectItem value="PENDING">{t('Unpaid', 'Chưa TT')}</SelectItem>
                    <SelectItem value="PAID">{t('Paid', 'Đã TT')}</SelectItem>
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

          {/* Orders Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {t('No orders found', 'Không tìm thấy đơn hàng')}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    {hasActiveFilters
                      ? t(
                          'Try adjusting your search or filters to find what you are looking for.',
                          'Thử thay đổi tìm kiếm hoặc bộ lọc để tìm đơn hàng.'
                        )
                      : t(
                          'Get started by creating your first order.',
                          'Bắt đầu bằng cách tạo đơn hàng đầu tiên.'
                        )}
                  </p>
                  {!hasActiveFilters && (
                    <Button
                      className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setCreateDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('Create First Order', 'Tạo đơn hàng đầu tiên')}
                    </Button>
                  )}
                </div>
              ) : (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[130px]">{t('Order #', 'Mã ĐH')}</TableHead>
                        <TableHead>{t('Shop', 'Cửa hàng')}</TableHead>
                        <TableHead>{t('Status', 'TT')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Payment', 'Thanh toán')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('PT Status', 'TT Thanh toán')}</TableHead>
                        <TableHead className="hidden sm:table-cell text-center">{t('Items', 'SP')}</TableHead>
                        <TableHead className="text-right">{t('Total', 'Tổng')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('Date', 'Ngày tạo')}</TableHead>
                        <TableHead className="text-right">{t('Actions', 'TH')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow
                          key={order.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleRowClick(order.id)}
                        >
                          {/* Order Number */}
                          <TableCell className="font-mono text-xs font-medium">
                            {order.orderNumber}
                          </TableCell>

                          {/* Shop Name */}
                          <TableCell>
                            <span className="text-sm font-medium truncate block max-w-[200px]">
                              {order.shopName}
                            </span>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <OrderStatusBadge status={order.status} locale={locale} />
                          </TableCell>

                          {/* Payment Method */}
                          <TableCell className="hidden md:table-cell">
                            <PaymentMethodBadge method={order.paymentMethod} locale={locale} />
                          </TableCell>

                          {/* Payment Status */}
                          <TableCell className="hidden md:table-cell">
                            <PaymentStatusBadge status={order.paymentStatus} locale={locale} />
                          </TableCell>

                          {/* Items Count */}
                          <TableCell className="hidden sm:table-cell text-center">
                            <span className="text-xs text-muted-foreground">
                              {order.itemCount}
                            </span>
                          </TableCell>

                          {/* Total Amount */}
                          <TableCell className="text-right">
                            <span className="text-sm font-semibold">
                              <SensitiveValue
                                value={order.totalAmount}
                                maskType="amount"
                                formatOptions={{ formatCurrency: true }}
                              />
                            </span>
                          </TableCell>

                          {/* Created Date */}
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString('vi-VN', {
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
                              onClick={() => handleRowClick(order.id)}
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
                          `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalOrdersCount)} of ${totalOrdersCount} orders`,
                          `Hiển thị ${(page - 1) * limit + 1}–${Math.min(page * limit, totalOrdersCount)} / ${totalOrdersCount} đơn hàng`
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

        {/* Order Detail Drawer */}
        <OrderDetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          orderId={selectedOrderId}
          locale={locale}
          onStatusChanged={handleDataChanged}
        />

        {/* Create Order Dialog */}
        <OrderCreateDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          locale={locale}
          onCreated={handleDataChanged}
        />
      </SidebarInset>
    </div>
  );
}
