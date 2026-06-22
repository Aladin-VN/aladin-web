'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Warehouse,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit,
  Trash2,
  Package,
  Phone,
  Mail,
  MapPin,
  RotateCcw,
  MapPinned,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Separator } from '@/components/ui/separator';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { DistributorFormDialog } from '@/components/supply-chain/supply-chain-forms';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

interface DistributorListItem {
  id: string;
  name: string;
  nameEn: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  email: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  isActive: boolean;
  createdAt: string;
  commissionRate: number;
  deliveryFeeShare: number;
  bankName: string | null;
  bankAccount: string | null;
  bankHolder: string | null;
  taxId: string | null;
  _count: { products: number };
}

interface DistributorsResponse {
  items: DistributorListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ============================================
// Main Distributors Page
// ============================================

export default function DistributorsPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data state
  const [distributors, setDistributors] = useState<DistributorListItem[]>([]);
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
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState<DistributorListItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  // Fetch distributors
  const fetchDistributors = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(limit), search: debouncedSearch });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await adminFetch(`/api/distributors?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        const data: DistributorsResponse = json.data;
        setDistributors(data.items || []);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch distributors:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, limit]);

  useEffect(() => { fetchDistributors(); }, [fetchDistributors]);

  // Handlers
  const handleCreate = () => {
    setSelectedDistributor(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (dist: DistributorListItem) => {
    setSelectedDistributor(dist);
    setFormDialogOpen(true);
  };

  const handleDelete = (dist: DistributorListItem) => {
    setSelectedDistributor(dist);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedDistributor) return;
    try {
      setDeleting(true);
      const res = await adminFetch(`/api/distributors/${selectedDistributor.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(t('Distributor deleted', 'Xoa nha phan phoi thanh cong'));
        setDeleteDialogOpen(false);
        setSelectedDistributor(null);
        fetchDistributors();
      } else {
        toast.error(json.error?.message || t('Failed to delete', 'Khong the xoa'));
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setDeleting(false);
    }
  };

  const toggleActive = async (dist: DistributorListItem) => {
    try {
      const res = await adminFetch(`/api/distributors/${dist.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !dist.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(dist.isActive
          ? t('Distributor deactivated', 'Ngung hoat dong nha phan phoi')
          : t('Distributor activated', 'Kich hoat nha phan phoi')
        );
        fetchDistributors();
      } else {
        toast.error(json.error?.message || t('Failed to update', 'Khong the cap nhat'));
      }
    } catch (err) {
      console.error('Toggle active error:', err);
    }
  };

  const handleSaved = () => { fetchDistributors(); };

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const activeCount = distributors.filter((d) => d.isActive).length;
  const hasCoords = distributors.filter((d) => d.lat !== null && d.lng !== null).length;
  const totalProducts = distributors.reduce((sum, d) => sum + d._count.products, 0);

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
                {t('Distributors', 'Nha phan phoi')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Manage distribution network, coordinates, and smart sourcing', 'Quan ly mang phan phoi, toa do va tim nguon thong minh')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchDistributors}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Lam moi')}
              </Button>
              <Button size="sm" onClick={handleCreate} className="bg-red-600 hover:bg-red-700 text-white">
                <Plus className="h-4 w-4 mr-1" />
                {t('Add Distributor', 'Them nha PP')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Total Distributors', 'Tong nha PP')}</p>
                    <p className="text-xl font-bold mt-1">{totalCount}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-yellow-50 text-red-600 flex items-center justify-center">
                    <Warehouse className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Active', 'Hoat dong')}</p>
                    <p className="text-xl font-bold mt-1 text-red-600">{activeCount}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <MapPinned className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('With Coordinates', 'Co toa do')}</p>
                    <p className="text-xl font-bold mt-1">{hasCoords}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                    <MapPin className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Total Products', 'Tong SP')}</p>
                    <p className="text-xl font-bold mt-1">{totalProducts}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Package className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Smart Sourcing Info Banner */}
          <Card className="border-yellow-100 bg-yellow-50/50 dark:border-red-900 dark:bg-emerald-950/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-yellow-100 text-red-700 flex items-center justify-center shrink-0">
                  <MapPinned className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-red-700 dark:text-yellow-500">
                    {t('Smart Sourcing', 'Tim nguon thong minh')}
                  </h4>
                  <p className="text-xs text-red-600/80 dark:text-yellow-500/80 mt-0.5">
                    {t(
                      'AI auto-selects optimal distributor based on margin + logistics cost. Add latitude/longitude to distributor profiles to enable distance-based routing.',
                      'AI tu dong chon NPP toi uu dua tren lai nhuong + chi phi van chuyen. Them vi do/kinh do vao ho so NPP de bat dau tuyen duong theo khoang cach.'
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Search + Filter */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={t('Search by name, contact, address...', 'Tim theo ten, nguoi LH, dia chi...')}
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[140px] h-9">
                    <SelectValue placeholder={t('Status', 'Trang thai')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('All', 'Tat ca')}</SelectItem>
                    <SelectItem value="active">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500" />
                        {t('Active', 'Hoat dong')}
                      </span>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-gray-400" />
                        {t('Inactive', 'Ngung hoat dong')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {(debouncedSearch || statusFilter !== 'all') && (
                  <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}>
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
              ) : distributors.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Warehouse className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">{t('No distributors found', 'Khong tim thay nha phan phoi')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('Add your first distributor to build the supply chain', 'Them nha phan phoi dau tien de xay dung chuoi cung ung')}
                  </p>
                  <Button className="mt-4 bg-red-600 hover:bg-red-700 text-white" onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('Add First Distributor', 'Them nha PP dau tien')}
                  </Button>
                </div>
              ) : (
                <div className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>{t('Distributor', 'Nha phan phoi')}</TableHead>
                        <TableHead>{t('Status', 'TT')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Contact', 'Lien he')}</TableHead>
                        <TableHead className="hidden sm:table-cell text-center">{t('Products', 'SP')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('Location', 'Vi tri')}</TableHead>
                        <TableHead className="hidden xl:table-cell">{t('Coordinates', 'Toa do')}</TableHead>
                        <TableHead className="text-right">{t('Actions', 'TH')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {distributors.map((dist) => (
                        <TableRow key={dist.id} className={`hover:bg-muted/50 transition-colors ${!dist.isActive ? 'opacity-60' : ''}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                                dist.isActive
                                  ? 'bg-yellow-50 text-red-600'
                                  : 'bg-gray-100 text-gray-400'
                              }`}>
                                <Warehouse className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{dist.name}</p>
                                {dist.nameEn && (
                                  <p className="text-[10px] text-muted-foreground">{dist.nameEn}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="secondary" className={
                              dist.isActive
                                ? 'bg-yellow-50 text-red-700 hover:bg-yellow-50 text-[10px]'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-100 text-[10px]'
                            }>
                              {dist.isActive ? t('Active', 'HD') : t('Inactive', 'Ngung')}
                            </Badge>
                          </TableCell>

                          <TableCell className="hidden md:table-cell">
                            <div className="space-y-0.5">
                              {dist.contactPerson && (
                                <p className="text-xs">{dist.contactPerson}</p>
                              )}
                              {dist.contactPhone && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  <SensitiveValue value={dist.contactPhone} maskType="phone" />
                                </p>
                              )}
                              {dist.email && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  <SensitiveValue value={dist.email} maskType="email" />
                                </p>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="hidden sm:table-cell text-center">
                            <span className="text-sm font-medium">{dist._count.products}</span>
                          </TableCell>

                          <TableCell className="hidden lg:table-cell">
                            {dist.address ? (
                              <span className="text-xs text-muted-foreground flex items-center gap-1 max-w-[200px] truncate">
                                <MapPin className="h-3 w-3 shrink-0" />
                                {dist.address}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell className="hidden xl:table-cell">
                            {dist.lat !== null && dist.lng !== null ? (
                              <span className="text-xs font-mono text-muted-foreground">
                                {dist.lat.toFixed(4)}, {dist.lng.toFixed(4)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {t('Not set', 'Chua dat')}
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-8 text-xs"
                                onClick={() => toggleActive(dist)}
                                title={dist.isActive ? t('Deactivate', 'Ngung HD') : t('Activate', 'Kich hoat')}>
                                {(dist.isActive
                                  ? <span key="on" className="h-3.5 w-3.5 rounded-full bg-red-500 inline-block" />
                                  : <span key="off" className="h-3.5 w-3.5 rounded-full bg-gray-300 inline-block" />
                                )}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleEdit(dist)}>
                                <Edit className="h-3.5 w-3.5 mr-1" />
                                {t('Edit', 'Sua')}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700" onClick={() => handleDelete(dist)}>
                                <Trash2 className="h-3.5 w-3.5" />
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
                          `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} of ${totalCount} distributors`,
                          `Hien thi ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} / ${totalCount} nha PP`
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
        </main>

        {/* Form Dialog */}
        <DistributorFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          distributor={selectedDistributor}
          locale={locale}
          onSaved={handleSaved}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                {t('Delete Distributor', 'Xoa nha phan phoi')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  `Are you sure you want to delete "${selectedDistributor?.name || ''}"? This action cannot be undone.`,
                  `Ban co chac chan muon xoa "${selectedDistributor?.name || ''}"? Hanh dong nay khong the hoan tac.`
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded p-3">
              {t(
                `This distributor has ${selectedDistributor?._count.products || 0} product(s). You must unlink all products before deleting.`,
                `Nha phan phoi nay co ${selectedDistributor?._count.products || 0} san pham. Ban phai ngat lien ket truoc khi xoa.`
              )}
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>{t('Cancel', 'Huy')}</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white">
                {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {t('Delete', 'Xoa')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </div>
  );
}
