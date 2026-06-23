'use client';
import { adminFetch } from '@/lib/admin-fetch';

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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatVND } from '@/lib/security';
import { toast } from 'sonner';
import {
  Search,
  Plus,
  Minus,
  X,
  ShoppingCart,
  Loader2,
  AlertCircle,
  Store,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface ShopOption {
  id: string;
  name: string;
  nameEn: string | null;
  district: string | null;
  province: string;
  creditStatus: string;
  user: { phone: string; name: string };
}

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  basePrice: number;
  stockQuantity: number;
  minOrderQty: number;
  maxOrderQty: number | null;
  isActive: boolean;
}

interface CartItem {
  product: ProductOption;
  quantity: number;
}

// ============================================
// Create Order Dialog
// ============================================

interface OrderCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  onCreated?: () => void;
}

const PAYMENT_METHODS = [
  { value: 'DIGITAL', labelEn: 'Digital Payment (2% off)', labelVi: 'Thanh toán số (giảm 2%)', discount: 0.02, fee: 0 },
  { value: 'CREDIT', labelEn: '7-Day Credit', labelVi: 'Công nợ 7 ngày', discount: 0, fee: 0 },
  { value: 'COD', labelEn: 'COD (+15K fee)', labelVi: 'COD (+15K phí)', discount: 0, fee: 15000 },
];

