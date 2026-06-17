'use client';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Package,
  AlertCircle,
  Check,
  X,
  Loader2,
  GripVertical,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

// ============================================
// Types
// ============================================

interface CategoryItem {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CategoryFormData {
  name: string;
  nameEn: string;
  slug: string;
  icon: string;
}

// ============================================
// Main Categories Page
// ============================================

export default function CategoriesPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Data
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<CategoryItem | null>(null);

  // Form state
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    nameEn: '',
    slug: '',
    icon: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Action states
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [reorderingId, setReorderingId] = useState<string | null>(null);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/categories');
      const json = await res.json();
      if (json.success) {
        setCategories(json.data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Auto-generate slug from Vietnamese name
  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  // Open create dialog
  const handleCreate = () => {
    setEditingCategory(null);
    setFormData({ name: '', nameEn: '', slug: '', icon: '' });
    setFormErrors({});
    setFormDialogOpen(true);
  };

  // Open edit dialog
  const handleEdit = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setFormData({
      name: cat.name,
      nameEn: cat.nameEn || '',
      slug: cat.slug,
      icon: cat.icon || '',
    });
    setFormErrors({});
    setFormDialogOpen(true);
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      errors.name = t('Name required (min 2 chars)', 'Tên bắt buộc (tối thiểu 2 ký tự)');
    }
    if (!formData.slug.trim() || formData.slug.trim().length < 2) {
      errors.slug = t('Slug required (min 2 chars)', 'Slug bắt buộc (tối thiểu 2 ký tự)');
    } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(formData.slug.trim())) {
      errors.slug = t(
        'Slug must be lowercase with hyphens (e.g., "gao", "dau-an")',
        'Slug phải viết thường, dùng gạch ngang (VD: "gao", "dau-an")'
      );
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const isEdit = !!editingCategory;
      const url = isEdit ? `/api/categories/${editingCategory.id}` : '/api/categories';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          nameEn: formData.nameEn.trim() || null,
          slug: formData.slug.trim(),
          icon: formData.icon.trim() || null,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setFormDialogOpen(false);
        fetchCategories();
      } else {
        if (json.error?.details?.errors) {
          const serverErrors: Record<string, string> = {};
          (json.error.details.errors as string[]).forEach((err: string) => {
            if (err.toLowerCase().includes('slug')) serverErrors.slug = err;
            else if (err.toLowerCase().includes('name')) serverErrors.name = err;
            else serverErrors._general = err;
          });
          setFormErrors(serverErrors);
        } else {
          setFormErrors({ _general: json.error?.message || t('Failed to save category', 'Không thể lưu danh mục') });
        }
      }
    } catch (err) {
      console.error('Submit error:', err);
      setFormErrors({ _general: t('Network error', 'Lỗi mạng') });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete category
  const handleDelete = (cat: CategoryItem) => {
    setDeletingCategory(cat);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingCategory) return;
    try {
      const res = await fetch(`/api/categories/${deletingCategory.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setDeleteDialogOpen(false);
        setDeletingCategory(null);
        fetchCategories();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Toggle active
  const handleToggleActive = async (cat: CategoryItem) => {
    try {
      setTogglingId(cat.id);
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_active' }),
      });
      const json = await res.json();
      if (json.success) {
        setCategories((prev) =>
          prev.map((c) => (c.id === cat.id ? { ...c, isActive: !c.isActive } : c))
        );
      }
    } catch (err) {
      console.error('Toggle error:', err);
    } finally {
      setTogglingId(null);
    }
  };

  // Reorder: move up/down
  const handleReorder = async (cat: CategoryItem, direction: 'up' | 'down') => {
    const sortedCats = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sortedCats.findIndex((c) => c.id === cat.id);
    if (
      (direction === 'up' && idx <= 0) ||
      (direction === 'down' && idx >= sortedCats.length - 1)
    ) {
      return;
    }

    const swapWith = sortedCats[direction === 'up' ? idx - 1 : idx + 1];
    const order: { id: string; sortOrder: number }[] = sortedCats.map((c, i) => ({
      id: c.id,
      sortOrder: i,
    }));

    // Swap sort orders
    const tempOrder = order[idx].sortOrder;
    order[idx].sortOrder = order[idx + (direction === 'up' ? -1 : 1)].sortOrder;
    order[idx + (direction === 'up' ? -1 : 1)].sortOrder = tempOrder;

    try {
      setReorderingId(cat.id);
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', order }),
      });
      const json = await res.json();
      if (json.success) {
        fetchCategories();
      }
    } catch (err) {
      console.error('Reorder error:', err);
    } finally {
      setReorderingId(null);
    }
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
                {t('Categories', 'Danh mục')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {t('Organize products into categories for better browsing', 'Sắp xếp sản phẩm vào danh mục để dễ duyệt')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchCategories}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {t('Refresh', 'Làm mới')}
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('Add Category', 'Thêm danh mục')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Categories List */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-red-600" />
                  {t('All Categories', 'Tất cả danh mục')}
                </CardTitle>
                <Badge variant="outline" className="font-mono">
                  {categories.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : categories.length === 0 ? (
                /* Empty State */
                <div className="text-center py-16 px-4">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <FolderOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {t('No categories yet', 'Chưa có danh mục')}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                    {t(
                      'Create your first category to organize products in the catalog.',
                      'Tạo danh mục đầu tiên để sắp xếp sản phẩm trong danh mục.'
                    )}
                  </p>
                  <Button
                    className="mt-4 bg-red-600 hover:bg-red-700 text-white"
                    onClick={handleCreate}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t('Create First Category', 'Tạo danh mục đầu tiên')}
                  </Button>
                </div>
              ) : (
                /* Categories List */
                <div className="space-y-2">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors ${
                        !cat.isActive ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Icon */}
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        {cat.icon ? (
                          <span className="text-xl">{cat.icon}</span>
                        ) : (
                          <FolderOpen className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold truncate">
                            {locale === 'vi' ? cat.name : (cat.nameEn || cat.name)}
                          </h3>
                          {cat.nameEn && locale === 'vi' && (
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              ({cat.nameEn})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-[11px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {cat.slug}
                          </code>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-medium">
                            <Package className="h-2.5 w-2.5 mr-1" />
                            {cat.productCount} {t('products', 'SP')}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                            #{cat.sortOrder}
                          </Badge>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Reorder Up */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={reorderingId === cat.id}
                          onClick={() => handleReorder(cat, 'up')}
                          title={t('Move up', 'Di chuyển lên')}
                        >
                          {reorderingId === cat.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ChevronUp className="h-3.5 w-3.5" />
                          )}
                        </Button>

                        {/* Reorder Down */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={reorderingId === cat.id}
                          onClick={() => handleReorder(cat, 'down')}
                          title={t('Move down', 'Di chuyển xuống')}
                        >
                          {reorderingId === cat.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>

                        {/* Active Toggle */}
                        <div className="flex items-center px-1">
                          <Switch
                            checked={cat.isActive}
                            onCheckedChange={() => handleToggleActive(cat)}
                            disabled={togglingId === cat.id}
                            className="data-[state=checked]:bg-red-600"
                          />
                        </div>

                        {/* Edit */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-muted"
                          onClick={() => handleEdit(cat)}
                          title={t('Edit', 'Sửa')}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-red-50 hover:text-red-600"
                          onClick={() => handleDelete(cat)}
                          title={t('Delete', 'Xóa')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-yellow-50 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                  <FolderOpen className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {t('Category Management Tips', 'Mẹo quản lý danh mục')}
                  </p>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                    <li>
                      {t(
                        'Use the up/down arrows to change display order in the product catalog.',
                        'Dùng mũi tên lên/xuống để thay đổi thứ tự hiển thị trong danh mục SP.'
                      )}
                    </li>
                    <li>
                      {t(
                        'Deactivate a category to hide it from the catalog without deleting.',
                        'Vô hiệu hóa danh mục để ẩn khỏi danh mục mà không cần xóa.'
                      )}
                    </li>
                    <li>
                      {t(
                        'Categories with products cannot be deleted. Reassign products first.',
                        'Danh mục có sản phẩm không thể bị xóa. Hãy chuyển sản phẩm sang danh mục khác trước.'
                      )}
                    </li>
                    <li>
                      {t(
                        'Slug is used in URLs. Keep it short and lowercase (e.g., "gao", "dau-an").',
                        'Slug dùng trong URL. Giữ ngắn và viết thường (VD: "gao", "dau-an").'
                      )}
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>

        {/* Create/Edit Dialog */}
        <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-red-600" />
                {editingCategory
                  ? t('Edit Category', 'Chỉnh sửa danh mục')
                  : t('Create Category', 'Tạo danh mục')}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? t('Update category details', 'Cập nhật thông tin danh mục')
                  : t('Add a new product category', 'Thêm danh mục sản phẩm mới')}
              </DialogDescription>
            </DialogHeader>

            {/* General Error */}
            {formErrors._general && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {formErrors._general}
              </div>
            )}

            <div className="grid gap-4 py-2">
              {/* Icon */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {t('Icon (Emoji)', 'Biểu tượng (Emoji)')}
                </label>
                <div className="flex gap-2 items-center">
                  <div className="h-10 w-10 rounded-lg border flex items-center justify-center text-xl bg-muted/50 shrink-0">
                    {formData.icon || '📦'}
                  </div>
                  <Input
                    placeholder={t('e.g., 🍚, 🥤, 🧴', 'VD: 🍚, 🥤, 🧴')}
                    value={formData.icon}
                    onChange={(e) => setFormData((prev) => ({ ...prev, icon: e.target.value }))}
                  />
                </div>
              </div>

              {/* Name (VI) */}
              <div className="space-y-2">
                <label htmlFor="cat-name" className="text-sm font-medium">
                  {t('Name (Vietnamese)', 'Tên (Tiếng Việt)')} <span className="text-red-500">*</span>
                </label>
                <Input
                  id="cat-name"
                  placeholder={t('e.g., Gạo', 'VD: Gạo')}
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      name,
                      // Auto-generate slug if creating or slug hasn't been manually edited
                      slug: !editingCategory ? generateSlug(name) : prev.slug,
                    }));
                    if (formErrors.name) setFormErrors((prev) => { const n = { ...prev }; delete n.name; return n; });
                  }}
                  className={formErrors.name ? 'border-red-300' : ''}
                />
                {formErrors.name && <p className="text-xs text-red-500">{formErrors.name}</p>}
              </div>

              {/* Name (EN) */}
              <div className="space-y-2">
                <label htmlFor="cat-name-en" className="text-sm font-medium">
                  {t('Name (English)', 'Tên (Tiếng Anh)')}
                </label>
                <Input
                  id="cat-name-en"
                  placeholder={t('e.g., Rice', 'VD: Rice')}
                  value={formData.nameEn}
                  onChange={(e) => setFormData((prev) => ({ ...prev, nameEn: e.target.value }))}
                />
              </div>

              {/* Slug */}
              <div className="space-y-2">
                <label htmlFor="cat-slug" className="text-sm font-medium">
                  Slug <span className="text-red-500">*</span>
                </label>
                <Input
                  id="cat-slug"
                  placeholder={t('e.g., gao, dau-an', 'VD: gao, dau-an')}
                  value={formData.slug}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, slug: e.target.value }));
                    if (formErrors.slug) setFormErrors((prev) => { const n = { ...prev }; delete n.slug; return n; });
                  }}
                  className={`font-mono text-sm ${formErrors.slug ? 'border-red-300' : ''}`}
                />
                {formErrors.slug && <p className="text-xs text-red-500">{formErrors.slug}</p>}
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    'Used in URLs. Lowercase, hyphens only. Auto-generated from Vietnamese name.',
                    'Dùng trong URL. Chữ thường, chỉ dùng gạch ngang. Tự động tạo từ tên tiếng Việt.'
                  )}
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setFormDialogOpen(false)} disabled={submitting}>
                {t('Cancel', 'Hủy')}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {submitting
                  ? t('Saving...', 'Đang lưu...')
                  : editingCategory
                    ? t('Update', 'Cập nhật')
                    : t('Create', 'Tạo')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('Delete Category', 'Xóa danh mục')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deletingCategory && (
                  <>
                    {t(
                      `Are you sure you want to delete "${deletingCategory.name}"?`,
                      `Bạn có chắc muốn xóa "${deletingCategory.name}"?`
                    )}
                    {deletingCategory.productCount > 0 && (
                      <>
                        <br />
                        <br />
                        <span className="text-amber-600 font-medium flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {t(
                            `This category has ${deletingCategory.productCount} product(s). Deletion will be blocked. Reassign products first.`,
                            `Danh mục này có ${deletingCategory.productCount} sản phẩm. Việc xóa sẽ bị từ chối. Hãy chuyển sản phẩm sang danh mục khác trước.`
                          )}
                        </span>
                      </>
                    )}
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('Cancel', 'Hủy')}</AlertDialogCancel>
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
