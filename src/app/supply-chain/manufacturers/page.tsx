'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Factory,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit,
  Trash2,
  Package,
  Tag,
  Phone,
  Mail,
  MapPin,
  RotateCcw,
  Percent,
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
import { ManufacturerFormDialog } from '@/components/supply-chain/supply-chain-forms';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

interface ManufacturerListItem {
  id: string;
  name: string;
  nameEn: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  email: string | null;
  address: string | null;
  province: string | null;
  commissionRate: number;
  createdAt: string;
  _count: { products: number; promotions: number };
}

interface ManufacturersResponse {
  items: ManufacturerListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

// ============================================
// Main Manufacturers Page
// ============================================

export default function ManufacturersPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data state
  const [manufacturers, setManufacturers] = useState<ManufacturerListItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 20;

  // Dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedManufacturer, setSelectedManufacturer] = useState<ManufacturerListItem | null>(null);
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

  // Fetch manufacturers
  const fetchManufacturers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: String(limit), search: debouncedSearch });
      const res = await adminFetch(`/api/manufacturers?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        const data: ManufacturersResponse = json.data;
        setManufacturers(data.items || []);
        setTotalPages(data.pagination.totalPages);
        setTotalCount(data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch manufacturers:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, limit]);

  useEffect(() => { fetchManufacturers(); }, [fetchManufacturers]);

  // Handlers
  const handleCreate = () => {
    setSelectedManufacturer(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (mfg: ManufacturerListItem) => {
    // Need full data for edit — fetch detail
    setSelectedManufacturer(mfg);
    setFormDialogOpen(true);
  };

  const handleDelete = (mfg: ManufacturerListItem) => {
    setSelectedManufacturer(mfg);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedManufacturer) return;
    try {
      setDeleting(true);
      const res = await adminFetch(`/api/manufacturers/${selectedManufacturer.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(t('Manufacturer deleted', 'Xoa nha san xuat thanh cong'));
        setDeleteDialogOpen(false);
        setSelectedManufacturer(null);
        fetchManufacturers();
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

  const handleSaved = () => {
    fetchManufacturers();
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

  // Summary stats
  const totalProducts = manufacturers.reduce((sum, m) => sum + m._count.products, 0);
  const totalPromotions = manufacturers.reduce((sum, m) => sum + m._count.promotions, 0);

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
                {t('Manufacturers', 'Nha san xuat')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Manage product manufacturers, commissions, and supplier relationships', 'Quan ly nha san xuat, hoa hong va moi quan he nha cung ung')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchManufacturers}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Lam moi')}
              </Button>
              <Button size="sm" onClick={handleCreate} className="bg-red-600 hover:bg-red-700 text-white">
                <Plus className="h-4 w-4 mr-1" />
                {t('Add Manufacturer', 'Them nha SX')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Total Manufacturers', 'Tong nha SX')}</p>
                    <p className="text-xl font-bold mt-1">{totalCount}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-yellow-50 text-red-600 flex items-center justify-center">
                    <Factory className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Total Products', 'Tong san pham')}</p>
                    <p className="text-xl font-bold mt-1">{totalProducts}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Package className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t('Active Promotions', 'Khuyen mai hoat dong')}</p>
                    <p className="text-xl font-bold mt-1">{totalPromotions}</p>
                  </div>
                  <div className="h-9 w-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                    <Tag className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={t('Search by name, contact, province...', 'Tim theo ten, nguoi LH, tinh...')}
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                {debouncedSearch && (
                  <Button variant="ghost" size="sm" className="h-9" onClick={() => setSearchQuery('')}>
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
              ) : manufacturers.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Factory className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">{t('No manufacturers found', 'Khong tim thay nha san xuat')}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('Add your first manufacturer to get started', 'Them nha san xuat dau tien de bat dau')}
                  </p>
                  <Button className="mt-4 bg-red-600 hover:bg-red-700 text-white" onClick={handleCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('Add First Manufacturer', 'Them nha SX dau tien')}
                  </Button>
                </div>
              ) : (
                <div className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>{t('Manufacturer', 'Nha san xuat')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Contact', 'Lien he')}</TableHead>
                        <TableHead className="hidden sm:table-cell">{t('Commission', 'Hoa hong')}</TableHead>
                        <TableHead className="hidden lg:table-cell text-center">{t('Products', 'SP')}</TableHead>
                        <TableHead className="hidden lg:table-cell text-center">{t('Promos', 'KM')}</TableHead>
                        <TableHead className="hidden xl:table-cell">{t('Province', 'Tinh')}</TableHead>
                        <TableHead className="text-right">{t('Actions', 'TH')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {manufacturers.map((mfg) => (
                        <TableRow key={mfg.id} className="hover:bg-muted/50 transition-colors">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-yellow-50 text-red-600 flex items-center justify-center shrink-0">
                                <Factory className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{mfg.name}</p>
                                {mfg.nameEn && (
                                  <p className="text-[10px] text-muted-foreground">{mfg.nameEn}</p>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="hidden md:table-cell">
                            <div className="space-y-0.5">
                              {mfg.contactPerson && (
                                <p className="text-xs">{mfg.contactPerson}</p>
                              )}
                              {mfg.contactPhone && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  <SensitiveValue value={mfg.contactPhone} maskType="phone" />
                                </p>
                              )}
                              {mfg.email && (
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  <SensitiveValue value={mfg.email} maskType="email" />
                                </p>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-50 text-xs">
                              <Percent className="h-3 w-3 mr-1" />
                              {(mfg.commissionRate * 100).toFixed(1)}%
                            </Badge>
                          </TableCell>

                          <TableCell className="hidden lg:table-cell text-center">
                            <span className="text-sm font-medium">{mfg._count.products}</span>
                          </TableCell>

                          <TableCell className="hidden lg:table-cell text-center">
                            <span className="text-sm">{mfg._count.promotions}</span>
                          </TableCell>

                          <TableCell className="hidden xl:table-cell">
                            {mfg.province && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {mfg.province}
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => handleEdit(mfg)}>
                                <Edit className="h-3.5 w-3.5 mr-1" />
                                {t('Edit', 'Sua')}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8 text-xs text-red-600 hover:text-red-700" onClick={() => handleDelete(mfg)}>
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
                          `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} of ${totalCount} manufacturers`,
                          `Hien thi ${(page - 1) * limit + 1}–${Math.min(page * limit, totalCount)} / ${totalCount} nha SX`
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
        <ManufacturerFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          manufacturer={selectedManufacturer}
          locale={locale}
          onSaved={handleSaved}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                {t('Delete Manufacturer', 'Xoa nha san xuat')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(
                  `Are you sure you want to delete "${selectedManufacturer?.name || ''}"? This action cannot be undone.`,
                  `Ban co chac chan muon xoa "${selectedManufacturer?.name || ''}"? Hanh dong nay khong the hoan tac.`
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded p-3">
              {t(
                `This manufacturer has ${selectedManufacturer?._count.products || 0} product(s). You must unlink all products before deleting.`,
                `Nha san xuat nay co ${selectedManufacturer?._count.products || 0} san pham. Ban phai ngat lien ket truoc khi xoa.`
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
