'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScrollText,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Users,
  Activity,
  Shield,
  Settings,
  RotateCcw,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Badge } from '@/components/ui/badge';
import { UserRoleBadge } from '@/components/settings/user-role-badge';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

interface AuditLogItem {
  id: string;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details: unknown;
  detailsRaw: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditLogStats {
  totalEvents: number;
  todayEvents: number;
  userActions: number;
  systemActions: number;
}

// Action color mapping
function getActionColor(action: string): string {
  if (action.includes('PASSWORD') || action.includes('LOGIN') || action.includes('LOGOUT')) {
    return 'text-red-600 dark:text-red-400';
  }
  if (action.includes('USER_') || action.includes('ROLE_CHANGED') || action.includes('STATUS_CHANGED')) {
    return 'text-blue-600 dark:text-blue-400';
  }
  if (action.includes('SETTING') || action.includes('PLATFORM')) {
    return 'text-purple-600 dark:text-purple-400';
  }
  if (action.includes('ORDER') || action.includes('SHIPMENT')) {
    return 'text-red-600 dark:text-yellow-500';
  }
  if (action.includes('CREDIT') || action.includes('REPAYMENT')) {
    return 'text-amber-600 dark:text-amber-400';
  }
  return 'text-muted-foreground';
}

function getActionBadgeColor(action: string): string {
  if (action.includes('PASSWORD') || action.includes('LOGIN') || action.includes('LOGOUT')) {
    return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400';
  }
  if (action.includes('USER_') || action.includes('ROLE_CHANGED') || action.includes('STATUS_CHANGED')) {
    return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400';
  }
  if (action.includes('SETTING') || action.includes('PLATFORM')) {
    return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400';
  }
  if (action.includes('ORDER') || action.includes('SHIPMENT')) {
    return 'bg-yellow-50 text-red-700 border-yellow-100 dark:bg-emerald-950 dark:text-yellow-500';
  }
  if (action.includes('CREDIT') || action.includes('REPAYMENT')) {
    return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400';
  }
  return '';
}

// ============================================
// Main Audit Log Page
// ============================================

export default function AuditLogPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [entityOptions, setEntityOptions] = useState<string[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Stats
  const [stats, setStats] = useState<AuditLogStats>({
    totalEvents: 0,
    todayEvents: 0,
    userActions: 0,
    systemActions: 0,
  });

  // Expanded row
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Auto refresh
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

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

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
      });
      if (actionFilter !== 'all') params.set('action', actionFilter);
      if (entityFilter !== 'all') params.set('entity', entityFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await adminFetch(`/api/settings/audit-log?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setLogs(json.data.items || []);
        setTotalPages(json.data.pagination.totalPages);
        setTotalCount(json.data.pagination.total);
        if (json.data.filterOptions) {
          setActionOptions(json.data.filterOptions.actions);
          setEntityOptions(json.data.filterOptions.entities);
        }
        // Compute stats from data
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayCount = (json.data.items || []).filter((l: AuditLogItem) => new Date(l.createdAt) >= today).length;
        setStats((prev) => ({
          ...prev,
          totalEvents: json.data.pagination.total,
          todayEvents: page === 1 ? todayCount : prev.todayEvents,
        }));
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, actionFilter, entityFilter, dateFrom, dateTo, limit]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    autoRefreshRef.current = setInterval(() => {
      fetchLogs();
    }, 30000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [fetchLogs]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setActionFilter('all');
    setEntityFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = debouncedSearch || actionFilter !== 'all' || entityFilter !== 'all' || dateFrom || dateTo;

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const formatDetails = (details: unknown): string => {
    if (!details) return '-';
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  };

  const truncateJson = (str: string, maxLen = 60): string => {
    if (!str) return '-';
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + '...';
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
                {t('Audit Log', 'Nhat ky He thong')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Track all platform actions and changes', 'Theo doi tat ca thao tac va thay doi tren nen tang')}
                <span className="text-[10px] ml-2 text-muted-foreground">
                  ({t('Auto-refresh every 30s', 'Tu dong lam moi moi 30s')})
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchLogs}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Lam moi')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Total Events', 'Tong su kien')}</p>
                    <p className="text-xl font-bold mt-1">{totalCount || stats.totalEvents}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                    <ScrollText className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-yellow-100 bg-yellow-50/50 dark:border-red-900 dark:bg-emerald-950/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('User Actions', 'Thao tac ND')}</p>
                    <p className="text-xl font-bold mt-1">{stats.userActions}</p>
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
                    <p className="text-xs text-muted-foreground font-medium">{t('Security', 'Bao mat')}</p>
                    <p className="text-xl font-bold mt-1">
                      {logs.filter((l) => l.action.includes('PASSWORD') || l.action.includes('LOGIN')).length}
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
                    <Shield className="h-4 w-4 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Settings', 'Cai dat')}</p>
                    <p className="text-xl font-bold mt-1">
                      {logs.filter((l) => l.action.includes('SETTING')).length}
                    </p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Settings className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={t('Search actions, entities...', 'Tim kiem thao tac, doi tuong...')}
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <Select value={actionFilter} onValueChange={(val) => { setActionFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[180px] h-9">
                    <SelectValue placeholder={t('All Actions', 'Tat ca thao tac')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Actions', 'Tat ca thao tac')}</SelectItem>
                    {actionOptions.slice(0, 15).map((a) => (
                      <SelectItem key={a} value={a}>
                        <span className="truncate max-w-[160px] block">{a.replace(/_/g, ' ')}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={entityFilter} onValueChange={(val) => { setEntityFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[150px] h-9">
                    <SelectValue placeholder={t('All Entities', 'Tat ca DT')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Entities', 'Tat ca DT')}</SelectItem>
                    {entityOptions.map((e) => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <div className="grid gap-1">
                    <Label className="text-[10px] text-muted-foreground">{t('From', 'Tu')}</Label>
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                      className="h-9 w-[140px] text-xs"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-[10px] text-muted-foreground">{t('To', 'Den')}</Label>
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                      className="h-9 w-[140px] text-xs"
                    />
                  </div>
                </div>

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="h-9" onClick={handleResetFilters}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {t('Reset', 'Dat lai')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Audit Log Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <ScrollText className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">{t('No audit events found', 'Khong tim thay su kien')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasActiveFilters
                      ? t('Try adjusting your filters.', 'Thu thay doi bo loc.')
                      : t('Audit events will appear here as actions are performed.', 'Su kien se xuat hien khi co thao tac thuc hien.')}
                  </p>
                </div>
              ) : (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[50px]" />
                        <TableHead className="hidden sm:table-cell">{t('Time', 'TG')}</TableHead>
                        <TableHead>{t('User', 'Nguoi dung')}</TableHead>
                        <TableHead>{t('Action', 'Thao tac')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Entity', 'Doi tuong')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('Details', 'Chi tiet')}</TableHead>
                        <TableHead className="hidden xl:table-cell">{t('IP', 'IP')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => {
                        const isExpanded = expandedRow === log.id;
                        return (
                          <>
                            <TableRow
                              key={log.id}
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                            >
                              <TableCell className="w-[50px]">
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  {isExpanded ? (
                                    <ChevronUp className="h-3 w-3" />
                                  ) : (
                                    <ChevronDown className="h-3 w-3" />
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(log.createdAt).toLocaleString('vi-VN', {
                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                                  })}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-0.5">
                                  {log.userName ? (
                                    <p className="text-xs font-medium">{log.userName}</p>
                                  ) : (
                                    <p className="text-xs text-muted-foreground italic">{t('System', 'He thong')}</p>
                                  )}
                                  {log.userRole && (
                                    <UserRoleBadge role={log.userRole} locale={locale} />
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 border ${getActionBadgeColor(log.action)}`}
                                >
                                  {log.action.replace(/_/g, ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <span className="text-xs text-muted-foreground">
                                  {log.entity}{log.entityId ? ` #${log.entityId.slice(0, 6)}` : ''}
                                </span>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <span className="text-[10px] text-muted-foreground font-mono max-w-[200px] truncate block">
                                  {log.detailsRaw ? truncateJson(log.detailsRaw) : '-'}
                                </span>
                              </TableCell>
                              <TableCell className="hidden xl:table-cell">
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {log.ipAddress || '-'}
                                </span>
                              </TableCell>
                            </TableRow>

                            {/* Expanded Row */}
                            {isExpanded && (
                              <TableRow key={`${log.id}-expanded`} className="bg-muted/30">
                                <TableCell colSpan={7} className="p-4">
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                      <div>
                                        <p className="text-xs text-muted-foreground">{t('Timestamp', 'Thoi gian')}</p>
                                        <p>{new Date(log.createdAt).toLocaleString('vi-VN')}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">{t('User ID', 'Ma ND')}</p>
                                        <p className="font-mono text-xs">{log.userId || t('System', 'He thong')}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">{t('Entity ID', 'Ma DT')}</p>
                                        <p className="font-mono text-xs">{log.entityId || '-'}</p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground">{t('IP Address', 'Dia chi IP')}</p>
                                        <p className="font-mono text-xs">{log.ipAddress || '-'}</p>
                                      </div>
                                    </div>

                                    {log.userAgent && (
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">{t('User Agent', 'Trinh duyet')}</p>
                                        <p className="text-xs font-mono text-muted-foreground bg-background p-2 rounded border max-h-20 overflow-y-auto">
                                          {log.userAgent}
                                        </p>
                                      </div>
                                    )}

                                    {log.detailsRaw && (
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">{t('Details (JSON)', 'Chi tiet (JSON)')}</p>
                                        <pre className="text-xs font-mono text-muted-foreground bg-background p-3 rounded border max-h-40 overflow-y-auto whitespace-pre-wrap">
                                          {formatDetails(log.details)}
                                        </pre>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
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
                            className={`h-8 w-8 text-xs ${p === page ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
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
      </SidebarInset>
    </div>
  );
}
