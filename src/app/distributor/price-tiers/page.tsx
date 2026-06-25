'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { toast } from 'sonner';
import {
  Layers, Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  RefreshCw, X, TrendingUp, Package, Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { AdminHeader } from '@/components/layout/admin-header';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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

// ============================================
// Types
// ============================================

interface PriceTierItem {
  id?: string;
  productId: string;
  price: number;
  productName?: string;
  productSku?: string;
  basePrice?: number;
  _delete?: boolean;
}

interface PriceTier {
  id: string;
  name: string;
  nameEn?: string;
  tierType: 'LOYALTY_BASED' | 'VOLUME_BASED' | 'CUSTOM';
  discountPercent: number;
  minOrderValue: number | null;
  loyaltyTier: string | null;
  isActive: boolean;
  itemCount: number;
  items: PriceTierItem[];
}

interface InventoryProduct {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  basePrice: number;
  quantity: number;
  costPrice: number;
}

type TierType = 'LOYALTY_BASED' | 'VOLUME_BASED' | 'CUSTOM';

// ============================================
// Constants
// ============================================

const TIER_TYPE_OPTIONS: { value: TierType; labelVi: string; labelEn: string }[] = [
  { value: 'LOYALTY_BASED', labelVi: 'Theo hạng khách hàng', labelEn: 'Loyalty-based' },
  { value: 'VOLUME_BASED', labelVi: 'Theo số lượng đặt hàng', labelEn: 'Volume-based' },
  { value: 'CUSTOM', labelVi: 'Tùy chỉnh', labelEn: 'Custom' },
];

const LOYALTY_TIER_OPTIONS = [
  { value: 'BRONZE', labelVi: 'Đồng', labelEn: 'Bronze' },
  { value: 'SILVER', labelVi: 'Bạc', labelEn: 'Silver' },
  { value: 'GOLD', labelVi: 'Vàng', labelEn: 'Gold' },
  { value: 'PLATINUM', labelVi: 'Bạch kim', labelEn: 'Platinum' },
];

// ============================================
// Main Component
// ============================================

export default function PriceTiersPage() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  // ---- Data State ----
  const [tiers, setTiers] = useState<PriceTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ---- Dialog State ----
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<PriceTier | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ---- Form State ----
  const [formName, setFormName] = useState('');
  const [formTierType, setFormTierType] = useState<TierType>('VOLUME_BASED');
  const [formLoyaltyTier, setFormLoyaltyTier] = useState('');
  const [formMinOrderValue, setFormMinOrderValue] = useState('');
  const [formDiscountPercent, setFormDiscountPercent] = useState('');
  const [formItems, setFormItems] = useState<PriceTierItem[]>([]);

  // ---- Product Selector State ----
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');

  // ---- Delete Confirmation ----
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingTier, setDeletingTier] = useState<PriceTier | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ============================================
  // Fetch price tiers
  // ============================================
  const fetchTiers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/distributor/price-tiers?includeProducts=true');
      if (res.success) {
        setTiers(res.data.items || []);
      }
    } catch (e) {
      console.error('[FETCH PRICE TIERS ERROR]', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  // ============================================
  // Fetch inventory products for the product selector
  // ============================================
  const fetchInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const res = await adminFetch('/api/distributor/inventory?limit=999');
      if (res.success) {
        setInventoryProducts(res.data.items || []);
      }
    } catch (e) {
      console.error('[FETCH INVENTORY ERROR]', e);
    }
    setInventoryLoading(false);
  }, []);

  // ============================================
  // Toggle tier active status
  // ============================================
  const handleToggleActive = useCallback(
    async (tier: PriceTier, newActive: boolean) => {
      try {
        const res = await adminFetch('/api/distributor/price-tiers', {
          method: 'PUT',
          body: JSON.stringify({ id: tier.id, isActive: newActive }),
        });
        if (res.success) {
          setTiers((prev) =>
            prev.map((t) => (t.id === tier.id ? { ...t, isActive: newActive } : t))
          );
          toast.success(
            newActive
              ? t('Đã kích hoạt bảng giá', 'Price tier activated')
              : t('Đã vô hiệu hóa bảng giá', 'Price tier deactivated')
          );
        } else {
          toast.error(res.error?.message || t('Lỗi cập nhật', 'Update failed'));
        }
      } catch (e: any) {
        toast.error(e.message || t('Lỗi mạng', 'Network error'));
      }
    },
    [t]
  );

  // ============================================
  // Open dialog for creating a new tier
  // ============================================
  const openCreateDialog = useCallback(async () => {
    setEditingTier(null);
    setFormName('');
    setFormTierType('VOLUME_BASED');
    setFormLoyaltyTier('');
    setFormMinOrderValue('');
    setFormDiscountPercent('');
    setFormItems([]);
    setSelectedProductId('');
    setProductSearch('');
    await fetchInventory();
    setDialogOpen(true);
  }, [fetchInventory]);

  // ============================================
  // Open dialog for editing an existing tier
  // ============================================
  const openEditDialog = useCallback(
    async (tier: PriceTier) => {
      setEditingTier(tier);
      setFormName(tier.name);
      setFormTierType(tier.tierType);
      setFormLoyaltyTier(tier.loyaltyTier || '');
      setFormMinOrderValue(tier.minOrderValue ? String(tier.minOrderValue) : '');
      setFormDiscountPercent(tier.discountPercent ? String(tier.discountPercent) : '');
      setFormItems(
        tier.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          price: item.price,
          productName: item.productName,
          productSku: item.productSku,
          basePrice: item.basePrice,
        }))
      );
      setSelectedProductId('');
      setProductSearch('');
      await fetchInventory();
      setDialogOpen(true);
    },
    [fetchInventory]
  );

  // ============================================
  // Add a product to the form items list
  // ============================================
  const handleAddProduct = useCallback(() => {
    if (!selectedProductId) return;
    const product = inventoryProducts.find((p) => p.productId === selectedProductId);
    if (!product) return;

    // Check if product is already in the list
    if (formItems.some((item) => item.productId === selectedProductId)) {
      toast.error(t('Sản phẩm đã có trong danh sách', 'Product already in list'));
      return;
    }

    const discount = parseFloat(formDiscountPercent) || 0;
    const calculatedPrice = Math.round(product.basePrice * (1 - discount / 100));

    setFormItems((prev) => [
      ...prev,
      {
        productId: product.productId,
        price: calculatedPrice,
        productName: product.productName,
        productSku: product.productSku,
        basePrice: product.basePrice,
      },
    ]);
    setSelectedProductId('');
    setProductSearch('');
  }, [selectedProductId, inventoryProducts, formItems, formDiscountPercent, t]);

  // ============================================
  // Remove a product from the form items list
  // ============================================
  const handleRemoveItem = useCallback((index: number) => {
    setFormItems((prev) => {
      const item = prev[index];
      const newItems = prev.filter((_, i) => i !== index);
      // If this item has an id (existing item), mark for deletion
      if (item.id) {
        return [...newItems, { ...item, _delete: true }];
      }
      return newItems;
    });
  }, []);

  // ============================================
  // Update a product's price in the form
  // ============================================
  const handleItemPriceChange = useCallback((index: number, newPrice: string) => {
    const priceVal = parseInt(newPrice) || 0;
    setFormItems((prev) =>
      prev.map((item, i) => {
        if (i === index) {
          return { ...item, price: priceVal };
        }
        return item;
      })
    );
  }, []);

  // ============================================
  // When discountPercent changes, update all item prices
  // ============================================
  const handleDiscountChange = useCallback((value: string) => {
    setFormDiscountPercent(value);
    const discount = parseFloat(value) || 0;
    if (discount > 0) {
      setFormItems((prev) =>
        prev.map((item) => {
          if (item._delete) return item;
          const base = item.basePrice || 0;
          return { ...item, price: Math.round(base * (1 - discount / 100)) };
        })
      );
    }
  }, []);

  // ============================================
  // Submit (create or update)
  // ============================================
  const handleSubmit = useCallback(async () => {
    if (!formName.trim()) {
      toast.error(t('Tên bảng giá là bắt buộc', 'Price tier name is required'));
      return;
    }

    // Collect visible items (not marked _delete)
    const visibleItems = formItems.filter((item) => !item._delete);

    if (visibleItems.length === 0) {
      toast.error(t('Phải có ít nhất 1 sản phẩm', 'At least 1 product is required'));
      return;
    }

    // Validate all prices > 0
    for (const item of visibleItems) {
      if (!item.price || item.price <= 0) {
        toast.error(
          t(
            `Giá sản phẩm "${item.productName || item.productId}" phải lớn hơn 0`,
            `Price for "${item.productName || item.productId}" must be > 0`
          )
        );
        return;
      }
    }

    // Validate conditional fields
    if (formTierType === 'LOYALTY_BASED' && !formLoyaltyTier) {
      toast.error(t('Chọn hạng khách hàng', 'Select a loyalty tier'));
      return;
    }

    setSubmitting(true);
    try {
      if (editingTier) {
        // --- UPDATE ---
        const payload: Record<string, unknown> = {
          id: editingTier.id,
          name: formName.trim(),
          tierType: formTierType,
          discountPercent: parseFloat(formDiscountPercent) || 0,
          minOrderValue:
            formTierType === 'VOLUME_BASED'
              ? parseInt(formMinOrderValue) || null
              : null,
          loyaltyTier:
            formTierType === 'LOYALTY_BASED' ? formLoyaltyTier : null,
          items: formItems.map((item) => ({
            id: item.id,
            productId: item.productId,
            price: item.price,
            _delete: item._delete || false,
          })),
        };
        const res = await adminFetch('/api/distributor/price-tiers', {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        if (res.success) {
          toast.success(t('Đã cập nhật bảng giá', 'Price tier updated'));
          setDialogOpen(false);
          fetchTiers();
        } else {
          toast.error(res.error?.message || t('Lỗi cập nhật', 'Update failed'));
        }
      } else {
        // --- CREATE ---
        const payload = {
          name: formName.trim(),
          tierType: formTierType,
          discountPercent: parseFloat(formDiscountPercent) || 0,
          minOrderValue:
            formTierType === 'VOLUME_BASED'
              ? parseInt(formMinOrderValue) || null
              : null,
          loyaltyTier:
            formTierType === 'LOYALTY_BASED' ? formLoyaltyTier : null,
          items: visibleItems.map((item) => ({
            productId: item.productId,
            price: item.price,
          })),
        };
        const res = await adminFetch('/api/distributor/price-tiers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (res.success) {
          toast.success(t('Đã tạo bảng giá mới', 'Price tier created'));
          setDialogOpen(false);
          fetchTiers();
        } else {
          toast.error(res.error?.message || t('Lỗi tạo mới', 'Create failed'));
        }
      }
    } catch (e: any) {
      toast.error(e.message || t('Lỗi mạng', 'Network error'));
    }
    setSubmitting(false);
  }, [
    editingTier,
    formName,
    formTierType,
    formLoyaltyTier,
    formMinOrderValue,
    formDiscountPercent,
    formItems,
    t,
    fetchTiers,
  ]);

  // ============================================
  // Delete handler
  // ============================================
  const handleDelete = useCallback(async () => {
    if (!deletingTier) return;
    setDeleting(true);
    try {
      const res = await adminFetch(
        `/api/distributor/price-tiers?id=${deletingTier.id}`,
        { method: 'DELETE' }
      );
      if (res.success) {
        toast.success(t('Đã xóa bảng giá', 'Price tier deleted'));
        setDeleteOpen(false);
        setDeletingTier(null);
        if (expandedId === deletingTier.id) setExpandedId(null);
        fetchTiers();
      } else {
        toast.error(res.error?.message || t('Lỗi xóa', 'Delete failed'));
      }
    } catch (e: any) {
      toast.error(e.message || t('Lỗi mạng', 'Network error'));
    }
    setDeleting(false);
  }, [deletingTier, expandedId, fetchTiers, t]);

  // ============================================
  // Available products for the selector (exclude already-added)
  // ============================================
  const availableProducts = useMemo(() => {
    const addedProductIds = new Set(
      formItems.filter((i) => !i._delete).map((i) => i.productId)
    );
    let list = inventoryProducts.filter(
      (p) => !addedProductIds.has(p.productId)
    );
    if (productSearch) {
      const q = productSearch.toLowerCase();
      list = list.filter(
        (p) =>
          p.productName.toLowerCase().includes(q) ||
          p.productSku.toLowerCase().includes(q)
      );
    }
    return list;
  }, [inventoryProducts, formItems, productSearch]);

  // ============================================
  // Tier type badge styling
  // ============================================
  const getTierTypeBadge = (tierType: TierType) => {
    switch (tierType) {
      case 'LOYALTY_BASED':
        return (
          <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-[10px] font-semibold rounded-full px-2.5">
            {t('Hạng khách hàng', 'Loyalty')}
          </Badge>
        );
      case 'VOLUME_BASED':
        return (
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-[10px] font-semibold rounded-full px-2.5">
            {t('Theo số lượng', 'Volume')}
          </Badge>
        );
      case 'CUSTOM':
        return (
          <Badge className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 text-[10px] font-semibold rounded-full px-2.5">
            {t('Tùy chỉnh', 'Custom')}
          </Badge>
        );
    }
  };

  // ============================================
  // Get tier subtitle
  // ============================================
  const getTierSubtitle = (tier: PriceTier) => {
    switch (tier.tierType) {
      case 'LOYALTY_BASED':
        return t(
          `Áp dụng cho khách hàng hạng: ${tier.loyaltyTier || '-'}`,
          `Applies to loyalty tier: ${tier.loyaltyTier || '-'}`
        );
      case 'VOLUME_BASED':
        return t(
          `Đơn hàng từ ${formatVND(tier.minOrderValue || 0)}`,
          `Orders from ${formatVND(tier.minOrderValue || 0)}`
        );
      case 'CUSTOM':
        return t('Tùy chỉnh', 'Custom pricing');
    }
  };

  // ============================================
  // Calculate discount percentage for display
  // ============================================
  const calcDiscount = (basePrice: number | undefined, tierPrice: number) => {
    if (!basePrice || basePrice === 0) return '0.0%';
    const pct = ((basePrice - tierPrice) / basePrice) * 100;
    return pct.toFixed(1) + '%';
  };

  // ============================================
  // Render
  // ============================================
  return (
    <>
      <AdminHeader />

      <div className="flex flex-1 flex-col">
        {/* Page Header */}
        <div className="px-4 md:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/20">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">
                  {t('Bảng giá phân tầng', 'Price Tiers')}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t(
                    'Quản lý bảng giá theo hạng khách hàng, số lượng đặt hàng',
                    'Manage pricing by customer tier and order volume'
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchTiers}
                disabled={loading}
                className="rounded-lg"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`}
                />
                {t('Làm mới', 'Refresh')}
              </Button>
              <Button
                size="sm"
                onClick={openCreateDialog}
                className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                {t('Thêm bảng giá', 'Add Price Tier')}
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
          {/* Loading State */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : tiers.length === 0 ? (
            /* Empty State */
            <div className="text-center py-20">
              <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Layers className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {t('Chưa có bảng giá nào', 'No price tiers yet')}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {t(
                  'Tạo bảng giá đầu tiên để áp dụng chiết khấu cho khách hàng',
                  'Create your first price tier to apply discounts for customers'
                )}
              </p>
              <Button
                size="sm"
                onClick={openCreateDialog}
                className="mt-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                {t('Thêm bảng giá', 'Add Price Tier')}
              </Button>
            </div>
          ) : (
            /* Price Tier Cards */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tiers.map((tier) => {
                const isExpanded = expandedId === tier.id;
                return (
                  <Card
                    key={tier.id}
                    className={`shadow-sm rounded-xl transition-all duration-200 ${
                      !tier.isActive
                        ? 'opacity-60 border-dashed'
                        : 'hover:shadow-md'
                    } ${isExpanded ? 'md:col-span-2 ring-2 ring-purple-200 dark:ring-purple-800' : ''}`}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base font-semibold truncate">
                              {tier.name}
                            </CardTitle>
                            {getTierTypeBadge(tier.tierType)}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {getTierSubtitle(tier)}
                          </p>
                        </div>
                        <Switch
                          checked={tier.isActive}
                          onCheckedChange={(checked) =>
                            handleToggleActive(tier, checked)
                          }
                        />
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-3">
                      {/* Meta info */}
                      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                        {tier.discountPercent > 0 && (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">
                            <TrendingUp className="h-3 w-3" />
                            {t('Giảm', 'Discount')} {tier.discountPercent}%
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {t('Số SP', 'Products')}: {tier.itemCount}
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 rounded-lg text-xs"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : tier.id)
                          }
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3.5 w-3.5" />
                              {t('Thu gọn', 'Collapse')}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3.5 w-3.5" />
                              {t('Xem chi tiết', 'View Details')}
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 rounded-lg text-xs"
                          onClick={() => openEditDialog(tier)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t('Sửa', 'Edit')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 rounded-lg text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => {
                            setDeletingTier(tier);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t('Xóa', 'Delete')}
                        </Button>
                      </div>

                      {/* Expanded: Product list table */}
                      {isExpanded && tier.items.length > 0 && (
                        <div className="mt-2 border rounded-lg overflow-hidden">
                          <div className="max-h-96 overflow-y-auto">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                  <TableHead className="text-[10px] font-semibold uppercase w-8">
                                    #
                                  </TableHead>
                                  <TableHead className="text-[10px] font-semibold uppercase">
                                    {t('Sản phẩm', 'Product')}
                                  </TableHead>
                                  <TableHead className="text-[10px] font-semibold uppercase">
                                    SKU
                                  </TableHead>
                                  <TableHead className="text-[10px] font-semibold uppercase text-right">
                                    {t('Giá gốc', 'Base Price')}
                                  </TableHead>
                                  <TableHead className="text-[10px] font-semibold uppercase text-right">
                                    {t('Giá tier', 'Tier Price')}
                                  </TableHead>
                                  <TableHead className="text-[10px] font-semibold uppercase text-right">
                                    {t('Chiết khấu', 'Discount')}
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {tier.items.map((item, idx) => {
                                  const discountPct =
                                    item.basePrice && item.basePrice > 0
                                      ? ((item.basePrice - item.price) /
                                          item.basePrice) *
                                        100
                                      : 0;
                                  const isDiscount =
                                    discountPct > 0;
                                  const isPremium =
                                    discountPct < 0;
                                  return (
                                    <TableRow
                                      key={item.id || idx}
                                      className="text-xs"
                                    >
                                      <TableCell className="text-muted-foreground">
                                        {idx + 1}
                                      </TableCell>
                                      <TableCell className="font-medium">
                                        {item.productName || item.productId}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground font-mono">
                                        {item.productSku || '-'}
                                      </TableCell>
                                      <TableCell className="text-right text-muted-foreground">
                                        {item.basePrice
                                          ? formatVND(item.basePrice)
                                          : '-'}
                                      </TableCell>
                                      <TableCell className="text-right font-semibold">
                                        {formatVND(item.price)}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <span
                                          className={`font-semibold ${
                                            isDiscount
                                              ? 'text-emerald-600 dark:text-emerald-400'
                                              : isPremium
                                              ? 'text-red-600 dark:text-red-400'
                                              : 'text-muted-foreground'
                                          }`}
                                        >
                                          {item.basePrice
                                            ? calcDiscount(
                                                item.basePrice,
                                                item.price
                                              )
                                            : '-'}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}

                      {isExpanded && tier.items.length === 0 && (
                        <div className="text-center py-6 text-xs text-muted-foreground">
                          {t('Chưa có sản phẩm nào', 'No products yet')}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* GVM Info Card */}
          <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                  <Info className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-amber-800 dark:text-amber-300">
                    {t(
                      'Giá phân tầng giúp tăng GVM',
                      'Tiered pricing helps increase GVM'
                    )}
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-xs text-amber-700 dark:text-amber-400/80">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      {t(
                        'Khách hàng mua sỉ nhận giá tốt hơn → tăng số lượng đơn',
                        'Wholesale customers get better prices → increase order volume'
                      )}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      {t(
                        'Khách hàng VIP duy trì mức giá cao → bảo vệ biên lợi nhuận',
                        'VIP customers maintain high prices → protect profit margins'
                      )}
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                      {t(
                        'Đơn hàng lớn nhận chiết khấu → khuyến khích upsell',
                        'Large orders receive discounts → encourage upselling'
                      )}
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ============================================ */}
      {/* Add / Edit Price Tier Dialog                */}
      {/* ============================================ */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                {editingTier ? (
                  <Pencil className="h-4 w-4 text-white" />
                ) : (
                  <Plus className="h-4 w-4 text-white" />
                )}
              </div>
              {editingTier
                ? t('Sửa bảng giá', 'Edit Price Tier')
                : t('Thêm bảng giá mới', 'Add New Price Tier')}
            </DialogTitle>
            <DialogDescription>
              {editingTier
                ? t(
                    'Chỉnh sửa thông tin và giá sản phẩm',
                    'Edit tier info and product prices'
                  )
                : t(
                    'Tạo bảng giá mới với chiết khấu theo sản phẩm',
                    'Create a new price tier with product discounts'
                  )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tên bảng giá */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('Tên bảng giá', 'Price Tier Name')}{' '}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder={t('VD: Giá sỉ, Giá VIP...', 'e.g. Wholesale, VIP...')}
                className="rounded-lg"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {/* Loại bảng giá */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('Loại', 'Type')}
              </Label>
              <Select
                value={formTierType}
                onValueChange={(v) => setFormTierType(v as TierType)}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIER_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.labelVi, opt.labelEn)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditional: Loyalty tier select */}
            {formTierType === 'LOYALTY_BASED' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t('Hạng khách hàng', 'Loyalty Tier')}
                </Label>
                <Select value={formLoyaltyTier} onValueChange={setFormLoyaltyTier}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue
                      placeholder={t('Chọn hạng...', 'Select tier...')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {LOYALTY_TIER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {t(opt.labelVi, opt.labelEn)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Conditional: Min order value */}
            {formTierType === 'VOLUME_BASED' && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t('Đơn hàng tối thiểu (VND)', 'Min Order Value (VND)')}
                </Label>
                <Input
                  type="number"
                  min="0"
                  placeholder={t('VD: 5000000', 'e.g. 5000000')}
                  className="rounded-lg"
                  value={formMinOrderValue}
                  onChange={(e) => setFormMinOrderValue(e.target.value)}
                />
              </div>
            )}

            {/* Giảm giá mặc định */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('Giảm giá mặc định (%)', 'Default Discount (%)')}
              </Label>
              <Input
                type="number"
                min="0"
                max="100"
                placeholder="0 - 100"
                className="rounded-lg"
                value={formDiscountPercent}
                onChange={(e) => handleDiscountChange(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                {t(
                  'Áp dụng cho tất cả sản phẩm khi thêm mới. Bạn vẫn có thể chỉnh giá từng SP bên dưới.',
                  'Applied to all products when adding. You can still adjust individual prices below.'
                )}
              </p>
            </div>

            <Separator />

            {/* ---- Product Price Management ---- */}
            <div className="space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                {t('Giá sản phẩm', 'Product Prices')}
              </Label>

              {/* Product selector */}
              <div className="flex gap-2">
                <Select
                  value={selectedProductId}
                  onValueChange={setSelectedProductId}
                >
                  <SelectTrigger className="rounded-lg flex-1">
                    <SelectValue
                      placeholder={
                        inventoryLoading
                          ? t('Đang tải...', 'Loading...')
                          : t('Chọn sản phẩm...', 'Select a product...')
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <div className="px-2 pb-1">
                      <Input
                        placeholder={t(
                          'Tìm tên, SKU...',
                          'Search name, SKU...'
                        )}
                        className="h-8 text-xs rounded-md"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                      />
                    </div>
                    {availableProducts.length === 0 ? (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        {t('Không tìm thấy sản phẩm', 'No products found')}
                      </div>
                    ) : (
                      availableProducts.map((p) => (
                        <SelectItem key={p.productId} value={p.productId}>
                          <span className="flex items-center gap-2 text-xs">
                            <span className="font-medium truncate max-w-[180px]">
                              {p.productName}
                            </span>
                            <span className="text-muted-foreground font-mono">
                              {p.productSku}
                            </span>
                            <span className="text-muted-foreground ml-auto">
                              {formatVND(p.basePrice)}
                            </span>
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-lg shrink-0"
                  disabled={!selectedProductId}
                  onClick={handleAddProduct}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Items table */}
              {formItems.filter((i) => !i._delete).length > 0 && (
                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[10px] font-semibold uppercase">
                          {t('Sản phẩm', 'Product')}
                        </TableHead>
                        <TableHead className="text-[10px] font-semibold uppercase text-right">
                          {t('Giá gốc', 'Base Price')}
                        </TableHead>
                        <TableHead className="text-[10px] font-semibold uppercase text-right min-w-[130px]">
                          {t('Giá tier', 'Tier Price')}
                        </TableHead>
                        <TableHead className="text-[10px] font-semibold uppercase text-right">
                          {t('Chiết khấu', 'Discount')}
                        </TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formItems
                        .filter((i) => !i._delete)
                        .map((item, idx) => {
                          const discountPct =
                            item.basePrice && item.basePrice > 0
                              ? ((item.basePrice - item.price) /
                                  item.basePrice) *
                                100
                              : 0;
                          const isDiscount = discountPct > 0;
                          const isPremium = discountPct < 0;
                          return (
                            <TableRow key={item.id || idx} className="text-xs">
                              <TableCell>
                                <div className="min-w-0">
                                  <p className="font-medium truncate max-w-[160px]">
                                    {item.productName || item.productId}
                                  </p>
                                  {item.productSku && (
                                    <p className="text-[10px] text-muted-foreground font-mono">
                                      {item.productSku}
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {item.basePrice
                                  ? formatVND(item.basePrice)
                                  : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  min="0"
                                  className="h-7 w-28 text-right text-xs rounded-md ml-auto"
                                  value={item.price}
                                  onChange={(e) =>
                                    handleItemPriceChange(
                                      idx,
                                      e.target.value
                                    )
                                  }
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={`font-semibold ${
                                    isDiscount
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : isPremium
                                      ? 'text-red-600 dark:text-red-400'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {item.basePrice
                                    ? calcDiscount(
                                        item.basePrice,
                                        item.price
                                      )
                                    : '-'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  onClick={() => handleRemoveItem(idx)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {formItems.filter((i) => !i._delete).length === 0 && (
                <div className="text-center py-6 border rounded-lg border-dashed bg-muted/30">
                  <Package className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">
                    {t(
                      'Chọn sản phẩm ở trên để thêm vào bảng giá',
                      'Select products above to add to this price tier'
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-lg"
              disabled={submitting}
            >
              {t('Hủy', 'Cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !formName.trim() || formItems.filter((i) => !i._delete).length === 0}
              className="rounded-lg bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
            >
              {submitting
                ? t('Đang lưu...', 'Saving...')
                : editingTier
                ? t('Cập nhật', 'Update')
                : t('Tạo bảng giá', 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================ */}
      {/* Delete Confirmation Dialog                   */}
      {/* ============================================ */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              {t('Xóa bảng giá', 'Delete Price Tier')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'Xác nhận xóa bảng giá này?',
                'Are you sure you want to delete this price tier?'
              )}
            </DialogDescription>
          </DialogHeader>
          {deletingTier && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-1">
              <p className="text-sm font-medium">{deletingTier.name}</p>
              <p className="text-xs text-muted-foreground">
                {t(
                  `Số sản phẩm: ${deletingTier.itemCount}`,
                  `Products: ${deletingTier.itemCount}`
                )}
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              className="rounded-lg"
              disabled={deleting}
            >
              {t('Hủy', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-lg"
            >
              {deleting
                ? t('Đang xóa...', 'Deleting...')
                : t('Xóa', 'Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}