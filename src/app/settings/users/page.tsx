'use client';
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
  UserPlus,
  UserCheck,
  UserX,
  Shield,
  RotateCcw,
  ArrowUpDown,
  Download,
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
import { UserRoleBadge } from '@/components/settings/user-role-badge';
import { UserStatusBadge } from '@/components/settings/user-status-badge';
import { UserDetailDrawer } from '@/components/settings/user-detail-drawer';
import { UserFormDialog } from '@/components/settings/user-form-dialog';
import { ChangePasswordDialog } from '@/components/settings/change-password-dialog';
import { toast } from 'sonner';
import { ROLES } from '@/lib/security';

// ============================================
// Types
// ============================================

interface UserListItem {
  id: string;
  phone: string;
  name: string;
  nameEn: string | null;
  email: string | null;
  role: string;
  status: string;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  mustChangePwd: boolean;
  createdAt: string;
  shop: { id: string; name: string; loyaltyTier: string } | null;
  broker: { id: string; tier: string; commissionRate: number } | null;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  pendingUsers: number;
  newThisMonth: number;
  newThisWeek: number;
  roleDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  recentLogins: number;
  admins: number;
  salesReps: number;
  drivers: number;
  shopOwners: number;
  brokers: number;
}

// ============================================
// Main Users Management Page
// ============================================

