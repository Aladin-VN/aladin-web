'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, AlertTriangle, Plus, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function DistributorInventory() {
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
        setItems(res.data.items);
        setTotalPages(res.data.pagination.totalPages);
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
        alert(res.error?.message || 'Lỗi');
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi mạng');
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
      <h1 className="text-xl font-bold mb-4">Quản lý kho hàng</h1>

      {/* Search */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Tìm sản phẩm..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Low Stock Filter */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => { setLowStockOnly(!lowStockOnly); setPage(1); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            lowStockOnly ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground'
          }`}
        >
          <AlertTriangle className="h-3 w-3" />
          Cảnh báo tồn kho
        </button>
      </div>

      {/* Inventory List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Không có sản phẩm nào</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => (
            <Card key={item.id} className={item.isLowStock ? 'border-red-200' : ''}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{item.productName}</p>
                      {item.isLowStock && <Badge variant="destructive" className="text-[10px] h-4">Thấp</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{item.productSku} · {item.category}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2 h-8 w-8 p-0 flex-shrink-0"
                    onClick={() => { setSelectedProduct(item); setDialogOpen(true); }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs">
                  <div className="flex gap-4">
                    <span>Tồn kho: <strong className={item.isLowStock ? 'text-red-600' : ''}>{item.quantity}</strong></span>
                    <span>Đã đặt: <strong>{item.reservedQty}</strong></span>
                    <span>Có sẵn: <strong className="text-green-600">{item.availableQty}</strong></span>
                  </div>
                </div>
                {item.costPrice && (
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>Giá vốn: {formatVND(item.costPrice)}</span>
                    <span>Giá bán: {formatVND(item.basePrice)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 text-sm rounded-lg bg-muted disabled:opacity-50">Trước</button>
          <span className="px-3 py-1 text-sm">{page}/{totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 text-sm rounded-lg bg-muted disabled:opacity-50">Sau</button>
        </div>
      )}

      {/* Stock In Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nhập kho</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <p className="text-sm font-medium">{selectedProduct.productName}</p>
              <p className="text-xs text-muted-foreground">Hiện tại: {selectedProduct.quantity} | Tối thiểu: {selectedProduct.minStockLevel}</p>
              <div>
                <Label className="text-sm">Số lượng</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Nhập số lượng..."
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm">Ghi chú (tùy chọn)</Label>
                <Textarea
                  placeholder="Lý do nhập kho..."
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleStockIn} disabled={submitting || !stockQty || parseInt(stockQty) <= 0} className="bg-yellow-500 hover:bg-yellow-600 text-white">
              {submitting ? 'Đang xử lý...' : 'Xác nhận nhập kho'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}