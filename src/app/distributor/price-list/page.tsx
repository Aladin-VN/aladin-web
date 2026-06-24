'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import { toast } from 'sonner';
import { Tag, Search, RefreshCw, Printer, Download, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AdminHeader } from '@/components/layout/admin-header';
import { Separator } from '@/components/ui/separator';

export default function PriceList() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [categories, setCategories] = useState<string[]>([]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/distributor/inventory?limit=999');
      if (res.success) {
        const items = res.data.items || [];
        setProducts(items);
        const cats = [...new Set(items.map((i: any) => i.category).filter(Boolean))] as string[];
        setCategories(cats.sort());
      }
    } catch (e) { console.error("[FETCH ERROR]", e); }
    setLoading(false);
  }, []);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = useMemo(() => {
    let list = products;
    if (search) list = list.filter((p: any) => p.productName?.toLowerCase().includes(search.toLowerCase()) || p.sku?.toLowerCase().includes(search.toLowerCase()));
    if (catFilter) list = list.filter((p: any) => p.category === catFilter);
    return list;
  }, [products, search, catFilter]);

  const handlePrint = () => window.print();

  return (
    <>
    <AdminHeader />
    <div className="flex flex-1 flex-col">
      <div className="px-4 md:px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-600/20">
            <Tag className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{t('Bảng giá', 'Price List')}</h1>
            <p className="text-sm text-muted-foreground">{t('Danh mục sản phẩm và giá bán lẻ', 'Product catalog and retail prices')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />{t('In', 'Print')}</Button>
            <Button variant="outline" size="sm" asChild><a href="/api/distributor/export?type=inventory" download><Download className="h-4 w-4 mr-1" />CSV</a></Button>
            <Button variant="outline" size="sm" onClick={fetchProducts} disabled={loading}><RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />{t('Làm mới', 'Refresh')}</Button>
          </div>
        </div>
      </div>
      <Separator />
      <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder={t('Tìm tên, SKU...', 'Search name, SKU...')} className="pl-9 h-9 text-sm rounded-lg" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <Select value={catFilter} onValueChange={(v) => v === '__all__' ? setCatFilter('') : setCatFilter(v)}>
            <SelectTrigger className="w-full sm:w-48 h-9 text-sm rounded-lg"><SelectValue placeholder={t('Tất cả danh mục', 'All categories')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('Tất cả danh mục', 'All categories')}</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}</div> : filtered.length === 0 ? (
          <div className="text-center py-20"><div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4"><Package className="h-8 w-8 text-muted-foreground/40" /></div><p className="text-sm font-medium text-muted-foreground">{t('Không tìm thấy sản phẩm', 'No products found')}</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p: any) => (
              <Card key={p.id} className="shadow-sm rounded-xl hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.productName}</p>
                      <p className="text-xs text-muted-foreground">{p.sku}</p>
                    </div>
                    {p.isLowStock && <Badge variant="secondary" className="bg-red-100 text-red-700 text-[10px] rounded-full shrink-0">{t('Thấp', 'Low')}</Badge>}
                  </div>
                  <div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{p.category}</Badge><span className="text-[11px] text-muted-foreground">{p.unit || ''}</span></div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[11px] text-muted-foreground">{t('Giá bán', 'Sell Price')}</p>
                      <p className="text-xl font-bold text-emerald-600">{formatVND(p.basePrice)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-muted-foreground">{t('Tồn kho', 'Stock')}</p>
                      <p className={`text-sm font-bold ${p.quantity <= (p.minStockLevel || 10) ? 'text-red-600' : 'text-foreground'}`}>{p.quantity || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground text-center">{t(`Hiển thị ${filtered.length} / ${products.length} sản phẩm`, `Showing ${filtered.length} / ${products.length} products`)}</p>
      </div>
    </div>
    </>
  );
}