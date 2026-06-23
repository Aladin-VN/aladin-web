'use client';
import { useState, useRef, useEffect } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { Brain, Sparkles, TrendingUp, ShoppingCart, AlertTriangle, RefreshCw, Send, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';

export default function AIAssistant() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [orderText, setOrderText] = useState('');
  const [parsed, setParsed] = useState<any>(null);
  const [parsing, setParsing] = useState(false);
  const [reorder, setReorder] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); setLoading(false); }, []);

  const parseOrder = async () => {
    if (!orderText.trim()) return;
    setParsing(true);
    try {
      const res = await adminFetch('/api/ai/order-parse', { method: 'POST', body: JSON.stringify({ text: orderText }) });
      if (res.success) setParsed(res.data);
    } catch {}
    setParsing(false);
  };

  const fetchSuggestions = async () => {
    try {
      const res = await adminFetch('/api/ai/reorder-suggestions');
      if (res.success) setReorder(res.data.suggestions || []);
    } catch {}
  };

  const fetchForecast = async () => {
    try {
      const res = await adminFetch('/api/ai/forecast?days=14');
      if (res.success) setForecast(res.data.forecast || []);
    } catch {}
  };

  useEffect(() => { fetchSuggestions(); fetchForecast(); }, []);

  const urgencyColor = (u: string) => u === 'CRITICAL' ? 'bg-red-100 text-red-800 border-red-200' : u === 'WARNING' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-blue-50 text-blue-800 border-blue-200';

  return (
    <>
      <AdminSidebar /><SidebarInset><AdminHeader />
        <div className="flex flex-1 flex-col">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Brain className="text-yellow-500" /> {t('Trợ lý AI', 'AI Assistant')}</h1>
            <p className="text-sm text-muted-foreground">{t('Đặt hàng bằng văn bản, dự báo nhu cầu, gợi ý nhập hàng', 'Order by text, forecast demand, restock suggestions')}</p>
          </div>
          <Separator />
          <div className="flex-1 px-6 py-4 space-y-6 overflow-auto">
            {/* Smart Order */}
            <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50/50 to-transparent">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-yellow-600" />{t('Đặt hàng thông minh', 'Smart Order')}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Input ref={inputRef} placeholder={t('Nhập: "5 thùng bia Heineken, 10 chai nước mắm Nam Ngư"', 'Type: "5 thùng bia Heineken, 10 chai nước mắm"')} value={orderText} onChange={e => setOrderText(e.target.value)} onKeyDown={e => e.key === 'Enter' && parseOrder()} className="flex-1" />
                  <Button onClick={parseOrder} disabled={parsing || !orderText.trim()}><Send className="h-4 w-4 mr-1" />{parsing ? '...' : t('Phân tích', 'Parse')}</Button>
                </div>
                {parsed && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{t('Độ tin cậy', 'Confidence')}: <span className="font-bold">{Math.round(parsed.confidence * 100)}%</span></span>
                      <Button variant="outline" size="sm" onClick={() => setParsed(null)} className="text-xs">{t('Xóa', 'Clear')}</Button>
                    </div>
                    <div className="border rounded-lg divide-y">
                      {parsed.parsed.map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2">
                          <div><p className="text-sm font-medium">{item.productName}</p><p className="text-xs text-muted-foreground">{item.sku} · {formatVND(item.unitPrice)}/đv · x{item.quantity}</p></div>
                          <div className="text-right">
                            <p className="font-semibold">{formatVND(item.subtotal)}</p>
                            {item.confidence < 0.5 && <Badge variant="destructive" className="text-[10px]">{t('Chưa khớp', 'No match')}</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reorder Suggestions */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-500" />{t(`Gợi ý nhập hàng (${reorder.length})`, `Reorder (${reorder.length})`)}</CardTitle></CardHeader>
              <CardContent>
                {reorder.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">{t('Tồn kho đầy đủ', 'All stocked up')}</p> :
                  <div className="space-y-2 max-h-80 overflow-auto">
                    {reorder.slice(0, 10).map((s: any) => (
                      <div key={s.productId} className="flex items-center justify-between p-2 rounded-lg border">
                        <div><p className="text-sm font-medium">{s.productName}</p><p className="text-xs text-muted-foreground">SKU: {s.sku} · Còn: {s.currentStock} · {s.avgDailySales}/ngày · {s.daysOfStock} ngày nữa</p></div>
                        <div className="flex items-center gap-2">
                          <Badge className={urgencyColor(s.urgency)}>{s.urgency}</Badge>
                          <span className="text-xs text-muted-foreground">+{s.suggestedQty}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </CardContent>
            </Card>

            {/* Demand Forecast */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-blue-500" />{t('Dự báo nhu cầu 14 ngày', '14-Day Forecast')}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end gap-1 h-32">
                  {forecast.map((f: any, i: number) => {
                    const maxD = Math.max(...forecast.map(x => x.predictedDemand), 1);
                    const h = (f.predictedDemand / maxD) * 100;
                    return <div key={i} className="flex-1 group relative" title={`${f.date}: ${f.predictedDemand} (độ tin cậy: ${Math.round(f.confidence * 100)}%)`}>
                      <div className={`w-full rounded-t transition-all cursor-pointer ${h > 70 ? 'bg-blue-500' : h > 40 ? 'bg-blue-400' : 'bg-blue-300'}`} style={{ height: `${h}%` }} />
                    </div>;
                  })}
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                  <span>{forecast[0]?.date}</span><span>{forecast[forecast.length - 1]?.date}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </SidebarInset>
    </>
  );
}