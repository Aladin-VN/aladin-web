'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  ScrollText,
  Plus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { CreditStatusBadge } from './credit-status-badge';
import { formatVND } from '@/lib/security';
import { RepaymentDialog } from './repayment-dialog';

interface ShopCreditData {
  shopId: string;
  shopName: string;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  creditStatus: string;
}

interface TransactionItem {
  id: string;
  type: string;
  amount: number;
  runningBalance: number;
  formattedBalance: string;
  paymentMethod: string | null;
  description: string | null;
  orderNumber: string | null;
  collectedByName: string | null;
  createdAt: string;
}

interface TransactionLedgerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shop: ShopCreditData | null;
  locale: string;
}

const TX_TYPE_CONFIG: Record<string, { bg: string; label: { en: string; vi: string } }> = {
  CREDIT_USED: { bg: 'bg-red-100 text-red-700', label: { en: 'Credit Used', vi: 'Da su dung' } },
  REPAYMENT: { bg: 'bg-yellow-50 text-red-700', label: { en: 'Repayment', vi: 'Tra no' } },
  CREDIT_LIMIT_INCREASE: { bg: 'bg-blue-100 text-blue-700', label: { en: 'Limit ↑', vi: 'Tang han muc' } },
  CREDIT_LIMIT_DECREASE: { bg: 'bg-amber-100 text-amber-700', label: { en: 'Limit ↓', vi: 'Giam han muc' } },
  ORDER_PAYMENT: { bg: 'bg-purple-100 text-purple-700', label: { en: 'Payment', vi: 'Thanh toan' } },
  REFUND: { bg: 'bg-gray-100 text-gray-700', label: { en: 'Refund', vi: 'Hoan tien' } },
};

const PAYMENT_LABELS: Record<string, { en: string; vi: string }> = {
  CASH: { en: 'Cash', vi: 'Tien mat' },
  DIGITAL: { en: 'Digital', vi: 'So' },
  COD: { en: 'COD', vi: 'COD' },
  CREDIT: { en: 'Credit', vi: 'Cong no' },
};

