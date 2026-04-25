'use client';

import { useAppStore } from '@/stores/app.store';
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  CreditCard,
  Receipt,
  RefreshCcw,
  Gift,
} from 'lucide-react';
import type { TransactionType } from '@/types';

// ============================================
// Transaction Row — Ledger line item
// ============================================

interface TransactionRowProps {
  type: TransactionType;
  amount: number;
  runningBalance: number;
  formattedBalance?: string;
  description?: string | null;
  orderNumber?: string | null;
  collectedByName?: string | null;
  paymentMethod?: string | null;
  createdAt: string;
}

const TX_TYPE_CONFIG: Record<TransactionType, { vi: string; en: string; icon: typeof ArrowDownLeft; color: string }> = {
  CREDIT_USED: { vi: 'Dùng tín dụng', en: 'Credit Used', icon: ArrowUpRight, color: 'text-red-500' },
  REPAYMENT: { vi: 'Thanh toán', en: 'Repayment', icon: ArrowDownLeft, color: 'text-emerald-500' },
  ORDER_PAYMENT: { vi: 'Thanh toán đơn', en: 'Order Payment', icon: CreditCard, color: 'text-blue-500' },
  REFUND: { vi: 'Hoàn trả', en: 'Refund', icon: RefreshCcw, color: 'text-amber-500' },
  CREDIT_LIMIT_INCREASE: { vi: 'Tăng hạn mức', en: 'Limit Increase', icon: TrendingUp, color: 'text-violet-500' },
  CREDIT_LIMIT_DECREASE: { vi: 'Giảm hạn mức', en: 'Limit Decrease', icon: Receipt, color: 'text-slate-500' },
};

const TX_PAYMENT_METHOD_LABELS: Record<string, { vi: string; en: string }> = {
  CASH: { vi: 'Tiền mặt', en: 'Cash' },
  BANK_TRANSFER: { vi: 'Chuyển khoản', en: 'Bank Transfer' },
  DIGITAL: { vi: 'Điện tử', en: 'Digital' },
  ZALOPAY: { vi: 'ZaloPay', en: 'ZaloPay' },
  MOMO: { vi: 'MoMo', en: 'MoMo' },
  COD: { vi: 'COD', en: 'COD' },
};

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.abs(amount)) + ' ₫';
}

function formatRelativeTime(dateStr: string, locale: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (locale === 'vi') {
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } else {
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

export function TransactionRow({
  type,
  amount,
  runningBalance,
  formattedBalance,
  description,
  orderNumber,
  collectedByName,
  paymentMethod,
  createdAt,
}: TransactionRowProps) {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const config = TX_TYPE_CONFIG[type] || TX_TYPE_CONFIG.CREDIT_USED;
  const Icon = config.icon;

  const isPositive = amount > 0; // positive = credit used (debit), negative = repayment/refund
  const amountColor = isPositive ? 'text-red-500' : 'text-emerald-500';
  const amountPrefix = isPositive ? '-' : '+';

  // Payment method label
  const paymentLabel = paymentMethod
    ? TX_PAYMENT_METHOD_LABELS[paymentMethod]
    : null;

  // Description line
  const descLines: string[] = [];
  if (description) descLines.push(description);
  if (orderNumber) descLines.push(`#${orderNumber}`);
  if (collectedByName) descLines.push(t(`thu bởi ${collectedByName}`, `collected by ${collectedByName}`));

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-b-0">
      {/* Icon */}
      <div className="shrink-0 mt-0.5">
        <div className={`h-9 w-9 rounded-full flex items-center justify-center bg-muted/50`}>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-sm font-medium text-foreground truncate">
            {config[locale === 'vi' ? 'vi' : 'en']}
          </span>
          <span className={`text-sm font-semibold ${amountColor} whitespace-nowrap`}>
            {amountPrefix}{formatVND(amount)}
          </span>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-1">
          {descLines.join(' · ')}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{formatRelativeTime(createdAt, locale)}</span>
          {paymentLabel && (
            <>
              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/40" />
              <span className="px-1.5 py-0.5 rounded bg-muted/50">
                {paymentLabel[locale === 'vi' ? 'vi' : 'en']}
              </span>
            </>
          )}
        </div>

        {/* Running balance */}
        {formattedBalance && (
          <div className="mt-1 text-[10px] text-muted-foreground">
            {t('Số dư', 'Balance')}: <span className="font-medium">{formattedBalance}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export { TX_TYPE_CONFIG, TX_PAYMENT_METHOD_LABELS };
