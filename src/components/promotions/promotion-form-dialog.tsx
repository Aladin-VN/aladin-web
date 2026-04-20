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
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, X, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface PromotionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotion: Record<string, unknown> | null;
  locale?: string;
  onSaved: () => void;
  manufacturers: { id: string; name: string }[];
}

// Simple search-based product selector
interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

export function PromotionFormDialog({
  open,
  onOpenChange,
  promotion,
  locale = 'vi',
  onSaved,
  manufacturers,
}: PromotionFormDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const isEditing = !!promotion;

  // Form state
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    titleEn: '',
    description: '',
    manufacturerId: '',
    promoType: 'BUY_X_GET_Y',
    buyQty: 10,
    getQty: 1,
    discountPercent: 10,
    discountAmount: 10000,
    startsAt: '',
    expiresAt: '',
    totalBudget: '',
    isActive: true,
  });
  const [selectedProducts, setSelectedProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [searching, setSearching] = useState(false);

  // Populate form on edit
  useEffect(() => {
    if (promotion) {
      setForm({
        title: (promotion.title as string) || '',
        titleEn: (promotion.titleEn as string) || '',
        description: (promotion.description as string) || '',
        manufacturerId: (promotion.manufacturerId as string) || (promotion.manufacturer as { id: string } | undefined)?.id || '',
        promoType: (promotion.promoType as string) || 'BUY_X_GET_Y',
        buyQty: (promotion.buyQty as number) || 10,
        getQty: (promotion.getQty as number) || 1,
        discountPercent: (promotion.discountPercent as number) || 10,
        discountAmount: (promotion.discountAmount as number) || 10000,
        startsAt: promotion.startsAt ? new Date(promotion.startsAt as string).toISOString().slice(0, 16) : '',
        expiresAt: promotion.expiresAt ? new Date(promotion.expiresAt as string).toISOString().slice(0, 16) : '',
        totalBudget: promotion.totalBudget ? String(promotion.totalBudget) : '',
        isActive: promotion.isActive !== false,
      });
      // Load existing products
      if (promotion.items && Array.isArray(promotion.items)) {
        setSelectedProducts(
          (promotion.items as { product: ProductOption }[]).map((item) => item.product)
        );
      }
    } else {
      setForm({
        title: '',
        titleEn: '',
        description: '',
        manufacturerId: manufacturers.length > 0 ? manufacturers[0].id : '',
        promoType: 'BUY_X_GET_Y',
        buyQty: 10,
        getQty: 1,
        discountPercent: 10,
        discountAmount: 10000,
        startsAt: new Date().toISOString().slice(0, 16),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        totalBudget: '',
        isActive: true,
      });
      setSelectedProducts([]);
    }
  }, [promotion, manufacturers]);

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
        setProductResults(json.data.items.map((p: { id: string; name: string; sku: string }) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
        })));
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

  const addProduct = (product: ProductOption) => {
    if (!selectedProducts.find((p) => p.id === product.id)) {
      setSelectedProducts((prev) => [...prev, product]);
    }
    setProductSearch('');
    setProductResults([]);
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  // Submit
  const handleSubmit = async () => {
    if (!form.title || !form.manufacturerId || !form.startsAt || !form.expiresAt) {
      toast.error(t('Please fill all required fields', 'Vui long dien day du cac truong bat buoc'));
      return;
    }

    setSaving(true);
    try {
      const url = isEditing ? `/api/promotions/${promotion.id}` : '/api/promotions';
      const method = isEditing ? 'PATCH' : 'POST';
      const body = {
        ...form,
        totalBudget: form.totalBudget || null,
        productIds: selectedProducts.map((p) => p.id),
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(isEditing
          ? t('Promotion updated', 'Cap nhat khuyen mai thanh cong')
          : t('Promotion created', 'Tao khuyen mai thanh cong')
        );
        onSaved();
        onOpenChange(false);
      } else {
        toast.error(json.error?.message || t('Failed to save', 'Khong the luu'));
      }
    } catch (err) {
      toast.error(t('Network error', 'Loi mang'));
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
              ? t('Edit Promotion', 'Sua khuyen mai')
              : t('Create Promotion', 'Tao khuyen mai')
            }
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? t('Update promotion details and linked products', 'Cap nhat thong tin khuyen mai va san pham lien ket')
              : t('Set up a new manufacturer-funded promotion', 'Thiet lap chuong trinh khuyen mai moi tu nha san xuat')
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Promotion Title *', 'Ten chuong trinh *')}</Label>
            <Input
              placeholder={t('e.g., Hao Hao Buy 10 Get 1', 'VD: Hao Hao Mua 10 Tang 1')}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Title English */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Title (English)', 'Ten (Tieng Anh)')}</Label>
            <Input
              placeholder={locale === 'vi' ? 'Tieng Anh (tu chon)' : 'English name (optional)'}
              value={form.titleEn}
              onChange={(e) => setForm((f) => ({ ...f, titleEn: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Description', 'Mo ta')}</Label>
            <Input
              placeholder={t('Brief description of the promotion', 'Mo ta ngan gon ve chuong trinh')}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Manufacturer + Promo Type */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Manufacturer *', 'Nha SX *')}</Label>
              <Select value={form.manufacturerId} onValueChange={(v) => setForm((f) => ({ ...f, manufacturerId: v }))}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={t('Select', 'Chon')} />
                </SelectTrigger>
                <SelectContent>
                  {manufacturers.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Promotion Type *', 'Loai KM *')}</Label>
              <Select value={form.promoType} onValueChange={(v) => setForm((f) => ({ ...f, promoType: v }))}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY_X_GET_Y">{t('Buy X Get Y', 'Mua X Tang Y')}</SelectItem>
                  <SelectItem value="PERCENT_OFF">{t('Percentage Off', 'Giam theo %')}</SelectItem>
                  <SelectItem value="FIXED_DISCOUNT">{t('Fixed Discount', 'Giam co dinh')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Type-specific fields */}
          {form.promoType === 'BUY_X_GET_Y' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('Buy Quantity *', 'SL mua *')}</Label>
                <Input type="number" min={1} value={form.buyQty} onChange={(e) => setForm((f) => ({ ...f, buyQty: parseInt(e.target.value) || 1 }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('Get Free *', 'SL tang *')}</Label>
                <Input type="number" min={1} value={form.getQty} onChange={(e) => setForm((f) => ({ ...f, getQty: parseInt(e.target.value) || 1 }))} className="h-9" />
              </div>
            </div>
          )}

          {form.promoType === 'PERCENT_OFF' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Discount Percentage *', '% Giam gia *')}</Label>
              <Input type="number" min={1} max={100} value={form.discountPercent} onChange={(e) => setForm((f) => ({ ...f, discountPercent: parseFloat(e.target.value) || 0 }))} className="h-9" />
            </div>
          )}

          {form.promoType === 'FIXED_DISCOUNT' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Discount Amount (VND) *', 'So tien giam (VND) *')}</Label>
              <Input type="number" min={1000} value={form.discountAmount} onChange={(e) => setForm((f) => ({ ...f, discountAmount: parseInt(e.target.value) || 0 }))} className="h-9" />
            </div>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Start Date *', 'Hieu luc tu *')}</Label>
              <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('Expiry Date *', 'Hieu luc den *')}</Label>
              <Input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))} className="h-9 text-xs" />
            </div>
          </div>

          {/* Budget */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Total Budget (VND)', 'Tong ngan sach (VND)')}</Label>
            <Input type="number" placeholder={t('e.g., 5000000', 'VD: 5000000')} value={form.totalBudget} onChange={(e) => setForm((f) => ({ ...f, totalBudget: e.target.value }))} className="h-9" />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-2">
            <Label className="text-xs font-medium">{t('Active', 'Hoat dong')}</Label>
            <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked }))} />
          </div>

          {/* Product Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">{t('Linked Products', 'San pham lien ket')}</Label>
            <div className="relative">
              <Input
                placeholder={t('Search products by name or SKU...', 'Tim san pham theo ten hoac ma...')}
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
                    onClick={() => addProduct(p)}
                  >
                    <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate">{p.name}</span>
                    <span className="text-muted-foreground ml-auto shrink-0">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedProducts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedProducts.map((p) => (
                  <Badge key={p.id} variant="secondary" className="text-xs gap-1 pr-1">
                    <Package className="h-3 w-3" />
                    {p.name}
                    <button onClick={() => removeProduct(p.id)} className="ml-0.5 hover:text-red-600">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 text-xs">
              {t('Cancel', 'Huy')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {isEditing
                ? t('Save Changes', 'Luu thay doi')
                : (locale === 'vi' ? <><Plus className="h-3.5 w-3.5 mr-1" />Tao khuyen mai</> : <><Plus className="h-3.5 w-3.5 mr-1" />Create Promotion</>)
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
