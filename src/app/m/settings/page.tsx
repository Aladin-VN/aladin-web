'use client';

import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  User,
  Bell,
  Globe,
  Shield,
  HardDrive,
  Info,
  ChevronRight,
  Smartphone,
  LogOut,
  Moon,
  Volume2,
  HelpCircle,
  FileText,
} from 'lucide-react';

// ============================================
// Settings Page (Sprint M8 — Full implementation)
// ============================================

export default function MobileSettingsPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const handleLogout = () => {
    logout();
    router.replace('/m/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader title={t('Cài đặt', 'Settings')} showBack showNotifications={false} />

      <main className="px-4 pb-4 pt-3 space-y-4">
        {/* Account Section */}
        <SettingsSection title={t('Tài khoản', 'Account')}>
          <SettingsRow
            icon={<User className="h-4 w-4" />}
            label={t('Chỉnh sửa hồ sơ', 'Edit Profile')}
            labelVi="Chỉnh sửa hồ sơ"
            value={user?.name}
            onClick={() => router.push('/m/profile/edit')}
            locale={locale}
          />
          <Separator />
          <SettingsRow
            icon={<Shield className="h-4 w-4" />}
            label={t('Đổi mật khẩu', 'Change Password')}
            labelVi="Đổi mật khẩu"
            onClick={() => router.push('/m/profile/password')}
            locale={locale}
          />
        </SettingsSection>

        {/* Preferences Section */}
        <SettingsSection title={t('Tùy chọn', 'Preferences')}>
          <SettingsRow
            icon={<Globe className="h-4 w-4" />}
            label={t('Ngôn ngữ', 'Language')}
            labelVi="Ngôn ngữ"
            value={locale === 'vi' ? 'Tiếng Việt' : 'English'}
            onClick={() => router.push('/m/settings/language')}
            locale={locale}
          />
          <Separator />
          <SettingsRow
            icon={<Bell className="h-4 w-4" />}
            label={t('Thông báo', 'Notifications')}
            labelVi="Thông báo"
            onClick={() => router.push('/m/settings/notifications')}
            locale={locale}
          />
        </SettingsSection>

        {/* App Section */}
        <SettingsSection title={t('Ứng dụng', 'App')}>
          <SettingsRow
            icon={<Smartphone className="h-4 w-4" />}
            label={t('Cài đặt PWA', 'PWA Install')}
            labelVi="Cài đặt PWA"
            onClick={() => {
              // Trigger install prompt
              const { deferredPrompt, dismissInstallPrompt } = useAppStore.getState();
              if (deferredPrompt) {
                (deferredPrompt as { prompt: () => Promise<void> }).prompt();
                dismissInstallPrompt();
              }
            }}
            locale={locale}
          />
          <Separator />
          <SettingsRow
            icon={<HardDrive className="h-4 w-4" />}
            label={t('Dữ liệu & Bộ nhớ', 'Data & Storage')}
            labelVi="Dữ liệu & Bộ nhớ"
            onClick={() => router.push('/m/settings/data')}
            locale={locale}
          />
        </SettingsSection>

        {/* Support Section */}
        <SettingsSection title={t('Hỗ trợ', 'Support')}>
          <SettingsRow
            icon={<HelpCircle className="h-4 w-4" />}
            label={t('Trợ giúp & FAQ', 'Help & FAQ')}
            labelVi="Trợ giúp & FAQ"
            onClick={() => router.push('/m/chat')}
            locale={locale}
          />
          <Separator />
          <SettingsRow
            icon={<FileText className="h-4 w-4" />}
            label={t('Điều khoản sử dụng', 'Terms of Service')}
            labelVi="Điều khoản sử dụng"
            locale={locale}
          />
          <Separator />
          <SettingsRow
            icon={<Info className="h-4 w-4" />}
            label={t('Giới thiệu', 'About')}
            labelVi="Giới thiệu"
            value="v1.0.0"
            onClick={() => {}}
            locale={locale}
          />
        </SettingsSection>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm font-medium">
            {t('Đăng xuất', 'Sign Out')}
          </span>
        </button>

        {/* Version footer */}
        <p className="text-center text-[11px] text-muted-foreground/50 pt-2 pb-4">
          ALADIN B2B v1.0.0 — Build 2025.04.25
        </p>
      </main>
    </div>
  );
}

// ============================================
// Settings Section
// ============================================

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 pb-1">
        {children}
      </CardContent>
    </Card>
  );
}

// ============================================
// Settings Row
// ============================================

function SettingsRow({
  icon,
  label,
  labelVi,
  value,
  onClick,
  locale,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  labelVi: string;
  value?: string | null;
  onClick: () => void;
  locale: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm flex-1 text-left">
        {locale === 'vi' ? labelVi : label}
      </span>
      {badge && (
        <Badge variant="secondary" className="text-[10px]">
          {badge}
        </Badge>
      )}
      {value && !badge && (
        <span className="text-xs text-muted-foreground">{value}</span>
      )}
      {onClick && (
        <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
      )}
    </button>
  );
}
