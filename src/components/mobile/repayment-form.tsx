'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import {
  Banknote,
  Building2,
  Smartphone,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { CreditInfoData } from '@/types';

// ============================================
// Repayment Form — Self-service credit repayment
// ============================================

interface RepaymentFormProps {
  credit: CreditInfoData;
  onSuccess: () => void;
  onCancel: () => void;
}

const REPAYMENT_METHODS = [
  {
    id: 'CASH' as const,
    vi: 'Tiền mặt',
    en: 'Cash',
    viDesc: 'Ghi nhận thanh toán tiền mặt',
    enDesc: 'Record cash payment',
    icon: Banknote,
    color: 'text-red-600',
    bg: 'bg-yellow-50',
    border: 'border-yellow-100',
  },
  {
    id: 'BANK_TRANSFER' as const,
    vi: 'Chuyển khoản ngân hàng',
    en: 'Bank Transfer',
    viDesc: 'Chuyển khoản qua ngân hàng',
    enDesc: 'Transfer via bank',
    icon: Building2,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    id: 'DIGITAL' as const,
    vi: 'ZaloPay / MoMo',
    en: 'ZaloPay / MoMo',
    viDesc: 'Liên hệ đại diện bán hàng để được hỗ trợ',
    enDesc: 'Contact your sales rep for assistance',
    icon: Smartphone,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    disabled: true,
  },
] as const;

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000, 1000000];

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

