'use client';
import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';
import { ArrowRight, TrendingUp, CreditCard, Package, BarChart3, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function ShopAnalytics() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/shops/my-analytics');
        if (res.success) setData(res.data);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const kpis = data ? [
    { label: 'Chi tiêu tháng này', value: formatVND(data.comparison?.thisMonth?.revenue || 0), icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Số đơn hàng', value: `${data.comparison?.thisMonth?.orders || 0}`, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'ĐTB trung bình', value: formatVND(data.comparison?.thisMonth?.revenue / (data.comparison?.thisMonth?.orders || 1)), icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Tăng trưởng', value: `${data.comparison?.monthGrowth || 0}%`, icon: TrendingUp, color: (data.comparison?.monthGrowth || 0) >= 0 ? 'text-green-600' : 'text-red-600', bg: 'bg-yellow-50' },
  ] : [];

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Phân tích của tôi</h1><p className="text-sm text-muted-foreground">Báo cáo mua hàng</p></div>
        <Button variant="ghost" size="sm" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
      </div>

      {loading ? <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div> : (
        <>
          <div className="grid grid-cols-2 gap-3">{kpis.map(kpi => (
            <Card key={kpi.label} className={`${kpi.bg} border-0`}><CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1"><kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} /><span className="text-[11px] text-muted-foreground">{kpi.label}</span></div>
              <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent></Card>
          ))}</div>

          {/* Favorite Products */}
          {data?.favoriteProducts && data.favoriteProducts.length > 0 && (
            <Card><CardContent className="p-3">
              <h3 className="text-sm font-semibold mb-3">Sản phẩm hay mua</h3>
              <div className="space-y-2">
                {data.favoriteProducts.slice(0, 5).map((p: any) => (
                  <div key={p.productId} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-0">
                    <div><p className="text-sm font-medium">{p.productName}</p><p className="text-xs text-muted-foreground">x{p.quantity}</p></div>
                    <span className="text-sm font-semibold">{formatVND(p.totalSpent)}</span>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}

          {/* Loyalty Progress */}
          {data?.loyalty && (
            <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50/50 to-transparent">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-2">Hạng thành viên</h3>
                <div className="flex items-center justify-between mb-2">
                  <Badge className="text-base px-3 py-1">{data.loyalty.currentTier}</Badge>
                  {data.loyalty.nextTier && <div className="text-right text-xs text-muted-foreground"><span>Cần thêm {data.loyalty.ordersNeeded} đơn hoặc {formatVND(data.loyalty.spendNeeded)} để lên <b>{data.loyalty.nextTier}</b></span></div>}
                </div>
                {data.loyalty.benefits?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {data.loyalty.benefits.map((b: string, i: number) => (
                      <p key={i} className="text-xs text-muted-foreground">✓ {b}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Benchmark */}
          {data?.benchmarks && (
            <Card><CardContent className="p-3">
              <h3 className="text-sm font-semibold mb-3">So sánh với trung bình</h3>
              <div className="space-y-2">
                {data.benchmarks.slice(0, 5).map((b: any) => (
                  <div key={b.metric} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-sm">{b.metric}</span>
                    <div className="text-right"><span className="text-sm font-semibold">{formatVND(b.myValue)}</span><span className="text-xs text-muted-foreground ml-1">/ {formatVND(b.avgValue)}</span></div>
                  </div>
                ))}
              </div>
            </CardContent></Card>
          )}

          <Button variant="outline" className="w-full" onClick={() => router.push('/m/shop/reorder')}><RefreshCw className="h-4 w-4 mr-1" />Gợi ý đặt hàng</Button>
        </>
      )}
    </div>
  );
}