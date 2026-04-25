'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Store,
  MapPin,
  CreditCard,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Clock,
  Star,
  ChevronRight,
  Phone,
  ShieldCheck,
  Award,
  Package,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { MobileKpiCard } from '@/components/mobile/kpi-card';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';

// ============================================
// Types
// ============================================

interface ShopDetail {
  id: string;
  name: string;
  nameEn?: string;
  district?: string;
  province: string;
  address?: string;
  shopType: string;
  loyaltyTier: string;
  creditLimit: number;
  creditLimitFormatted: string;
  creditBalance: number;
  creditBalanceFormatted: string;
  creditAvailable: number;
  creditAvailableFormatted: string;
  creditStatus: string;
  totalOrders: number;
  totalGmv: number;
  totalGmvFormatted: string;
  avgOrderValue: number;
  avgOrderValueFormatted: string;
  createdAt: string;
  user: {
    id: string;
    phone: string;
    name: string;
    email?: string;
    lastLoginAt?: string;
    createdAt: string;
  };
  ward?: {
    name: string;
    district: string;
    province: string;
  };
  stats: {
    totalOrderCount: number;
    totalGmv: number;
    totalGmvFormatted: string;
    avgOrderValue: number;
    avgOrderValueFormatted: string;
    pendingOrders: number;
    deliveredOrders: number;
    recentOrders30d: number;
    recentGmv30d: number;
    recentGmv30dFormatted: string;
  };
}

// ============================================
// Loyalty tier colors
// ============================================

