'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAuthStore } from '@/stores/auth.store';
import { ArrowLeft, ShoppingCart, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export default function ShopReorder() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/shops/reorder-suggestions');
        if (res.success) setSuggestions(res.data.suggestions || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleReorder = (productId: string, qty: number) => {
    if (!productId) return;
    // Add to cart
    const cart = JSON.parse(localStorage.getItem('aladin-cart') || '[]');
    const existing = cart.find((c: any) => c.productId === productId);
    if (existing) existing.quantity += qty;
    else cart.push({ productId, quantity: qty, name: '', price: 0 });
    localStorage.setItem('aladin-cart', JSON.stringify(cart));
    router.push('/m/cart');
  };

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Gợi ý đặt hàng</h1><p className="text-sm text-muted-foreground">Dựa trên lịch sử mua</p></div>
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
      </div>

      {loading ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div> : suggestions.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Bạn đã đặt hàng đầy đủ!</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s: any) => (
            <Card key={s.productId} className={s.hasPromotion ? 'border-yellow-200 bg-yellow-50/50' : ''}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.productName}</p>
                    <p className="text-xs text-muted-foreground">SKU: {s.sku} · {formatVND(s.price)}/đv</p>
                    <p className="text-xs text-muted-foreground mt-1">Đặt lần cuối: {s.lastOrdered} · TB: {s.avgFrequencyDays} ngày/lần</p>
                  </div>
                  {s.hasPromotion && <Badge className="bg-yellow-500 text-white text-[10px]">Khuyến mãi</Badge>}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">Gợi ý: {s.suggestedQty}</span>
                  <Button size="sm" onClick={() => handleReorder(s.productId, s.suggestedQty)}>
                    <ShoppingCart className="h-3.5 w-3.5 mr-1" />{s.suggestedQty}
                    <Package className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}