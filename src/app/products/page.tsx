'use client';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  PackageX,
  BarChart3,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
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
import { formatVND } from '@/lib/security';
import { ProductFormDialog, type ProductEditData } from '@/components/products/product-form-dialog';

// ============================================
// Types
// ============================================

interface Category {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  icon: string | null;
  productCount?: number;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  nameEn: string | null;
  categoryId: string;
  category: { id: string; name: string; nameEn: string | null; slug: string; icon: string | null };
  brand: string | null;
  unit: string;
  unitEn: string | null;
  basePrice: number;
  groupBuyPrice: number | null;
  stockQuantity: number;
  minOrderQty: number;
  maxOrderQty: number | null;
  weightKg: number | null;
  imageUrl: string | null;
  isActive: boolean;
  isPrivateLabel: boolean;
  barcode: string | null;
  manufacturer: { id: string; name: string } | null;
  distributor: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface ProductsResponse {
  items: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters: {
    categories: { categoryId: string; count: number }[];
    brands: string[];
  };
}

interface ProductStats {
  total: number;
  active: number;
  lowStock: number;
  outOfStock: number;
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'lowStock' | 'outOfStock';

// ============================================
// Stock Badge Component
// ============================================

function StockBadge({ quantity }: { quantity: number }) {
  if (quantity === 0) {
    return (
      <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100 text-[11px] font-medium px-2 py-0.5">
        0
      </Badge>
    );
  }
  if (quantity <= 50) {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[11px] font-medium px-2 py-0.5">
        {quantity}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-yellow-50 text-red-700 hover:bg-yellow-50 text-[11px] font-medium px-2 py-0.5">
      {quantity}
    </Badge>
  );
}

// ============================================
// Stat Card
// ============================================

function StatCardMini({
  title,
  titleVi,
  value,
  icon,
  variant = 'default',
  locale,
}: {
  title: string;
  titleVi: string;
  value: number;
  icon: React.ReactNode;
  variant?: 'default' | 'warning' | 'danger' | 'success';
  locale: string;
}) {
  const label = locale === 'vi' ? titleVi : title;

  return (
    <Card className={
      variant === 'danger' ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/30' :
      variant === 'warning' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30' :
      variant === 'success' ? 'border-yellow-100 bg-yellow-50/50 dark:border-red-900 dark:bg-emerald-950/30' :
      ''
    }>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-xl font-bold mt-1">{value.toLocaleString()}</p>
          </div>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
            variant === 'danger' ? 'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400' :
            variant === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400' :
            variant === 'success' ? 'bg-yellow-50 text-red-600 dark:bg-red-900/50 dark:text-yellow-500' :
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
// Main Products Page
// ============================================

export default function ProductsPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProductStats>({ total: 0, active: 0, lowStock: 0, outOfStock: 0 });

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const limit = 20;

  // Dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductEditData | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      const json = await res.json();
      if (json.success) {
        setCategories(json.data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
      });

      if (categoryFilter !== 'all') {
        params.set('categoryId', categoryFilter);
      }

      if (statusFilter === 'active') params.set('isActive', 'true');
      else if (statusFilter === 'inactive') params.set('isActive', 'false');
      else if (statusFilter === 'lowStock') params.set('lowStock', 'true');
      else if (statusFilter === 'outOfStock') params.set('outOfStock', 'true');

      const res = await fetch(`/api/products?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        const data: ProductsResponse = json.data;
        setProducts(data.items || []);
        setTotalPages(data.pagination.totalPages);
        setTotalProducts(data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, categoryFilter, statusFilter, limit]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const [allRes, activeRes, lowRes, outRes] = await Promise.all([
        fetch('/api/products?limit=1'),
        fetch('/api/products?isActive=true&limit=1'),
        fetch('/api/products?lowStock=true&limit=1'),
        fetch('/api/products?outOfStock=true&limit=1'),
      ]);
      const [allJson, activeJson, lowJson, outJson] = await Promise.all([
        allRes.json(),
        activeRes.json(),
        lowRes.json(),
        outRes.json(),
      ]);
      setStats({
        total: allJson.success ? allJson.data.pagination.total : 0,
        active: activeJson.success ? activeJson.data.pagination.total : 0,
        lowStock: lowJson.success ? lowJson.data.pagination.total : 0,
        outOfStock: outJson.success ? outJson.data.pagination.total : 0,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchCategories();
    fetchStats();
  }, [fetchCategories, fetchStats]);

  // Re-fetch on filter/page change
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handlers
  const handleCreate = () => {
    setEditingProduct(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct({
      id: product.id,
      sku: product.sku,
      name: product.name,
      nameEn: product.nameEn,
      description: (product as Record<string, unknown>).description as string | null || null,
      descriptionEn: (product as Record<string, unknown>).descriptionEn as string | null || null,
      categoryId: product.categoryId,
      brand: product.brand,
      unit: product.unit,
      unitEn: product.unitEn,
      basePrice: product.basePrice,
      groupBuyPrice: product.groupBuyPrice,
      stockQuantity: product.stockQuantity,
      minOrderQty: product.minOrderQty,
      maxOrderQty: product.maxOrderQty,
      weightKg: product.weightKg,
      barcode: product.barcode,
      manufacturerId: product.manufacturer?.id || null,
      distributorId: product.distributor?.id || null,
      isPrivateLabel: product.isPrivateLabel,
      isActive: product.isActive,
    });
    setFormDialogOpen(true);
  };

  const handleDelete = (product: Product) => {
    setDeletingProduct(product);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingProduct) return;
    try {
      const res = await fetch(`/api/products/${deletingProduct.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setDeleteDialogOpen(false);
        setDeletingProduct(null);
        fetchProducts();
        fetchStats();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      setTogglingId(product.id);
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_active' }),
      });
      const json = await res.json();
      if (json.success) {
        // Optimistic update
        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id ? { ...p, isActive: !p.isActive } : p
          )
        );
        fetchStats();
      }
    } catch (err) {
      console.error('Toggle error:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleSaved = () => {
    fetchProducts();
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
                {t('Products', 'Sản phẩm')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Manage product catalog and inventory', 'Quản lý danh mục sản phẩm và tồn kho')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { fetchProducts(); fetchStats(); }}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Làm mới')}
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('Add Product', 'Thêm SP')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCardMini
              title="Total Products"
              titleVi="Tổng sản phẩm"
              value={stats.total}
              icon={<Package className="h-4 w-4" />}
              variant="default"
              locale={locale}
            />
            <StatCardMini
              title="Active"
              titleVi="Đang bán"
              value={stats.active}
              icon={<Check className="h-4 w-4" />}
              variant="success"
              locale={locale}
            />
            <StatCardMini
              title="Low Stock"
              titleVi="Sắp hết hàng"
              value={stats.lowStock}
              icon={<AlertTriangle className="h-4 w-4" />}
              variant="warning"
              locale={locale}
            />
            <StatCardMini
              title="Out of Stock"
              titleVi="Hết hàng"
              value={stats.outOfStock}
              icon={<PackageX className="h-4 w-4" />}
              variant="danger"
              locale={locale}
            />
          </div>

          {/* Filters Bar */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder={t('Search by name, SKU, brand, barcode...', 'Tìm theo tên, SKU, thương hiệu, mã vạch...')}
                    className="pl-8 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Category Filter */}
                <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setPage(1); }}>
                  <SelectTrigger className="w-full sm:w-[200px] h-9">
                    <SelectValue placeholder={t('All Categories', 'Tất cả danh mục')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('All Categories', 'Tất cả danh mục')}
                    </SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          {cat.icon && <span>{cat.icon}</span>}
                          {locale === 'vi' ? cat.name : (cat.nameEn || cat.name)}
                          {cat.productCount !== undefined && (
                            <Badge variant="outline" className="text-[10px] ml-1 px-1 py-0">
                              {cat.productCount}
                            </Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select
                  value={statusFilter}
                  onValueChange={(val) => { setStatusFilter(val as StatusFilter); setPage(1); }}
                >
                  <SelectTrigger className="w-full sm:w-[170px] h-9">
                    <SelectValue placeholder={t('All Status', 'Tất cả trạng thái')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('All Status', 'Tất cả trạng thái')}
                    </SelectItem>
                    <SelectItem value="active">
                      {t('Active', 'Đang bán')}
                    </SelectItem>
                    <SelectItem value="inactive">
                      {t('Inactive', 'Ngừng bán')}
                    </SelectItem>
                    <SelectItem value="lowStock">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                        {t('Low Stock', 'Sắp hết hàng')}
                      </span>
                    </SelectItem>
                    <SelectItem value="outOfStock">
                      <span className="flex items-center gap-1">
                        <PackageX className="h-3 w-3 text-red-500" />
                        {t('Out of Stock', 'Hết hàng')}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Products Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-10 w-full" />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : products.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {t('No products found', 'Không tìm thấy sản phẩm')}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    {debouncedSearch || categoryFilter !== 'all' || statusFilter !== 'all'
                      ? t(
                          'Try adjusting your search or filters to find what you are looking for.',
                          'Thử thay đổi tìm kiếm hoặc bộ lọc để tìm sản phẩm.'
                        )
                      : t(
                          'Get started by adding your first product to the catalog.',
                          'Bắt đầu bằng cách thêm sản phẩm đầu tiên vào danh mục.'
                        )}
                  </p>
                  {!debouncedSearch && categoryFilter === 'all' && statusFilter === 'all' && (
                    <Button
                      className="mt-4 bg-red-600 hover:bg-red-700 text-white"
                      onClick={handleCreate}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {t('Add Your First Product', 'Thêm sản phẩm đầu tiên')}
                    </Button>
                  )}
                </div>
              ) : (
                <div>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-[100px]">{t('SKU', 'Mã SP')}</TableHead>
                        <TableHead>{t('Product Name', 'Tên sản phẩm')}</TableHead>
                        <TableHead className="hidden md:table-cell">{t('Category', 'Danh mục')}</TableHead>
                        <TableHead className="hidden lg:table-cell">{t('Brand', 'TH')}</TableHead>
                        <TableHead className="text-right">{t('Price', 'Giá')}</TableHead>
                        <TableHead className="text-right hidden sm:table-cell">{t('Group Buy', 'Mua chung')}</TableHead>
                        <TableHead className="text-center">{t('Stock', 'Tồn kho')}</TableHead>
                        <TableHead className="hidden lg:table-cell text-center">{t('Label', 'Nhãn')}</TableHead>
                        <TableHead className="text-center">{t('Status', 'TT')}</TableHead>
                        <TableHead className="text-right">{t('Actions', 'TH')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id} className={!product.isActive ? 'opacity-60' : ''}>
                          {/* SKU */}
                          <TableCell className="font-mono text-xs font-medium">
                            {product.sku}
                          </TableCell>

                          {/* Name */}
                          <TableCell>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate max-w-[200px]">
                                {locale === 'vi' ? product.name : (product.nameEn || product.name)}
                              </p>
                              {locale === 'en' && product.nameEn && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {product.name}
                                </p>
                              )}
                              {product.barcode && (
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  {product.barcode}
                                </p>
                              )}
                            </div>
                          </TableCell>

