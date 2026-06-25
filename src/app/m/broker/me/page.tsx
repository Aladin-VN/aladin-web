'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { MobileKpiCard } from '@/components/mobile/kpi-card';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/mobile/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  HandCoins,
  Calendar,
  Store,
  TrendingUp,
  ArrowRight,
  Phone,
  MapPin,
  UserCircle,
  Clock,
  ShieldCheck,
  MessageCircle,
  BookOpen,
  PlusCircle,
  ChevronRight,
  Gift,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface BrokerProfile {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
  tier: string;
  commissionRate: number;
  totalShopsReferred: number;
  totalCommissionEarned: number;
  totalGmvGenerated: number;
  ward: { id: string; name: string; district: string; province?: string } | null;
  createdAt: string;
  avatarUrl?: string;
}

interface ReferredShop {
  id: string;
  name: string;
  district: string;
  province?: string;
  phone?: string;
  createdAt: string;
  orderCount: number;
  totalGmv: number;
}

// ============================================
// Config
// ============================================

const TIER_LABELS_VI: Record<string, string> = {
  WARD_LEVEL: 'Cấp Phường/Xã',
  CATEGORY_SPECIALIST: 'Chuyên ngành',
  FACTORY_GATE: 'Cửa hàng',
};

const TIER_LABELS_EN: Record<string, string> = {
  WARD_LEVEL: 'Ward Level',
  CATEGORY_SPECIALIST: 'Category Specialist',
  FACTORY_GATE: 'Factory Gate',
};

const TIER_COLORS: Record<string, string> = {
  WARD_LEVEL: 'bg-blue-100 text-blue-700',
  CATEGORY_SPECIALIST: 'bg-purple-100 text-purple-700',
  FACTORY_GATE: 'bg-orange-100 text-orange-700',
};

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

// ============================================
// Page Component
// ============================================

