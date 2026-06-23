'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import {
  Brain, Sparkles, TrendingUp, RefreshCw, Send, Mic,
  AlertTriangle, AlertCircle, Info, ShoppingCart, Package,
  ArrowRight, Zap, Lightbulb,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// ============================================
// TYPES
// ============================================

interface ParsedOrderItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface ForecastPoint {
  date: string;
  predictedDemand: number;
  confidence: number;
}

interface ReorderItem {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  avgDailySales: number;
  daysOfStock: number;
  suggestedQty: number;
  urgency: 'CRITICAL' | 'WARNING' | 'INFO';
}

interface Recommendation {
  productId: string;
  productName: string;
  sku: string;
  reason: string;
  score: number;
}

// ============================================
// MOBILE PAGE
// ============================================

export default function MobileAiAssistant() {
  const { toast } = useToast();

  // Smart Order state
  const [orderText, setOrderText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedResult, setParsedResult] = useState<{
    parsed: ParsedOrderItem[];
    confidence: number;
    originalText: string;
    unmatched?: string[];
  } | null>(null);

  // Forecast state
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);

  // Reorder suggestions state
  const [reorderItems, setReorderItems] = useState<ReorderItem[]>([]);
  const [reorderLoading, setReorderLoading] = useState(false);

  // Recommendations state
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recsLoading, setRecsLoading] = useState(false);

  const fetchAllData = useCallback(async () => {
    setForecastLoading(true);
    setReorderLoading(true);
    setRecsLoading(true);

    try {
      const [forecastRes, reorderRes, recsRes] = await Promise.all([
        adminFetch('/api/ai/forecast?days=30&predictionDays=14'),
        adminFetch('/api/ai/reorder-suggestions'),
        adminFetch('/api/ai/recommendations'),
      ]);

      if (forecastRes.success) setForecastData(forecastRes.data.forecast || []);
      if (reorderRes.success) setReorderItems(reorderRes.data.suggestions || []);
      if (recsRes.success) setRecommendations(recsRes.data.recommendations || []);
    } catch {}

    setForecastLoading(false);
    setReorderLoading(false);
    setRecsLoading(false);
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const handleParseOrder = async () => {
    if (!orderText.trim()) return;
    setParsing(true);
    setParsedResult(null);

    try {
      const res = await adminFetch('/api/ai/order-parse', {
        method: 'POST',
        body: JSON.stringify({ text: orderText.trim() }),
      });

      if (res.success) {
        setParsedResult(res.data);
        if (res.data.unmatched?.length) {
          toast({
            title: 'Cảnh báo',
            description: `Không tìm thấy: ${res.data.unmatched.join(', ')}`,
            variant: 'destructive',
          });
        }
      } else {
        toast({ title: 'Lỗi', description: res.error?.message || 'Không thể phân tích.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Lỗi mạng', variant: 'destructive' });
    }
    setParsing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleParseOrder();
    }
  };

  const chartData = forecastData.map(d => ({
    date: new Date(d.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
    demand: d.predictedDemand,
  }));

  const urgencyColors: Record<string, string> = {
    CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    WARNING: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    INFO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24 space-y-4">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-500/30">
          <Brain className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Trợ lý AI</h1>
          <p className="text-xs text-muted-foreground">Đặt hàng thông minh, dự báo nhu cầu</p>
        </div>
      </div>

      {/* ===================== SMART ORDER ===================== */}
      <Card className="border-purple-200 dark:border-purple-800/50">
        <CardHeader className="p-3 pb-2">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-600" />
            <CardTitle className="text-sm">Đặt hàng thông minh</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-3">
          <div className="relative">
            <Textarea
              placeholder="Ví dụ: 5 thùng bia Heineken và 10 chai nước mắm Nam Ngư..."
              className="min-h-[56px] resize-none pr-20 text-sm"
              value={orderText}
              onChange={(e) => setOrderText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={parsing}
            />
            <div className="absolute right-2 bottom-2 flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground"
                onClick={() => toast({ title: 'Giọng nói', description: 'Tính năng sắp ra mắt.' })}
              >
                <Mic className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleParseOrder}
                disabled={parsing || !orderText.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white h-8 px-3"
              >
                {parsing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Parsed Result */}
          {parsing && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20">
              <RefreshCw className="h-4 w-4 animate-spin text-purple-500" />
              <span className="text-xs text-purple-700 dark:text-purple-300">Đang phân tích...</span>
            </div>
          )}

          {parsedResult && !parsing && parsedResult.parsed.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-yellow-500" />
                  Nhận diện {Math.round(parsedResult.confidence * 100)}%
                </span>
                <span className="text-sm font-bold text-purple-700 dark:text-purple-400">
                  {formatVND(parsedResult.parsed.reduce((s, i) => s + i.subtotal, 0))}
                </span>
              </div>
              <div className="space-y-2">
                {parsedResult.parsed.map((item, idx) => (
                  <div key={item.productId || idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Package className="h-4 w-4 text-purple-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.productName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.quantity} x {formatVND(item.unitPrice)} = {formatVND(item.subtotal)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm" className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1">
                <ShoppingCart className="h-3 w-3" />
                Tạo đơn hàng
                <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===================== QUICK ACTIONS ===================== */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          className="h-auto py-3 flex-col gap-1.5"
          onClick={() => {
            const el = document.getElementById('reorder-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <ShoppingCart className="h-4 w-4 text-orange-600" />
          <span className="text-[10px]">Nhập hàng</span>
          {reorderItems.filter(i => i.urgency === 'CRITICAL').length > 0 && (
            <Badge variant="destructive" className="text-[9px] h-4 px-1">
              {reorderItems.filter(i => i.urgency === 'CRITICAL').length}
            </Badge>
          )}
        </Button>
        <Button
          variant="outline"
          className="h-auto py-3 flex-col gap-1.5"
          onClick={() => {
            const el = document.getElementById('forecast-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <TrendingUp className="h-4 w-4 text-green-600" />
          <span className="text-[10px]">Dự báo</span>
        </Button>
        <Button
          variant="outline"
          className="h-auto py-3 flex-col gap-1.5"
          onClick={() => {
            const el = document.getElementById('recs-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <Lightbulb className="h-4 w-4 text-yellow-600" />
          <span className="text-[10px]">Gợi ý</span>
          {recommendations.length > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1 bg-yellow-100 text-yellow-700 border-0">
              {recommendations.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* ===================== REORDER SUGGESTIONS ===================== */}
      <section id="reorder-section">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Gợi ý nhập hàng
          </h2>
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => {
            setReorderLoading(true);
            adminFetch('/api/ai/reorder-suggestions').then(res => {
              if (res.success) setReorderItems(res.data.suggestions || []);
              setReorderLoading(false);
            }).catch(() => setReorderLoading(false));
          }}>
            <RefreshCw className={`h-3 w-3 mr-0.5 ${reorderLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {reorderLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : reorderItems.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-4 text-center text-xs text-muted-foreground">
              <Package className="h-6 w-6 mx-auto mb-1 text-green-500/50" />
              Tồn kho ổn định, không cần nhập gấp.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {reorderItems.slice(0, 5).map((item) => {
              const UrgencyIcon = item.urgency === 'CRITICAL' ? AlertTriangle : item.urgency === 'WARNING' ? AlertCircle : Info;
              return (
                <Card key={item.productId} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2.5">
                      <div className={`h-8 w-8 rounded-lg ${urgencyColors[item.urgency]} flex items-center justify-center shrink-0`}>
                        <UrgencyIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">{item.productName}</p>
                          <Badge variant="secondary" className={`text-[9px] ml-1 shrink-0 ${urgencyColors[item.urgency]} border-0`}>
                            {item.urgency === 'CRITICAL' ? 'NGHIÊM TRỌNG' : item.urgency === 'WARNING' ? 'CẢNH BÁO' : 'THÔNG TIN'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Tồn: {item.currentStock} · Bán: {item.avgDailySales}/ngày · Còn {item.daysOfStock} ngày
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs">
                            Đề xuất: <span className="font-bold text-orange-600">{item.suggestedQty}</span>
                          </span>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-0.5">
                            Nhập hàng <ArrowRight className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================== FORECAST CHART ===================== */}
      <section id="forecast-section">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Dự báo nhu cầu 14 ngày
          </h2>
        </div>
        <Card>
          <CardContent className="p-3">
            {forecastLoading ? (
              <Skeleton className="h-[200px] rounded-lg" />
            ) : chartData.length > 0 ? (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', fontSize: '11px', border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number) => [`${value} đơn vị`, 'Nhu cầu dự báo']}
                    />
                    <Line
                      type="monotone"
                      dataKey="demand"
                      stroke="#EAB308"
                      strokeWidth={2}
                      dot={{ fill: '#EAB308', r: 2.5 }}
                      name="demand"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <TrendingUp className="h-8 w-8 mb-1 text-muted-foreground/50" />
                <p className="text-xs">Chưa có dữ liệu.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ===================== RECOMMENDATIONS ===================== */}
      <section id="recs-section">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4 text-yellow-500" />
            Gợi ý sản phẩm
          </h2>
          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => {
            setRecsLoading(true);
            adminFetch('/api/ai/recommendations').then(res => {
              if (res.success) setRecommendations(res.data.recommendations || []);
              setRecsLoading(false);
            }).catch(() => setRecsLoading(false));
          }}>
            <RefreshCw className={`h-3 w-3 mr-0.5 ${recsLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {recsLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : recommendations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-4 text-center text-xs text-muted-foreground">
              <Lightbulb className="h-6 w-6 mx-auto mb-1 text-muted-foreground/50" />
              Chưa có gợi ý.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recommendations.slice(0, 5).map((rec, idx) => (
              <Card key={rec.productId} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-yellow-700 dark:text-yellow-400">#{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{rec.productName}</p>
                      <p className="text-[10px] text-muted-foreground">{rec.sku}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{rec.reason}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-500"
                            style={{ width: `${Math.round(rec.score * 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {Math.round(rec.score * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}