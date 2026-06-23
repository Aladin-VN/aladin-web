'use client';
import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAuth, useLocale } from '@/providers/app-provider';
import { BarChart3, TrendingUp, Download, RefreshCw, Package, DollarSign, AlertTriangle, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminHeader } from '@/components/layout/admin-header';
import { Separator } from '@/components/ui/separator';

export default function DistributorAnalytics() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/distributor/analytics');
      if (res.success) setData(res.data);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { fetchAnalytics(); }, []);

  const kpiCards = data ? [
    { label: t('Doanh thu 30 ngày', '30-Day Revenue'), value: formatVND(data.salesTrend?.reduce((s: number, d: any) => s + d.revenue, 0) || 0), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
    { label: t('Tăng trưởng tuần', 'Week Growth'), value: `${data.comparison?.weekGrowth || 0}%`, icon: TrendingUp, color: data.comparison?.weekGrowth >= 0 ? 'text-green-600' : 'text-red-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: t('Vòng quay tồn kho', 'Inventory Turnover'), value: `${data.inventory?.turnoverRate || 0}/ngày`, icon: Package, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: t('Tồn kho thấp', 'Low Stock Items'), value: data.inventory?.lowStock || 0, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
  ] : [];

  return (
    <>
      <AdminHeader />
      <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('Phân tích', 'Analytics')}</h1>
              <p className="text-sm text-muted-foreground">{t('Báo cáo doanh thu, tồn kho, biên lợi nhuận', 'Revenue, inventory & margin analytics')}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/api/distributor/export?type=analytics" download><Download className="h-4 w-4 mr-1" /> {t('Xuất CSV', 'Export CSV')}</a>
              </Button>
              <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> {t('Làm mới', 'Refresh')}
              </Button>
            </div>
          </div>
          <Separator />
          <div className="flex-1 px-6 py-4 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />) :
                kpiCards.map(kpi => (
                  <Card key={kpi.label} className={`${kpi.bg} border-0`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-1"><kpi.icon className={`h-4 w-4 ${kpi.color}`} /><span className="text-xs text-muted-foreground">{kpi.label}</span></div>
                      <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                    </CardContent>
                  </Card>
                ))}
            </div>

            {/* Comparison Cards */}
            {data?.comparison && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">{t('Tuần này', 'This Week')}</p>
                  <p className="text-lg font-bold">{formatVND(data.comparison.thisWeek.revenue)}</p>
                  <p className="text-xs text-muted-foreground">{data.comparison.thisWeek.orders} đơn</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">{t('Tháng này', 'This Month')}</p>
                  <p className="text-lg font-bold">{formatVND(data.comparison.thisMonth.revenue)}</p>
                  <p className="text-xs text-muted-foreground">{data.comparison.thisMonth.orders} đơn</p>
                </CardContent></Card>
                <Card><CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">{t('Tỷ lệ phí NT', 'Platform Fee Rate')}</p>
                  <p className="text-lg font-bold text-yellow-600">{((data.commissionRate || 0.03) * 100).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">{t('Trên doanh thu', 'On revenue')}</p>
                </CardContent></Card>
              </div>
            )}

            {/* Sales Trend Mini Chart (CSS-only) */}
            {data?.salesTrend && data.salesTrend.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t('Xu hướng doanh thu 30 ngày', '30-Day Revenue Trend')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-end gap-[2px] h-32">
                    {data.salesTrend.map((d: any, i: number) => {
                      const maxRev = Math.max(...data.salesTrend.map((x: any) => x.revenue), 1);
                      const h = (d.revenue / maxRev) * 100;
                      return (
                        <div key={i} className="flex-1 group relative" title={`${d.date}: ${formatVND(d.revenue)}`}>
                          <div className="w-full bg-yellow-400/80 hover:bg-yellow-500 rounded-t transition-all cursor-pointer" style={{ height: `${h}%` }} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                    <span>{data.salesTrend[0]?.date}</span>
                    <span>{data.salesTrend[data.salesTrend.length - 1]?.date}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Two columns: Top Products + Category Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Products */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4" /> {t('Sản phẩm bán chạy', 'Top Products')}</CardTitle>
                  <Button variant="outline" size="sm" className="ml-auto" asChild><a href="/api/distributor/export?type=analytics" download><Download className="h-3 w-3 mr-1" />CSV</a></Button>
                </CardHeader>
                <CardContent>
                  {loading ? <Skeleton className="h-48" /> : (
                    <Table><TableBody>
                      {(data?.topProducts || []).slice(0, 7).map((p: any, i: number) => (
                        <TableRow key={p.productId}>
                          <TableCell className="text-xs text-muted-foreground w-8">{i + 1}</TableCell>
                          <TableCell><p className="text-sm font-medium">{p.productName}</p><p className="text-xs text-muted-foreground">{p.sku}</p></TableCell>
                          <TableCell className="text-right font-semibold text-sm">{formatVND(p.revenue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody></Table>
                  )}
                </CardContent>
              </Card>

              {/* Category Breakdown */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t('Doanh thu theo danh mục', 'Revenue by Category')}</CardTitle></CardHeader>
                <CardContent>
                  {loading ? <Skeleton className="h-48" /> : (
                    <div className="space-y-3">
                      {(data?.categoryBreakdown || []).slice(0, 7).map((c: any, i: number) => {
                        const maxRev = Math.max(...(data?.categoryBreakdown || []).map((x: any) => x.revenue), 1);
                        const pct = (c.revenue / maxRev) * 100;
                        const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-red-500', 'bg-pink-500', 'bg-indigo-500'];
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-xs text-muted-foreground w-28 truncate">{c.category}</span>
                            <div className="flex-1 bg-muted rounded-full h-3"><div className={`${colors[i % colors.length]} rounded-full h-3 transition-all`} style={{ width: `${pct}%` }} /></div>
                            <span className="text-xs font-medium w-20 text-right">{formatVND(c.revenue)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Order Status + Margin Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t('Phân bổ trạng thái đơn', 'Order Status Distribution')}</CardTitle></CardHeader>
                <CardContent>
                  {loading ? <Skeleton className="h-32" /> : (
                    <div className="flex gap-2 flex-wrap">
                      {(data?.orderStatusDistribution || []).map((s: any) => (
                        <Badge key={s.status} variant="secondary" className="text-xs px-3 py-1">{s.status}: {s.count}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">{t('Biên lợi nhuận hàng đầu', 'Top Margin Products')}</CardTitle></CardHeader>
                <CardContent>
                  {loading ? <Skeleton className="h-32" /> : (
                    <Table><TableBody>
                      {(data?.marginAnalysis || []).slice(0, 5).map((m: any) => (
                        <TableRow key={m.productId}>
                          <TableCell><p className="text-sm font-medium">{m.productName}</p><p className="text-xs text-muted-foreground">{m.sku}</p></TableCell>
                          <TableCell className="text-right"><span className={`text-sm font-bold ${parseFloat(m.margin) > 20 ? 'text-green-600' : parseFloat(m.margin) > 10 ? 'text-yellow-600' : 'text-red-600'}`}>{m.margin}%</span></TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">Stock: {m.stock}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody></Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
    </>
  );
}