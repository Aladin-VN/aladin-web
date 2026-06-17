'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, X, Package, Percent } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatVND } from '@/lib/security';

interface DealFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deal: Record<string, unknown> | null;
  locale?: string;
  onSaved: () => void;
  wards: { id: string; name: string }[];
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  basePrice: number;
  stockQuantity: number;
}

export function DealFormDialog({
  open,
  onOpenChange,
  deal,
  locale = 'vi',
  onSaved,
  wards,
}: DealFormDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const isEditing = !!deal;

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    titleEn: '',
    description: '',
    productId: '',
    targetQty: 100,
    originalPrice: 0,
    discountPrice: 0,
    startsAt: '',
    expiresAt: '',
    wardId: 'none',
    maxParticipants: '',
  });
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);

  // Populate form on edit
  useEffect(() => {
    if (deal) {
      setForm({
        title: (deal.title as string) || '',
        titleEn: (deal.titleEn as string) || '',
        description: (deal.description as string) || '',
        productId: (deal.productId as string) || '',
        targetQty: (deal.targetQty as number) || 100,
        originalPrice: (deal.originalPrice as number) || 0,
        discountPrice: (deal.discountPrice as number) || 0,
        startsAt: deal.startsAt ? new Date(deal.startsAt as string).toISOString().slice(0, 16) : '',
        expiresAt: deal.expiresAt ? new Date(deal.expiresAt as string).toISOString().slice(0, 16) : '',
        wardId: (deal.wardId as string) || 'none',
        maxParticipants: deal.maxParticipants ? String(deal.maxParticipants) : '',
      });
      // Set selected product from deal
      if (deal.product && typeof deal.product === 'object') {
        const p = deal.product as { id: string; name: string; sku: string; basePrice: number };
        setSelectedProduct({
          id: p.id,
          name: p.name,
          sku: p.sku,
          basePrice: p.basePrice,
          stockQuantity: 0,
        });
        setForm((prev) => ({
          ...prev,
          originalPrice: p.basePrice,
          discountPrice: (deal.discountPrice as number) || 0,
        }));
      }
    } else {
      setForm({
        title: '',
        titleEn: '',
        description: '',
        productId: '',
        targetQty: 100,
        originalPrice: 0,
        discountPrice: 0,
        startsAt: new Date().toISOString().slice(0, 16),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        wardId: 'none',
        maxParticipants: '',
      });
      setSelectedProduct(null);
    }
    setProductSearch('');
    setProductResults([]);
  }, [deal]);

  // Search products
  const searchProducts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setProductResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/products?search=${encodeURIComponent(query)}&limit=10`);
      const json = await res.json();
      if (json.success && json.data?.items) {
        setProductResults(
          json.data.items.map((p: { id: string; name: string; sku: string; basePrice: number; stockQuantity: number }) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            basePrice: p.basePrice,
            stockQuantity: p.stockQuantity || 0,
          }))
        );
      }
    } catch {
      console.error('Product search failed');
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => searchProducts(productSearch), 300);
    return () => clearTimeout(timeout);
  }, [productSearch, searchProducts]);

  const selectProduct = (product: ProductOption) => {
    setSelectedProduct(product);
    setForm((f) => ({
      ...f,
      productId: product.id,
      originalPrice: product.basePrice,
      discountPrice: Math.round(product.basePrice * 0.9), // Default 10% discount
    }));
    setProductSearch('');
    setProductResults([]);
  };

  const clearProduct = () => {
    setSelectedProduct(null);
    setForm((f) => ({ ...f, productId: '', originalPrice: 0, discountPrice: 0 }));
  };

  // Computed savings
  const savingsPercent = form.originalPrice > 0
    ? Math.round(((form.originalPrice - form.discountPrice) / form.originalPrice) * 100)
    : 0;
  const savingsPerUnit = form.originalPrice - form.discountPrice;

  // Submit
  const handleSubmit = async () => {
    if (!form.title || !form.productId || form.targetQty <= 0 || form.originalPrice <= 0 || form.discountPrice <= 0 || !form.startsAt || !form.expiresAt) {
      toast.error(t('Please fill all required fields', 'Vui lòng điền đầy đủ các trường bắt buộc'));
      return;
    }

    if (form.discountPrice >= form.originalPrice) {
      toast.error(t('Discount price must be less than original price', 'Giá mua chung phải nhỏ hơn giá gốc'));
      return;
    }

    setSaving(true);
    try {
      const url = isEditing ? `/api/group-deals/${deal.id}` : '/api/group-deals';
      const method = isEditing ? 'PATCH' : 'POST';
      const body = {
        title: form.title,
        titleEn: form.titleEn || undefined,
        description: form.description || undefined,
        productId: form.productId,
        targetQty: form.targetQty,
        originalPrice: form.originalPrice,
        discountPrice: form.discountPrice,
        startsAt: form.startsAt,
        expiresAt: form.expiresAt,
        wardId: form.wardId && form.wardId !== 'none' ? form.wardId : undefined,
        maxParticipants: form.maxParticipants ? parseInt(form.maxParticipants) : undefined,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(isEditing
          ? t('Deal updated', 'Cập nhật deal thành công')
          : t('Deal created', 'Tạo deal mua chung thành công')
        );
        onSaved();
        onOpenChange(false);
      } else {
        toast.error(json.error?.message || t('Failed to save', 'Không thể lưu'));
      }
    } catch {
      toast.error(t('Network error', 'Lỗi mạng'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('Edit Group Deal', 'Sửa Deal Mua Chung')
              : t('Create Group Deal', 'Tạo Deal Mua Chung')
            }
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('Update group buy deal details', 'Cập nhật thông tin deal mua chung')
              : t('Set up a new Pinduoduo-style group buy deal', 'Thiết lập deal mua chung mới theo mô hình Pinduoduo')
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Title (Vietnamese) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Deal Title *', 'Tên Deal *')}</Label>
            <Input
              placeholder={t('e.g., Gạo ST25 Group Buy Phường 5', 'VD: Gạo ST25 Mua Chung Phường 5')}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Title (English) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Title (English)', 'Tên (Tiếng Anh)')}</Label>
            <Input
              placeholder={locale === 'vi' ? 'Tiếng Anh (tùy chọn)' : 'English name (optional)'}
              value={form.titleEn}
              onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))}
            />
          </div>

          {/* Product Search */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Product *', 'Sản phẩm *')}</Label>
            {!selectedProduct ? (
              <>
                <div className="relative">
                  <Input
                    placeholder={t('Search products by name or SKU...', 'Tìm sản phẩm theo tên hoặc mã...')}
                    className="h-9 text-xs pr-8"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                  {searching && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {productResults.length > 0 && (
                  <div className="border rounded-md max-h-32 overflow-y-auto">
                    {productResults.map((p) => (
                      <button
                        key={p.id}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2 border-b last:border-0"
                        onClick={() => selectProduct(p)}
                      >
                        <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate flex-1">{p.name}</span>
                        <span className="text-muted-foreground shrink-0">{p.sku}</span>
                        <span className="font-medium shrink-0">{formatVND(p.basePrice)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                <Package className="h-4 w-4 text-red-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{selectedProduct.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedProduct.sku} · {formatVND(selectedProduct.basePrice)} · {t('Stock', 'Tồn')}: {selectedProduct.stockQuantity}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={clearProduct}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Target Quantity + Max Participants */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Target Quantity *', 'Số lượng mục tiêu *')}</Label>
              <Input
                type="number"
                min={1}
                value={form.targetQty}
                onChange={(e) => setForm((f) => ({ ...f, targetQty: parseInt(e.target.value) || 1 }))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Max Participants', 'Số cửa hàng tối đa')}</Label>
              <Input
                type="number"
                min={1}
                placeholder={t('Unlimited', 'Không giới hạn')}
                value={form.maxParticipants}
                onChange={(e) => setForm((f) => ({ ...f, maxParticipants: e.target.value }))}
                className="h-9"
              />
            </div>
          </div>

          {/* Original Price + Discount Price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Original Price (VND) *', 'Giá gốc (VND) *')}</Label>
              <Input
                type="number"
                min={1000}
                value={form.originalPrice || ''}
                placeholder={t('e.g., 50000', 'VD: 50000')}
                onChange={(e) => setForm((f) => ({ ...f, originalPrice: parseInt(e.target.value) || 0 }))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Group Buy Price (VND) *', 'Giá mua chung (VND) *')}</Label>
              <Input
                type="number"
                min={1000}
                value={form.discountPrice || ''}
                placeholder={t('e.g., 42000', 'VD: 42000')}
                onChange={(e) => setForm((f) => ({ ...f, discountPrice: parseInt(e.target.value) || 0 }))}
                className="h-9"
              />
            </div>
          </div>

          {/* Savings indicator */}
          {form.originalPrice > 0 && form.discountPrice > 0 && (
            <div className="rounded-md bg-yellow-50 dark:bg-emerald-950/20 border border-yellow-100 p-2.5">
              <div className="flex items-center gap-2 text-xs">
                <Percent className="h-4 w-4 text-red-600" />
                <span className="font-medium text-red-700">
                  {t('Savings', 'Tiết kiệm')}: {savingsPercent}%
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="font-medium text-red-700">
                  {formatVND(savingsPerUnit)}/{t('unit', 'sp')}
                </span>
                {form.targetQty > 0 && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="font-medium text-red-700">
                      {t('Total potential', 'Tổng tiềm năng')}: {formatVND(savingsPerUnit * form.targetQty)}
                    </span>
                  </>
                )}
              </div>
              {form.discountPrice >= form.originalPrice && (
                <p className="text-[10px] text-red-600 mt-1">
                  {t('Discount price must be less than original price!', 'Giá mua chung phải nhỏ hơn giá gốc!')}
                </p>
              )}
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Start Date *', 'Hiệu lực từ *')}</Label>
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Expiry Date *', 'Hiệu lực đến *')}</Label>
              <Input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Ward Select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Ward (Zone Scope)', 'Phường (Phạm vi khu vực)')}</Label>
            <Select value={form.wardId} onValueChange={(v) => setForm((f) => ({ ...f, wardId: v }))}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={t('All wards (city-wide)', 'Tất cả phường (toàn thành)')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('All wards (city-wide)', 'Tất cả phường (toàn thành)')}</SelectItem>
                {wards.map((w) => (
                  <SelectItem key={w.id} value={w.id} className="text-xs">{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Description', 'Mô tả')}</Label>
            <Input
              placeholder={t('Brief description of the group deal', 'Mô tả ngắn gọn về deal mua chung')}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 text-xs">
              {t('Cancel', 'Hủy')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !form.productId || form.discountPrice >= form.originalPrice}
              className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {isEditing
                ? t('Save Changes', 'Lưu thay đổi')
                : (locale === 'vi' ? <><Plus className="h-3.5 w-3.5 mr-1" />Tạo deal</> : <><Plus className="h-3.5 w-3.5 mr-1" />Create Deal</>)
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