                          {/* Category */}
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-1.5">
                              {product.category.icon && (
                                <span className="text-sm">{product.category.icon}</span>
                              )}
                              <span className="text-xs">
                                {locale === 'vi' ? product.category.name : (product.category.nameEn || product.category.name)}
                              </span>
                            </div>
                          </TableCell>

                          {/* Brand */}
                          <TableCell className="hidden lg:table-cell">
                            {product.brand ? (
                              <span className="text-xs text-muted-foreground">{product.brand}</span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            )}
                          </TableCell>

                          {/* Price */}
                          <TableCell className="text-right">
                            <span className="text-sm font-semibold">
                              {formatVND(product.basePrice)}
                            </span>
                          </TableCell>

                          {/* Group Buy Price */}
                          <TableCell className="text-right hidden sm:table-cell">
                            {product.groupBuyPrice ? (
                              <span className="text-sm text-red-600 font-medium">
                                {formatVND(product.groupBuyPrice)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            )}
                          </TableCell>

                          {/* Stock */}
                          <TableCell className="text-center">
                            <StockBadge quantity={product.stockQuantity} />
                          </TableCell>

                          {/* Private Label */}
                          <TableCell className="hidden lg:table-cell text-center">
                            {product.isPrivateLabel ? (
                              <Badge variant="secondary" className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px] font-medium px-1.5 py-0.5">
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                PL
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </TableCell>

                          {/* Status Toggle */}
                          <TableCell className="text-center">
                            <Switch
                              checked={product.isActive}
                              onCheckedChange={() => handleToggleActive(product)}
                              disabled={togglingId === product.id}
                              className="data-[state=checked]:bg-red-600"
                            />
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-muted"
                                onClick={() => handleEdit(product)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                                onClick={() => handleDelete(product)}
                              >
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
                          `Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, totalProducts)} of ${totalProducts} products`,
                          `Hiển thị ${(page - 1) * limit + 1}–${Math.min(page * limit, totalProducts)} / ${totalProducts} sản phẩm`
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
                            className={`h-8 w-8 text-xs ${p === page ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
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

        {/* Product Form Dialog */}
        <ProductFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          editProduct={editingProduct}
          locale={locale}
          onSaved={handleSaved}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('Delete Product', 'Xóa sản phẩm')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deletingProduct && (
                  <>
                    {t(
                      `Are you sure you want to delete "${deletingProduct.name}" (${deletingProduct.sku})?`,
                      `Bạn có chắc muốn xóa "${deletingProduct.name}" (${deletingProduct.sku})?`
                    )}
                    <br />
                    <br />
                    <span className="text-amber-600 font-medium">
                      {t(
                        'This action cannot be undone. If the product has active orders, deletion will be blocked.',
                        'Hành động này không thể hoàn tác. Nếu sản phẩm có đơn hàng đang xử lý, việc xóa sẽ bị từ chối.'
                      )}
                    </span>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>
                {t('Cancel', 'Hủy')}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {t('Delete', 'Xóa')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SidebarInset>
    </div>
  );
}
