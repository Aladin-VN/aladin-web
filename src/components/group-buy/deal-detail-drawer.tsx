'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  Calendar,
  BarChart3,
  Users,
  ShoppingCart,
  MapPin,
  Clock,
  TrendingUp,
  PiggyBank,
  Store,
  Loader2,
} from 'lucide-react';
import { DealStatusBadge } from './deal-status-badge';
import { formatVND } from '@/lib/security';

interface DealDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string | null;
  locale?: string;
}

interface Participant {
  id: string;
  committedQty: number;
  isActive: boolean;
  createdAt: string;
  shop: { id: string; name: string; district: string | null; loyaltyTier: string };
}

interface DealDetail {
  id: string;
  title: string;
  titleEn: string | null;
  description: string | null;
  productId: string;
  targetQty: number;
  currentQty: number;
  originalPrice: number;
  discountPrice: number;
  maxParticipants: number | null;
  startsAt: string;
  expiresAt: string;
  wardId: string | null;
  status: string;
  createdAt: string;
  progressPercent: number;
  savingsPercent: number;
  savingsPerUnit: number;
  savingsPerUnitFormatted: string;
  originalPriceFormatted: string;
  discountPriceFormatted: string;
  totalPotentialSavings: number;
  totalPotentialSavingsFormatted: string;
  timeRemaining: string;
  participantCount: number;
  activeParticipantCount: number;
  totalCommitted: number;
  totalCommittedFormatted: string;
  product: { id: string; name: string; sku: string; basePrice: number; imageUrl: string | null; isActive: boolean };
  ward: { id: string; name: string; district: string } | null;
  participants: Participant[];
  orders: { id: string; orderNumber: string; status: string; totalAmount: number; createdAt: string }[];
}

