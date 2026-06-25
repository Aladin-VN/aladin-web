'use client';

import { useState, useEffect } from 'react';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/mobile/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Store,
  Users,
  CalendarPlus,
  TrendingUp,
  Package,
  HandCoins,
  Phone,
  MapPin,
  AlertCircle,
  Gift,
  Star,
  ChevronRight,
  ArrowRight,
  UserPlus,
  MessageCircle,
  Link2,
  CheckCircle2,
  CircleDot,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface ShopItem {
  id: string;
  name: string;
  nameEn?: string;
  district: string | null;
  province: string | null;
  totalOrders: number;
  totalGmv: number;
  totalGmvFormatted?: string;
  createdAt: string;
  user: {
    id: string;
    phone: string;
    name: string;
    status: string;
  };
}

interface BrokerCommissionItem {
  id: string;
  userId: string;
  name: string;
  phone: string;
  tier: string;
  commissionRate: number;
  totalShopsReferred: number;
  totalCommissionEarned: number;
  totalGmvGenerated: number;
}

// ============================================
// Helpers
// ============================================

function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
}

function formatDate(dateStr: string, locale: string): string {
  return new Date(dateStr).toLocaleDateString(
    locale === 'vi' ? 'vi-VN' : 'en-US',
    { day: '2-digit', month: 'short', year: 'numeric' }
  );
}

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// ============================================
// Page Component
// ============================================