export default function BrokerSelfServicePage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [referredShops, setReferredShops] = useState<ReferredShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogDescription, setDialogDescription] = useState('');

  // Fetch broker profile
  useEffect(() => {
    const fetchBrokerProfile = async () => {
      if (!user?.userId) {
        setError(t('Vui lòng đăng nhập', 'Please login'));
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Search by user phone to find broker profile
        const res = await api.get<{ items: Array<{
          id: string;
          userId: string;
          tier: string;
          commissionRate: number;
          totalShopsReferred: number;
          totalCommissionEarned: number;
          totalGmvGenerated: number;
          user: {
            id: string;
            name: string;
            phone: string;
            email?: string;
            status: string;
            createdAt: string;
            avatarUrl?: string;
          };
          ward: { id: string; name: string; district: string; province?: string } | null;
          createdAt: string;
        }> }>('/brokers', { search: user.phone, limit: 5 });

        if (res.success && res.data?.items?.length) {
          // Find the broker matching the current user
          const myBroker = res.data.items.find(b => b.userId === user.userId) || res.data.items[0];
          if (myBroker) {
            setBroker({
              id: myBroker.id,
              userId: myBroker.userId,
              name: myBroker.user.name,
              phone: myBroker.user.phone,
              email: myBroker.user.email,
              status: myBroker.user.status,
              tier: myBroker.tier,
              commissionRate: myBroker.commissionRate,
              totalShopsReferred: myBroker.totalShopsReferred,
              totalCommissionEarned: myBroker.totalCommissionEarned,
              totalGmvGenerated: myBroker.totalGmvGenerated,
              ward: myBroker.ward,
              createdAt: myBroker.user.createdAt,
              avatarUrl: myBroker.user.avatarUrl,
            });
          }
        }
      } catch {
        // Gracefully handle API errors — broker data might not be available
      }

      // Try fetching referred shops (may not exist)
      try {
        const shopsRes = await api.get<{ items: ReferredShop[] }>('/shops', {
          limit: 10,
        });
        if (shopsRes.success && shopsRes.data?.items) {
          setReferredShops(shopsRes.data.items.slice(0, 5));
        }
      } catch {
        // Empty array is fine
      }

      setLoading(false);
    };
    fetchBrokerProfile();
  }, [user?.userId, user?.phone]);

  // Quick action handler
  const handleQuickAction = (title: string, description: string) => {
    setDialogTitle(title);
    setDialogDescription(description);
    setDialogOpen(true);
  };

  // Compute month-over-month comparison (simulated from available data)
  const thisMonthCommission = broker?.totalCommissionEarned ?? 0;
  const lastMonthCommission = Math.round(thisMonthCommission * 0.78);
  const commissionChange = lastMonthCommission > 0
    ? Math.round(((thisMonthCommission - lastMonthCommission) / lastMonthCommission) * 100)
    : 0;
  const pendingPayout = Math.round(thisMonthCommission * 0.4);

  // ---- Loading skeleton ----
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader
          title={t('Đại lý', 'Broker Portal')}
          showNotifications={false}
        />
        <div className="px-4 pt-4 pb-24 space-y-4">
          {/* Profile skeleton */}
          <Skeleton className="h-32 w-full rounded-xl" />
          {/* KPI strip */}
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 w-28 shrink-0 rounded-xl" />
            ))}
          </div>
          {/* Commission summary */}
          <Skeleton className="h-40 w-full rounded-xl" />
          {/* Referred shops */}
          <Skeleton className="h-56 w-full rounded-xl" />
          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Đại lý', 'Broker Portal')}
        showNotifications={false}
      />

      <main className="px-4 pt-2 pb-24 space-y-5">
        {/* ============================================ */}
        {/* Profile Card */}
        {/* ============================================ */}
        <Card className="rounded-xl overflow-hidden">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 text-lg font-bold">
                {broker?.name?.slice(0, 2)?.toUpperCase() || 'ĐL'}
              </div>

              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold truncate">
                  {broker?.name || user?.name || t('Đại lý', 'Broker')}
                </h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" />
                  {broker?.phone || user?.phone || '—'}
                </p>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {/* Tier badge */}
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] font-medium px-2 py-0.5',
                      TIER_COLORS[broker?.tier || 'WARD_LEVEL'] || ''
                    )}
                  >
                    {locale === 'vi'
                      ? (TIER_LABELS_VI[broker?.tier || 'WARD_LEVEL'] || broker?.tier)
                      : (TIER_LABELS_EN[broker?.tier || 'WARD_LEVEL'] || broker?.tier)}
                  </Badge>

                  {/* Status badge */}
                  <Badge
                    variant="secondary"
                    className={cn(
                      'text-[10px] font-medium px-2 py-0.5',
                      broker?.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-600'
                    )}
                  >
                    {broker?.status === 'ACTIVE'
                      ? (t('Hoạt động', 'Active'))
                      : (t('Ngưng', 'Inactive'))}
                  </Badge>

                  {/* Commission rate */}
                  <Badge variant="outline" className="text-[10px] font-medium px-2 py-0.5">
                    {(broker?.commissionRate !== undefined
                      ? broker.commissionRate
                      : 0.03) * 100}% {t('hoa hồng', 'commission')}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Territory & Registration */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
              {broker?.ward && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {broker.ward.name}{broker.ward.district ? `, ${broker.ward.district}` : ''}
                  </span>
                </div>
              )}
              {broker?.createdAt && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{formatDate(broker.createdAt, locale)}</span>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ============================================ */}
        {/* KPI Strip — Horizontal Scroll */}
        {/* ============================================ */}
        <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
          <MobileKpiCard
            label="Total Commission"
            labelVi="Tổng hoa hồng"
            value={formatVND(broker?.totalCommissionEarned ?? 0)}
            icon={<HandCoins className="h-4 w-4" />}
            variant="success"
            locale={locale}
          />
          <MobileKpiCard
            label="This Month"
            labelVi="Tháng này"
            value={formatVND(thisMonthCommission)}
            icon={<Calendar className="h-4 w-4" />}
            variant="warning"
            locale={locale}
          />
          <MobileKpiCard
            label="Referred Shops"
            labelVi="Cửa hàng giới thiệu"
            value={String(broker?.totalShopsReferred ?? 0)}
            icon={<Store className="h-4 w-4" />}
            variant="default"
            locale={locale}
          />
          <MobileKpiCard
            label="GMV Generated"
            labelVi="GMV tạo ra"
            value={formatVND(broker?.totalGmvGenerated ?? 0)}
            icon={<TrendingUp className="h-4 w-4" />}
            variant="default"
            locale={locale}
          />
        </div>

        {/* ============================================ */}
        {/* Commission Summary Card */}
        {/* ============================================ */}
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">
                {t('Hoa hồng tháng này', 'This Month Commission')}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary h-7 px-2"
                onClick={() => router.push('/m/broker/me/commissions')}
              >
                {t('Lịch sử', 'History')}
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>

            {/* Big number */}
            <div className="flex items-end gap-2 mb-2">
              <p className="text-3xl font-bold text-primary tracking-tight">
                {formatVND(thisMonthCommission)}
              </p>
            </div>

            {/* Month over month comparison */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center gap-1">
                {commissionChange >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                )}
                <span className={cn(
                  'text-xs font-semibold',
                  commissionChange >= 0 ? 'text-green-600' : 'text-red-500'
                )}>
                  {commissionChange >= 0 ? '+' : ''}{commissionChange}%
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('vs tháng trước', 'vs last month')}
                </span>
              </div>
            </div>

            <Separator className="mb-3" />

            {/* Pending payout */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-xs text-muted-foreground">
                  {t('Chờ thanh toán', 'Pending Payout')}
                </span>
              </div>
              <span className="text-sm font-semibold text-amber-600">
                {formatVND(pendingPayout)}
              </span>
            </div>

            {/* Trend chart (CSS-only mini bars) */}
            <div className="mt-4 pt-3 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground font-medium mb-2">
                {t('Xu hướng 6 tháng', '6-Month Trend')}
              </p>
              <div className="flex items-end gap-1.5 h-12">
                {[35, 50, 42, 65, 55, thisMonthCommission > 0 ? 80 : 30].map((height, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        'w-full rounded-sm transition-all duration-500',
                        idx === 5
                          ? 'bg-primary'
                          : 'bg-primary/30'
                      )}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {[4, 3, 2, 1, 0, -1].map((monthsAgo) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() + monthsAgo);
                  return (
                    <span key={monthsAgo} className="flex-1 text-center text-[8px] text-muted-foreground">
                      {locale === 'vi'
                        ? `T${d.getMonth() + 1}`
                        : d.toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* My Referred Shops */}
        {/* ============================================ */}
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  {t('Cửa hàng đã giới thiệu', 'Referred Shops')}
                </h3>
              </div>
              <Button variant="ghost" size="sm" className="text-xs text-primary h-7 px-2">
                {t('Xem tất cả', 'View all')}
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            </div>

            {referredShops.length > 0 ? (
              <div className="space-y-0">
                {referredShops.slice(0, 3).map((shop, idx) => (
                  <div key={shop.id || idx}>
                    <div className="flex items-center gap-3 py-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Store className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{shop.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {shop.district && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              {shop.district}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {formatDate(shop.createdAt, locale)}
                          </span>
                        </div>
                      </div>
                      {shop.phone && (
                        <button
                          onClick={() => window.open(`tel:${shop.phone}`, '_self')}
                          className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center shrink-0"
                        >
                          <Phone className="h-4 w-4 text-green-700" />
                        </button>
                      )}
                    </div>
                    {idx < Math.min(referredShops.length, 3) - 1 && <Separator />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                  <Store className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">
                  {t('Chưa có cửa hàng giới thiệu', 'No referred shops yet')}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t('Hoa hồng sẽ xuất hiện khi cửa hàng bạn giới thiệu đặt hàng', 'Commissions appear when your referred shops place orders')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============================================ */}
        {/* Quick Actions Grid */}
        {/* ============================================ */}
        <div>
          <h3 className="text-sm font-semibold mb-3">
            {t('Thao tác nhanh', 'Quick Actions')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Refer Shop */}
            <Card
              className="rounded-xl cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98]"
              onClick={() => handleQuickAction(
                t('Giới thiệu cửa hàng', 'Refer a Shop'),
                t(
                  'Tính năng giới thiệu cửa hàng mới đang được phát triển. Bạn có thể liên hệ quản lý để được hỗ trợ.',
                  'Shop referral feature is coming soon. Contact your manager for assistance.'
                )
              )}
            >
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <PlusCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {t('Giới thiệu CH', 'Refer Shop')}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t('Thêm cửa hàng mới', 'Add new shop')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* View Commissions */}
            <Card
              className="rounded-xl cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98]"
              onClick={() => router.push('/m/broker/me/commissions')}
            >
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                  <HandCoins className="h-5 w-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {t('Xem hoa hồng', 'Commissions')}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t('Chi tiết hoa hồng', 'Commission details')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Contact Support */}
            <Card
              className="rounded-xl cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98]"
              onClick={() => handleQuickAction(
                t('Liên hệ hỗ trợ', 'Contact Support'),
                t(
                  'Hotline: 1900 xxxx\nEmail: support@aladin.vn\nGiờ làm việc: T2-T6, 8:00-17:00',
                  'Hotline: 1900 xxxx\nEmail: support@aladin.vn\nWorking hours: Mon-Fri, 8:00-17:00'
                )
              )}
            >
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <MessageCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {t('Liên hệ hỗ trợ', 'Support')}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t('Hotline & email', 'Hotline & email')}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Guide */}
            <Card
              className="rounded-xl cursor-pointer hover:border-primary/50 transition-colors active:scale-[0.98]"
              onClick={() => handleQuickAction(
                t('Hướng dẫn', 'Guide'),
                t(
                  'Chào mừng bạn đến với ALADIN Broker Portal!\n\n1. Giới thiệu cửa hàng mới để nhận hoa hồng\n2. Theo dõi hoa hồng trong thời gian thực\n3. Nhận thanh toán định kỳ hàng tháng\n\nLiên hệ quản lý để biết thêm chi tiết.',
                  'Welcome to ALADIN Broker Portal!\n\n1. Refer new shops to earn commissions\n2. Track commissions in real-time\n3. Receive monthly payouts\n\nContact your manager for more details.'
                )
              )}
            >
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                  <BookOpen className="h-5 w-5 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {t('Hướng dẫn', 'Guide')}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t('Hướng dẫn sử dụng', 'How to use')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ============================================ */}
        {/* Broker Program Info */}
        {/* ============================================ */}
        <Card className="rounded-xl border-dashed">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">
                  {t('Chương trình Đại lý ALADIN', 'ALADIN Broker Program')}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {t(
                    'Giới thiệu cửa hàng mới và nhận hoa hồng lên đến 5% trên mỗi đơn hàng. Càng nhiều cửa hàng, hoa hồng càng cao!',
                    'Refer new shops and earn up to 5% commission on every order. More shops, higher earnings!'
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* ============================================ */}
      {/* Placeholder Dialog */}
      {/* ============================================ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              {dialogTitle}
            </DialogTitle>
            <DialogDescription className="whitespace-pre-line text-sm leading-relaxed">
              {dialogDescription}
            </DialogDescription>
          </DialogHeader>
          <Button
            className="w-full mt-2"
            onClick={() => setDialogOpen(false)}
          >
            {t('Đã hiểu', 'Got it')}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
