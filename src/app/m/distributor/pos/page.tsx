'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import {
  Search, Plus, Minus, Trash2, ShoppingCart,
  X, CheckCircle2, Loader2, Package, Printer, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Product {
  id: string;
  sku: string;
  name: string;
  barcode?: string;
  unit?: string;
  imageUrl?: string;
  basePrice: number;
  costPrice?: number;
  stock: number;
  category?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'DEBT';

export default function MobilePOSPage() {
  // Search
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Sheet
  const [cartSheetOpen, setCartSheetOpen] = useState(false);

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // Receipt
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Computed
  const cartTotal = cart.reduce((sum, item) => sum + item.product.basePrice * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Auto-focus search
  useEffect(() => {
    const timer = setTimeout(() => searchInputRef.current?.focus(), 200);
    return () => clearTimeout(timer);
  }, []);

  // Search
  useEffect(() => {
    if (!query.trim()) {
      setProducts([]);
      setSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await adminFetch(`/api/distributor/pos/products?q=${encodeURIComponent(query.trim())}&limit=20`);
        if (res.success) setProducts(res.data.products || []);
      } catch {}
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Add to cart
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setQuery('');
    setProducts([]);
    searchInputRef.current?.focus();
  };

  const updateQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: Math.min(newQty, item.product.stock) }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Submit
  const completeSale = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await adminFetch('/api/distributor/pos/sale', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
          paymentMethod,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
        }),
      });

      if (res.success) {
        const saleResult = res.data;
        try {
          const receiptRes = await adminFetch('/api/distributor/pos/receipt', {
            method: 'POST',
            body: JSON.stringify({ shiftId: saleResult.id, saleSequence: saleResult.saleSequence }),
          });
          if (receiptRes.success) setReceiptData(receiptRes.data.receipt);
        } catch {}
        setCartSheetOpen(false);
        setReceiptOpen(true);
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
      } else {
        alert(res.error?.message || 'Lỗi');
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi mạng');
    }
    setSubmitting(false);
  };

  const printReceipt = () => {
    const el = document.getElementById('m-receipt-printable');
    if (!el) return;
    const w = window.open('', '_blank', 'width=300,height=600');
    if (!w) return;
    w.document.write(`<html><head><title>Hóa đơn</title><style>body{font-family:monospace;font-size:12px;padding:10px;max-width:280px;margin:0 auto}.center{text-align:center}.bold{font-weight:bold}.line{border-top:1px dashed #000;margin:8px 0}.row{display:flex;justify-content:space-between}</style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold">Bán hàng</h1>
          {cartCount > 0 && (
            <button
              onClick={() => setCartSheetOpen(true)}
              className="relative flex items-center gap-1.5 bg-yellow-500 text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg shadow-yellow-300/40 active:scale-95 transition-transform"
            >
              <ShoppingCart className="h-4 w-4" />
              {cartCount}
              <span className="text-yellow-100">{formatVND(cartTotal)}</span>
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Tìm barcode, SKU, tên SP..."
            className="pl-9 h-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && products.length === 1) addToCart(products[0]);
              if (e.key === 'Escape') { setQuery(''); setProducts([]); }
            }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setProducts([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Product List */}
      <div className="p-4">
        {searching ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
        ) : query && products.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Không tìm thấy sản phẩm</p>
          </div>
        ) : !query ? (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-15" />
            <p className="text-sm">Tìm kiếm sản phẩm để bán</p>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map((product) => {
              const inCart = cart.find((c) => c.product.id === product.id);
              return (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`w-full text-left p-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                    inCart ? 'border-yellow-400 bg-yellow-50/50' : 'border-border/60 bg-card'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name}</p>
                      <p className="text-[10px] text-muted-foreground">{product.sku}{product.barcode ? ` · ${product.barcode}` : ''}</p>
                    </div>
                    {inCart && (
                      <Badge className="bg-yellow-500 text-white text-[10px] h-5 px-1.5 rounded-full">
                        {inCart.quantity}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-end justify-between mt-1.5">
                    <span className="text-sm font-bold text-yellow-600">{formatVND(product.basePrice)}</span>
                    <span className="text-[10px] text-muted-foreground">SL: {product.stock}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && !cartSheetOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-white via-white to-transparent">
          <button
            onClick={() => setCartSheetOpen(true)}
            className="w-full h-14 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-2xl font-bold text-base shadow-2xl shadow-orange-400/40 flex items-center justify-center gap-3 active:scale-[0.98] transition-transform"
          >
            <ShoppingCart className="h-5 w-5" />
            <span>{cartCount} sản phẩm</span>
            <Separator orientation="vertical" className="h-6 bg-white/30" />
            <span>{formatVND(cartTotal)}</span>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Cart Sheet (Bottom Drawer) */}
      <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl px-0 pb-0">
          <SheetHeader className="px-4 pt-2 pb-3">
            <SheetTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Giỏ hàng ({cartCount})
              </span>
              <button
                onClick={() => { setCart([]); setCustomerName(''); setCustomerPhone(''); }}
                className="text-xs text-red-500 font-medium"
              >
                Xóa tất cả
              </button>
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col h-[calc(85vh-80px)]">
            {/* Cart Items */}
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-2 pb-4">
                {cart.map((item) => (
                  <Card key={item.product.id} className="border-dashed">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.product.name}</p>
                          <p className="text-[10px] text-muted-foreground">{formatVND(item.product.basePrice)} / {item.product.unit || 'cái'}</p>
                        </div>
                        <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateQty(item.product.id, item.quantity - 1)} className="h-8 w-8 rounded-lg border flex items-center justify-center">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                          <button onClick={() => updateQty(item.product.id, item.quantity + 1)} className="h-8 w-8 rounded-lg border flex items-center justify-center" disabled={item.quantity >= item.product.stock}>
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-sm font-bold">{formatVND(item.product.basePrice * item.quantity)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            {/* Payment Section (sticky bottom) */}
            <div className="border-t bg-white px-4 pt-3 pb-6">
              {/* Totals */}
              <div className="flex justify-between mb-3">
                <span className="text-sm text-muted-foreground">Tổng cộng</span>
                <span className="text-xl font-bold text-yellow-600">{formatVND(cartTotal)}</span>
              </div>

              {/* Payment Method */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { value: 'CASH' as const, label: 'Tiền mặt', color: 'bg-green-50 border-green-200 text-green-700' },
                  { value: 'BANK_TRANSFER' as const, label: 'Chuyển khoản', color: 'bg-blue-50 border-blue-200 text-blue-700' },
                  { value: 'DEBT' as const, label: 'Công nợ', color: 'bg-orange-50 border-orange-200 text-orange-700' },
                ].map((pm) => (
                  <button
                    key={pm.value}
                    onClick={() => setPaymentMethod(pm.value)}
                    className={`p-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                      paymentMethod === pm.value ? pm.color : 'border-transparent bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>

              {/* Customer Info */}
              <div className="flex gap-2 mb-3">
                <Input placeholder="Tên KH (tùy chọn)" className="h-9 text-xs" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                <Input placeholder="SĐT" className="h-9 text-xs w-28" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
              </div>

              {/* Submit */}
              <Button
                className="w-full h-12 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold text-base shadow-lg shadow-orange-300/30"
                disabled={cart.length === 0 || submitting}
                onClick={completeSale}
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                {submitting ? 'Đang xử lý...' : 'Hoàn thành bán hàng'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Bán hàng thành công!
            </DialogTitle>
          </DialogHeader>
          {receiptData && (
            <div id="m-receipt-printable" className="space-y-3">
              <div className="border-2 border-dashed rounded-lg p-4 bg-white text-xs space-y-3">
                <div className="center">
                  <p className="bold text-sm">ALADIN POS</p>
                  <p>{receiptData.distributor?.name}</p>
                </div>
                <div className="line" />
                <div className="row"><span>Mã HĐ:</span><span className="bold">#{receiptData.saleSequence}</span></div>
                <div className="row"><span>Ngày:</span><span>{new Date(receiptData.saleDate).toLocaleString('vi-VN')}</span></div>
                <div className="line" />
                {receiptData.items.map((item: any, idx: number) => (
                  <div key={idx}>
                    <p className="bold">{item.productName}</p>
                    <div className="row"><span>{item.quantity} x {formatVND(item.unitPrice)}</span><span className="bold">{formatVND(item.totalPrice)}</span></div>
                  </div>
                ))}
                <div className="line" />
                <div className="row"><span className="bold text-sm">TỔNG CỘNG</span><span className="bold text-sm">{formatVND(receiptData.total)}</span></div>
                <div className="line" />
                <div className="center" style={{ fontSize: '10px' }}><p>Cảm ơn quý khách!</p></div>
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setReceiptOpen(false)}>Đóng</Button>
            <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white" onClick={printReceipt}>
              <Printer className="h-4 w-4 mr-1" /> In HĐ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}