export default function UsersPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Dialogs
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetPwdDialogOpen, setResetPwdDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [resetPwdTarget, setResetPwdTarget] = useState<UserListItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resettingPwd, setResettingPwd] = useState(false);

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

  // Fetch users
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
        sortBy,
        sortOrder,
      });
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/users?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setUsers(json.data.items || []);
        setTotalPages(json.data.pagination.totalPages);
        setTotalCount(json.data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, roleFilter, statusFilter, sortBy, sortOrder, limit]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/users/stats');
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRowClick = (user: UserListItem) => {
    setSelectedUser(user);
    setDrawerOpen(true);
  };

  const handleEdit = (user: UserListItem) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleResetPassword = (user: any) => {
    setResetPwdTarget(user);
    setNewPassword('');
    setResetPwdDialogOpen(true);
  };

  const handleConfirmResetPassword = async () => {
    if (!resetPwdTarget) return;
    if (newPassword.length < 8) {
      toast.error(t('Password must be at least 8 characters', 'Mat khau phai it nhat 8 ky tu'));
      return;
    }
    setResettingPwd(true);
    try {
      const res = await fetch(`/api/users/${resetPwdTarget.id}/reset-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(t('Password reset successfully', 'Dat lai mat khau thanh cong'));
        setResetPwdDialogOpen(false);
        setResetPwdTarget(null);
        setNewPassword('');
      } else {
        toast.error(json.error?.message || t('Failed', 'That bai'));
      }
    } catch (err) {
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setResettingPwd(false);
    }
  };

  const handleDataChanged = () => {
    fetchUsers();
    fetchStats();
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
  };

  const hasActiveFilters = debouncedSearch || roleFilter !== 'all' || statusFilter !== 'all';

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  // Export CSV
  const handleExportCSV = () => {
    if (users.length === 0) return;
    const headers = locale === 'vi'
      ? ['Ten', 'SDT', 'Email', 'Vai tro', 'Trang thai', 'Dang nhap cuoi', 'Ngay tao']
      : ['Name', 'Phone', 'Email', 'Role', 'Status', 'Last Login', 'Created'];
    const rows = users.map((u) => [u.name, u.phone, u.email || '', u.role, u.status, u.lastLoginAt || '', u.createdAt]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aladin-users-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
                {t('User Management', 'Quan ly Nguoi dung')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Manage all platform users, roles, and access', 'Quan ly tat ca nguoi dung, vai tro va quyen truy cap')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDataChanged}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Lam moi')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={users.length === 0}>
                <Download className="h-4 w-4 mr-1" />
                {t('Export', 'Xuat')}
              </Button>
              <Button size="sm" onClick={() => setCreateDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Plus className="h-4 w-4 mr-1" />
                {t('Create User', 'Tao nguoi dung')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Total Users', 'Tong ND')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.totalUsers || 0}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Active', 'Hoat dong')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.activeUsers || 0}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('New This Month', 'Moi trong thang')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.newThisMonth || 0}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                    <UserPlus className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Suspended', 'Bi khoa')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.suspendedUsers || 0}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
                    <UserX className="h-4 w-4 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Admins', 'Quan tri')}</p>
                    <p className="text-xl font-bold mt-1">{stats?.admins || 0}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Role Distribution */}
          {stats && stats.roleDistribution && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.roleDistribution).map(([role, count]) => (
                count > 0 ? (
                  <div key={role} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs">
                    <UserRoleBadge role={role} locale={locale} />
                    <span className="text-muted-foreground">({count})</span>
                  </div>
                ) : null
              ))}
            </div>
          )}

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={t('Search by name, phone, email...', 'Tim theo ten, SDT, email...')}
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <Select value={roleFilter} onValueChange={(val) => { setRoleFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[155px] h-9">
                    <SelectValue placeholder={t('All Roles', 'Tat ca vai tro')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Roles', 'Tat ca vai tro')}</SelectItem>
                    <SelectItem value="ADMIN">{t('Admin', 'Quan tri')}</SelectItem>
                    <SelectItem value="SHOP_OWNER">{t('Shop Owner', 'Chu cua hang')}</SelectItem>
                    <SelectItem value="SALES_REP">{t('Sales Rep', 'Nhan vien BH')}</SelectItem>
                    <SelectItem value="DRIVER">{t('Driver', 'Tai xe')}</SelectItem>
                    <SelectItem value="BROKER">{t('Broker', 'Dai ly')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[155px] h-9">
                    <SelectValue placeholder={t('All Status', 'Tat ca TT')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Status', 'Tat ca TT')}</SelectItem>
                    <SelectItem value="ACTIVE">{t('Active', 'Hoat dong')}</SelectItem>
                    <SelectItem value="SUSPENDED">{t('Suspended', 'Bi khoa')}</SelectItem>
                    <SelectItem value="PENDING_VERIFICATION">{t('Pending', 'Cho xac minh')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full sm:w-[130px] h-9">
                    <SelectValue placeholder={t('Sort by', 'Sap xep')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">{t('Newest', 'Moi nhat')}</SelectItem>
                    <SelectItem value="name">{t('Name', 'Ten')}</SelectItem>
                    <SelectItem value="lastLoginAt">{t('Last Login', 'DN cuoi')}</SelectItem>
                    <SelectItem value="role">{t('Role', 'Vai tro')}</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSortOrder((p) => p === 'desc' ? 'asc' : 'desc')}>
                  <ArrowUpDown className="h-4 w-4" />
                </Button>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-9" onClick={handleResetFilters}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {t('Reset', 'Dat lai')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">{t('No users found', 'Khong tim thay nguoi dung')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasActiveFilters
                      ? t('Try adjusting your search or filters.', 'Thu thay doi tim kiem hoac bo loc.')
                      : t('Create the first user to get started.', 'Tao nguoi dung dau tien de bat dau.')}
                  </p>
                  {!hasActiveFilters && (
                    <Button className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />{t('Create First User', 'Tao nguoi dung dau tien')}
                    </Button>
                  )}
                </div>
              ) : (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>{t('User', 'Nguoi dung')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('Email', 'Email')}</TableHead>
                        <TableHead>{t('Role', 'Vai tro')}</TableHead>
                        <TableHead>{t('Status', 'TT')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Shop/Broker', 'CH/DL')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('Last Login', 'DN cuoi')}</TableHead>
                        <TableHead className="text-right">{t('Actions', 'TH')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => (
                        <TableRow
                          key={u.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleRowClick(u)}
                        >
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="text-sm font-medium truncate max-w-[150px]">{u.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                <SensitiveValue value={u.phone} maskType="phone" />
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <span className="text-xs text-muted-foreground truncate max-w-[150px] block">
                              {u.email || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <UserRoleBadge role={u.role} locale={locale} />
                          </TableCell>
                          <TableCell>
                            <UserStatusBadge status={u.status} locale={locale} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {u.shop ? (
                              <span className="text-xs text-muted-foreground">{u.shop.name}</span>
                            ) : u.broker ? (
                              <span className="text-xs text-muted-foreground">
                                {t('Broker', 'DL')} · {(u.broker.commissionRate * 100).toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {u.lastLoginAt
                                ? new Date(u.lastLoginAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                : t('Never', 'Chua DN')}
                            </span>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-xs"
                              onClick={() => handleEdit(u)}
                            >
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
                          `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} of ${totalCount}`,
                          `Hien thi ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} / ${totalCount}`
                        )}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
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

        {/* User Detail Drawer */}
        <UserDetailDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          userId={selectedUser?.id || null}
          locale={locale}
          onUserUpdated={handleDataChanged}
          onEdit={(user) => { setSelectedUser(user); setEditDialogOpen(true); }}
          onResetPassword={handleResetPassword}
        />

        {/* Create User Dialog */}
        <UserFormDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          locale={locale}
          onSaved={handleDataChanged}
        />

        {/* Edit User Dialog */}
        <UserFormDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          user={selectedUser}
          locale={locale}
          onSaved={handleDataChanged}
        />

        {/* Reset Password Dialog */}
        <ChangePasswordDialog
          open={resetPwdDialogOpen}
          onOpenChange={setResetPwdDialogOpen}
          locale={locale}
        />
      </SidebarInset>
    </div>
  );
}
