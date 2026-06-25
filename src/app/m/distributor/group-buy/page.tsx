'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { formatVND } from '@/lib/security';
import { useAppStore } from '@/stores/app.store';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { PackageOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

// ============================================
// Types
// ============================================

interface GroupDeal {
  id: string;
  name: string;
  productName: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED';
  targetQty: number;
  currentQty: number;
  totalOrders: number;
  totalQuantity: number;
  fulfillmentPct?: number;
  deadline?: string;
  pricePerUnit?: number;
}

type TabFilter = 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

// ============================================
// Helpers
// ============================================

const t = (vi: string, en: string, locale: string) => (locale === 'vi' ? vi : en);

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
};

const statusLabelVi: Record<string, string> = {
  ACTIVE: 'Đang diễn ra',
  COMPLETED: 'Hoàn thành',
  EXPIRED: 'Hết hạn',
  CANCELLED: 'Đã hủy',
};

const statusLabelEn: Record<string, string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

// ============================================
// Component
// ============================================

export default function GroupBuyPage() {
  const locale = useAppStore((s) => s.locale);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabFilter>('ACTIVE');
  const [deals, setDeals] = useState<GroupDeal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminFetch(`/api/distributor/group-buy?status=${activeTab}`);
      if (res.success) {
        setDeals(res.data?.items || res.data || []);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const tabs: { key: TabFilter; vi: string; en: string }[] = [
    { key: 'ACTIVE', vi: 'Đang diễn ra', en: 'Active' },
    { key: 'COMPLETED', vi: 'Hoàn thành', en: 'Completed' },
    { key: 'EXPIRED', vi: 'Hết hạn', en: 'Expired' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Mua chung', 'Group Buy', locale)}
        showNotifications={false}
      />

      <main className="px-4 pb-24 pt-2">
        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`flex-1 py-2 text-xs font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {locale === 'vi' ? tab.vi : tab.en}
            </button>
          ))}
        </div>

        {/* Deal list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : deals.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <PackageOpen className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                {t('Chưa có đơn mua chung', 'No group deals yet', locale)}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {deals.map((deal) => {
              const pct = deal.targetQty > 0
                ? Math.min(Math.round((deal.currentQty / deal.targetQty) * 100), 100)
                : 0;
              return (
                <Card
                  key={deal.id}
                  className="rounded-xl cursor-pointer hover:bg-accent/30 transition-colors"
                  onClick={() => router.push(`/m/distributor/group-buy/${deal.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{deal.name}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {deal.productName}
                        </p>
                      </div>
                      <Badge className={`text-[10px] shrink-0 ${statusBadge[deal.status] || ''}`}>
                        {locale === 'vi'
                          ? statusLabelVi[deal.status]
                          : statusLabelEn[deal.status]}
                      </Badge>
                    </div>

                    {/* Progress */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">
                          {deal.currentQty} / {deal.targetQty}
                        </span>
                        <span className="font-semibold text-primary">{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {t(`${deal.totalOrders} đơn hàng`, `${deal.totalOrders} orders`, locale)}
                      </span>
                      <span>
                        {t(`Tổng: ${deal.totalQuantity}`, `Total: ${deal.totalQuantity}`, locale)}
                      </span>
                    </div>

                    {/* Fulfillment */}
                    {deal.fulfillmentPct !== undefined && deal.fulfillmentPct !== null && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">
                          {t('Đã giao', 'Fulfilled', locale)}:
                        </span>
                        <span className={`font-semibold ${
                          deal.fulfillmentPct >= 80 ? 'text-green-600' :
                          deal.fulfillmentPct >= 50 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {deal.fulfillmentPct}%
                        </span>
                      </div>
                    )}

                    {/* Deadline */}
                    {deal.deadline && deal.status === 'ACTIVE' && (
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        {t('Hạn:', 'Deadline:', locale)}{' '}
                        {new Date(deal.deadline).toLocaleDateString('vi-VN')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}