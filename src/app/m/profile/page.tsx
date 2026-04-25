'use client';

import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { useCartStore } from '@/stores/cart.store';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Store,
  CreditCard,
  Truck,
  Tag,
  Settings,
  Globe,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

// ============================================
// Profile / Account Page
// ============================================

export default function MobileProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const handleLogout = () => {
    logout();
    router.replace('/m/login');
  };

  const roleLabels: Record<string, string> = {
    ADMIN: t('Quản trị viên', 'Admin'),
    SHOP_OWNER: t('Chủ cửa hàng', 'Shop Owner'),
    SALES_REP: t('Nhân viên sales', 'Sales Rep'),
    DRIVER: t('Tài xế', 'Driver'),
    BROKER: t('Đại lý', 'Broker'),
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Tài khoản', 'Account')} showNotifications={false} />

      <main className="px-4 pb-4 pt-3 space-y-4">
        {/* Profile card */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarImage src={user?.avatarUrl || undefined} />
                <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                  {user?.name?.slice(0, 2)?.toUpperCase() || 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold truncate">{user?.name || t('Khách', 'Guest')}</h2>
                <p className="text-sm text-muted-foreground">{user?.phone}</p>
                <Badge variant="secondary" className="mt-1 text-[10px]">
                  {roleLabels[user?.role || 'SHOP_OWNER'] || user?.role}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shop info (if shop owner) */}
        {user?.shop && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Store className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{user.shop.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.shop.district}, {user.shop.province}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      {user.shop.loyaltyTier}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Menu items */}
        <Card className="overflow-hidden">
          <ProfileMenuItem
            icon={<CreditCard className="h-4 w-4" />}
            label={t('Công nợ', 'Credit')}
            labelVi="Công nợ"
            onClick={() => router.push('/m/credit')}
            locale={locale}
          />
          <Separator />
          <ProfileMenuItem
            icon={<Truck className="h-4 w-4" />}
            label={t('Vận chuyển', 'Shipments')}
            labelVi="Vận chuyển"
            onClick={() => router.push('/m/shipments')}
            locale={locale}
          />
          <Separator />
          <ProfileMenuItem
            icon={<Tag className="h-4 w-4" />}
            label={t('Mua chung', 'Group Buy')}
            labelVi="Mua chung"
            onClick={() => router.push('/m/group-buy')}
            locale={locale}
          />
          <Separator />
          <ProfileMenuItem
            icon={<Settings className="h-4 w-4" />}
            label={t('Cài đặt', 'Settings')}
            labelVi="Cài đặt"
            onClick={() => router.push('/m/settings')}
            locale={locale}
          />
          <Separator />
          <button
            onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors"
          >
            <Globe className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm flex-1 text-left">
              {t('Ngôn ngữ', 'Language')}
            </span>
            <span className="text-xs text-muted-foreground">
              {locale === 'vi' ? 'Tiếng Việt' : 'English'}
            </span>
          </button>
        </Card>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full h-11 text-destructive hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t('Đăng xuất', 'Sign Out')}
        </Button>
      </main>
    </div>
  );
}

// ============================================
// Profile Menu Item
// ============================================

function ProfileMenuItem({
  icon,
  label,
  labelVi,
  onClick,
  locale,
}: {
  icon: React.ReactNode;
  label: string;
  labelVi: string;
  onClick: () => void;
  locale: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm flex-1 text-left">{locale === 'vi' ? labelVi : label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}