export function RepaymentForm({ credit, onSuccess, onCancel }: RepaymentFormProps) {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'input' | 'confirm' | 'processing' | 'success' | 'error'>('input');
  const [errorMsg, setErrorMsg] = useState('');
  const [resultBalance, setResultBalance] = useState(0);

  // Parse numeric amount
  const numericAmount = useMemo(() => {
    const parsed = parseInt(amount.replace(/[^\d]/g, ''), 10);
    return isNaN(parsed) ? 0 : parsed;
  }, [amount]);

  // Validation
  const isAmountValid = numericAmount > 0 && numericAmount <= credit.used;
  const canSubmit = selectedMethod && isAmountValid && step === 'input';

  // Format input value with thousand separators
  const handleAmountChange = (value: string) => {
    const digits = value.replace(/[^\d]/g, '');
    if (digits === '') {
      setAmount('');
      return;
    }
    const num = parseInt(digits, 10);
    if (num > 999999999) return;
    setAmount(new Intl.NumberFormat('vi-VN').format(num));
  };

  // Quick amount button
  const handleQuickAmount = (value: number) => {
    const clamped = Math.min(value, credit.used);
    setAmount(new Intl.NumberFormat('vi-VN').format(clamped));
  };

  // Submit repayment
  const handleSubmit = async () => {
    if (!canSubmit) return;

    setStep('confirm');
  };

  const handleConfirm = async () => {
    setStep('processing');
    setErrorMsg('');

    try {
      const res = await api.post<{
        transaction: { id: string; runningBalance: number };
        newBalance: number;
        isFullRepayment: boolean;
      }>('/credit/repay', {
        amount: numericAmount,
        paymentMethod: selectedMethod,
      });

      if (res.success && res.data) {
        setResultBalance(res.data.newBalance);
        setStep('success');
      } else {
        const code = res.error?.code || 'ERROR';
        const msg = res.error?.message || (locale === 'vi'
          ? 'Không thể ghi nhận thanh toán. Vui lòng thử lại.'
          : 'Failed to record payment. Please try again.');
        setErrorMsg(`${code}: ${msg}`);
        setStep('error');
      }
    } catch {
      setErrorMsg(locale === 'vi'
        ? 'Lỗi kết nối mạng. Vui lòng thử lại.'
        : 'Network error. Please try again.');
      setStep('error');
    }
  };

  const selectedMethodCfg = REPAYMENT_METHODS.find((m) => m.id === selectedMethod);

  // Success screen
  if (step === 'success') {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-background rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 animate-in slide-in-from-bottom duration-200">
          <div className="text-center">
            <div className="h-16 w-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">
              {t('Thanh toán thành công!', 'Payment Successful!')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t(
                `Đã ghi nhận ${formatVND(numericAmount)} qua ${selectedMethodCfg ? t(selectedMethodCfg.vi, selectedMethodCfg.en) : ''}`,
                `Recorded ${formatVND(numericAmount)} via ${selectedMethodCfg ? t(selectedMethodCfg.vi, selectedMethodCfg.en) : ''}`
              )}
            </p>

            <div className="bg-muted/50 rounded-xl p-3 mb-4">
              <div className="text-xs text-muted-foreground mb-1">
                {t('Số dư công nợ còn lại', 'Remaining Credit Balance')}
              </div>
              <div className="text-xl font-bold text-foreground">
                {formatVND(resultBalance)}
              </div>
              {resultBalance === 0 && (
                <div className="text-xs text-red-600 font-medium mt-1">
                  {t('Đã thanh toán đủ!', 'Fully Settled!')}
                </div>
              )}
            </div>

            <button
              onClick={onSuccess}
              className="w-full bg-primary text-primary-foreground font-semibold py-3 rounded-xl"
            >
              {t('Hoàn tất', 'Done')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Confirm screen
  if (step === 'confirm') {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-background rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 animate-in slide-in-from-bottom duration-200">
          <h3 className="text-lg font-bold text-foreground mb-4">
            {t('Xác nhận thanh toán', 'Confirm Repayment')}
          </h3>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('Số tiền', 'Amount')}</span>
              <span className="font-semibold text-foreground">{formatVND(numericAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('Phương thức', 'Method')}</span>
              <span className="font-medium text-foreground">
                {selectedMethodCfg ? t(selectedMethodCfg.vi, selectedMethodCfg.en) : ''}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('Công nợ sau TT', 'Balance After')}</span>
              <span className="font-semibold text-red-600">
                {formatVND(credit.used - numericAmount)}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('input')}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground"
            >
              {t('Quay lại', 'Back')}
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
            >
              {t('Xác nhận', 'Confirm')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Processing state
  if (step === 'processing') {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-background rounded-2xl w-full max-w-sm p-6 text-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">
            {t('Đang xử lý...', 'Processing...')}
          </p>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-background rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-4">
          <h3 className="text-lg font-bold text-foreground">
            {t('Thanh toán công nợ', 'Repay Credit')}
          </h3>
          <button
            onClick={onCancel}
            className="text-sm text-muted-foreground font-medium"
          >
            {t('Đóng', 'Close')}
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Current balance */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <div className="text-xs text-red-600 font-medium mb-0.5">
              {t('Công nợ hiện tại', 'Current Outstanding')}
            </div>
            <div className="text-xl font-bold text-red-700">
              {formatVND(credit.used)}
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('Số tiền thanh toán', 'Repayment Amount')}
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="0"
                className="w-full h-12 pl-4 pr-16 border border-border rounded-xl text-lg font-semibold text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                VND
              </span>
            </div>
            {numericAmount > credit.used && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {t('Vượt quá công nợ hiện tại', 'Exceeds current outstanding')}
              </p>
            )}

            {/* Quick amount buttons */}
            <div className="flex gap-2 mt-2 flex-wrap">
              {QUICK_AMOUNTS.filter((v) => v <= credit.used).map((val) => (
                <button
                  key={val}
                  onClick={() => handleQuickAmount(val)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    numericAmount === val
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {val >= 1000000 ? `${val / 1000}K` : val >= 1000 ? `${val / 1000}K` : val}
                </button>
              ))}
              <button
                onClick={() => handleQuickAmount(credit.used)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  numericAmount === credit.used
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {t('Tất cả', 'All')}
              </button>
            </div>
          </div>

          {/* Payment method selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('Phương thức thanh toán', 'Payment Method')}
            </label>
            <div className="space-y-2">
              {REPAYMENT_METHODS.map((method) => {
                const MethodIcon = method.icon;
                const isSelected = selectedMethod === method.id;
                const isDisabled = 'disabled' in method && method.disabled;

                return (
                  <button
                    key={method.id}
                    onClick={() => !isDisabled && setSelectedMethod(method.id)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      isDisabled
                        ? 'opacity-50 cursor-not-allowed border-border bg-muted/30'
                        : isSelected
                          ? `${method.bg} ${method.border} ring-2 ring-offset-1 ring-primary/20`
                          : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                      isDisabled ? 'bg-muted' : `${method.bg}`
                    }`}>
                      <MethodIcon className={`h-4 w-4 ${isDisabled ? 'text-muted-foreground' : method.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${isDisabled ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {t(method.vi, method.en)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t(method.viDesc, method.enDesc)}
                      </div>
                    </div>
                    {isSelected && !isDisabled && (
                      <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error message */}
          {step === 'error' && errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{errorMsg}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full bg-red-500 hover:bg-red-600 active:bg-red-700 disabled:bg-muted disabled:text-muted-foreground text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {t(
              `Thanh toán ${numericAmount > 0 ? formatVND(numericAmount) : ''}`,
              `Repay ${numericAmount > 0 ? formatVND(numericAmount) : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
