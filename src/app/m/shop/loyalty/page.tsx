'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Award,
  ChevronRight,
  RefreshCw,
  Star,
  TrendingUp,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';

// ============================================
// Types
// ============================================

interface TierInfo {
  tier: string;
  name: string;
  nameVi: string;
  minOrders: number;
  minGmv: number;
  discount: number;
  discountLabel: string;
  creditLimitMax: number;
  creditLimitMaxFormatted: string;
  benefits: string[];
  isUnlocked: boolean;
  isCurrent: boolean;
  isNext: boolean;
  progressPercent: number;
}

interface LoyaltyData {
  currentTier: {
    tier: string;
    name: string;
    nameVi: string;
    discount: number;
    discountLabel: string;
    creditLimitMax: number;
    creditLimitMaxFormatted: string;
    benefits: string[];
    reachedAt: string | null;
  };
  nextTier: {
    tier: string;
    name: string;
    nameVi: string;
    discountLabel: string;
    creditLimitMaxFormatted: string;
    benefits: string[];
    ordersNeeded: number;
    spendNeededFormatted: string;
  } | null;
  progressToNext: {
    ordersProgress: number;
    gmvProgress: number;
  } | null;
  allTiers: TierInfo[];
  tierHistory: Array<{
    tier: string;
    name: string;
    nameVi: string;
    reachedOrders: number;
    estimatedDate: string;
  }>;
  shopStats: {
    totalOrders: number;
    totalGmv: number;
    totalGmvFormatted: string;
  };
}

// ============================================
// Constants
// ============================================