const TIER_CONFIG: Record<string, { color: string; bg: string; label: string; labelVi: string; icon: string }> = {
  BRONZE: { color: 'text-amber-700', bg: 'bg-amber-100 dark:bg-amber-900/40', label: 'Bronze', labelVi: 'Đồng', icon: '🥉' },
  SILVER: { color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800', label: 'Silver', labelVi: 'Bạc', icon: '🥈' },
  GOLD: { color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/40', label: 'Gold', labelVi: 'Vàng', icon: '🥇' },
  PLATINUM: { color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/40', label: 'Platinum', labelVi: 'Bạch kim', icon: '💎' },
};

const CREDIT_STATUS_CONFIG: Record<string, { color: string; label: string; labelVi: string }> = {
  ACTIVE: { color: 'bg-emerald-100 text-emerald-700', label: 'Active', labelVi: 'Hoạt động' },
  LOCKED: { color: 'bg-red-100 text-red-700', label: 'Locked', labelVi: 'Đã khóa' },
  OVERDUE: { color: 'bg-amber-100 text-amber-700', label: 'Overdue', labelVi: 'Quá hạn' },
};

const SHOP_TYPE_LABELS: Record<string, { vi: string; en: string }> = {
  TAPHOA: { vi: 'Tạp hóa', en: 'Grocery' },
  CONVENIENCE: { vi: 'Tiện lợi', en: 'Convenience' },
  FACTORY: { vi: 'Nhà máy', en: 'Factory' },
};

// ============================================
// Shop Profile Page
// ============================================

export default function MobileShopProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const shopId = user?.shopId || user?.shop?.id;

  const fetchShop = useCallback(async () => {
    if (!shopId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const json = await api.get<ShopDetail>(`/shops/${shopId}`);
      if (json.success && json.data) {
        setShop(json.data);
      } else {
        setError(json.error?.message || t('Failed to load shop', 'Không tải được thông tin cửa hàng'));
      }
    } catch {
      setError(t('Network error', 'Lỗi kết nối'));
    } finally {
      setLoading(false);
    }
  }, [shopId, locale]);

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

  const creditUsedPercent = shop
    ? Math.round((shop.creditBalance / shop.creditLimit) * 100)
    : 0;

  // ============================================
  // Loading state
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('My Shop', 'Cửa hàng của tôi')} showBack showNotifications={false} />
        <main className="px-4 pb-4 pt-3 space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-32 w-full rounded-xl" />
        </main>
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('My Shop', 'Cửa hàng của tôi')} showBack showNotifications={false} />
        <main className="px-4 pb-4 pt-3">
          <div className="text-center py-12">
            <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{error || t('No shop found', 'Không tìm thấy cửa hàng')}</p>
            {shopId && (
              <Button variant="outline" className="mt-4" onClick={fetchShop}>
                {t('Retry', 'Thử lại')}
              </Button>
            )}
          </div>
        </main>
      </div>
    );
  }

  const tier = TIER_CONFIG[shop.loyaltyTier] || TIER_CONFIG.BRONZE;
  const creditStatus = CREDIT_STATUS_CONFIG[shop.creditStatus] || CREDIT_STATUS_CONFIG.ACTIVE;
  const shopType = SHOP_TYPE_LABELS[shop.shopType] || { vi: shop.shopType, en: shop.shopType };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('My Shop', 'Cửa hàng của tôi')} showBack showNotifications={false} />

      <main className="px-4 pb-4 pt-3 space-y-4">
        {/* Shop Header Card */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-primary/90 to-primary p-4 text-primary-foreground">
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Store className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">{shop.name}</h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <MapPin className="h-3 w-3 opacity-80" />
                  <span className="text-sm opacity-90 truncate">
                    {shop.district ? `${shop.district}, ` : ''}{shop.province}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={`${tier.bg} ${tier.color} border-0 text-[10px]`}>
                    {tier.icon} {locale === 'vi' ? tier.labelVi : tier.label}
                  </Badge>
                  <Badge className={`${creditStatus.color} border-0 text-[10px]`}>
                    {locale === 'vi' ? creditStatus.labelVi : creditStatus.label}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Shop info grid */}
          <CardContent className="p-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">{t('Type', 'Loại hình')}</p>
                <p className="text-xs font-semibold mt-0.5">{locale === 'vi' ? shopType.vi : shopType.en}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">{t('Since', 'Từ')}</p>
                <p className="text-xs font-semibold mt-0.5">
                  {new Date(shop.createdAt).toLocaleDateString('vi-VN', { year: 'numeric', month: 'short' })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground">{t('Owner', 'Chủ sở hữu')}</p>
                <p className="text-xs font-semibold mt-0.5 truncate">{shop.user.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credit Card */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {t('Credit Account', 'Tài khoản công nợ')}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => router.push('/m/credit')}
              >
                {t('History', 'Lịch sử')}
                <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Available credit - hero number */}
            <div className="text-center py-2">
              <p className="text-[11px] text-muted-foreground">{t('Available Credit', 'Hạn mức còn lại')}</p>
              <p className="text-2xl font-bold text-emerald-600">{shop.creditAvailableFormatted}</p>
            </div>

            {/* Usage bar */}
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>{t('Used', 'Đã dùng')}: {shop.creditBalanceFormatted}</span>
                <span>{creditUsedPercent}%</span>
              </div>
              <Progress value={creditUsedPercent} className="h-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0</span>
                <span>{t('Limit', 'Hạn mức')}: {shop.creditLimitFormatted}</span>
              </div>
            </div>

            {/* Credit details */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-muted/50 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground">{t('7-Day Window', 'Chu kỳ 7 ngày')}</p>
                <p className="text-xs font-semibold mt-0.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t('Auto-lock on Day 7', 'Tự khóa ngày 7')}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground">{t('Pay Now Discount', 'Trả ngay giảm giá')}</p>
                <p className="text-xs font-semibold mt-0.5 flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-500" />
                  -2% {t('digital payment', 'thanh toán số')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats KPIs */}
        <div>
          <h3 className="text-sm font-semibold mb-3">{t('Statistics', 'Thống kê')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <MobileKpiCard
              label="Total Orders"
              labelVi="Tổng đơn hàng"
              value={shop.stats.totalOrderCount.toLocaleString()}
              icon={<ShoppingBag className="h-4 w-4" />}
              locale={locale}
            />
            <MobileKpiCard
              label="Total GMV"
              labelVi="Tổng doanh thu"
              value={shop.stats.totalGmvFormatted}
              icon={<DollarSign className="h-4 w-4" />}
              variant="success"
              locale={locale}
            />
            <MobileKpiCard
              label="Avg Order"
              labelVi="TB đơn hàng"
              value={shop.stats.avgOrderValueFormatted}
              icon={<TrendingUp className="h-4 w-4" />}
              locale={locale}
            />
            <MobileKpiCard
              label="30d Orders"
              labelVi="Đơn 30 ngày"
              value={shop.stats.recentOrders30d.toLocaleString()}
              icon={<Package className="h-4 w-4" />}
              locale={locale}
            />
          </div>
        </div>

        {/* 30-Day Summary */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">
              {t('Last 30 Days', '30 ngày qua')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground">{t('GMV', 'Doanh thu')}</p>
                <p className="text-lg font-bold">{shop.stats.recentGmv30dFormatted}</p>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center gap-1 text-xs">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-muted-foreground">{t('Delivered', 'Đã giao')}: {shop.stats.deliveredOrders}</span>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  <span className="text-muted-foreground">{t('Pending', 'Chờ xử lý')}: {shop.stats.pendingOrders}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loyalty Tier Progress */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Award className="h-4 w-4" />
              {t('Loyalty Program', 'Chương trình khách hàng thân thiết')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <LoyaltyTierProgress currentTier={shop.loyaltyTier} totalOrders={shop.totalOrders} locale={locale} />
          </CardContent>
        </Card>

        {/* Contact & Address */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">{t('Contact Info', 'Thông tin liên hệ')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                <Phone className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">{t('Phone', 'Điện thoại')}</p>
                <p className="text-sm font-medium">{shop.user.phone}</p>
              </div>
            </div>
            {shop.address && (
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{t('Address', 'Địa chỉ')}</p>
                  <p className="text-sm">{shop.address}</p>
                </div>
              </div>
            )}
            {shop.user.email && (
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Email</p>
                  <p className="text-sm">{shop.user.email}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// ============================================
// Loyalty Tier Progress
// ============================================

const TIER_THRESHOLDS = [
  { tier: 'BRONZE', min: 0, labelVi: 'Đồng', labelEn: 'Bronze' },
  { tier: 'SILVER', min: 6, labelVi: 'Bạc', labelEn: 'Silver' },
  { tier: 'GOLD', min: 16, labelVi: 'Vàng', labelEn: 'Gold' },
  { tier: 'PLATINUM', min: 31, labelVi: 'Bạch kim', labelEn: 'Platinum' },
];

function LoyaltyTierProgress({
  currentTier,
  totalOrders,
  locale,
}: {
  currentTier: string;
  totalOrders: number;
  locale: string;
}) {
  const currentIndex = TIER_THRESHOLDS.findIndex((t) => t.tier === currentTier);
  const nextTier = currentIndex < TIER_THRESHOLDS.length - 1 ? TIER_THRESHOLDS[currentIndex + 1] : null;
  const progress = nextTier
    ? Math.min(((totalOrders - TIER_THRESHOLDS[currentIndex].min) / (nextTier.min - TIER_THRESHOLDS[currentIndex].min)) * 100, 100)
    : 100;

  return (
    <div className="space-y-3">
      {/* Tier steps */}
      <div className="flex items-center justify-between">
        {TIER_THRESHOLDS.map((tier, i) => {
          const isActive = i <= currentIndex;
          const isCurrent = tier.tier === currentTier;
          return (
            <div key={tier.tier} className="flex flex-col items-center gap-1">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                isCurrent
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : isActive
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {i + 1}
              </div>
              <span className={`text-[10px] ${isCurrent ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                {locale === 'vi' ? tier.labelVi : tier.labelEn}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar to next tier */}
      {nextTier && (
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{totalOrders} / {nextTier.min} {locale === 'vi' ? 'đơn hàng' : 'orders'}</span>
            <span>
              {locale === 'vi' ? nextTier.labelVi : nextTier.labelEn} ({nextTier.min})
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-1">
            {Math.max(nextTier.min - totalOrders, 0)} {locale === 'vi' ? 'đơn nữa để thăng hạng' : 'more orders to upgrade'}
          </p>
        </div>
      )}

      {!nextTier && (
        <p className="text-xs text-center text-muted-foreground">
          {locale === 'vi' ? 'Đã đạt hạng cao nhất!' : 'Highest tier achieved!'}
        </p>
      )}
    </div>
  );
}
