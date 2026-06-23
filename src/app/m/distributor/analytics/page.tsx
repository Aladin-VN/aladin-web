'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAuthStore } from '@/stores/auth.store';
import { BarChart3, CreditCard, Package, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function DistributorAnalyticsMobile() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/distributor/analytics');
      if (res.success) setData(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const kpis = data ? [
    { label: 'Doanh thu 30 ngày', value: formatVND(data.salesTrend?.reduce((s: number, d: any) => s + d.revenue, 0) || 0), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Tăng trưởng tuần', value: `${data.comparison?.weekGrowth || 0}%`, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Vòng quay tồn kho', value: `${data.inventory?.turnoverRate || 0}/ngày`, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Cảnh báo tồn kho', value: `${data.inventory?.lowStock || 0}`, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  ] : [];

  return (
    <div className="px-4 pt-4 pb-24 space-y-4">
      <h1 className="text-xl font-bold mb-1">Phân tích</h1>
      <p className="text-sm text-muted-foreground mb-4">Báo cáo doanh thu & tồn kho</p>
      <Button variant="outline" size="sm" className="gap-1" onClick={fetchAnalytics} disabled={loading}>
        <TrendingUp className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
      </Button>

      {loading ? <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div> : (
        <div className="grid grid-cols-2 gap-3">
          {kpis.map(kpi => (
            <Card key={kpi.label} className={`${kpi.bg} border-0`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-1"><kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} /><span className="text-[11px] text-muted-foreground">{kpi.label}</span></div>
                <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Comparison */}
      {data?.comparison && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-3 flex items-center justify-between">
            <div><p className="text-xs text-muted-foreground">Tuần này</p><p className="text-base font-bold">{formatVND(data.comparison.thisWeek.revenue)}</p><p className="text-xs text-muted-foreground">{data.comparison.thisWeek.orders} đơn</p></div>
            <div className="text-right"><p className="text-xs text-muted-foreground">Tháng này</p><p className="text-base font-bold">{formatVND(data.comparison.thisMonth.revenue)}</p><p className="text-xs text-muted-foreground">{data.comparison.thisMonth.orders} đơn</p></div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Trend (CSS bars) */}
      {data?.salesTrend && (
        <Card>
          <CardContent className="p-3">
            <h3 className="text-sm font-semibold mb-3">Xu hướng doanh thu 30 ngày</h3>
            <div className="flex items-end gap-[2px] h-24">
              {data.salesTrend.slice(-14).map((d: any, i: number) => {
                const maxRev = Math.max(...data.salesTrend.slice(-14).map((x: any) => x.revenue), 1);
                const h = (d.revenue / maxRev) * 100;
                return <div key={i} className="flex-1 bg-yellow-400/80 rounded-t" style={{ height: `${h}%` }} />;
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Products */}
      <Card>
        <CardContent className="p-3">
          <h3 className="text-sm font-semibold mb-3">Sản phẩm bán chạy</h3>
          {loading ? <Skeleton className="h-40" /> : (
            <div className="space-y-2">
              {(data?.topProducts || []).slice(0, 7).map((p: any, i: number) => (
                <div key={p.productId} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <div><p className="text-sm font-medium">{p.productName}</p><p className="text-xs text-muted-foreground">{p.sku}</p></div>
                  <span className="text-sm font-semibold">{formatVND(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Margin Top */}
      <Card>
        <CardContent className="p-3">
          <h3 className="text-sm font-semibold mb-3">Biên lợi nhuận hàng đầu</h3>
          {loading ? <Skeleton className="h-40" /> : (
            <div className="space-y-2">
              {(data?.marginAnalysis || []).slice(0, 5).map((m: any) => (
                <div key={m.productId} className="flex items-center justify-between py-1.5">
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{m.productName}</p><p className="text-xs text-muted-foreground">{m.sku}</p></div>
                  <Badge variant={parseFloat(m.margin) > 20 ? 'default' : 'secondary'} className={parseFloat(m.margin) > 20 ? 'bg-green-500' : ''}>{m.margin}%</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export */}
      <a href="/api/distributor/export?type=analytics" download className="block">
        <Button variant="outline" className="w-full gap-2" size="lg"><CreditCard className="h-5 w-5" />Xuất CSV Analytics</Button>
      </a>
    </div>
  );
}