export function DealDetailDrawer({ open, onOpenChange, dealId, locale = 'vi' }: DealDetailDrawerProps) {
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;
  const [detail, setDetail] = useState<DealDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'participants' | 'orders'>('overview');

  const shouldFetch = dealId && open;

  // Reset state when drawer closes
  if (!shouldFetch && detail) {
    setDetail(null);
    setActiveTab('overview');
  }

  useEffect(() => {
    if (!shouldFetch) return;
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await adminFetch(`/api/group-deals/${dealId}`, { signal: controller.signal });
        const json = await res.json();
        if (!cancelled && json.success) setDetail(json.data);
      } catch (err) {
        if (!cancelled) console.error(err);
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [shouldFetch, dealId]);

  if (!dealId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-1 pr-6">
          <SheetTitle className="text-lg">{t('Group Deal Detail', 'Chi tiết Deal Mua Chung')}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
            <div className="grid grid-cols-2 gap-3 mt-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          </div>
        ) : detail ? (
          <div className="mt-6 space-y-5">
            {/* Title + Badges */}
            <div>
              <h3 className="text-lg font-semibold">{detail.title}</h3>
              {detail.titleEn && <p className="text-sm text-muted-foreground">{detail.titleEn}</p>}
              {detail.description && <p className="text-sm text-muted-foreground mt-1">{detail.description}</p>}
              <div className="flex flex-wrap gap-2 mt-3">
                <DealStatusBadge status={detail.status as 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'} locale={locale} />
                {detail.ward && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <MapPin className="h-3 w-3" />
                    {detail.ward.name}
                  </Badge>
                )}
                {detail.maxParticipants && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Users className="h-3 w-3" />
                    {t('Max', 'Tối đa')}: {detail.maxParticipants}
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            {/* Tab navigation */}
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(['overview', 'participants', 'orders'] as const).map((tab) => (
                <button
                  key={tab}
                  className={`h-8 text-xs flex-1 rounded-md flex items-center justify-center gap-1 transition-colors ${
                    activeTab === tab
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'hover:bg-muted-foreground/10'
                  }`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'overview' && <BarChart3 className="h-3.5 w-3.5" />}
                  {tab === 'participants' && <Users className="h-3.5 w-3.5" />}
                  {tab === 'orders' && <ShoppingCart className="h-3.5 w-3.5" />}
                  {t(
                    { overview: 'Overview', participants: 'Participants', orders: 'Orders' }[tab],
                    { overview: 'Tổng quan', participants: 'Tham gia', orders: 'Đơn hàng' }[tab]
                  )}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Progress */}
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground">{t('Progress', 'Tiến độ')}</p>
                    <span className="text-sm font-bold">{detail.progressPercent}%</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        detail.progressPercent >= 100
                          ? 'bg-red-500'
                          : detail.progressPercent >= 50
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                      }`}
                      style={{ width: `${Math.min(100, detail.progressPercent)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {detail.currentQty.toLocaleString()} / {detail.targetQty.toLocaleString()} {t('units', 'sản phẩm')}
                  </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">{t('Product', 'Sản phẩm')}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Package className="h-3.5 w-3.5 text-red-600 shrink-0" />
                      <p className="text-xs font-medium truncate">{detail.product.name}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{detail.product.sku}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">{t('Pricing', 'Định giá')}</p>
                    <div className="space-y-0.5 mt-1">
                      <p className="text-xs">
                        <span className="text-muted-foreground line-through">{detail.originalPriceFormatted}</span>
                      </p>
                      <p className="text-sm font-bold text-red-600">{detail.discountPriceFormatted}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">-{detail.savingsPercent}%</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">{t('Savings / Unit', 'Tiết kiệm / SP')}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <PiggyBank className="h-3.5 w-3.5 text-red-600" />
                      <p className="text-sm font-bold">{detail.savingsPerUnitFormatted}</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {t('Potential total', 'Tiềm năng tổng')}: {detail.totalPotentialSavingsFormatted}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">{t('Participants', 'Người tham gia')}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <Users className="h-3.5 w-3.5 text-purple-600" />
                      <p className="text-sm font-bold">{detail.activeParticipantCount}</p>
                      <span className="text-[10px] text-muted-foreground">/ {detail.maxParticipants || t('unlimited', 'không giới hạn')}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {t('Total committed', 'Tổng cam kết')}: {detail.currentQty.toLocaleString()} {t('units', 'sp')}
                    </p>
                  </div>
                </div>

                {/* Validity */}
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {t('Validity Period', 'Thời gian hiệu lực')}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">{t('From', 'Từ')}</p>
                      <p className="font-medium">{new Date(detail.startsAt).toLocaleDateString('vi-VN')}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{t('To', 'Đến')}</p>
                      <p className="font-medium">{new Date(detail.expiresAt).toLocaleDateString('vi-VN')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className={detail.timeRemaining === 'Đã hết hạn' ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                      {detail.timeRemaining === 'Đã hết hạn' ? t('Expired', 'Đã hết hạn') : detail.timeRemaining}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Participants Tab */}
            {activeTab === 'participants' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-muted-foreground">
                    {detail.activeParticipantCount} {t('active shops', 'cửa hàng đang tham gia')}
                  </p>
                  <p className="text-xs font-medium">
                    {t('Total committed', 'Tổng cam kết')}: {detail.currentQty.toLocaleString()} {t('units', 'sp')}
                  </p>
                </div>
                {detail.participants.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{t('No participants yet', 'Chưa có cửa hàng tham gia')}</p>
                ) : (
                  detail.participants.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50">
                      <div className="h-10 w-10 rounded-md bg-yellow-50 flex items-center justify-center shrink-0">
                        <Store className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.shop.name}</p>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          {p.shop.district && <MapPin className="h-3 w-3" />}
                          <span className="truncate">{p.shop.district}</span>
                          <span>·</span>
                          <span>{new Date(p.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">{p.committedQty.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground">{t('units', 'sp')}</p>
                      </div>
                      {!p.isActive && (
                        <Badge variant="outline" className="text-[10px] text-red-600 shrink-0">{t('Inactive', 'Rút')}</Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="space-y-2">
                {detail.orders.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t('No bulk order created yet', 'Chưa tạo đơn gom hàng')}
                    </p>
                    {detail.status === 'COMPLETED' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('Deal completed but no bulk order linked', 'Deal hoàn thành nhưng chưa liên kết đơn gom')}
                      </p>
                    )}
                  </div>
                ) : (
                  detail.orders.map((order) => (
                    <div key={order.id} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50">
                      <div className="h-10 w-10 rounded-md bg-blue-50 flex items-center justify-center shrink-0">
                        <ShoppingCart className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{order.orderNumber}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium">{formatVND(order.totalAmount)}</p>
                        <Badge variant="outline" className="text-[10px]">{order.status}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