export function OrderCreateDialog({
  open,
  onOpenChange,
  locale,
  onCreated,
}: OrderCreateDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [shops, setShops] = useState<ShopOption[]>([]);
  const [shopSearch, setShopSearch] = useState('');
  const [selectedShop, setSelectedShop] = useState<ShopOption | null>(null);

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productSearchDebounced, setProductSearchDebounced] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [loadingShops, setLoadingShops] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const shopSearchRef = useRef<HTMLDivElement>(null);
  const productSearchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch shops on open
  const fetchShops = useCallback(async () => {
    try {
      setLoadingShops(true);
      const params = new URLSearchParams({ limit: '50' });
      if (shopSearch) params.set('search', shopSearch);
      const res = await adminFetch(`/api/shops?${params.toString()}`);
      if (res.success) {
        setShops(res.data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch shops:', err);
    } finally {
      setLoadingShops(false);
    }
  }, [shopSearch]);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const params = new URLSearchParams({ limit: '20', isActive: 'true' });
      if (productSearchDebounced) params.set('search', productSearchDebounced);
      const res = await adminFetch(`/api/products?${params.toString()}`);
      if (res.success) {
        setProducts(res.data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, [productSearchDebounced]);

  useEffect(() => {
    if (open) {
      fetchShops();
      fetchProducts();
    }
  }, [open, fetchShops, fetchProducts]);

  // Debounced product search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setProductSearchDebounced(productSearch);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [productSearch]);

  useEffect(() => {
    if (productSearchDebounced) {
      fetchProducts();
    }
  }, [productSearchDebounced, fetchProducts]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedShop(null);
      setCart([]);
      setPaymentMethod('');
      setCustomerNotes('');
      setShopSearch('');
      setProductSearch('');
    }
  }, [open]);

  // Add product to cart
  const addProduct = (product: ProductOption) => {
    const existing = cart.find((item) => item.product.id === product.id);
    if (existing) {
      setCart((prev) =>
        prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + product.minOrderQty }
            : item
        )
      );
    } else {
      setCart((prev) => [...prev, { product, quantity: product.minOrderQty }]);
    }
    setProductSearch('');
    setShowProductDropdown(false);
  };

  // Update cart item quantity
  const updateCartQty = (productId: string, qty: number) => {
    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;
    const minQty = item.product.minOrderQty || 1;
    const maxQty = item.product.maxOrderQty || Infinity;
    const newQty = Math.max(minQty, Math.min(maxQty, qty));
    setCart((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity: newQty } : i))
    );
  };

  // Remove cart item
  const removeCartItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.product.basePrice * item.quantity, 0);
  const selectedPM = PAYMENT_METHODS.find((pm) => pm.value === paymentMethod);
  const discountAmount = selectedPM ? Math.round(subtotal * selectedPM.discount) : 0;
  const deliveryFee = selectedPM?.fee || 0;
  const totalAmount = subtotal - discountAmount + deliveryFee;

  // Submit
  const handleSubmit = async () => {
    if (!selectedShop) {
      toast.error(t('Please select a shop', 'Vui lòng chọn cửa hàng'));
      return;
    }
    if (cart.length === 0) {
      toast.error(t('Please add at least one product', 'Vui lòng thêm ít nhất 1 sản phẩm'));
      return;
    }
    if (!paymentMethod) {
      toast.error(t('Please select payment method', 'Vui lòng chọn phương thức thanh toán'));
      return;
    }

    try {
      setSubmitting(true);
      const res = await adminFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: selectedShop.id,
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          paymentMethod,
          customerNotes: customerNotes.trim() || undefined,
        }),
      });
      if (res.success) {
        toast.success(t('Order created successfully!', 'Tạo đơn hàng thành công!'));
        onOpenChange(false);
        onCreated?.();
      } else {
        const errors = res.error?.details?.errors;
        if (Array.isArray(errors) && errors.length > 0) {
          errors.forEach((err: string) => toast.error(err));
        } else {
          toast.error(res.error?.message || t('Failed to create order', 'Không thể tạo đơn hàng'));
        }
      }
    } catch (err) {
      console.error('Create order error:', err);
      toast.error(t('Network error', 'Lỗi mạng'));
    } finally {
      setSubmitting(false);
    }
  };

  const cartProductIds = new Set(cart.map((item) => item.product.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-red-600" />
            {t('Create Order', 'Tạo đơn hàng')}
          </DialogTitle>
          <DialogDescription>
            {t('Select shop, add products, and submit order', 'Chọn cửa hàng, thêm sản phẩm và gửi đơn hàng')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          {/* Step 1: Shop Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              <Store className="h-3.5 w-3.5 mr-1 inline" />
              {t('Shop', 'Cửa hàng')} <span className="text-red-500">*</span>
            </Label>
            {selectedShop ? (
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{selectedShop.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedShop.district}{selectedShop.province ? `, ${selectedShop.province}` : ''}
                    {selectedShop.creditStatus === 'LOCKED' && (
                      <Badge variant="secondary" className="ml-2 bg-red-100 text-red-600 text-[9px] px-1 py-0">LOCKED</Badge>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSelectedShop(null)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="relative" ref={shopSearchRef}>
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('Search shop by name or phone...', 'Tìm cửa hàng theo tên hoặc SĐT...')}
                  className="pl-8 h-9"
                  value={shopSearch}
                  onChange={(e) => setShopSearch(e.target.value)}
                />
                {shopSearch && shops.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md max-h-40 overflow-y-auto">
                    {shops.slice(0, 10).map((shop) => (
                      <button
                        key={shop.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                        onClick={() => {
                          setSelectedShop(shop);
                          setShopSearch('');
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{shop.name}</span>
                          {shop.creditStatus === 'LOCKED' && (
                            <Badge variant="secondary" className="bg-red-100 text-red-600 text-[9px] px-1 py-0">LOCKED</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">{shop.district}{shop.province ? `, ${shop.province}` : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                {loadingShops && <Skeleton className="h-8 w-full mt-1" />}
              </div>
            )}
          </div>

          {/* Step 2: Product Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('Products', 'Sản phẩm')} <span className="text-red-500">*</span>
            </Label>
            <div className="relative" ref={productSearchRef}>
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('Search products by name or SKU...', 'Tìm sản phẩm theo tên hoặc mã SP...')}
                className="pl-8 h-9"
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
              />
              {showProductDropdown && productSearch && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                  {loadingProducts ? (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
                      {t('Searching...', 'Đang tìm...')}
                    </div>
                  ) : products.filter((p) => !cartProductIds.has(p.id)).length > 0 ? (
                    products
                      .filter((p) => !cartProductIds.has(p.id))
                      .slice(0, 10)
                      .map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b last:border-b-0"
                          onClick={() => addProduct(product)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-xs">{product.name}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {product.sku} · {t('Stock', 'Tồn')}: {product.stockQuantity}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-red-600 whitespace-nowrap ml-2">
                              {formatVND(product.basePrice)}
                            </span>
                          </div>
                        </button>
                      ))
                  ) : (
                    <div className="p-3 text-center text-xs text-muted-foreground">
                      {t('No products found', 'Không tìm thấy sản phẩm')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t('Cart', 'Giỏ hàng')} ({cart.length} {t('items', 'SP')})
              </Label>
              <div className="rounded-lg border divide-y max-h-52 overflow-y-auto">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.product.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatVND(item.product.basePrice)} × {item.quantity} = {formatVND(item.product.basePrice * item.quantity)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateCartQty(item.product.id, item.quantity - 1)}
                        disabled={item.quantity <= (item.product.minOrderQty || 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-xs font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => updateCartQty(item.product.id, item.quantity + 1)}
                        disabled={item.quantity >= (item.product.maxOrderQty || 999)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => removeCartItem(item.product.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Payment Method */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t('Payment Method', 'Phương thức thanh toán')} <span className="text-red-500">*</span>
            </Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder={t('Select payment method', 'Chọn phương thức thanh toán')} />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((pm) => (
                  <SelectItem key={pm.value} value={pm.value}>
                    {locale === 'vi' ? pm.labelVi : pm.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('Customer Notes', 'Ghi chú')}</Label>
            <Textarea
              placeholder={t('Optional notes...', 'Ghi chú (tùy chọn)...')}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              rows={2}
              disabled={submitting}
            />
          </div>

          {/* Order Summary */}
          {cart.length > 0 && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <h4 className="text-sm font-semibold">{t('Order Summary', 'Tóm tắt đơn hàng')}</h4>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('Subtotal', 'Tạm tính')}</span>
                  <span>{formatVND(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>{t('Discount (2%)', 'Giảm giá (2%)')}</span>
                    <span>-{formatVND(discountAmount)}</span>
                  </div>
                )}
                {deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('Delivery Fee', 'Phí giao hàng')}</span>
                    <span>+{formatVND(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-1 border-t">
                  <span>{t('Total', 'Tổng thanh tiền')}</span>
                  <span className="text-red-700">{formatVND(totalAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('Cancel', 'Hủy')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || cart.length === 0 || !selectedShop || !paymentMethod}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {submitting
              ? t('Creating...', 'Đang tạo...')
              : t('Create Order', 'Tạo đơn hàng')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