export default function BrokerReferralPage() {
  const locale = useAppStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [shops, setShops] = useState<ShopItem[]>([]);
  const [brokerData, setBrokerData] = useState<BrokerCommissionItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.userId) {
        setError(t('Vui lòng đăng nhập', 'Please login'));
        setLoading(false);
        return;
      }

      setLoading(true);

      // Fetch shops list
      try {
        const res = await api.get<{ items: ShopItem[] }>('/shops', { limit: 50 });
        if (res.success && res.data?.items) {
          setShops(res.data.items);
        }
      } catch {
        // Gracefully handle
      }

      // Fetch broker's own data
      try {
        const res = await api.get<{ items: BrokerCommissionItem[] }>('/brokers/commissions', {
          limit: 1,
        });
        if (res.success && res.data?.items?.length) {
          const myBroker = res.data.items.find((b) => b.userId === user.userId) || res.data.items[0];
          if (myBroker) {
            setBrokerData(myBroker);
          }
        }
      } catch {
        // Gracefully handle
      }

      setLoading(false);
    };
    fetchData();
  }, [user?.userId]);

  // Compute stats
  const totalReferred = brokerData?.totalShopsReferred ?? shops.length;
  const activeShops = shops.filter((s) => s.totalOrders > 0);
  const activeCount = activeShops.length;
  const thisMonthShops = shops.filter((s) => isThisMonth(s.createdAt));
  const thisMonthCount = thisMonthShops.length;

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Giới thiệu cửa hàng', 'Shop Referrals')}
          showBack
          showNotifications={false}
        />
        <div className="px-4 pt-4 pb-24 space-y-4">
          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          {/* Referral program card */}
          <Skeleton className="h-52 w-full rounded-xl" />
          {/* Shop cards */}
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
          {/* How to refer */}
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Giới thiệu cửa hàng', 'Shop Referrals')}
          showBack
          showNotifications={false}
        />
        <div className="px-4 pt-12 flex flex-col items-center justify-center text-center">
          <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <p className="text-sm font-semibold">{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            {t('Thử lại', 'Retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Giới thiệu cửa hàng', 'Shop Referrals')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pt-4 pb-24 space-y-5">
        {/* ============================================ */}
        {/* 1. Referral Stats Strip */}
        {/* ============================================ */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="rounded-xl">
            <CardContent className="p-3 text-center">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-1.5">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="text-lg font-bold">{totalReferred}</p>
              <p className="text-[10px] text-muted-foreground font-medium">
                {t('Tổng giới thiệu', 'Total Referred')}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent className="p-3 text-center">
              <div className="h-8 w-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-lg font-bold">{activeCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">
                {t('Đang hoạt động', 'Active')}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent className="p-3 text-center">
              <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-1.5">
                <CalendarPlus className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-lg font-bold">{thisMonthCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">
                {t('Tháng này', 'This Month')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ============================================ */}
        {/* 2. Referral Program Card */}
        {/* ============================================ */}
        <Card className="rounded-xl overflow-hidden">
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-5 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="h-5 w-5" />
              <h3 className="text-sm font-bold">
                {t('Chương trình giới thiệu', 'Referral Program')}
              </h3>
            </div>
            <p className="text-xs opacity-90 leading-relaxed">
              {t(
                'Giới thiệu cửa hàng mới đăng ký trên ALADIN và nhận hoa hồng trên mọi đơn hàng của họ.',
                'Refer new shops to register on ALADIN and earn commission on every order they place.'
              )}
            </p>
          </div>
          <CardContent className="p-4 space-y-3">
            {/* Commission tiers */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Star className="h-3 w-3 text-blue-600" />
                  </div>
                  <span className="text-xs font-medium">
                    {t('Mức cơ bản', 'Base Rate')}
                  </span>
                </div>
                <span className="text-sm font-bold text-primary">3.0%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Star className="h-3 w-3 text-purple-600" />
                  </div>
                  <span className="text-xs font-medium">
                    {t('≥5 cửa hàng hoạt động', '≥5 Active Shops')}
                  </span>
                </div>
                <span className="text-sm font-bold text-purple-600">4.0%</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                    <Star className="h-3 w-3 text-amber-600" />
                  </div>
                  <span className="text-xs font-medium">
                    {t('≥15 cửa hàng, GMV > 50Tr', '≥15 Shops, GMV > 50M')}
                  </span>
                </div>
                <span className="text-sm font-bold text-amber-600">5.0%</span>
              </div>
            </div>

            {brokerData && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t('Mức hiện tại', 'Current Rate')}
                  </span>
                  <span className="font-bold text-primary">
                    {(brokerData.commissionRate * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* 3. My Referred Shops List */}
        {/* ============================================ */}
        {shops.length > 0 ? (
          <Card className="rounded-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">
                    {t('Cửa hàng đã giới thiệu', 'My Referred Shops')}
                  </h3>
                </div>
                <Badge variant="outline" className="text-[10px] font-medium">
                  {shops.length}
                </Badge>
              </div>

              <div className="space-y-0">
                {shops.map((shop, idx) => {
                  const isActive = shop.totalOrders > 0;
                  const isLast = idx === shops.length - 1;

                  return (
                    <div key={shop.id}>
                      <div className="flex items-start gap-3 py-3">
                        {/* Status icon */}
                        <div
                          className={cn(
                            'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                            isActive
                              ? 'bg-green-100 dark:bg-green-900/30'
                              : 'bg-muted'
                          )}
                        >
                          {isActive ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <CircleDot className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium truncate">
                              {shop.name}
                            </p>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-[9px] font-medium px-1.5 py-0 shrink-0',
                                isActive
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {isActive
                                ? t('Hoạt động', 'Active')
                                : t('Chưa đặt hàng', 'Inactive')}
                            </Badge>
                          </div>

                          {shop.district && (
                            <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              {shop.district}
                            </div>
                          )}

                          <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                            <span className="flex items-center gap-0.5 text-muted-foreground">
                              <Package className="h-3 w-3" />
                              {shop.totalOrders} {t('đơn', 'orders')}
                            </span>
                            <span className="font-medium">
                              {formatVND(shop.totalGmv)}
                            </span>
                          </div>

                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {t('Đăng ký', 'Registered')}: {formatDate(shop.createdAt, locale)}
                          </p>
                        </div>
                      </div>
                      {!isLast && <Separator />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <UserPlus className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold">
              {t('Chưa giới thiệu cửa hàng nào', 'No shops referred yet')}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[260px] mx-auto">
              {t(
                'Hãy bắt đầu giới thiệu cửa hàng mới để nhận hoa hồng trên mỗi đơn hàng của họ!',
                'Start referring new shops to earn commission on every order they place!'
              )}
            </p>
          </div>
        )}

        {/* ============================================ */}
        {/* 4. How to Refer Section */}
        {/* ============================================ */}
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">
                {t('Cách giới thiệu', 'How to Refer')}
              </h3>
            </div>

            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-xs font-bold">
                  1
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {t('Chia sẻ liên kết', 'Share your referral link')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(
                      'Gửi liên kết đăng ký ALADIN cho chủ cửa hàng bạn biết.',
                      'Send the ALADIN registration link to shop owners you know.'
                    )}
                  </p>
                </div>
                <MessageCircle className="h-4 w-4 text-primary shrink-0 mt-1" />
              </div>

              <Separator />

              {/* Step 2 */}
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-xs font-bold">
                  2
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {t('Cửa hàng đăng ký', 'Shop registers')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(
                      'Cửa hàng đăng ký tài khoản và hoàn thành xác minh.',
                      'The shop creates an account and completes verification.'
                    )}
                  </p>
                </div>
                <Store className="h-4 w-4 text-primary shrink-0 mt-1" />
              </div>

              <Separator />

              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-xs font-bold">
                  3
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {t('Nhận hoa hồng', 'Earn commission')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t(
                      'Bạn nhận hoa hồng trên mọi đơn hàng thành công từ cửa hàng đã giới thiệu.',
                      'You earn commission on every successful order from your referred shops.'
                    )}
                  </p>
                </div>
                <HandCoins className="h-4 w-4 text-primary shrink-0 mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}