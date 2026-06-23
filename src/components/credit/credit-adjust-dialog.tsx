'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useState } from 'react';
import { Loader2, Check } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { formatVND, CREDIT_CONFIG } from '@/lib/security';
import { toast } from 'sonner';

interface ShopCreditData {
  shopId: string;
  shopName: string;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  creditStatus: string;
}

interface CreditAdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shop: ShopCreditData | null;
  locale: string;
  onSuccess: () => void;
}

const PRESET_LIMITS = [
  { label: '1M', value: 1_000_000 },
  { label: '2M', value: 2_000_000 },
  { label: '3M', value: 3_000_000 },
  { label: '5M', value: 5_000_000 },
  { label: '10M', value: 10_000_000 },
];

export function CreditAdjustDialog({
  open,
  onOpenChange,
  shop,
  locale,
  onSuccess,
}: CreditAdjustDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [newLimit, setNewLimit] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset form on open
  const handleOpenChange = (val: boolean) => {
    if (val && shop) {
      setNewLimit(String(shop.creditLimit));
      setReason('');
      setError('');
    }
    onOpenChange(val);
  };

  const validateLimit = (val: string): boolean => {
    const num = parseInt(val);
    if (!val || isNaN(num)) {
      setError(t('Please enter a valid number', 'Vui long nhap so hop le'));
      return false;
    }
    if (num < CREDIT_CONFIG.MIN_LIMIT || num > CREDIT_CONFIG.MAX_LIMIT) {
      setError(
        t(
          `Limit must be between ${formatVND(CREDIT_CONFIG.MIN_LIMIT)} and ${formatVND(CREDIT_CONFIG.MAX_LIMIT)}`,
          `Han muc phai tu ${formatVND(CREDIT_CONFIG.MIN_LIMIT)} den ${formatVND(CREDIT_CONFIG.MAX_LIMIT)}`
        )
      );
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!shop) return;
    if (!reason.trim()) {
      setError(t('Reason is required', 'Ly do la bat buoc'));
      return;
    }
    if (!validateLimit(newLimit)) return;

    const num = parseInt(newLimit);
    if (num === shop.creditLimit) {
      setError(t('New limit is the same as current', 'Han muc moi giong han muc hien tai'));
      return;
    }

    setLoading(true);
    try {
      const res = await adminFetch('/api/credit/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopId: shop.shopId,
          newLimit: num,
          reason: reason.trim(),
        }),
      });

      if (json.success) {
        toast.success(
          locale === 'vi'
            ? `Dieu chinh han muc thanh cong: ${formatVND(json.data.oldLimit)} → ${formatVND(json.data.newLimit)}`
            : `Credit limit adjusted: ${formatVND(json.data.oldLimit)} → ${formatVND(json.data.newLimit)}`
        );
        handleOpenChange(false);
        onSuccess();
      } else {
        setError(json.error?.message || t('Failed to adjust credit limit', 'Khong the dieu chinh han muc'));
      }
    } catch {
      setError(t('Network error. Please try again.', 'Loi mang. Vui long thu lai.'));
    } finally {
      setLoading(false);
    }
  };

  if (!shop) return null;

  const limitNum = parseInt(newLimit) || 0;
  const isIncrease = limitNum > shop.creditLimit;
  const isDecrease = limitNum < shop.creditLimit;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t('Adjust Credit Limit', 'Dieu chinh han muc tin dung')}
          </DialogTitle>
          <DialogDescription>
            {shop.shopName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Current Credit Info */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[11px] text-muted-foreground font-medium">
                {t('Limit', 'Han muc')}
              </p>
              <p className="text-sm font-semibold mt-1">
                <SensitiveValue value={String(shop.creditLimit)} maskType="amount" formatOptions={{ formatCurrency: true }} />
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[11px] text-muted-foreground font-medium">
                {t('Used', 'Da dung')}
              </p>
              <p className="text-sm font-semibold mt-1">
                <SensitiveValue value={String(shop.creditUsed)} maskType="amount" formatOptions={{ formatCurrency: true }} />
              </p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-[11px] text-muted-foreground font-medium">
                {t('Available', 'Con lai')}
              </p>
              <p className="text-sm font-semibold mt-1">
                <SensitiveValue value={String(shop.creditAvailable)} maskType="amount" formatOptions={{ formatCurrency: true }} />
              </p>
            </div>
          </div>

          {/* New Limit Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('New Credit Limit', 'Han muc moi')}
            </label>
            <Input
              type="number"
              value={newLimit}
              onChange={(e) => {
                setNewLimit(e.target.value);
                validateLimit(e.target.value);
              }}
              min={CREDIT_CONFIG.MIN_LIMIT}
              max={CREDIT_CONFIG.MAX_LIMIT}
              step={100000}
              placeholder={formatVND(shop.creditLimit)}
              className="font-mono"
            />
            {isIncrease && (
              <p className="text-xs text-red-600">
                +{formatVND(limitNum - shop.creditLimit)} {t('increase', 'tang')}
              </p>
            )}
            {isDecrease && limitNum > 0 && (
              <p className="text-xs text-red-600">
                -{formatVND(shop.creditLimit - limitNum)} {t('decrease', 'giam')}
              </p>
            )}
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('Quick Presets', 'Chon nhanh')}
            </label>
            <div className="flex gap-2">
              {PRESET_LIMITS.map((preset) => (
                <Button
                  key={preset.value}
                  variant={parseInt(newLimit) === preset.value ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setNewLimit(String(preset.value));
                    validateLimit(String(preset.value));
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t('Reason', 'Ly do')} <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t(
                'e.g., Shop has good payment history, increasing trust level...',
                'VD: Cua hang co lich su thanh toan tot, tang cap tin dung...'
              )}
              rows={3}
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
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            {t('Cancel', 'Huy')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !newLimit || !reason.trim()}
            className={
              isIncrease
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : isDecrease
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            {t('Confirm Adjustment', 'Xac nhan dieu chinh')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