export function TransactionLedgerDialog({
  open,
  onOpenChange,
  shop,
  locale,
}: TransactionLedgerDialogProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTx, setTotalTx] = useState(0);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const limit = 15;

  // Repayment dialog
  const [repaymentOpen, setRepaymentOpen] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!shop) return;
    try {
      setLoading(true);
      const params = new URLSearchParams({
        shopId: shop.shopId,
        page: String(page),
        limit: String(limit),
      });
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await adminFetch(`/api/credit/transactions?${params.toString()}`);

      if (json.success) {
        setTransactions(json.data.items || []);
        setTotalPages(json.data.pagination.totalPages);
        setTotalTx(json.data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setLoading(false);
    }
  }, [shop, page, typeFilter, dateFrom, dateTo, limit]);

  useEffect(() => {
    if (open && shop) {
      setPage(1);
      setTypeFilter('ALL');
      setDateFrom('');
      setDateTo('');
    }
  }, [open, shop]);

  useEffect(() => {
    if (open && shop) {
      fetchTransactions();
    }
  }, [fetchTransactions, open, shop]);

  const resetFilters = () => {
    setTypeFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
    });
  };

  if (!shop) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <ScrollText className="h-5 w-5 text-red-600" />
                  {t('Transaction Ledger', 'So cai no')}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">{shop.shopName}</p>
              </div>
              <div className="flex items-center gap-3">
                <CreditStatusBadge status={shop.creditStatus} locale={locale} />
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground">{t('Balance', 'So du')}</p>
                  <p className="text-sm font-bold">
                    <SensitiveValue value={String(shop.creditUsed)} maskType="amount" formatOptions={{ formatCurrency: true }} />
                  </p>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">{t('Limit', 'Han muc')}</p>
              <p className="text-xs font-semibold mt-0.5">
                <SensitiveValue value={String(shop.creditLimit)} maskType="amount" formatOptions={{ formatCurrency: true }} />
              </p>
            </div>
            <div className="rounded-lg border p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">{t('Available', 'Con lai')}</p>
              <p className="text-xs font-semibold mt-0.5">
                <SensitiveValue value={String(shop.creditAvailable)} maskType="amount" formatOptions={{ formatCurrency: true }} />
              </p>
            </div>
            <div className="rounded-lg border p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">{t('Transactions', 'Giao dich')}</p>
              <p className="text-xs font-semibold mt-0.5">{totalTx}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(1); }}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder={t('All Types', 'Tat ca loai')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('All Types', 'Tat ca loai')}</SelectItem>
                <SelectItem value="CREDIT_USED">{t('Credit Used', 'Da su dung no')}</SelectItem>
                <SelectItem value="REPAYMENT">{t('Repayment', 'Tra no')}</SelectItem>
                <SelectItem value="CREDIT_LIMIT_INCREASE">{t('Limit Increase', 'Tang han muc')}</SelectItem>
                <SelectItem value="CREDIT_LIMIT_DECREASE">{t('Limit Decrease', 'Giam han muc')}</SelectItem>
                <SelectItem value="ORDER_PAYMENT">{t('Order Payment', 'Thanh toan don')}</SelectItem>
                <SelectItem value="REFUND">{t('Refund', 'Hoan tien')}</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-[140px] h-8 text-xs"
              placeholder={t('From', 'Tu')}
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-[140px] h-8 text-xs"
              placeholder={t('To', 'Den')}
            />

            {(typeFilter !== 'ALL' || dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
                {t('Reset', 'Dat lai')}
              </Button>
            )}

            <Button
              size="sm"
              className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white ml-auto"
              onClick={() => setRepaymentOpen(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              {t('Record Repayment', 'Ghi nhan tra no')}
            </Button>
          </div>

          {/* Transaction Table */}
          <div className="flex-1 min-h-0">
            <ScrollArea className="max-h-[320px]">
              {loading ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('No transactions found', 'Khong tim thay giao dich')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-[11px] w-[120px]">{t('Date', 'Ngay')}</TableHead>
                      <TableHead className="text-[11px] w-[110px]">{t('Type', 'Loai')}</TableHead>
                      <TableHead className="text-[11px] text-right w-[100px]">{t('Amount', 'So tien')}</TableHead>
                      <TableHead className="text-[11px] text-right w-[100px]">{t('Balance', 'So du')}</TableHead>
                      <TableHead className="text-[11px] w-[80px] hidden md:table-cell">{t('Method', 'PT')}</TableHead>
                      <TableHead className="text-[11px] hidden lg:table-cell">{t('Collected By', 'Thu boi')}</TableHead>
                      <TableHead className="text-[11px] hidden xl:table-cell">{t('Description', 'Mo ta')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => {
                      const typeConfig = TX_TYPE_CONFIG[tx.type] || { bg: 'bg-gray-100 text-gray-700', label: { en: tx.type, vi: tx.type } };
                      const isDebit = tx.amount > 0;
                      const isCredit = tx.amount < 0;
                      const isZero = tx.amount === 0;

                      return (
                        <TableRow key={tx.id} className="text-xs">
                          <TableCell className="font-mono text-[11px]">
                            {formatShortDate(tx.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`text-[10px] font-medium px-1.5 py-0 ${typeConfig.bg}`}>
                              {locale === 'vi' ? typeConfig.label.vi : typeConfig.label.en}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {isZero ? (
                              <span className="text-muted-foreground">—</span>
                            ) : isDebit ? (
                              <span className="text-red-600 font-medium">
                                <ArrowUpRight className="h-3 w-3 inline mr-0.5" />
                                <SensitiveValue value={String(tx.amount)} maskType="amount" formatOptions={{ formatCurrency: true }} />
                              </span>
                            ) : (
                              <span className="text-red-600 font-medium">
                                <ArrowDownRight className="h-3 w-3 inline mr-0.5" />
                                <SensitiveValue value={String(Math.abs(tx.amount))} maskType="amount" formatOptions={{ formatCurrency: true }} />
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <SensitiveValue value={String(tx.runningBalance)} maskType="amount" formatOptions={{ formatCurrency: true }} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {tx.paymentMethod ? (
                              <span className="text-[11px] text-muted-foreground">
                                {locale === 'vi' ? (PAYMENT_LABELS[tx.paymentMethod]?.vi || tx.paymentMethod) : (PAYMENT_LABELS[tx.paymentMethod]?.en || tx.paymentMethod)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {tx.collectedByName ? (
                              <span className="text-[11px]">
                                <SensitiveValue value={tx.collectedByName} maskType="name" />
                              </span>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden xl:table-cell max-w-[180px] truncate">
                            <span className="text-[11px] text-muted-foreground" title={tx.description || ''}>
                              {tx.description || (tx.orderNumber ? `#${tx.orderNumber}` : '—')}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t pt-3">
              <p className="text-[11px] text-muted-foreground">
                {t(`Page ${page} of ${totalPages} (${totalTx} transactions)`, `Trang ${page}/${totalPages} (${totalTx} giao dich)`)}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Repayment Dialog */}
      <RepaymentDialog
        open={repaymentOpen}
        onOpenChange={setRepaymentOpen}
        shop={shop}
        locale={locale}
        onSuccess={() => {
          fetchTransactions();
        }}
      />
    </>
  );
}
