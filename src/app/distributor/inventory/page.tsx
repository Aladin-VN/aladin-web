'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useLocale } from '@/providers/app-provider';
import {
  Search, AlertTriangle, Plus, RefreshCw, ChevronLeft, ChevronRight, Package,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
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
    } catch {}
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
      } else {
        alert(res.error?.message || t('Lỗi', 'Error'));
      }
    } catch (e: any) {
      alert(e.message || t('Lỗi mạng', 'Network error'));
    }
    setSubmitting(false);
  };

  return (
    <>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
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
          <Separator />

          <div className="flex-1 px-6 py-4 space-y-4">
            {/* Filters */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-2">
                <Button
                  variant={lowStockOnly ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => { setLowStockOnly(!lowStockOnly); setPage(1); }}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  {t('Cảnh báo tồn kho', 'Low Stock Only')}
                </Button>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('Tìm sản phẩm...', 'Search products...')}
                  className="pl-9 h-9 text-sm"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>

            {/* Inventory Table */}
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 space-y-2">
                    {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-16 text-sm text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                    {t('Không có sản phẩm nào', 'No products found')}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('Sản phẩm', 'Product')}</TableHead>
                        <TableHead>{t('Danh mục', 'Category')}</TableHead>
                        <TableHead className="text-center">{t('Tồn kho', 'Stock')}</TableHead>
                        <TableHead className="text-center">{t('Đã đặt', 'Reserved')}</TableHead>
                        <TableHead className="text-center">{t('Có sẵn', 'Available')}</TableHead>
                        <TableHead className="text-right">{t('Giá vốn', 'Cost')}</TableHead>
                        <TableHead className="text-right">{t('Giá bán', 'Sell Price')}</TableHead>
                        <TableHead className="text-center">{t('Hành động', 'Action')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item: any) => (
                        <TableRow key={item.id} className={item.isLowStock ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{item.productName}</span>
                              {item.isLowStock && (
                                <Badge variant="destructive" className="text-[10px] h-4">
                                  {t('Thấp', 'Low')}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">{item.category}</TableCell>
                          <TableCell className={`text-center font-semibold ${item.isLowStock ? 'text-red-600' : ''}`}>
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-center">{item.reservedQty}</TableCell>
                          <TableCell className="text-center text-green-600 font-medium">{item.availableQty}</TableCell>
                          <TableCell className="text-right text-xs">{item.costPrice ? formatVND(item.costPrice) : '-'}</TableCell>
                          <TableCell className="text-right text-xs">{formatVND(item.basePrice)}</TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              onClick={() => { setSelectedProduct(item); setDialogOpen(true); }}
                            >
                              <Plus className="h-3 w-3" /> {t('Nhập kho', 'Stock In')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
      </SidebarInset>

      {/* Stock In Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Nhập kho', 'Stock In')}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{selectedProduct.productName}</p>
              <p className="text-xs text-muted-foreground">
                {t('Hiện tại', 'Current')}: {selectedProduct.quantity} | {t('Tối thiểu', 'Min')}: {selectedProduct.minStockLevel}
              </p>
              <div>
                <Label className="text-sm">{t('Số lượng', 'Quantity')}</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder={t('Nhập số lượng...', 'Enter quantity...')}
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm">{t('Ghi chú (tùy chọn)', 'Notes (optional)')}</Label>
                <Textarea
                  placeholder={t('Lý do nhập kho...', 'Reason for stock in...')}
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('Hủy', 'Cancel')}
            </Button>
            <Button
              onClick={handleStockIn}
              disabled={submitting || !stockQty || parseInt(stockQty) <= 0}
              className="bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {submitting ? t('Đang xử lý...', 'Processing...') : t('Xác nhận nhập kho', 'Confirm Stock In')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}