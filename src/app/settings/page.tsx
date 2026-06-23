'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useLocale } from '@/providers/app-provider';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Save,
  Loader2,
  RefreshCw,
  Clock,
  Key,
  AlertTriangle,
  Info,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminHeader } from '@/components/layout/admin-header';
import { SidebarInset } from '@/components/ui/sidebar';
import { SensitiveValue } from '@/components/shared/sensitive-value';
import { UserRoleBadge } from '@/components/settings/user-role-badge';
import { ChangePasswordDialog } from '@/components/settings/change-password-dialog';
import { toast } from 'sonner';

interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  description: string | null;
  category: string;
}

interface PlatformSettingsResponse {
  settings: Record<string, PlatformSetting[]>;
  flat: PlatformSetting[];
}

export default function SettingsPage() {
  const { locale } = useLocale();
  const t = (en: string, vi: string) => locale === 'vi' ? vi : en;

  // Tabs
  const [activeTab, setActiveTab] = useState('platform');

  // Platform settings
  const [settings, setSettings] = useState<PlatformSettingsResponse | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [modifiedSettings, setModifiedSettings] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);

  // Change password
  const [changePwdOpen, setChangePwdOpen] = useState(false);

  // Profile (mock current user)
  const [profile, setProfile] = useState({
    name: 'Quyet Dinh',
    nameEn: '',
    email: 'admin@aladin.vn',
    phone: '0912345678',
    role: 'ADMIN',
    lastLoginAt: new Date().toISOString(),
  });

  // Fetch platform settings
  const fetchSettings = useCallback(async () => {
    try {
      setSettingsLoading(true);
      const json = await adminFetch('/api/settings/platform');
      if (json.success) {
        setSettings(json.data);
        setModifiedSettings({});
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'platform') {
      fetchSettings();
    }
  }, [activeTab, fetchSettings]);

  // Save settings
  const handleSaveSettings = async () => {
    const changes = Object.entries(modifiedSettings).map(([key, value]) => ({ key, value }));
    if (changes.length === 0) {
      toast.info(t('No changes to save', 'Khong co thay doi de luu'));
      return;
    }

    setSavingSettings(true);
    try {
      const res = await adminFetch('/api/settings/platform', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: changes }),
      });
      if (json.success) {
        toast.success(t(`Saved ${json.data.count} setting(s)`, `Da luu ${json.data.count} cai dat`));
        fetchSettings();
      } else {
        toast.error(json.error?.message || t('Failed to save', 'Luu that bai'));
      }
    } catch (err) {
      toast.error(t('Network error', 'Loi mang'));
    } finally {
      setSavingSettings(false);
    }
  };

  // Update profile
  const handleSaveProfile = async () => {
    toast.success(t('Profile updated', 'Cap nhat ho so thanh cong'));
  };

  const categoryLabels: Record<string, { en: string; vi: string; icon: React.ReactNode }> = {
    general: { en: 'General', vi: 'Tong quat', icon: <SettingsIcon className="h-4 w-4" /> },
    credit: { en: 'Credit System', vi: 'He thong cong no', icon: <Info className="h-4 w-4" /> },
    notification: { en: 'Notifications', vi: 'Thong bao', icon: <AlertTriangle className="h-4 w-4" /> },
    security: { en: 'Security', vi: 'Bao mat', icon: <Shield className="h-4 w-4" /> },
  };

  const isBooleanValue = (val: string) => val === 'true' || val === 'false';
  const isNumericValue = (val: string) => /^\d+(\.\d+)?$/.test(val) && !isBooleanValue(val);

  const hasChanges = Object.keys(modifiedSettings).length > 0;

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />

        <main className="flex-1 p-4 md:p-6 space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t('Settings', 'Cai dat')}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t('Platform configuration, profile, and security settings', 'Cau hinh nen tang, ho so va thiet lap bao mat')}
            </p>
          </div>

          <Separator />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="platform">
                <SettingsIcon className="h-4 w-4 mr-1.5" />
                {t('Platform Config', 'Cau hinh')}
              </TabsTrigger>
              <TabsTrigger value="profile">
                <User className="h-4 w-4 mr-1.5" />
                {t('My Profile', 'Ho so cua toi')}
              </TabsTrigger>
              <TabsTrigger value="security">
                <Shield className="h-4 w-4 mr-1.5" />
                {t('Security', 'Bao mat')}
              </TabsTrigger>
            </TabsList>

            {/* Platform Config Tab */}
            <TabsContent value="platform" className="space-y-6 mt-6">
              {settingsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-48 w-full" />
                  ))}
                </div>
              ) : settings ? (
                <>
                  {Object.entries(categoryLabels).map(([category, label]) => {
                    const categorySettings = settings.settings[category];
                    if (!categorySettings || categorySettings.length === 0) return null;

                    return (
                      <Card key={category}>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            {label.icon}
                            {locale === 'vi' ? label.vi : label.en}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {categorySettings.map((s) => (
                            <div key={s.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b last:border-b-0 last:pb-0">
                              <div className="flex-1">
                                <Label className="text-sm font-medium">
                                  {s.description || s.key}
                                </Label>
                                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{s.key}</p>
                              </div>
                              <div className="flex items-center gap-2 min-w-[120px]">
                                {isBooleanValue(s.value) ? (
                                  <Switch
                                    checked={
                                      modifiedSettings[s.key] !== undefined
                                        ? modifiedSettings[s.key] === 'true'
                                        : s.value === 'true'
                                    }
                                    onCheckedChange={(checked) => {
                                      setModifiedSettings((prev) => ({
                                        ...prev,
                                        [s.key]: String(checked),
                                      }));
                                    }}
                                  />
                                ) : isNumericValue(s.value) ? (
                                  <Input
                                    type="number"
                                    value={
                                      modifiedSettings[s.key] !== undefined
                                        ? modifiedSettings[s.key]
                                        : s.value
                                    }
                                    onChange={(e) => {
                                      setModifiedSettings((prev) => ({
                                        ...prev,
                                        [s.key]: e.target.value,
                                      }));
                                    }}
                                    className="h-8 w-32 text-sm"
                                  />
                                ) : (
                                  <Input
                                    value={
                                      modifiedSettings[s.key] !== undefined
                                        ? modifiedSettings[s.key]
                                        : s.value
                                    }
                                    onChange={(e) => {
                                      setModifiedSettings((prev) => ({
                                        ...prev,
                                        [s.key]: e.target.value,
                                      }));
                                    }}
                                    className="h-8 w-48 text-sm"
                                  />
                                )}
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })}

                  {/* Save Button */}
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={fetchSettings} disabled={savingSettings}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      {t('Reset', 'Dat lai')}
                    </Button>
                    <Button
                      onClick={handleSaveSettings}
                      disabled={savingSettings || !hasChanges}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      {savingSettings ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-1" />
                      )}
                      {t('Save Changes', 'Luu thay doi')}
                      {hasChanges && (
                        <span className="ml-1.5 bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">
                          {Object.keys(modifiedSettings).length}
                        </span>
                      )}
                    </Button>
                  </div>
                </>
              ) : null}
            </TabsContent>

            {/* My Profile Tab */}
            <TabsContent value="profile" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('Profile Information', 'Thong tin ho so')}</CardTitle>
                  <CardDescription>{t('View and update your account information', 'Xem va cap nhat thong tin tai khoan')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-yellow-50 flex items-center justify-center">
                      <span className="text-xl font-bold text-red-700">
                        {profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{profile.name}</h3>
                      <UserRoleBadge role={profile.role} locale={locale} />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>{t('Phone', 'So dien thoai')}</Label>
                      <div className="text-sm">
                        <SensitiveValue value={profile.phone} maskType="phone" />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>{t('Email', 'Email')}</Label>
                      <p className="text-sm">{profile.email}</p>
                    </div>
                    <div className="grid gap-2">
                      <Label>{t('Name (Vietnamese)', 'Ten (Tieng Viet)')}</Label>
                      <Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t('Name (English)', 'Ten (Tieng Anh)')}</Label>
                      <Input value={profile.nameEn} onChange={(e) => setProfile((p) => ({ ...p, nameEn: e.target.value }))} placeholder="John Doe" />
                    </div>
                    <div className="grid gap-2">
                      <Label>{t('Last Login', 'Dang nhap cuoi')}</Label>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(profile.lastLoginAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      onClick={() => setChangePwdOpen(true)}
                      variant="outline"
                    >
                      <Key className="h-4 w-4 mr-1" />
                      {t('Change Password', 'Doi mat khau')}
                    </Button>
                    <Button onClick={handleSaveProfile} className="bg-red-600 hover:bg-red-700 text-white">
                      <Save className="h-4 w-4 mr-1" />
                      {t('Save Profile', 'Luu ho so')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {t('Session Timeout', 'Het phien lam viec')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t('Access token expires after 15 minutes', 'Token truy cap het han sau 15 phut')}</p>
                    <p>{t('Refresh token expires after 7 days', 'Token lam moi het han sau 7 ngay')}</p>
                    {settings?.settings?.security && (() => {
                      const timeout = settings.settings.security.find((s) => s.key === 'security.sessionTimeoutMinutes');
                      return timeout ? (
                        <p className="font-medium text-foreground">{timeout.value} {t('minutes', 'phut')}</p>
                      ) : null;
                    })()}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Key className="h-4 w-4" />
                      {t('Password Policy', 'Chinh sach mat khau')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t('Minimum 8 characters', 'It nhat 8 ky tu')}</p>
                    <p>{t('Scrypt hashing algorithm', 'Thuat toan bam Scrypt')}</p>
                    <p>{t('Force change on admin reset', 'Bat buoc doi khi quan tri dat lai')}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {t('Rate Limiting', 'Gioi han truy cap')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t('Login: 10 attempts per 15 minutes', 'Dang nhap: 10 lan / 15 phut')}</p>
                    <p>{t('Registration: 5 attempts per 15 minutes', 'Dang ky: 5 lan / 15 phut')}</p>
                    <p>{t('In-memory rate limiting per user/IP', 'Gioi han theo nguoi dung/IP trong bo nho')}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      {t('Security Practices', 'Thuc hanh bao mat')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>{t('All admin actions are audit logged', 'Tat ca thao tac cua quan tri duoc ghi nhat ky')}</p>
                    <p>{t('JWT-based authentication with refresh tokens', 'Xac thuc JWT voi token lam moi')}</p>
                    <p>{t('Input sanitization against XSS', 'Lam sach du lieu dau vong chong XSS')}</p>
                    <p>{t('Soft delete for data recovery', 'Xoa mem de khoi phuc du lieu')}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t('Quick Actions', 'Thao tac nhanh')}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setChangePwdOpen(true)}>
                    <Key className="h-4 w-4 mr-1" />
                    {t('Change Password', 'Doi mat khau')}
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab('platform')}>
                    <Eye className="h-4 w-4 mr-1" />
                    {t('View Platform Config', 'Xem cau hinh nen tang')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>

        {/* Change Password Dialog */}
        <ChangePasswordDialog open={changePwdOpen} onOpenChange={setChangePwdOpen} locale={locale} />
      </SidebarInset>
    </div>
  );
}
