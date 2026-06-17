'use client';

import { useAppStore } from '@/stores/app.store';
import { TrendingDown, TrendingUp, Clock, AlertTriangle, Lock, CheckCircle } from 'lucide-react';
import type { CreditInfoData, CreditMonthlyStats, CreditStatus } from '@/types';

// ============================================
// Credit Balance Card — Hero credit overview
// ============================================

interface CreditBalanceCardProps {
  credit: CreditInfoData;
  monthly: CreditMonthlyStats;
  onRepay: () => void;
}

const STATUS_CONFIG: Record<CreditStatus, { vi: string; en: string; color: string; bg: string }> = {
  ACTIVE: { vi: 'Hoạt động', en: 'Active', color: 'text-red-600', bg: 'bg-yellow-50 border-yellow-100' },
  LOCKED: { vi: 'Đã khóa', en: 'Locked', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  OVERDUE: { vi: 'Quá hạn', en: 'Overdue', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
};

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

export function CreditBalanceCard({ credit, monthly, onRepay }: CreditBalanceCardProps) {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const statusCfg = STATUS_CONFIG[credit.status];
  const isNegativeBalance = credit.used > 0;

  // Progress bar color based on utilization
  const progressColor =
    credit.utilizationPercent >= 90 ? 'bg-red-500' :
    credit.utilizationPercent >= 70 ? 'bg-amber-500' :
    'bg-red-500';

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white shadow-lg">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-300 font-medium">
          {t('Hạn mức tín dụng', 'Credit Limit')}
        </span>
        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
          credit.status === 'ACTIVE' ? 'bg-red-500/20 text-yellow-400 border-red-500/30' :
          credit.status === 'LOCKED' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' :
          'bg-red-500/20 text-red-300 border-red-500/30'
        }`}>
          {statusCfg[locale === 'vi' ? 'vi' : 'en']}
        </span>
      </div>

      {/* Available Credit (Hero number) */}
      <div className="mb-1">
        <span className="text-3xl font-bold tracking-tight">
          {formatVND(credit.available)}
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        {t('Còn lại', 'Remaining')} / {formatVND(credit.limit)} {t('hạn mức', 'limit')}
      </p>

      {/* Utilization bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">
            {t('Đã sử dụng', 'Used')}: {formatVND(credit.used)}
          </span>
          <span className="text-slate-300 font-medium">{credit.utilizationPercent}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${Math.min(100, credit.utilizationPercent)}%` }}
          />
        </div>
      </div>

      {/* Status-specific warning */}
      {credit.status === 'OVERDUE' && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">
            {t(
              'Công nợ quá hạn! Vui lòng thanh toán ngay để khôi phục hạn mức.',
              'Credit overdue! Please repay immediately to restore limit.'
            )}
          </span>
        </div>
      )}
      {credit.status === 'LOCKED' && (
        <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg px-3 py-2 mb-3 flex items-center gap-2">
          <Lock className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300">
            {t(
              'Tài khoản đã bị khóa. Thanh toán đủ sẽ tự động mở khóa.',
              'Account locked. Full repayment auto-reactivates credit.'
            )}
          </span>
        </div>
      )}

      {/* Days until due */}
      {credit.daysUntilDue !== null && credit.status === 'ACTIVE' && isNegativeBalance && (
        <div className="flex items-center gap-2 mb-3">
          <Clock className={`h-4 w-4 shrink-0 ${
            credit.daysUntilDue <= 2 ? 'text-amber-400' : 'text-slate-400'
          }`} />
          <span className={`text-xs ${
            credit.daysUntilDue <= 2 ? 'text-amber-400 font-medium' : 'text-slate-400'
          }`}>
            {t(
              `Còn ${credit.daysUntilDue} ngày để thanh toán`,
              `${credit.daysUntilDue} days until due`
            )}
          </span>
        </div>
      )}

      {/* Monthly stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-700/50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
              {t('Đã dùng TL', 'Used/Mo')}
            </span>
          </div>
          <span className="text-sm font-semibold text-white">
            {formatVND(monthly.totalCreditUsed)}
          </span>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-yellow-500" />
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">
              {t('Đã trả TL', 'Repaid/Mo')}
            </span>
          </div>
          <span className="text-sm font-semibold text-white">
            {formatVND(monthly.totalRepaid)}
          </span>
        </div>
      </div>

      {/* Repay button */}
      {isNegativeBalance && (
        <button
          onClick={onRepay}
          className="w-full bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle className="h-4 w-4" />
          {t('Thanh toán ngay', 'Repay Now')}
        </button>
      )}

      {/* Zero balance state */}
      {!isNegativeBalance && (
        <div className="text-center py-1.5">
          <span className="text-xs text-yellow-500">
            {t('Công nợ đã thanh toán đủ', 'Credit fully settled')}
          </span>
        </div>
      )}
    </div>
  );
}
