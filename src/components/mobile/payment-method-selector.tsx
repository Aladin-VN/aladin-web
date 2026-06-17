'use client';

import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { cn } from '@/lib/utils';
import { CreditCard, Smartphone, Banknote, AlertTriangle } from 'lucide-react';
import type { PaymentMethod } from '@/types';

// ============================================
// Types
// ============================================

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

// ============================================
// Payment method definitions
// ============================================

interface PaymentOption {
  id: PaymentMethod;
  icon: React.ReactNode;
  labelVi: string;
  labelEn: string;
  descVi: string;
  descEn: string;
  badgeVi?: string;
  badgeEn?: string;
  disabled?: boolean;
}

function getPaymentOptions(creditStatus?: string): PaymentOption[] {
  const isCreditLocked = creditStatus === 'LOCKED' || creditStatus === 'OVERDUE';

  return [
    {
      id: 'CREDIT',
      icon: <CreditCard className="h-5 w-5" />,
      labelVi: 'Công nợ',
      labelEn: 'Credit',
      descVi: 'Thanh toán sau theo hạn',
      descEn: 'Pay later by due date',
      ...(isCreditLocked
        ? { badgeVi: 'Khóa', badgeEn: 'Locked', disabled: true }
        : {}),
    },
    {
      id: 'DIGITAL',
      icon: <Smartphone className="h-5 w-5" />,
      labelVi: 'Thanh toán số',
      labelEn: 'Digital Pay',
      descVi: 'ZaloPay / MoMo (giảm 2%)',
      descEn: 'ZaloPay / MoMo (2% off)',
      badgeVi: '-2%',
      badgeEn: '-2%',
    },
    {
      id: 'COD',
      icon: <Banknote className="h-5 w-5" />,
      labelVi: 'COD',
      labelEn: 'COD',
      descVi: 'Trả tiền khi nhận hàng',
      descEn: 'Pay on delivery',
      badgeVi: '+15K phí ship',
      badgeEn: '+15K ship fee',
    },
  ];
}

// ============================================
// Component
// ============================================

export function PaymentMethodSelector({ value, onChange }: PaymentMethodSelectorProps) {
  const locale = useAppStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const options = getPaymentOptions(user?.shop?.creditStatus);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold mb-2">{t('Phương thức thanh toán', 'Payment Method')}</h3>

      {options.map((option) => {
        const isSelected = value === option.id;
        const isDisabled = option.disabled;

        return (
          <button
            key={option.id}
            onClick={() => !isDisabled && onChange(option.id)}
            disabled={isDisabled}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
              isSelected && !isDisabled
                ? 'border-primary bg-primary/5'
                : isDisabled
                ? 'border-border opacity-50 cursor-not-allowed'
                : 'border-border hover:border-primary/30'
            )}
          >
            {/* Icon */}
            <div
              className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                isSelected && !isDisabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}
            >
              {option.icon}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {locale === 'vi' ? option.labelVi : option.labelEn}
                </span>
                {option.badgeVi && (
                  <span
                    className={cn(
                      'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                      option.id === 'DIGITAL'
                        ? 'bg-yellow-50 text-red-700 dark:bg-red-900 dark:text-yellow-400'
                        : option.id === 'COD'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                        : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                    )}
                  >
                    {locale === 'vi' ? option.badgeVi : option.badgeEn}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {locale === 'vi' ? option.descVi : option.descEn}
              </p>
            </div>

            {/* Radio indicator */}
            <div
              className={cn(
                'h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center',
                isSelected && !isDisabled ? 'border-primary' : 'border-muted-foreground/30'
              )}
            >
              {isSelected && !isDisabled && (
                <div className="h-2.5 w-2.5 rounded-full bg-primary" />
              )}
            </div>
          </button>
        );
      })}

      {/* Credit locked warning */}
      {user?.shop?.creditStatus === 'LOCKED' && (
        <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t(
              'Công nợ đã bị khóa. Vui lòng thanh toán công nợ trước khi đặt hàng.',
              'Credit is locked. Please repay before placing new orders.'
            )}
          </p>
        </div>
      )}
    </div>
  );
}
