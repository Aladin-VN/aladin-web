'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatVND } from '@/lib/security';
import { Package, AlertCircle, Loader2 } from 'lucide-react';

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

interface Manufacturer {
  id: string;
  name: string;
}

interface Distributor {
  id: string;
  name: string;
}

export interface ProductFormData {
  sku: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  categoryId: string;
  brand: string;
  unit: string;
  unitEn: string;
  basePrice: number;
  groupBuyPrice: string;
  stockQuantity: number;
  minOrderQty: number;
  maxOrderQty: string;
  weightKg: string;
  barcode: string;
  manufacturerId: string;
  distributorId: string;
  isPrivateLabel: boolean;
  isActive: boolean;
}

export interface ProductEditData {
  id: string;
  sku: string;
  name: string;
  nameEn: string | null;
  description: string | null;
  descriptionEn: string | null;
  categoryId: string;
  brand: string | null;
  unit: string;
  unitEn: string | null;
  basePrice: number;
  groupBuyPrice: number | null;
  stockQuantity: number;
  minOrderQty: number;
  maxOrderQty: number | null;
  weightKg: number | null;
  barcode: string | null;
  manufacturerId: string | null;
  distributorId: string | null;
  isPrivateLabel: boolean;
  isActive: boolean;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProduct?: ProductEditData | null;
  locale: string;
  onSaved?: () => void;
}

// ============================================
// Unit mapping
// ============================================

const UNIT_MAP: Record<string, string> = {
  'cái': 'piece',
  'bao': 'bag',
  'chai': 'bottle',
  'thùng': 'box',
  'gói': 'pack',
  'hộp': 'carton',
  'lốc': 'block',
  'kg': 'kg',
};

const UNIT_OPTIONS = Object.keys(UNIT_MAP);

// ============================================
// Default form data
// ============================================

function getInitialFormData(): ProductFormData {
  return {
    sku: '',
    name: '',
    nameEn: '',
    description: '',
    descriptionEn: '',
    categoryId: '',
    brand: '',
    unit: 'cái',
    unitEn: 'piece',
    basePrice: 0,
    groupBuyPrice: '',
    stockQuantity: 0,
    minOrderQty: 1,
    maxOrderQty: '',
    weightKg: '',
    barcode: '',
    manufacturerId: '',
    distributorId: '',
    isPrivateLabel: false,
    isActive: true,
  };
}

// ============================================
// Product Form Dialog
// ============================================

