'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Banknote, Smartphone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { formatVND } from '@/lib/security';
import { toast } from 'sonner';

interface ShopCreditData {
  shopId: string;
  shopName: string;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  creditStatus: string;
}

interface CreditOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
  paidAmount: number;
  creditUsed: number;
}

interface RepaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shop: ShopCreditData | null;
  locale: string;
  onSuccess: () => void;
}

export function RepaymentDialog({
  open,
  onOpenChange,
  shop,
  locale,
  onSuccess,
}: RepaymentDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [orders, setOrders] = useState<CreditOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [collectedBy, setCollectedBy] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [error, setError] = useState('');

  // Fetch shop's credit orders when dialog opens
  const fetchOrders = useCallback(async () => {
    if (!shop) return;
    try {
      setLoadingOrders(true);
      const res = await fetch(`/api/orders?shopId=${shop.shopId}&paymentMethod=CREDIT&paymentStatus=PENDING&limit=50`);
      const json = await res.json();
      if (json.success) {
        setOrders(json.data.items || []);
      }
    } catch {
      setOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  }, [shop]);

  useEffect(() => {
    if (open && shop) {
      setSelectedOrderId('');
      setAmount('');
      setPaymentMethod('');
      setCollectedBy('');
      setError('');
      fetchOrders();
    }
  }, [open, shop, fetchOrders]);

  // When order is selected, prefill with outstanding amount
  const handleOrderChange = (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      const outstanding = order.totalAmount - order.paidAmount;
      setAmount(String(outstanding > 0 ? outstanding : order.creditUsed));
    } else {
      setAmount('');
    }
  };

  const handleSubmit = async () => {
    if (!shop) return;
    if (!selectedOrderId) {
      setError(t('Please select an order', 'Vui long chon don hang'));
      return;
    }
    if (!amount || parseInt(amount) <= 0) {
      setError(t('Please enter a valid amount', 'Vui long nhap so tien hop le'));
      return;
    }
    if (!paymentMethod) {
      setError(t('Please select payment method', 'Vui long chon phuong thuc thanh toan'));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/credit/repay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shop.shopId,
          orderId: selectedOrderId,
          amount: parseInt(amount),
          paymentMethod,
          collectedBy: collectedBy.trim() || undefined,
        }),
      });
      const json = await res.json();

      if (json.success) {
        const isFull = json.data.isFullRepayment;
        toast.success(
          locale === 'vi'
            ? `Ghi nhan tra no thanh cong: ${formatVND(Math.abs(json.data.transaction.amount))}. So du moi: ${formatVND(json.data.newBalance)}`
            : `Repayment recorded: ${formatVND(Math.abs(json.data.transaction.amount))}. New balance: ${formatVND(json.data.newBalance)}`
        );
        if (isFull) {
          toast.success(
            locale === 'vi'
              ? 'Da tra het no! Han muc tin dung da duoc kich hoat.'
              : 'Full repayment! Credit has been reactivated.'
          );
        }
        onOpenChange(false);
        onSuccess();
      } else {
        setError(json.error?.message || t('Failed to record repayment', 'Khong the ghi nhan tra no'));
      }
    } catch {
      setError(t('Network error. Please try again.', 'Loi mang. Vui long thu lai.'));
    } finally {
      setLoading(false);
    }
  };

  if (!shop) return null;

  const order = orders.find((o) => o.id === selectedOrderId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-red-600" />
            {t('Record Repayment', 'Ghi nhan tra no')}
          </DialogTitle>
          <DialogDescription>
            {shop.shopName} — {t('Outstanding', 'No hien tai')}: {formatVND(shop.creditUsed)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Order Select */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('Order', 'Don hang')} <span className="text-red-500">*</span>
            </label>
            {loadingOrders ? (
              <div className="h-9 bg-muted animate-pulse rounded-md" />
            ) : (
              <Select value={selectedOrderId} onValueChange={handleOrderChange}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t('Select an order...', 'Chon don hang...')} />
                </SelectTrigger>
                <SelectContent>
                  {orders.length === 0 ? (
                    <SelectItem value="none" disabled>
                      {t('No credit orders found', 'Khong co don cong no')}
                    </SelectItem>
                  ) : (
                    orders.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs">#{o.orderNumber}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatVND(o.totalAmount - o.paidAmount)}
                          </span>
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('Amount', 'So tien')} <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={1000}
              step={10000}
              placeholder={t('Enter repayment amount...', 'Nhap so tien tra...')}
              className="font-mono"
            />
            {order && (
              <p className="text-[11px] text-muted-foreground">
                {t('Order total', 'Tong don')}: {formatVND(order.totalAmount)} | {t('Outstanding', 'Con no')}: {formatVND(order.totalAmount - order.paidAmount)}
              </p>
            )}
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('Payment Method', 'Phuong thuc TT')} <span className="text-red-500">*</span>
            </label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={t('Select method...', 'Chon phuong thuc...')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">
                  <span className="flex items-center gap-2">
                    <Banknote className="h-3.5 w-3.5" />
                    {t('Cash', 'Tien mat')}
                  </span>
                </SelectItem>
                <SelectItem value="DIGITAL">
                  <span className="flex items-center gap-2">
                    <Smartphone className="h-3.5 w-3.5" />
                    {t('Digital (MoMo/ZaloPay)', 'So (MoMo/ZaloPay)')}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Collected By */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('Collected By', 'Thu boi')} <span className="text-xs text-muted-foreground">({t('optional', 'tu chon')})</span>
            </label>
            <Input
              value={collectedBy}
              onChange={(e) => setCollectedBy(e.target.value)}
              placeholder={t('Driver or rep name...', 'Ten tai xe hoac nhan vien...')}
              className="h-9"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('Cancel', 'Huy')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedOrderId || !amount || !paymentMethod}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Banknote className="h-4 w-4 mr-1" />
            )}
            {t('Record Repayment', 'Ghi nhan tra no')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
