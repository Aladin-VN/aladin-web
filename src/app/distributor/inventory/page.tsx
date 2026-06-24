'use client';
import { toast } from 'sonner';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import {
  Search, AlertTriangle, Plus, RefreshCw, ChevronLeft, ChevronRight, Package,
  Warehouse, BarChart3, DollarSign, Minus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AdminHeader } from '@/components/layout/admin-header';
import { Separator } from '@/components/ui/separator';

export default function DistributorInventory() {
  const { locale } = useLocale();
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [writeDownOpen, setWriteDownOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [stockQty, setStockQty] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (lowStockOnly) params.set('lowStock', 'true');
      const res = await adminFetch(`/api/distributor/inventory?${params}`);
      if (res.success) {
        setItems(res.data.items || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
      }
    } catch (e) { console.error("[FETCH ERROR]", e); }
    setLoading(false);
  }, [search, lowStockOnly, page]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const handleStockIn = async () => {
    if (!selectedProduct || !stockQty || parseInt(stockQty) <= 0) return;
    setSubmitting(true);
    try {
      const res = await adminFetch('/api/distributor/inventory', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProduct.productId,
          type: 'RECEIPT',
          quantity: parseInt(stockQty),
          reason: stockReason || undefined,
        }),
      });
      if (res.success) {
        setDialogOpen(false);
        setStockQty('');
        setStockReason('');
        setSelectedProduct(null);
        fetchInventory();
        toast.success(t('Đã nhập kho thành công!', 'Stock added successfully!'));
      } else {
        toast.error(res.error?.message || t('Lỗi', 'Error'));
      }
    } catch (e: any) {
      toast.error(e.message || t('Lỗi mạng', 'Network error'));
    }
    setSubmitting(false);
  };

  const handleWriteDown = async () => {
    if (!selectedProduct || !stockQty || parseInt(stockQty) <= 0) return;
    if (parseInt(stockQty) > selectedProduct.quantity) {
      toast.error(t('Số lượng vượt quá tồn kho', 'Quantity exceeds stock'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await adminFetch('/api/distributor/inventory', {
        method: 'POST',
        body: JSON.stringify({
          productId: selectedProduct.productId,
          type: 'DAMAGE',
          quantity: parseInt(stockQty),
          reason: stockReason || undefined,
        }),
      });
      if (res.success) {
        setWriteDownOpen(false);
        setStockQty('');
        setStockReason('');
        setSelectedProduct(null);
        fetchInventory();
        toast.success(t('Đã ghi nhận hư hỏng/hao hụt!', 'Write-down recorded!'));
      } else {
        toast.error(res.error?.message || t('Lỗi', 'Error'));
      }
    } catch (e: any) {
      toast.error(e.message || t('Lỗi mạng', 'Network error'));
    }
    setSubmitting(false);
  };

  // Computed KPIs from items data
  const kpis = useMemo(() => {
    const totalSkus = items.length;
    const lowStock = items.filter((i: any) => i.isLowStock).length;
    const totalValue = items.reduce((sum: number, i: any) => sum + ((i.quantity || 0) * (i.costPrice || 0)), 0);
    return { totalSkus, lowStock, totalValue };
  }, [items]);

  const getStockLevel = (item: any) => {
    const qty = item.quantity || 0;
    const min = item.minStockLevel || 0;
    if (qty === 0) return { level: 0, color: 'bg-red-500', label: 'critical' };
    if (qty <= min * 0.5) return { level: Math.min((qty / min) * 100, 100), color: 'bg-red-500', label: 'critical' };
    if (qty <= min) return { level: (qty / min) * 100, color: 'bg-amber-500', label: 'low' };
    return { level: Math.min((qty / Math.max(min * 3, 1)) * 100, 100), color: 'bg-emerald-500', label: 'good' };
  };

  return (
    <>
      <AdminHeader />
      <div className="flex flex-1 flex-col">
        {/* Page Header */}
        <div className="px-4 md:px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <Warehouse className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight">{t('Quản lý kho hàng', 'Inventory Management')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('Kiểm tra và cập nhật tồn kho', 'Check and update stock levels')}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchInventory} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('Làm mới', 'Refresh')}
            </Button>
          </div>
        </div>
        <Separator />

        <div className="flex-1 px-4 md:px-6 py-4 space-y-6">
          {/* KPI Summary Cards */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Tổng SKU', 'Total SKUs')}</p>
                      <p className="text-2xl font-bold mt-1 text-blue-700 dark:text-blue-400">{kpis.totalSkus}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('sản phẩm trong kho', 'products in warehouse')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Cảnh báo tồn kho', 'Low Stock Alerts')}</p>
                      <p className="text-2xl font-bold mt-1 text-red-700 dark:text-red-400">{kpis.lowStock}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('sản phẩm dưới mức tối thiểu', 'items below minimum')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm rounded-xl border-0 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('Tổng giá trị', 'Total Value')}</p>
                      <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-400">{formatVND(kpis.totalValue)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t('giá vốn hàng tồn', 'at cost price')}</p>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex gap-2">
              <Button
                variant={lowStockOnly ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => { setLowStockOnly(!lowStockOnly); setPage(1); }}
                className={lowStockOnly ? 'shadow-sm rounded-full px-4' : 'rounded-full px-4 text-muted-foreground hover:text-foreground'}
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                {t('Cảnh báo tồn kho', 'Low Stock Only')}
              </Button>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('Tìm sản phẩm...', 'Search products...')}
                className="pl-9 h-9 text-sm rounded-lg"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
          </div>

          {/* Inventory Table */}
          <Card className="shadow-sm rounded-xl overflow-hidden">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 md:p-6 space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-40 rounded" />
                      <Skeleton className="h-4 w-20 rounded" />
                      <Skeleton className="h-2 w-24 rounded-full" />
                      <Skeleton className="h-4 w-12 rounded" />
                      <Skeleton className="h-4 w-12 rounded" />
                      <Skeleton className="h-4 w-20 rounded ml-auto" />
                      <Skeleton className="h-4 w-20 rounded" />
                      <Skeleton className="h-8 w-20 rounded-lg" />
                    </div>
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="text-center py-20">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Package className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t('Không có sản phẩm nào', 'No products found')}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {t('Sản phẩm sẽ hiển thị khi được thêm vào kho', 'Products appear when added to warehouse')}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Sản phẩm', 'Product')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider">{t('Danh mục', 'Category')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider min-w-[140px]">{t('Tồn kho', 'Stock Level')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Đã đặt', 'Reserved')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Có sẵn', 'Available')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Giá vốn', 'Cost')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">{t('Giá bán', 'Sell Price')}</TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">{t('Hành động', 'Action')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => {
                        const stockInfo = getStockLevel(item);
                        return (
                          <TableRow key={item.id} className={item.isLowStock ? 'bg-red-50/50 dark:bg-red-950/10 hover:bg-red-50/70 dark:hover:bg-red-950/20' : 'hover:bg-muted/50 transition-colors'}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{item.productName}</span>
                                {item.isLowStock && (
                                  <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 text-[10px] font-medium rounded-full px-2 h-5">
                                    {t('Thấp', 'Low')}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">{item.category}</TableCell>
                            <TableCell>
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className={`font-semibold ${item.isLowStock ? 'text-red-600 dark:text-red-400' : ''}`}>
                                    {item.quantity}
                                  </span>
                                  <span className="text-muted-foreground text-[11px]">
                                    {t('min:', 'min:')} {item.minStockLevel || '-'}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${stockInfo.color}`}
                                    style={{ width: `${stockInfo.level}%` }}
                                  />
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm">{item.reservedQty}</TableCell>
                            <TableCell className="text-center">
                              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{item.availableQty}</span>
                            </TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{item.costPrice ? formatVND(item.costPrice) : '-'}</TableCell>
                            <TableCell className="text-right text-xs font-medium">{formatVND(item.basePrice)}</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 rounded-lg"
                                  onClick={() => { setSelectedProduct(item); setDialogOpen(true); setStockQty(''); setStockReason(''); }}
                                >
                                  <Plus className="h-3 w-3" /> {t('Nhập', 'In')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => { setSelectedProduct(item); setWriteDownOpen(true); setStockQty(''); setStockReason(''); }}
                                >
                                  <Minus className="h-3 w-3" /> {t('Xuất', 'Out')}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t(`Trang ${page}/${totalPages}`, `Page ${page}/${totalPages}`)}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> {t('Trước', 'Prev')}
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  {t('Sau', 'Next')} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stock In Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                <Plus className="h-4 w-4 text-white" />
              </div>
              {t('Nhập kho', 'Stock In')}
            </DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <p className="text-sm font-medium">{selectedProduct.productName}</p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{t('Hiện tại', 'Current')}: <span className="font-semibold text-foreground">{selectedProduct.quantity}</span></span>
                  <span>{t('Tối thiểu', 'Min')}: <span className="font-semibold text-foreground">{selectedProduct.minStockLevel}</span></span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('Số lượng', 'Quantity')}</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder={t('Nhập số lượng...', 'Enter quantity...')}
                  className="rounded-lg"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('Ghi chú (tùy chọn)', 'Notes (optional)')}</Label>
                <Textarea
                  placeholder={t('Lý do nhập kho...', 'Reason for stock in...')}
                  className="rounded-lg resize-none"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-lg">
              {t('Hủy', 'Cancel')}
            </Button>
            <Button
              onClick={handleStockIn}
              disabled={submitting || !stockQty || parseInt(stockQty) <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm"
            >
              {submitting ? t('Đang xử lý...', 'Processing...') : t('Xác nhận nhập kho', 'Confirm Stock In')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Write-Down / Damage Dialog */}
      <Dialog open={writeDownOpen} onOpenChange={setWriteDownOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
                <Minus className="h-4 w-4 text-white" />
              </div>
              {t('Xuất kho / Hao hụt', 'Write-Down / Damage')}
            </DialogTitle>
            <DialogDescription>
              {t('Ghi nhận hàng hư hỏng, hao hụt, hoặc xuất kho', 'Record damaged, lost, or removed stock')}
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <p className="text-sm font-medium">{selectedProduct.productName}</p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{t('Hiện tại', 'Current')}: <span className="font-semibold text-foreground">{selectedProduct.quantity}</span></span>
                  <span>{t('Tối thiểu', 'Min')}: <span className="font-semibold text-foreground">{selectedProduct.minStockLevel}</span></span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('Số lượng xuất', 'Quantity to remove')}</Label>
                <Input
                  type="number"
                  min="1"
                  max={selectedProduct.quantity}
                  placeholder={t('Nhập số lượng...', 'Enter quantity...')}
                  className="rounded-lg"
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                />
                {stockQty && parseInt(stockQty) > selectedProduct.quantity && (
                  <p className="text-xs text-red-600">{t('Vượt quá tồn kho hiện tại!', 'Exceeds current stock!')}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t('Lý do', 'Reason')}</Label>
                <Textarea
                  placeholder={t('VD: Hàng hỏng, hết hạn sử dụng...', 'e.g. Damaged, expired...')}
                  className="rounded-lg resize-none"
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setWriteDownOpen(false)} className="rounded-lg">
              {t('Hủy', 'Cancel')}
            </Button>
            <Button
              onClick={handleWriteDown}
              disabled={submitting || !stockQty || parseInt(stockQty) <= 0 || parseInt(stockQty) > (selectedProduct?.quantity || 0)}
              className="bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm"
            >
              {submitting ? t('Đang xử lý...', 'Processing...') : t('Xác nhận xuất kho', 'Confirm Write-Down')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}