'use client';
import { toast } from 'sonner';
import { useState, useEffect, useRef, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { Search, Plus, Minus, Trash2, ShoppingCart, Banknote, CreditCard, Wallet, CheckCircle, Printer, ScanBarcode, Camera, CameraOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AdminHeader } from '@/components/layout/admin-header';

export default function POSTerminal() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const searchRef = useRef<HTMLInputElement>(null);
  const [barcodeMode, setBarcodeMode] = useState(false);
  const lastKeystrokeRef = useRef<number>(0);
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const barcodeScanningRef = useRef(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [cart, setCart] = useState<any[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const scannerRef = useRef<any>(null);

  useEffect(() => { searchRef.current?.focus(); }, []);

  useEffect(() => {
    if (barcodeMode) {
      searchRef.current?.focus();
    }
  }, [barcodeMode]);

  useEffect(() => {
    if (barcodeMode) return;
    if (!query.trim()) { queueMicrotask(() => setResults([])); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await adminFetch(`/api/distributor/pos/products?q=${encodeURIComponent(query)}&limit=15`);
        if (res.success) setResults(res.data);
      } catch (e) { console.error("[FETCH ERROR]", e); }
    }, 200);
    return () => clearTimeout(timer);
  }, [query, barcodeMode]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.productId === product.productId);
      if (existing) return prev.map(i => i.productId === product.productId ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price } : i);
      return [...prev, { ...product, quantity: 1, subtotal: product.price }];
    });
  };

  const handleBarcodeScan = useCallback(async (barcode: string) => {
    if (barcodeScanningRef.current || !barcode.trim()) return;
    barcodeScanningRef.current = true;
    try {
      const res = await adminFetch(`/api/distributor/pos/products?q=${encodeURIComponent(barcode.trim())}&limit=50`);
      if (res.success) {
        const products = res.data;
        if (products.length === 1) {
          addToCart(products[0]);
          toast.success(`${t('Đã thêm', 'Added')}: ${products[0].productName}`);
          setQuery('');
          setResults([]);
        } else if (products.length > 1) {
          setResults(products);
          setQuery('');
        } else {
          toast.error(t('Không tìm thấy sản phẩm', 'Product not found'));
          setQuery('');
          setResults([]);
        }
      } else {
        toast.error(res.error?.message || t('Lỗi quét mã vạch', 'Barcode scan error'));
        setQuery('');
      }
    } catch (e) {
      console.error('[BARCODE ERROR]', e);
      toast.error(t('Lỗi quét mã vạch', 'Barcode scan error'));
      setQuery('');
    }
    setTimeout(() => { searchRef.current?.focus(); }, 10);
    barcodeScanningRef.current = false;
  }, [t]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (barcodeMode) {
      const now = Date.now();
      lastKeystrokeRef.current = now;
      if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
      barcodeTimerRef.current = setTimeout(() => {
        const elapsed = Date.now() - lastKeystrokeRef.current;
        if (elapsed >= 50 && value.trim().length > 0) {
          handleBarcodeScan(value);
        }
      }, 80);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (barcodeMode && e.key === 'Enter') {
      e.preventDefault();
      if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
      if (query.trim()) {
        handleBarcodeScan(query);
      }
    }
  };

  const updateQty = (idx: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const newQty = Math.max(0, item.quantity + delta);
      return newQty === 0 ? null : { ...item, quantity: newQty, subtotal: newQty * item.price };
    }).filter(Boolean));
  };

  const total = cart.reduce((s, i) => s + i.subtotal, 0);

  const completeSale = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await adminFetch('/api/distributor/pos/sale', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map(i => ({ productId: i.productId, quantity: i.quantity })),
          paymentMethod,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
        }),
      });
      if (res.success) {
        setReceipt(res.data);
        setReceiptOpen(true);
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setQuery('');
      } else {
        toast.error(res.error?.message || t("Lỗi", "Error"));
      }
    } catch (e) { console.error("[FETCH ERROR]", e); }
    setSubmitting(false);
  };

  const fetchRecent = async () => {
    try {
      const res = await adminFetch('/api/distributor/pos/reconciliation');
      if (res.success) setRecentSales(res.data.transactions || []);
    } catch (e) { console.error("[FETCH ERROR]", e); }
  };

  // Camera barcode scanner
  const startCameraScanner = useCallback(async () => {
    setCameraOpen(true);
    // Dynamic import to avoid SSR issues
    try {
      const { Html5QrcodeScanner } = await import('html5-qrcode');
      await new Promise(resolve => setTimeout(resolve, 100));
      const scannerId = 'barcode-scanner';
      if (!document.getElementById(scannerId)) return;
      const scanner = new Html5QrcodeScanner(scannerId, {
        fps: 10,
        qrbox: { width: 280, height: 120 },
        formatsToSupport: [
          0, // QR_CODE
          2, // EAN_13
          1, // EAN_8
          3, // UPC_A
          4, // UPC_E
          6, // CODE_128
          7, // CODE_39
        ],
      }, false);
      scannerRef.current = scanner;
      scanner.render(async (decodedText: string) => {
        try {
          scanner.stop();
          setCameraOpen(false);
          await handleBarcodeScan(decodedText);
        } catch (e) {
          console.error('[CAMERA SCAN ERROR]', e);
        }
      }, (errorMessage: string) => {
        // Silently ignore scan failures (normal for continuous scanning)
      });
    } catch (e) {
      console.error('[CAMERA INIT ERROR]', e);
      toast.error(t('Không thể khởi tạo camera', 'Cannot initialize camera'));
      setCameraOpen(false);
    }
  }, [handleBarcodeScan, t]);

  const stopCameraScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (e) { /* ignore */ }
      scannerRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop(); } catch (e) { /* ignore */ }
      }
    };
  }, []);

  return (
    <>
      <AdminHeader />
      <div className="flex flex-1 flex-col h-[calc(100vh-57px)]">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h1 className="text-lg font-bold">{t('POS - Bán hàng', 'POS Terminal')}</h1>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={startCameraScanner}>
                <Camera className="h-4 w-4 mr-1" /> {t('Quét camera', 'Camera Scan')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setShowRecent(!showRecent); if (!showRecent) fetchRecent(); }}>
                <ShoppingCart className="h-4 w-4 mr-1" /> {t('Gần đây', 'Recent')} ({recentSales.length})
              </Button>
            </div>
          </div>
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Products */}
            <div className="flex-1 flex flex-col border-r">
              <div className="p-3 border-b">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={searchRef}
                      placeholder={barcodeMode ? t('Quét mã vạch...', 'Scan barcode...') : t('Tìm sản phẩm (tên, SKU, mã vạch)...', 'Search product...')}
                      className={`pl-9 transition-all duration-200 ${barcodeMode ? 'ring-2 ring-red-500/60 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : ''}`}
                      value={query}
                      onChange={handleSearchChange}
                      onKeyDown={handleSearchKeyDown}
                    />
                  </div>
                  <Button
                    variant={barcodeMode ? 'destructive' : 'outline'}
                    size="icon"
                    className={`h-9 w-9 shrink-0 transition-all ${barcodeMode ? 'shadow-[0_0_12px_rgba(239,68,68,0.4)]' : ''}`}
                    onClick={() => {
                      setBarcodeMode(prev => !prev);
                      if (!barcodeMode) {
                        setQuery('');
                        setResults([]);
                      }
                    }}
                    title={barcodeMode ? t('Tắt quét mã vạch', 'Turn off barcode scanner') : t('Bật quét mã vạch', 'Turn on barcode scanner')}
                  >
                    <ScanBarcode className={`h-4 w-4 ${barcodeMode ? 'text-white' : ''}`} />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-3 grid grid-cols-2 gap-2 content-start">
                {results.map(p => (
                  <Card key={p.productId} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => addToCart(p)}>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate">{p.productName}</p>
                      <p className="text-xs text-muted-foreground">{p.sku} · {p.category}</p>
                      <div className="flex justify-between items-center mt-2">
                        <span className="font-semibold text-sm">{formatVND(p.price)}</span>
                        <Badge variant="outline" className="text-[10px]">{p.available}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
            {/* Right: Cart */}
            <div className="w-96 flex flex-col">
              <div className="p-3 border-b bg-muted/30">
                <h2 className="text-sm font-semibold">{t('Giỏ hàng', 'Cart')} ({cart.length})</h2>
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-2">
                {cart.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">{t('Nhấn sản phẩm để thêm', 'Tap products to add')}</p>}
                {cart.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{item.productName}</p><p className="text-xs text-muted-foreground">{formatVND(item.price)}/đơn vị</p></div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQty(i, -1)}><Minus className="h-3 w-3" /></Button>
                      <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => updateQty(i, 1)}><Plus className="h-3 w-3" /></Button>
                    </div>
                    <span className="text-sm font-semibold w-24 text-right">{formatVND(item.subtotal)}</span>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => setCart(prev => prev.filter((_, idx) => idx !== i))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
              </div>
              <div className="border-t p-3 space-y-3">
                <div className="flex gap-2">
                  <Input placeholder={t('Tên KH', 'Customer')} value={customerName} onChange={e => setCustomerName(e.target.value)} className="h-9 text-sm" />
                  <Input placeholder={t('SĐT', 'Phone')} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="h-9 text-sm" />
                </div>
                <div className="flex gap-2">
                  {(['CASH', 'BANK_TRANSFER', 'DEBT'] as const).map(m => (
                    <Button key={m} size="sm" variant={paymentMethod === m ? 'default' : 'outline'} className="flex-1 h-9 text-xs" onClick={() => setPaymentMethod(m)}>
                      {m === 'CASH' ? <Banknote className="h-3 w-3 mr-1" /> : m === 'BANK_TRANSFER' ? <CreditCard className="h-3 w-3 mr-1" /> : <Wallet className="h-3 w-3 mr-1" />}
                      {m === 'CASH' ? t('Tiền mặt', 'Cash') : m === 'BANK_TRANSFER' ? t('Chuyển khoản', 'Bank') : t('Công nợ', 'Debt')}
                    </Button>
                  ))}
                </div>
                <Separator />
                <div className="flex justify-between"><span className="font-semibold">Tổng cộng</span><span className="text-xl font-bold">{formatVND(total)}</span></div>
                <Button className="w-full" disabled={cart.length === 0 || submitting} onClick={completeSale}>
                  {submitting ? t('Đang xử lý...', 'Processing...') : <><CheckCircle className="h-4 w-4 mr-1" />{t('Hoàn thành', 'Complete Sale')}</>}
                </Button>
              </div>
            </div>
          </div>
        </div>

      {/* Receipt Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('Hóa đơn', 'Receipt')}</DialogTitle></DialogHeader>
          {receipt && (
            <div className="space-y-3 text-sm">
              <div className="text-center border-b pb-3"><p className="font-bold">ALADIN POS</p><p className="text-xs text-muted-foreground">{receipt.orderNumber}</p><p className="text-xs text-muted-foreground">{new Date(receipt.createdAt).toLocaleString('vi-VN')}</p></div>
              <div className="space-y-1">{receipt.items.map((i: any, idx: number) => (
                <div key={idx} className="flex justify-between"><span>{i.productName} x{i.quantity}</span><span>{formatVND(i.subtotal)}</span></div>
              ))}
              </div>
              <div className="border-t pt-2 flex justify-between font-bold"><span>TỔNG CỘNG</span><span>{formatVND(receipt.totalAmount)}</span></div>
              <p className="text-xs text-muted-foreground text-center">Thanh toán: {receipt.paymentMethod}</p>
              {receipt.customerName && <p className="text-xs text-muted-foreground text-center">KH: {receipt.customerName} {receipt.customerPhone}</p>}
              <Button variant="outline" className="w-full" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />{t('In', 'Print')}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Camera Barcode Scanner Dialog */}
      <Dialog open={cameraOpen} onOpenChange={(open) => { if (!open) stopCameraScanner(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {t('Quét mã vạch bằng camera', 'Camera Barcode Scanner')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('Hướng camera vào mã vạch hoặc mã QR. Tự động nhận diện khi quét thành công.', 'Point camera at barcode or QR code. Auto-detects on successful scan.')}
            </p>
            <div id="barcode-scanner" className="w-full overflow-hidden rounded-lg" />
            <div className="flex justify-center">
              <Button variant="outline" onClick={stopCameraScanner}>
                <CameraOff className="h-4 w-4 mr-1" />
                {t('Đóng camera', 'Close Camera')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Recent Sales Drawer */}
      {showRecent && (
        <div className="fixed inset-y-0 right-0 w-80 bg-background border-l z-50 shadow-lg p-4 overflow-auto">
          <div className="flex justify-between items-center mb-3"><h3 className="font-semibold">{t('Giao dịch hôm nay', 'Today Sales')}</h3><Button variant="ghost" size="sm" onClick={() => setShowRecent(false)}>✕</Button></div>
          <div className="space-y-2">{recentSales.map((s: any) => (
            <Card key={s.id} className="p-2"><div className="flex justify-between text-sm"><span className="font-medium">{s.orderNumber}</span><span className="font-semibold">{formatVND(s.totalAmount)}</span></div></Card>
          ))}</div>
        </div>
      )}
    </>
  );
}