const TIER_STYLES: Record<string, { bg: string; text: string; border: string; icon: string; gradient: string }> = {
  BRONZE: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-300', icon: '🥉', gradient: 'from-amber-600 to-amber-800' },
  SILVER: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-300', border: 'border-gray-300', icon: '🥈', gradient: 'from-gray-500 to-gray-700' },
  GOLD: { bg: 'bg-yellow-100 dark:bg-yellow-900/40', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-400', icon: '🥇', gradient: 'from-yellow-500 to-amber-600' },
  PLATINUM: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-400', icon: '💎', gradient: 'from-purple-600 to-indigo-700' },
};

const TIPS_VI = [
  'Đặt hàng đều đặn mỗi tuần để tăng nhanh số đơn hàng.',
  'Thanh toán bằng phương thức số để được giảm thêm 2%.',
  'Tham gia nhóm mua sắm để tiết kiệm chi phí.',
  'Đặt nhiều sản phẩm trong cùng một đơn để tăng giá trị trung bình.',
];

const TIPS_EN = [
  'Order regularly each week to increase your order count faster.',
  'Pay via digital methods for an extra 2% discount.',
  'Join group deals to save on costs.',
  'Order multiple products in one order to increase average value.',
];

// ============================================
// Page
// ============================================

export default function MobileShopLoyaltyPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<LoyaltyData>('/shops/loyalty');
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error?.message || t('Failed to load loyalty info', 'Không tải được thông tin thân thiết'));
      }
    } catch {
      setError(t('Network error', 'Lỗi kết nối'));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================
  // Loading
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Loyalty Program', 'Chương trình thân thiết')} showBack showNotifications={false} />
        <main className="px-4 pb-4 pt-3 space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </main>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <MobileHeader title={t('Loyalty Program', 'Chương trình thân thiết')} showBack showNotifications={false} />
        <main className="px-4 pt-3">
          <div className="text-center py-12">
            <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{error || t('No data', 'Không có dữ liệu')}</p>
            <Button variant="outline" className="mt-4" onClick={fetchData}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              {t('Retry', 'Thử lại')}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const style = TIER_STYLES[data.currentTier.tier] || TIER_STYLES.BRONZE;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Loyalty Program', 'Chương trình thân thiết')} showBack showNotifications={false} />

      <main className="px-4 pb-6 pt-3 space-y-4">
        {/* Current Tier Hero Card */}
        <Card className="overflow-hidden">
          <div className={`bg-gradient-to-r ${style.gradient} p-5 text-white`}>
            <div className="text-center">
              <div className="text-5xl mb-2">{style.icon}</div>
              <h2 className="text-2xl font-bold">{locale === 'vi' ? data.currentTier.nameVi : data.currentTier.name}</h2>
              {data.currentTier.discount > 0 && (
                <Badge className="bg-white/20 border-0 text-white text-xs mt-2">
                  {data.currentTier.discountLabel} {t('discount', 'giảm giá')}
                </Badge>
              )}
            </div>
          </div>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground">{t('Total Orders', 'Tổng đơn hàng')}</p>
                <p className="text-lg font-bold">{data.shopStats.totalOrders}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">{t('Total Spend', 'Tổng chi tiêu')}</p>
                <p className="text-sm font-bold">{data.shopStats.totalGmvFormatted}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">{t('Max Credit', 'Hạn mức max')}</p>
                <p className="text-sm font-bold">{data.currentTier.creditLimitMaxFormatted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress to Next Tier */}
        {data.nextTier && data.progressToNext && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {t('Progress to', 'Tiến độ lên')} {locale === 'vi' ? data.nextTier.nameVi : data.nextTier.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {/* Orders progress */}
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">{t('Orders', 'Đơn hàng')}</span>
                  <span className="font-medium">{data.nextTier.ordersNeeded} {t('more needed', 'đơn nữa')}</span>
                </div>
                <Progress value={data.progressToNext.ordersProgress} className="h-2.5" />
              </div>

              {/* GMV progress */}
              {data.currentTier.tier !== data.nextTier.tier && (
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">{t('Total Spend', 'Tổng chi tiêu')}</span>
                    <span className="font-medium">{data.nextTier.spendNeededFormatted} {t('more', 'nữa')}</span>
                  </div>
                  <Progress value={data.progressToNext.gmvProgress} className="h-2.5" />
                </div>
              )}

              {/* Next tier preview */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                <p className="text-[11px] font-semibold">{locale === 'vi' ? data.nextTier.nameVi : data.nextTier.name} {t('Benefits:', 'Quyền lợi:')}</p>
                {data.nextTier.benefits.map((b, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <Star className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-muted-foreground">{b}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Current Tier Benefits */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">
              {t('Current Benefits', 'Quyền lợi hiện tại')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {data.currentTier.benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-xs">{b}</span>
                </div>
              ))}
              {data.currentTier.benefits.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('Standard benefits', 'Quyền lợi tiêu chuẩn')}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tier Comparison Table */}
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold">
              {t('All Tiers Comparison', 'So sánh các hạng')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-3">
              {data.allTiers.map((tier) => {
                const ts = TIER_STYLES[tier.tier] || TIER_STYLES.BRONZE;
                return (
                  <div
                    key={tier.tier}
                    className={`rounded-lg border p-3 ${tier.isCurrent ? ts.bg + ' ' + ts.border : 'border-transparent bg-muted/30'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{ts.icon}</span>
                        <div>
                          <p className="text-sm font-semibold flex items-center gap-1.5">
                            {locale === 'vi' ? tier.nameVi : tier.name}
                            {tier.isCurrent && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                                {t('Current', 'Hiện tại')}
                              </Badge>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {t('From', 'Từ')} {tier.minOrders} {t('orders', 'đơn')} · {tier.discountLabel} {t('discount', 'giảm giá')}
                          </p>
                        </div>
                      </div>
                      {!tier.isUnlocked && (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    {tier.isUnlocked && !tier.isCurrent && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        {t('Unlocked', 'Đã mở khóa')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tips to reach next tier */}
        {data.nextTier && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Info className="h-4 w-4" />
                {t('Tips to Upgrade', 'Mẹo thăng hạng nhanh')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {(locale === 'vi' ? TIPS_VI : TIPS_EN).map((tip, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ArrowUpRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="text-xs text-muted-foreground">{tip}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tier History */}
        {data.tierHistory.length > 0 && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold">
                {t('Tier History', 'Lịch sử hạng')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2">
                {data.tierHistory.map((h) => {
                  const ts = TIER_STYLES[h.tier] || TIER_STYLES.BRONZE;
                  return (
                    <div key={h.tier} className="flex items-center gap-3">
                      <span className="text-lg">{ts.icon}</span>
                      <div className="flex-1">
                        <p className="text-xs font-medium">{locale === 'vi' ? h.nameVi : h.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(h.estimatedDate).toLocaleDateString('vi-VN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {h.reachedOrders} {t('orders', 'đơn')}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-12 text-xs"
            onClick={() => router.push('/m/shop/analytics')}
          >
            <span>{t('📊 Analytics', '📊 Phân tích')}</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
          <Button
            variant="outline"
            className="h-12 text-xs"
            onClick={() => router.push('/m/shop/benchmark')}
          >
            <span>{t('🏆 Benchmark', '🏆 So sánh')}</span>
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </main>
    </div>
  );
}