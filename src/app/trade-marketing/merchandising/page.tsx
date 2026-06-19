'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Camera,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Image as ImageIcon,
  Store,
  Package,
  Tag,
  RotateCcw,
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
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { AuditStatusBadge } from '@/components/merchandising/audit-status-badge';
import { AuditReviewDialog } from '@/components/merchandising/audit-review-dialog';
import { PromoTypeBadge } from '@/components/promotions/promo-type-badge';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

interface AuditListItem {
  id: string;
  photoUrl: string;
  status: string;
  reviewNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  shopId: string;
  productId: string | null;
  promotionId: string | null;
  shop: { id: string; name: string; district: string | null; shopType: string };
  product: { id: string; name: string; sku: string; imageUrl: string | null } | null;
  promotion: { id: string; title: string; promoType: string } | null;
}

// ============================================
// Main Merchandising Page
// ============================================

export default function MerchandisingPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data state
  const [audits, setAudits] = useState<AuditListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Dialog state
  const [selectedAudit, setSelectedAudit] = useState<AuditListItem | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  // Stats (computed client-side)
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });

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

  // Fetch audits
  const fetchAudits = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
      });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);

      const res = await adminFetch(`/api/merchandising?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        const data = json.data;
        setAudits(data.items || []);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch audits:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, limit]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      // Fetch all statuses in parallel
      const [pendingRes, approvedRes, rejectedRes, totalRes] = await Promise.all([
        fetch('/api/merchandising?limit=1&status=PENDING_REVIEW'),
        fetch('/api/merchandising?limit=1&status=APPROVED'),
        fetch('/api/merchandising?limit=1&status=REJECTED'),
        fetch('/api/merchandising?limit=1'),
      ]);
      const [pendingJson, approvedJson, rejectedJson, totalJson] = await Promise.all([
        pendingRes.json(), approvedRes.json(), rejectedRes.json(), totalRes.json(),
      ]);
      setStats({
        pending: pendingJson.data?.pagination?.total || 0,
        approved: approvedJson.data?.pagination?.total || 0,
        rejected: rejectedJson.data?.pagination?.total || 0,
        total: totalJson.data?.pagination?.total || 0,
      });
    } catch (err) {
      console.error('Failed to fetch audit stats:', err);
    }
  }, []);

  useEffect(() => { fetchAudits(); }, [fetchAudits]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Handlers
  const handleReview = (audit: AuditListItem) => {
    setSelectedAudit(audit);
    setReviewDialogOpen(true);
  };

  const handleReviewed = () => {
    fetchAudits();
    fetchStats();
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPage(1);
  };

  const hasFilters = debouncedSearch || (statusFilter && statusFilter !== 'all');

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
                {t('Merchandising Audits', 'Kiem tra Trung bay')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t(
                  'Review shelf photos from shop owners for promotion compliance',
                  'Duyet anh trung bay tu chu cua hang de dam bao tuan thu chuong trinh khuyen mai'
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { fetchAudits(); fetchStats(); }}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Lam moi')}
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
                    <p className="text-xs text-muted-foreground font-medium">{t('Total Audits', 'Tong kiem tra')}</p>
                    <p className="text-xl font-bold mt-1">{stats.total}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center">
                    <ImageIcon className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Pending Review', 'Cho duyet')}</p>
                    <p className="text-xl font-bold mt-1">{stats.pending}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Approved', 'Da duyet')}</p>
                    <p className="text-xl font-bold mt-1">{stats.approved}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-yellow-50 text-red-600 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Rejected', 'Da tu choi')}</p>
                    <p className="text-xl font-bold mt-1">{stats.rejected}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                    <XCircle className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search + Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={t('Search by shop, product...', 'Tim theo cua hang, san pham...')}
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="h-9 w-[150px] text-xs">
                      <SelectValue placeholder={t('All Status', 'Tat ca TT')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('All Status', 'Tat ca TT')}</SelectItem>
                      <SelectItem value="PENDING_REVIEW">{t('Pending Review', 'Cho duyet')}</SelectItem>
                      <SelectItem value="APPROVED">{t('Approved', 'Da duyet')}</SelectItem>
                      <SelectItem value="REJECTED">{t('Rejected', 'Da tu choi')}</SelectItem>
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
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : audits.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">{t('No audits found', 'Khong tim thay kiem tra')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t(
                      'Shelf photo audits will appear here when shop owners submit them',
                      'Kiem tra anh khe hang se xuat hien o day khi chu cua hang gui len'
                    )}
                  </p>
                </div>
              ) : (
                <div className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>{t('Shop', 'Cua hang')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Product', 'San pham')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('Promotion', 'Khuyen mai')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('Photo', 'Anh')}</TableHead>
                        <TableHead>{t('Status', 'TT')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('Submitted', 'Gui luc')}</TableHead>
                        <TableHead className="text-right">{t('Actions', 'TH')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audits.map((audit) => (
                        <TableRow key={audit.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-yellow-50 text-red-600 flex items-center justify-center shrink-0">
                                <Store className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{audit.shop.name}</p>
                                {audit.shop.district && (
                                  <p className="text-[10px] text-muted-foreground">{audit.shop.district}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="hidden md:table-cell">
                            {audit.product ? (
                              <div className="flex items-center gap-1.5">
                                <Package className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs">{audit.product.name}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">{t('N/A', 'Khong co')}</span>
                            )}
                          </TableCell>

                          <TableCell className="hidden lg:table-cell">
                            {audit.promotion ? (
                              <div className="flex items-center gap-1.5">
                                <PromoTypeBadge type={audit.promotion.promoType} locale={locale} />
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell className="hidden sm:table-cell">
                            {audit.photoUrl ? (
                              <div className="h-10 w-14 rounded-md overflow-hidden border bg-muted">
                                <img
                                  src={audit.photoUrl}
                                  alt="Shelf"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    const el = e.target as HTMLImageElement;
                                    el.style.display = 'none';
                                    el.parentElement!.innerHTML = '<div class="flex items-center justify-center h-full"><Camera class="h-3 w-3 text-muted-foreground" /></div>';
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="h-10 w-14 rounded-md bg-muted flex items-center justify-center">
                                <Camera className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            <AuditStatusBadge status={audit.status} locale={locale} />
                          </TableCell>

                          <TableCell className="hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {new Date(audit.createdAt).toLocaleDateString('vi-VN')}
                            </span>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {audit.status === 'PENDING_REVIEW' && (
                                <Button
                                  variant="default" size="sm"
                                  className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white"
                                  onClick={() => handleReview(audit)}
                                >
                                  {t('Review', 'Duyet')}
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleReview(audit)}>
                                <Eye className="h-3.5 w-3.5" />
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
                          `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} of ${totalCount} audits`,
                          `Hien thi ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} / ${totalCount} kiem tra`
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

          {/* Merchandising Info */}
          <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Camera className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold">{t('Shelf Photo Verification', 'Xac minh Anh Trung bay')}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(
                      'Shop owners submit shelf photos to prove promotion compliance. Review and approve or reject each submission. Approved audits may qualify shops for additional incentives from manufacturers.',
                      'Chu cua hang gui anh trung bay de chung minh tuan thu chuong trinh khuyen mai. Duyet hoac tu choi moi de nghi. Cua hang qua duyet co the duoc them uu dai tu nha san xuat.'
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>

        {/* Review Dialog */}
        <AuditReviewDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          audit={selectedAudit ? {
            id: selectedAudit.id,
            shopName: selectedAudit.shop?.name,
            productName: selectedAudit.product?.name,
            promotionTitle: selectedAudit.promotion?.title,
            photoUrl: selectedAudit.photoUrl,
          } : null}
          locale={locale}
          onReviewed={handleReviewed}
        />
      </SidebarInset>
    </div>
  );
}
