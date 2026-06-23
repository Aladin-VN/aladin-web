'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import {
  Banknote, Building2, HandCoins, ShoppingBag,
  Clock, CheckCircle2, History, RefreshCw, ChevronRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

interface ShiftData {
  id: string;
  openedAt: string;
  openedBy: string;
  openingBalance: number;
  cashTotal: number;
  bankTransferTotal: number;
  debtTotal: number;
  salesCount: number;
  expectedCash: number;
}

interface Transaction {
  saleSequence: number;
  paymentMethod: string;
  customerName?: string;
  itemCount: number;
  total: number;
  createdAt: string;
}

export default function MobileReconciliationPage() {
  const [loading, setLoading] = useState(true);
  const [hasOpenShift, setHasOpenShift] = useState(false);
  const [currentShift, setCurrentShift] = useState<ShiftData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [previousShifts, setPreviousShifts] = useState<any[]>([]);

  // Close dialog
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closingBalance, setClosingBalance] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch('/api/distributor/pos/reconciliation');
      if (res.success) {
        setHasOpenShift(res.data.hasOpenShift);
        setCurrentShift(res.data.currentShift);
        setTransactions(res.data.transactions || []);
        setPreviousShifts(res.data.previousShifts || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCloseShift = async () => {
    const balance = parseInt(closingBalance);
    if (isNaN(balance) || balance < 0) return;
    setClosing(true);
    try {
      const res = await adminFetch('/api/distributor/pos/reconciliation', {
        method: 'POST',
        body: JSON.stringify({ closingBalance: balance, closingNotes: closingNotes || undefined }),
      });
      if (res.success) {
        setCloseResult(res.data.shift);
        setCloseDialogOpen(false);
        fetchData();
      } else {
        alert(res.error?.message || 'Lỗi');
      }
    } catch (e: any) {
      alert(e.message || 'Lỗi mạng');
    }
    setClosing(false);
  };

  const totalRevenue = currentShift ? currentShift.cashTotal + currentShift.bankTransferTotal + currentShift.debtTotal : 0;

  const paymentBadge = (method: string) => {
    switch (method) {
      case 'CASH': return <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">Tiền mặt</Badge>;
      case 'BANK_TRANSFER': return <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">CK</Badge>;
      case 'DEBT': return <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">Nợ</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">{method}</Badge>;
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 pt-4 pb-24">
      <h1 className="text-xl font-bold mb-1">Đối soát ca</h1>
      <p className="text-sm text-muted-foreground mb-4">Theo dõi doanh thu và chốt ca</p>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : !hasOpenShift ? (
        <Card>
          <CardContent className="p-10 text-center">
            <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <h3 className="font-semibold mb-1">Chưa mở ca</h3>
            <p className="text-sm text-muted-foreground">Ca tự động mở khi bán hàng đầu tiên.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Close Shift Result */}
          {closeResult && (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-700">Chốt ca thành công!</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Dự kiến</p>
                    <p className="font-semibold">{formatVND(closeResult.expectedCash)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Thực tế</p>
                    <p className="font-semibold">{formatVND(closeResult.closingBalance)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Chênh lệch</p>
                    <p className={`font-bold ${closeResult.cashDifference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {closeResult.cashDifference >= 0 ? '+' : ''}{formatVND(closeResult.cashDifference)}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setCloseResult(null)}>Đóng</Button>
              </CardContent>
            </Card>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-green-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="h-4 w-4 text-green-600" />
                  <span className="text-xs text-green-700 font-medium">Tiền mặt</span>
                </div>
                <p className="text-lg font-bold text-green-700">{formatVND(currentShift!.cashTotal)}</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-blue-600" />
                  <span className="text-xs text-blue-700 font-medium">Chuyển khoản</span>
                </div>
                <p className="text-lg font-bold text-blue-700">{formatVND(currentShift!.bankTransferTotal)}</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <HandCoins className="h-4 w-4 text-orange-600" />
                  <span className="text-xs text-orange-700 font-medium">Công nợ</span>
                </div>
                <p className="text-lg font-bold text-orange-700">{formatVND(currentShift!.debtTotal)}</p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingBag className="h-4 w-4 text-yellow-600" />
                  <span className="text-xs text-yellow-700 font-medium">Tổng DT</span>
                </div>
                <p className="text-lg font-bold text-yellow-700">{formatVND(totalRevenue)}</p>
                <p className="text-[10px] text-yellow-600">{currentShift!.salesCount} giao dịch</p>
              </CardContent>
            </Card>
          </div>

          {/* Shift Info + Close */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Mở ca: {new Date(currentShift!.openedAt).toLocaleTimeString('vi-VN')}</p>
                  <p className="text-xs text-muted-foreground">Số dư đầu ca: {formatVND(currentShift!.openingBalance)}</p>
                </div>
                <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">Đang mở</Badge>
              </div>
              <Button
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold shadow-lg shadow-orange-300/30"
                onClick={() => {
                  setClosingBalance(String(currentShift!.expectedCash));
                  setClosingNotes('');
                  setCloseDialogOpen(true);
                }}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Chốt ca
              </Button>
            </CardContent>
          </Card>

          {/* Transactions */}
          <div>
            <h2 className="text-sm font-semibold mb-2">Giao dịch hôm nay ({transactions.length})</h2>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Chưa có giao dịch</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((txn) => (
                  <Card key={txn.saleSequence}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold text-muted-foreground">#{txn.saleSequence}</span>
                          {paymentBadge(txn.paymentMethod)}
                        </div>
                        <span className="text-sm font-bold">{formatVND(txn.total)}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                        <span>
                          {new Date(txn.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          {txn.customerName ? ` · ${txn.customerName}` : ''}
                        </span>
                        <span>{txn.itemCount} SP</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Previous Shifts */}
          {previousShifts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <History className="h-4 w-4" /> Ca trước
              </h2>
              <div className="space-y-2">
                {previousShifts.map((s: any) => (
                  <Card key={s.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(s.openedAt).toLocaleDateString('vi-VN')}
                        </span>
                        <span className={`text-xs font-bold ${(s.cashDifference || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {s.cashDifference != null ? (s.cashDifference >= 0 ? '+' : '') + formatVND(s.cashDifference) : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{s.salesCount} GD</span>
                        <span className="font-semibold">{formatVND(s.cashTotal + s.bankTransferTotal + s.debtTotal)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Close Shift Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Chốt ca bán hàng</DialogTitle>
            <DialogDescription>Nhập số tiền mặt thực tế trong két.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {currentShift && (
              <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Dự kiến tiền mặt</span>
                  <span className="font-semibold">{formatVND(currentShift.expectedCash)}</span>
                </div>
              </div>
            )}
            <div>
              <Label className="text-sm">Số tiền thực tế (VND)</Label>
              <Input
                type="number"
                placeholder="Nhập số tiền..."
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                className="mt-1 text-lg font-bold"
                autoFocus
              />
            </div>
            <div>
              <Label className="text-sm">Ghi chú (tùy chọn)</Label>
              <Textarea placeholder="Ghi chú..." value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} rows={2} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>Hủy</Button>
            <Button
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
              onClick={handleCloseShift}
              disabled={closing || !closingBalance || parseInt(closingBalance) < 0}
            >
              {closing ? 'Đang xử lý...' : 'Xác nhận chốt ca'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}