'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  Users,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
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
import { BrokerTierBadge } from '@/components/brokers/broker-tier-badge';

interface CommissionItem {
  id: string;
  userId: string;
  name: string;
  phone: string;
  status: string;
  tier: string;
  commissionRate: number;
  commissionRatePercent: string;
  totalShopsReferred: number;
  totalCommissionEarned: number;
  totalCommissionEarnedFormatted: string;
  totalGmvGenerated: number;
  totalGmvGeneratedFormatted: string;
  effectiveRate: string;
  ward: { id: string; name: string; district: string } | null;
  joinedAt: string;
}

export default function BrokerCommissionsPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [items, setItems] = useState<CommissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);

  const [tierFilter, setTierFilter] = useState('all');
  const [hasEarnings, setHasEarnings] = useState('all');
  const [sortBy, setSortBy] = useState('totalCommissionEarned');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  const fetchCommissions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder: 'desc',
      });
      if (tierFilter !== 'all') params.set('tier', tierFilter);
      if (hasEarnings !== 'all') params.set('hasEarnings', hasEarnings);

      const json = await adminFetch(`/api/brokers/commissions?${params.toString()}`);
      if (json.success) {
        setItems(json.data.items || []);
        setTotalPages(json.data.pagination.totalPages);
        setTotalCount(json.data.pagination.total);
        setSummary(json.data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch commissions:', err);
    } finally {
      setLoading(false);
    }
  }, [page, tierFilter, hasEarnings, sortBy, limit]);

  useEffect(() => { fetchCommissions(); }, [fetchCommissions]);

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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t('Commissions & Payouts', 'Hoa hồng & Thanh toán')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Track broker commissions, performance, and payout management', 'Theo dõi hoa hồng, hiệu suất và quản lý thanh toán đại lý')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchCommissions}>
              <RefreshCw className="h-4 w-4 mr-1" />
              {t('Refresh', 'Làm mới')}
            </Button>
          </div>

          <Separator />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-yellow-100 bg-yellow-50/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">{t('Total Commission', 'Tổng hoa hồng')}</p>
                <p className="text-xl font-bold mt-1 text-red-700">
                  <SensitiveValue value={Number(summary?.totalUnpaidCommission) || 0} maskType="amount" formatOptions={{ formatCurrency: true, compact: true }} />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">{t('Total GMV', 'Tổng GMV')}</p>
                <p className="text-xl font-bold mt-1 text-blue-700">
                  <SensitiveValue value={Number(summary?.totalGmvGenerated) || 0} maskType="amount" formatOptions={{ formatCurrency: true, compact: true }} />
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">{t('With Earnings', 'Có hoa hồng')}</p>
                <p className="text-xl font-bold mt-1">{Number(summary?.brokersWithEarnings) || 0}</p>
                <p className="text-[10px] text-muted-foreground">/ {totalCount} {t('brokers', 'đại lý')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-medium">{t('Avg Commission', 'TB Hoa hồng')}</p>
                <p className="text-xl font-bold mt-1">
                  <SensitiveValue value={totalCount > 0 ? Math.round(Number(summary?.totalUnpaidCommission) / Math.max(1, Number(summary?.brokersWithEarnings) || 1)) : 0} maskType="amount" formatOptions={{ formatCurrency: true, compact: true }} />
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); setPage(1); }}>
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

                <Select value={hasEarnings} onValueChange={(v) => { setHasEarnings(v); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[170px] h-9">
                    <SelectValue placeholder={t('All', 'Tất cả')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All Brokers', 'Tất cả đại lý')}</SelectItem>
                    <SelectItem value="true">{t('With Earnings Only', 'Có hoa hồng')}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(v) => { setSortBy(v); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[170px] h-9">
                    <SelectValue placeholder={t('Sort By', 'Sắp xếp')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="totalCommissionEarned">{t('Commission', 'Hoa hồng')}</SelectItem>
                    <SelectItem value="totalGmvGenerated">{t('GMV', 'GMV')}</SelectItem>
                    <SelectItem value="totalShopsReferred">{t('Shops Referred', 'Cửa hàng')}</SelectItem>
                    <SelectItem value="commissionRate">{t('Rate', 'Tỷ lệ')}</SelectItem>
                  </SelectContent>
                </Select>

                {(tierFilter !== 'all' || hasEarnings !== 'all') && (
                  <Button variant="ghost" size="sm" className="h-9" onClick={() => { setTierFilter('all'); setHasEarnings('all'); setPage(1); }}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {t('Reset', 'Đặt lại')}
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
                  {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">{t('No commission data', 'Không có dữ liệu hoa hồng')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('Commission data will appear as brokers generate GMV.', 'Dữ liệu hoa hồng sẽ hiển thị khi đại lý tạo ra GMV.')}
                  </p>
                </div>
              ) : (
                <div className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>{t('Broker', 'Đại lý')}</TableHead>
                        <TableHead>{t('Tier', 'Cấp')}</TableHead>
                        <TableHead>{t('Rate', 'Tỷ lệ')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('Shops', 'Cửa hàng')}</TableHead>
                        <TableHead>{t('GMV', 'GMV')}</TableHead>
                        <TableHead>{t('Commission', 'Hoa hồng')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Eff. Rate', 'Tỷ lệ thực')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((b) => (
                        <TableRow key={b.id} className="hover:bg-muted/50">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <span className="text-[9px] font-bold text-blue-700">{b.name.charAt(0)}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate max-w-[130px]">{b.name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  <SensitiveValue value={b.phone} maskType="phone" />
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><BrokerTierBadge tier={b.tier} locale={locale} /></TableCell>
                          <TableCell><span className="text-xs font-semibold">{b.commissionRatePercent}</span></TableCell>
                          <TableCell className="hidden sm:table-cell"><span className="text-xs">{b.totalShopsReferred}</span></TableCell>
                          <TableCell>
                            <span className="text-xs font-medium">
                              <SensitiveValue value={b.totalGmvGenerated} maskType="amount" formatOptions={{ formatCurrency: true, compact: true }} />
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-semibold text-red-600">
                              <SensitiveValue value={b.totalCommissionEarned} maskType="amount" formatOptions={{ formatCurrency: true }} />
                            </span>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <span className={`text-xs font-medium ${Number(b.effectiveRate) > 0 ? 'text-blue-600' : 'text-muted-foreground'}`}>
                              {b.effectiveRate}%
                            </span>
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
                          <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon" className={`h-8 w-8 text-xs ${p === page ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`} onClick={() => setPage(p)}>{p}</Button>
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
      </SidebarInset>
    </div>
  );
}
