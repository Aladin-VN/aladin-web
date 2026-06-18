'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Truck, Package } from 'lucide-react';
import { toast } from 'sonner';
import { formatVND } from '@/lib/security';

interface ShipmentCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale?: string;
  onCreated: () => void;
}

interface OrderOption {
  id: string;
  orderNumber: string;
  shopName: string;
  shopAddress: string;
  totalAmount: number;
  status: string;
}

interface DriverOption {
  id: string;
  name: string;
  phone: string;
  activeShipments: number;
  isAvailable: boolean;
}

export function ShipmentCreateDialog({
  open,
  onOpenChange,
  locale = 'vi',
  onCreated,
}: ShipmentCreateDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    orderId: '',
    type: 'INTERNAL',
    assignedDriverId: 'none',
    pickupAddress: '',
    dropoffAddress: '',
  });

  const [orderSearch, setOrderSearch] = useState('');
  const [orderResults, setOrderResults] = useState<OrderOption[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderOption | null>(null);
  const [searchingOrders, setSearchingOrders] = useState(false);

  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);

  // Reset form on open
  useEffect(() => {
    if (open) {
      setForm({ orderId: '', type: 'INTERNAL', assignedDriverId: 'none', pickupAddress: '', dropoffAddress: '' });
      setSelectedOrder(null);
      setOrderSearch('');
      setOrderResults([]);
    }
  }, [open]);

  // Fetch available drivers when dialog opens
  const fetchDrivers = useCallback(async () => {
    try {
      setLoadingDrivers(true);
      const res = await adminFetch('/api/shipments/drivers');
      const json = await res.json();
      if (json.success) {
        setDrivers(json.data.drivers || []);
      }
    } catch {
      console.error('Failed to fetch drivers');
    } finally {
      setLoadingDrivers(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchDrivers();
  }, [open, fetchDrivers]);

  // Search orders
  useEffect(() => {
    if (!orderSearch || orderSearch.length < 2) {
      setOrderResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchingOrders(true);
      try {
        const params = new URLSearchParams({
          search: orderSearch,
          limit: '10',
          status: 'CONFIRMED,PROCESSING,PACKED,OUT_FOR_DELIVERY',
        });
        const res = await adminFetch(`/api/orders?${params.toString()}`);
        const json = await res.json();
        if (json.success && json.data?.items) {
          setOrderResults(
            json.data.items
              .filter((o: { status: string }) => ['CONFIRMED', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY'].includes(o.status))
              .map((o: { id: string; orderNumber: string; shopName: string; totalAmount: number; status: string }) => ({
                id: o.id,
                orderNumber: o.orderNumber,
                shopName: o.shopName,
                shopAddress: '',
                totalAmount: o.totalAmount,
                status: o.status,
              }))
          );
        }
      } catch {
        console.error('Order search failed');
      } finally {
        setSearchingOrders(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [orderSearch]);

  const selectOrder = (order: OrderOption) => {
    setSelectedOrder(order);
    setForm((f) => ({
      ...f,
      orderId: order.id,
      dropoffAddress: order.shopAddress,
    }));
    setOrderSearch('');
    setOrderResults([]);
  };

  const clearOrder = () => {
    setSelectedOrder(null);
    setForm((f) => ({ ...f, orderId: '', dropoffAddress: '' }));
  };

  const handleSubmit = async () => {
    if (!form.orderId || !form.dropoffAddress) {
      toast.error(t('Please select an order and provide dropoff address', 'Vui lòng chọn đơn hàng và địa chỉ giao hàng'));
      return;
    }

    setSaving(true);
    try {
      const res = await adminFetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: form.orderId,
          type: form.type,
          assignedDriverId: form.assignedDriverId && form.assignedDriverId !== 'none' ? form.assignedDriverId : undefined,
          pickupAddress: form.pickupAddress || undefined,
          dropoffAddress: form.dropoffAddress,
        }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(t('Shipment created', 'Tạo chuyến giao hàng thành công'));
        onCreated();
        onOpenChange(false);
      } else {
        toast.error(json.error?.message || t('Failed to create shipment', 'Không thể tạo chuyến giao hàng'));
      }
    } catch {
      toast.error(t('Network error', 'Lỗi mạng'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Create Shipment', 'Tạo Chuyến Giao Hàng')}</DialogTitle>
          <DialogDescription>
            {t('Create a new delivery shipment for an existing order', 'Tạo chuyến giao hàng mới cho đơn hàng đã có')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Order Search */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Order *', 'Đơn hàng *')}</Label>
            {!selectedOrder ? (
              <>
                <div className="relative">
                  <Input
                    placeholder={t('Search by order number...', 'Tìm theo mã đơn hàng...')}
                    className="h-9 text-xs pr-8"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                  />
                  {searchingOrders && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                {orderResults.length > 0 && (
                  <div className="border rounded-md max-h-32 overflow-y-auto">
                    {orderResults.map((o) => (
                      <button
                        key={o.id}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2 border-b last:border-0"
                        onClick={() => selectOrder(o)}
                      >
                        <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="truncate flex-1 font-mono">{o.orderNumber}</span>
                        <span className="text-muted-foreground shrink-0">{o.shopName}</span>
                        <span className="font-medium shrink-0">{formatVND(o.totalAmount)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/50">
                <Package className="h-4 w-4 text-red-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono font-medium">{selectedOrder.orderNumber}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedOrder.shopName} · {formatVND(selectedOrder.totalAmount)}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={clearOrder}>
                  <span className="text-xs">x</span>
                </Button>
              </div>
            )}
          </div>

          {/* Shipment Type */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Shipment Type *', 'Loại vận chuyển *')}</Label>
            <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERNAL">
                  <span className="flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5 text-blue-600" />
                    {t('Internal Fleet', 'Xe nội bộ')}
                  </span>
                </SelectItem>
                <SelectItem value="THIRD_PARTY">
                  <span className="flex items-center gap-2">
                    <Truck className="h-3.5 w-3.5 text-purple-600" />
                    {t('3rd Party (Ahamove/Grab)', 'Bên thứ 3 (Ahamove/Grab)')}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Assign Driver */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Assign Driver', 'Giao cho tài xế')}</Label>
            <Select value={form.assignedDriverId} onValueChange={(v) => setForm((f) => ({ ...f, assignedDriverId: v }))}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={t('Unassigned', 'Chưa phân công')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('Unassigned', 'Chưa phân công')}</SelectItem>
                {drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    <span className="flex items-center justify-between w-full gap-2">
                      <span>{d.name}</span>
                      <span className={`text-[10px] ${d.isAvailable ? 'text-red-600' : 'text-red-500'}`}>
                        ({d.activeShipments} {t('active', 'đang giao')})
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pickup Address */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Pickup Address (Warehouse)', 'Địa chỉ lấy hàng (Kho)')}</Label>
            <Input
              placeholder={t('e.g., Kho ALADIN, Q.7, TP.HCM', 'VD: Kho ALADIN, Q.7, TP.HCM')}
              value={form.pickupAddress}
              onChange={(e) => setForm((f) => ({ ...f, pickupAddress: e.target.value }))}
              className="h-9 text-xs"
            />
          </div>

          {/* Dropoff Address */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('Dropoff Address *', 'Địa chỉ giao hàng *')}</Label>
            <Input
              placeholder={t('Shop delivery address', 'Địa chỉ giao đến cửa hàng')}
              value={form.dropoffAddress}
              onChange={(e) => setForm((f) => ({ ...f, dropoffAddress: e.target.value }))}
              className="h-9 text-xs"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 text-xs">
              {t('Cancel', 'Hủy')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !form.orderId || !form.dropoffAddress}
              className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {t('Create Shipment', 'Tạo chuyến giao')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