export function ProductFormDialog({
  open,
  onOpenChange,
  editProduct,
  locale,
  onSaved,
}: ProductFormDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const isEdit = !!editProduct;

  const [formData, setFormData] = useState<ProductFormData>(getInitialFormData);
  const [categories, setCategories] = useState<Category[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const brandInputRef = useRef<HTMLDivElement>(null);

  // Fetch categories, manufacturers, distributors
  const fetchMeta = useCallback(async () => {
    try {
      setLoadingMeta(true);
      const [catRes, mfrRes, distRes] = await Promise.all([
        fetch('/api/categories').then((r) => r.json()),
        fetch('/api/products?limit=100').then((r) => r.json()),
        fetch('/api/products?limit=100').then((r) => r.json()),
      ]);

      if (catRes.success) {
        setCategories(catRes.data.items || []);
      }
      // Extract unique brands from products for autocomplete
      if (mfrRes.success && mfrRes.data?.filters?.brands) {
        setBrandSuggestions(mfrRes.data.filters.brands as string[]);
      }
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  // Populate form when editing
  useEffect(() => {
    if (editProduct) {
      setFormData({
        sku: editProduct.sku,
        name: editProduct.name,
        nameEn: editProduct.nameEn || '',
        description: editProduct.description || '',
        descriptionEn: editProduct.descriptionEn || '',
        categoryId: editProduct.categoryId,
        brand: editProduct.brand || '',
        unit: editProduct.unit || 'cái',
        unitEn: editProduct.unitEn || UNIT_MAP[editProduct.unit] || '',
        basePrice: editProduct.basePrice,
        groupBuyPrice: editProduct.groupBuyPrice != null ? String(editProduct.groupBuyPrice) : '',
        stockQuantity: editProduct.stockQuantity,
        minOrderQty: editProduct.minOrderQty,
        maxOrderQty: editProduct.maxOrderQty != null ? String(editProduct.maxOrderQty) : '',
        weightKg: editProduct.weightKg != null ? String(editProduct.weightKg) : '',
        barcode: editProduct.barcode || '',
        manufacturerId: editProduct.manufacturerId || '',
        distributorId: editProduct.distributorId || '',
        isPrivateLabel: editProduct.isPrivateLabel,
        isActive: editProduct.isActive,
      });
    } else {
      setFormData(getInitialFormData());
    }
    setErrors({});
  }, [editProduct, open]);

  useEffect(() => {
    if (open) {
      fetchMeta();
    }
  }, [open, fetchMeta]);

  // Auto-fill English unit when Vietnamese unit changes
  const handleUnitChange = (unitVi: string) => {
    setFormData((prev) => ({
      ...prev,
      unit: unitVi,
      unitEn: UNIT_MAP[unitVi] || '',
    }));
  };

  // Update form field
  const updateField = (field: keyof ProductFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for field
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.sku.trim() || formData.sku.trim().length < 3) {
      newErrors.sku = t('SKU required (min 3 chars)', 'SKU bắt buộc (tối thiểu 3 ký tự)');
    }
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      newErrors.name = t('Name required (min 2 chars)', 'Tên bắt buộc (tối thiểu 2 ký tự)');
    }
    if (!formData.categoryId) {
      newErrors.categoryId = t('Category is required', 'Danh mục bắt buộc');
    }
    if (!formData.basePrice || formData.basePrice < 100) {
      newErrors.basePrice = t('Price must be at least 100 VND', 'Giá phải từ 100 ₫ trở lên');
    }

    const gbp = formData.groupBuyPrice ? Number(formData.groupBuyPrice) : null;
    if (gbp !== null && (gbp >= formData.basePrice || gbp < 100)) {
      newErrors.groupBuyPrice = t(
        'Group buy price must be less than base price and at least 100 VND',
        'Giá mua chung phải nhỏ hơn giá gốc và từ 100 ₫ trở lên'
      );
    }

    const maxQty = formData.maxOrderQty ? Number(formData.maxOrderQty) : null;
    if (maxQty !== null && maxQty < formData.minOrderQty) {
      newErrors.maxOrderQty = t(
        'Max must be >= min order qty',
        'SL tối đa phải >= SL tối thiểu'
      );
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit form
  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        sku: formData.sku.trim(),
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim() || null,
        description: formData.description.trim() || null,
        descriptionEn: formData.descriptionEn.trim() || null,
        categoryId: formData.categoryId,
        brand: formData.brand.trim() || null,
        unit: formData.unit,
        unitEn: formData.unitEn.trim() || null,
        basePrice: Math.round(formData.basePrice),
        groupBuyPrice: formData.groupBuyPrice ? Math.round(Number(formData.groupBuyPrice)) : null,
        stockQuantity: formData.stockQuantity,
        minOrderQty: formData.minOrderQty || 1,
        maxOrderQty: formData.maxOrderQty ? Number(formData.maxOrderQty) : null,
        weightKg: formData.weightKg ? Number(formData.weightKg) : null,
        barcode: formData.barcode.trim() || null,
        manufacturerId: formData.manufacturerId || null,
        distributorId: formData.distributorId || null,
        isPrivateLabel: formData.isPrivateLabel,
        isActive: formData.isActive,
      };

      const url = isEdit ? `/api/products/${editProduct.id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json.success) {
        onOpenChange(false);
        onSaved?.();
      } else {
        // Handle server-side validation errors
        if (json.error?.details?.errors) {
          const serverErrors: Record<string, string> = {};
          (json.error.details.errors as string[]).forEach((err: string) => {
            if (err.toLowerCase().includes('sku')) serverErrors.sku = err;
            else if (err.toLowerCase().includes('barcode')) serverErrors.barcode = err;
            else if (err.toLowerCase().includes('name')) serverErrors.name = err;
            else if (err.toLowerCase().includes('price')) serverErrors.basePrice = err;
            else serverErrors._general = err;
          });
          setErrors(serverErrors);
        } else {
          setErrors({ _general: json.error?.message || t('Failed to save product', 'Không thể lưu sản phẩm') });
        }
      }
    } catch (err) {
      console.error('Submit error:', err);
      setErrors({ _general: t('Network error. Please try again.', 'Lỗi mạng. Vui lòng thử lại.') });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600" />
            {isEdit
              ? t('Edit Product', 'Chỉnh sửa sản phẩm')
              : t('Create New Product', 'Tạo sản phẩm mới')}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t('Update product information', 'Cập nhật thông tin sản phẩm')
              : t('Fill in product details to add to catalog', 'Nhập thông tin sản phẩm để thêm vào danh mục')}
          </DialogDescription>
        </DialogHeader>

        {/* General Error */}
        {errors._general && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errors._general}
          </div>
        )}

        <div className="grid gap-5 py-2">
          {/* Row: SKU + Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* SKU */}
            <div className="space-y-2">
              <Label htmlFor="sku" className="text-sm font-medium">
                SKU <span className="text-red-500">*</span>
              </Label>
              <Input
                id="sku"
                placeholder={t('e.g., SP-001', 'VD: SP-001')}
                value={formData.sku}
                onChange={(e) => updateField('sku', e.target.value)}
                className={errors.sku ? 'border-red-300 focus-visible:ring-red-200' : ''}
                disabled={submitting}
              />
              {errors.sku && <p className="text-xs text-red-500">{errors.sku}</p>}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('Category', 'Danh mục')} <span className="text-red-500">*</span>
              </Label>
              {loadingMeta ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <Select
                  value={formData.categoryId}
                  onValueChange={(val) => updateField('categoryId', val)}
                  disabled={submitting}
                >
                  <SelectTrigger className={`w-full ${errors.categoryId ? 'border-red-300' : ''}`}>
                    <SelectValue placeholder={t('Select category', 'Chọn danh mục')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          {cat.icon && <span>{cat.icon}</span>}
                          {locale === 'vi' ? cat.name : (cat.nameEn || cat.name)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.categoryId && <p className="text-xs text-red-500">{errors.categoryId}</p>}
            </div>
          </div>

          {/* Row: Name VI + Name EN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nameVi" className="text-sm font-medium">
                {t('Name (Vietnamese)', 'Tên (Tiếng Việt)')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="nameVi"
                placeholder={t('Product name in Vietnamese', 'Tên sản phẩm tiếng Việt')}
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className={errors.name ? 'border-red-300 focus-visible:ring-red-200' : ''}
                disabled={submitting}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameEn" className="text-sm font-medium">
                {t('Name (English)', 'Tên (Tiếng Anh)')}
              </Label>
              <Input
                id="nameEn"
                placeholder={t('Product name in English', 'Tên sản phẩm tiếng Anh')}
                value={formData.nameEn}
                onChange={(e) => updateField('nameEn', e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Description VI */}
          <div className="space-y-2">
            <Label htmlFor="descVi" className="text-sm font-medium">
              {t('Description (Vietnamese)', 'Mô tả (Tiếng Việt)')}
            </Label>
            <Textarea
              id="descVi"
              placeholder={t('Product description...', 'Mô tả sản phẩm...')}
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={3}
              disabled={submitting}
            />
          </div>

          {/* Description EN */}
          <div className="space-y-2">
            <Label htmlFor="descEn" className="text-sm font-medium">
              {t('Description (English)', 'Mô tả (Tiếng Anh)')}
            </Label>
            <Textarea
              id="descEn"
              placeholder={t('Product description in English...', 'Mô tả sản phẩm tiếng Anh...')}
              value={formData.descriptionEn}
              onChange={(e) => updateField('descriptionEn', e.target.value)}
              rows={3}
              disabled={submitting}
            />
          </div>

          {/* Row: Brand + Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Brand with autocomplete */}
            <div className="space-y-2 relative" ref={brandInputRef}>
              <Label htmlFor="brand" className="text-sm font-medium">
                {t('Brand', 'Thương hiệu')}
              </Label>
              <div className="relative">
                <Input
                  id="brand"
                  placeholder={t('e.g., Unilever, Hao Hao', 'VD: Unilever, Hảo Hảo')}
                  value={formData.brand}
                  onChange={(e) => {
                    updateField('brand', e.target.value);
                    setShowBrandSuggestions(e.target.value.length > 0);
                  }}
                  onFocus={() => setShowBrandSuggestions(formData.brand.length > 0)}
                  onBlur={() => setTimeout(() => setShowBrandSuggestions(false), 200)}
                  disabled={submitting}
                />
                {showBrandSuggestions && brandSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md max-h-32 overflow-y-auto">
                    {brandSuggestions
                      .filter((b) => b && b.toLowerCase().includes(formData.brand.toLowerCase()))
                      .slice(0, 6)
                      .map((brand) => (
                        <button
                          key={brand}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            updateField('brand', brand);
                            setShowBrandSuggestions(false);
                          }}
                        >
                          {brand}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              {errors.brand && <p className="text-xs text-red-500">{errors.brand}</p>}
            </div>

            {/* Barcode */}
            <div className="space-y-2">
              <Label htmlFor="barcode" className="text-sm font-medium">
                {t('Barcode', 'Mã vạch')}
              </Label>
              <Input
                id="barcode"
                placeholder={t('Scan or enter barcode', 'Quét hoặc nhập mã vạch')}
                value={formData.barcode}
                onChange={(e) => updateField('barcode', e.target.value)}
                className={errors.barcode ? 'border-red-300 focus-visible:ring-red-200' : ''}
                disabled={submitting}
              />
              {errors.barcode && <p className="text-xs text-red-500">{errors.barcode}</p>}
            </div>
          </div>

          {/* Row: Unit VI + Unit EN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('Unit (Vietnamese)', 'Đơn vị (Tiếng Việt)')}
              </Label>
              <Select value={formData.unit} onValueChange={handleUnitChange} disabled={submitting}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unitEn" className="text-sm font-medium">
                {t('Unit (English)', 'Đơn vị (Tiếng Anh)')}
              </Label>
              <Input
                id="unitEn"
                placeholder={t('Auto-filled, editable', 'Tự động điền, có thể sửa')}
                value={formData.unitEn}
                onChange={(e) => updateField('unitEn', e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Row: Base Price + Group Buy Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="basePrice" className="text-sm font-medium">
                {t('Base Price (VND)', 'Giá gốc (₫)')} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="basePrice"
                type="number"
                min={100}
                placeholder={t('e.g., 50000', 'VD: 50000')}
                value={formData.basePrice || ''}
                onChange={(e) => updateField('basePrice', Number(e.target.value))}
                className={errors.basePrice ? 'border-red-300 focus-visible:ring-red-200' : ''}
                disabled={submitting}
              />
              {formData.basePrice > 0 && (
                <p className="text-xs text-muted-foreground">{formatVND(formData.basePrice)}</p>
              )}
              {errors.basePrice && <p className="text-xs text-red-500">{errors.basePrice}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupBuyPrice" className="text-sm font-medium">
                {t('Group Buy Price (VND)', 'Giá mua chung (₫)')}
              </Label>
              <Input
                id="groupBuyPrice"
                type="number"
                min={100}
                placeholder={t('Optional, must be < base price', 'Tùy chọn, phải < giá gốc')}
                value={formData.groupBuyPrice}
                onChange={(e) => updateField('groupBuyPrice', e.target.value)}
                className={errors.groupBuyPrice ? 'border-red-300 focus-visible:ring-red-200' : ''}
                disabled={submitting}
              />
              {formData.groupBuyPrice && Number(formData.groupBuyPrice) > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formatVND(Number(formData.groupBuyPrice))}
                  {formData.basePrice > 0 && (
                    <span className="ml-2">
                      (
                      {Math.round(((1 - Number(formData.groupBuyPrice) / formData.basePrice) * 100))}
                      % {t('off', 'giảm')})
                    </span>
                  )}
                </p>
              )}
              {errors.groupBuyPrice && <p className="text-xs text-red-500">{errors.groupBuyPrice}</p>}
            </div>
          </div>

          {/* Row: Stock + Min Order + Max Order */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stock" className="text-sm font-medium">
                {t('Stock Quantity', 'Số lượng tồn kho')}
              </Label>
              <Input
                id="stock"
                type="number"
                min={0}
                placeholder="0"
                value={formData.stockQuantity || ''}
                onChange={(e) => updateField('stockQuantity', Number(e.target.value))}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minOrder" className="text-sm font-medium">
                {t('Min Order Qty', 'SL đặt tối thiểu')}
              </Label>
              <Input
                id="minOrder"
                type="number"
                min={1}
                value={formData.minOrderQty || ''}
                onChange={(e) => updateField('minOrderQty', Number(e.target.value))}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxOrder" className="text-sm font-medium">
                {t('Max Order Qty', 'SL đặt tối đa')}
              </Label>
              <Input
                id="maxOrder"
                type="number"
                min={1}
                placeholder={t('Unlimited', 'Không giới hạn')}
                value={formData.maxOrderQty}
                onChange={(e) => updateField('maxOrderQty', e.target.value)}
                className={errors.maxOrderQty ? 'border-red-300 focus-visible:ring-red-200' : ''}
                disabled={submitting}
              />
              {errors.maxOrderQty && <p className="text-xs text-red-500">{errors.maxOrderQty}</p>}
            </div>
          </div>

          {/* Row: Weight */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight" className="text-sm font-medium">
                {t('Weight (kg)', 'Cân nặng (kg)')}
              </Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                min={0}
                placeholder={t('For delivery calc', 'Tính phí vận chuyển')}
                value={formData.weightKg}
                onChange={(e) => updateField('weightKg', e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('Manufacturer', 'Nhà sản xuất')}
              </Label>
              <Select
                value={formData.manufacturerId}
                onValueChange={(val) => updateField('manufacturerId', val)}
                disabled={submitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('Optional', 'Tùy chọn')} />
                </SelectTrigger>
                <SelectContent>
                  {manufacturers.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      {t('No manufacturers yet', 'Chưa có nhà SX')}
                    </SelectItem>
                  ) : (
                    manufacturers.map((mfr) => (
                      <SelectItem key={mfr.id} value={mfr.id}>
                        {mfr.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('Distributor', 'Nhà phân phối')}
              </Label>
              <Select
                value={formData.distributorId}
                onValueChange={(val) => updateField('distributorId', val)}
                disabled={submitting}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('Optional', 'Tùy chọn')} />
                </SelectTrigger>
                <SelectContent>
                  {distributors.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      {t('No distributors yet', 'Chưa có nhà PP')}
                    </SelectItem>
                  ) : (
                    distributors.map((dist) => (
                      <SelectItem key={dist.id} value={dist.id}>
                        {dist.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Toggles: Private Label + Active */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">
                  {t('Private Label', 'Nhãn riêng')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('Aladin Select house brand', 'Thương hiệu riêng Aladin Select')}
                </p>
              </div>
              <Switch
                checked={formData.isPrivateLabel}
                onCheckedChange={(checked) => updateField('isPrivateLabel', checked)}
                disabled={submitting}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">
                  {t('Active', 'Đang hoạt động')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('Visible in product catalog', 'Hiển thị trong danh mục SP')}
                </p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => updateField('isActive', checked)}
                disabled={submitting}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('Cancel', 'Hủy')}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting
              ? t('Saving...', 'Đang lưu...')
              : isEdit
                ? t('Update Product', 'Cập nhật SP')
                : t('Create Product', 'Tạo sản phẩm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
