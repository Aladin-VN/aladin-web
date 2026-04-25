'use client';

import { useState, useEffect, useCallback } from 'react';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { CreditBalanceCard } from '@/components/mobile/credit-balance-card';
import { TransactionRow } from '@/components/mobile/transaction-row';
import { RepaymentForm } from '@/components/mobile/repayment-form';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import {
  Wallet,
  Loader2,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';
import type { CreditMyInfoResponse } from '@/types';

// ============================================
// Credit Page — Full credit management
// ============================================

const TX_FILTER_TABS: Array<{ id: string; vi: string; en: string }> = [
  { id: 'ALL', vi: 'Tất cả', en: 'All' },
  { id: 'CREDIT_USED', vi: 'Dùng tín dụng', en: 'Credit Used' },
  { id: 'REPAYMENT', vi: 'Thanh toán', en: 'Repayment' },
  { id: 'REFUND', vi: 'Hoàn trả', en: 'Refund' },
  { id: 'ADJUSTMENTS', vi: 'Điều chỉnh', en: 'Adjustments' },
];

export default function MobileCreditPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  // State
  const [creditData, setCreditData] = useState<CreditMyInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ALL');
  const [showRepayment, setShowRepayment] = useState(false);

  // Transaction list
  const [transactions, setTransactions] = useState<CreditMyInfoResponse['transactions']>([]);

  // Filter tabs
  const filteredTransactions = activeTab === 'ALL'
    ? transactions
    : activeTab === 'ADJUSTMENTS'
      ? transactions.filter((tx) => tx.type === 'CREDIT_LIMIT_INCREASE' || tx.type === 'CREDIT_LIMIT_DECREASE')
      : transactions.filter((tx) => tx.type === activeTab);

  // Fetch credit info
  const fetchCreditInfo = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const res = await api.get<CreditMyInfoResponse>('/credit/my-info');
      if (res.success && res.data) {
        setCreditData(res.data);
        setTransactions(res.data.transactions || []);
      } else {
        const code = res.error?.code || 'ERROR';
        const msg = res.error?.message || (locale === 'vi'
          ? 'Không thể tải thông tin công nợ'
          : 'Failed to load credit info');
        setError(`${code}: ${msg}`);
      }
    } catch {
      setError(locale === 'vi'
        ? 'Lỗi kết nối mạng. Kéo xuống để thử lại.'
        : 'Network error. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locale]);

  // Initial load
  useEffect(() => {
    fetchCreditInfo();
  }, [fetchCreditInfo]);

  // Pull-to-refresh
  const [pullState, setPullState] = useState<'idle' | 'pulling' | 'ready'>('idle');
  const [startY, setStartY] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setStartY(e.touches[0].clientY);
      setPullState('pulling');
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullState === 'idle') return;
    const diff = e.touches[0].clientY - startY;
    if (diff > 80) {
      setPullState('ready');
    } else if (diff < 20) {
      setPullState('idle');
    }
  };

  const handleTouchEnd = () => {
    if (pullState === 'ready') {
      fetchCreditInfo(true);
    }
    setPullState('idle');
    setStartY(0);
  };

  // Repayment success handler
  const handleRepaymentSuccess = () => {
    setShowRepayment(false);
    fetchCreditInfo(true);
  };

  // Empty state
  const hasNoTransactions = !loading && filteredTransactions.length === 0;

  // ===== RENDER =====

  // Loading skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Công nợ', 'Credit')} />
        <main className="px-4 pb-4 pt-3">
          {/* Skeleton credit card */}
          <div className="bg-slate-200 rounded-2xl h-64 animate-pulse mb-4" />
          {/* Skeleton tabs */}
          <div className="flex gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-20 rounded-full bg-slate-200 animate-pulse" />
            ))}
          </div>
          {/* Skeleton rows */}
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-border/50">
              <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-32 bg-slate-200 rounded animate-pulse mb-2" />
                <div className="h-3 w-48 bg-slate-200 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }

  // Error state
  if (error && !creditData) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Công nợ', 'Credit')} />
        <main className="px-4 pb-4 pt-3">
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive/50" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t('Lỗi tải dữ liệu', 'Failed to Load')}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => fetchCreditInfo(true)}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium"
            >
              {t('Thử lại', 'Retry')}
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <MobileHeader title={t('Công nợ', 'Credit')} showNotifications={false} />

      <main className="px-4 pb-4 pt-3">
        {/* Pull-to-refresh indicator */}
        {pullState === 'ready' && (
          <div className="flex justify-center py-2 mb-2">
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </div>
        )}

        {/* Refresh button */}
        <div className="flex justify-end mb-2">
          <button
            onClick={() => fetchCreditInfo(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {t('Làm mới', 'Refresh')}
          </button>
        </div>

        {/* Credit Balance Card */}
        {creditData && (
          <CreditBalanceCard
            credit={creditData.credit}
            monthly={creditData.monthly}
            onRepay={() => setShowRepayment(true)}
          />
        )}

        {/* Transactions section */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-foreground">
              {t('Lịch sử giao dịch', 'Transaction History')}
            </h2>
            <span className="text-xs text-muted-foreground">
              {filteredTransactions.length} {t('giao dịch', 'transactions')}
            </span>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 -mx-4 px-4">
            {TX_FILTER_TABS.map((tab) => {
              const count = tab.id === 'ALL'
                ? transactions.length
                : tab.id === 'ADJUSTMENTS'
                  ? transactions.filter((tx) => tx.type === 'CREDIT_LIMIT_INCREASE' || tx.type === 'CREDIT_LIMIT_DECREASE').length
                  : transactions.filter((tx) => tx.type === tab.id).length;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t(tab.vi, tab.en)}
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      activeTab === tab.id
                        ? 'bg-white/20'
                        : 'bg-muted-foreground/10'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Transaction list */}
          <div className="bg-card rounded-xl border border-border divide-y divide-border/50">
            {filteredTransactions.map((tx) => (
              <div key={tx.id} className="px-3">
                <TransactionRow
                  type={tx.type}
                  amount={tx.amount}
                  runningBalance={tx.runningBalance}
                  formattedBalance={tx.formattedBalance}
                  description={tx.description}
                  orderNumber={tx.orderNumber}
                  collectedByName={tx.collectedByName}
                  paymentMethod={tx.paymentMethod}
                  createdAt={typeof tx.createdAt === 'string' ? tx.createdAt : new Date(tx.createdAt).toISOString()}
                />
              </div>
            ))}

            {/* Empty state for filter */}
            {hasNoTransactions && activeTab !== 'ALL' && (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {t('Không có giao dịch loại này', 'No transactions of this type')}
                </p>
              </div>
            )}

            {/* Empty state for no transactions at all */}
            {hasNoTransactions && activeTab === 'ALL' && (
              <div className="text-center py-8">
                <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {t('Chưa có giao dịch nào', 'No transactions yet')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t(
                    'Giao dịch sẽ hiển thị khi bạn đặt hàng hoặc thanh toán.',
                    'Transactions appear when you place orders or make payments.'
                  )}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Credit info section */}
        {creditData && creditData.credit.status !== 'ACTIVE' && (
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-amber-800 mb-2">
              {t('Thông tin quan trọng', 'Important Information')}
            </h3>
            <ul className="text-xs text-amber-700 space-y-1.5">
              <li>
                · {t(
                  'Chu kỳ tín dụng: 7 ngày kể từ khi sử dụng.',
                  'Credit cycle: 7 days from first use.'
                )}
              </li>
              <li>
                · {t(
                  'Quá hạn sẽ bị khóa tài khoản và không thể đặt hàng.',
                  'Overdue accounts are locked and cannot place orders.'
                )}
              </li>
              <li>
                · {t(
                  'Thanh toán đủ sẽ tự động mở khóa.',
                  'Full repayment auto-reactivates your account.'
                )}
              </li>
              <li>
                · {t(
                  'Liên hệ đại diện bán hàng để được hỗ trợ.',
                  'Contact your sales rep for assistance.'
                )}
              </li>
            </ul>
          </div>
        )}

        {/* Healthy credit tips */}
        {creditData && creditData.credit.status === 'ACTIVE' && creditData.credit.utilizationPercent >= 70 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-blue-800 mb-1.5">
              {t('Mẹo quản lý công nợ', 'Credit Management Tips')}
            </h3>
            <ul className="text-xs text-blue-700 space-y-1.5">
              <li>
                · {t(
                  'Thanh toán trước hạn để duy trì hạn mức tốt.',
                  'Pay before due date to maintain a good credit limit.'
                )}
              </li>
              <li>
                · {t(
                  'Giữ tỷ lệ sử dụng dưới 70% để có cơ hội tăng hạn mức.',
                  'Keep utilization below 70% for limit increase opportunities.'
                )}
              </li>
              <li>
                · {t(
                  'Đặt hàng thanh toán điện tử (Digital) để được giảm 2%.',
                  'Order with Digital payment for 2% discount.'
                )}
              </li>
            </ul>
          </div>
        )}
      </main>

      {/* Repayment modal */}
      {showRepayment && creditData && (
        <RepaymentForm
          credit={creditData.credit}
          onSuccess={handleRepaymentSuccess}
          onCancel={() => setShowRepayment(false)}
        />
      )}
    </div>
  );
}
