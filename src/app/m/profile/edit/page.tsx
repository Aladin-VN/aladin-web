'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Camera, Loader2, Check, X } from 'lucide-react';

// ============================================
// Profile Edit Page
// ============================================

export default function ProfileEditPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const hasChanges = name !== user?.name || email !== user?.email || phone !== user?.phone;

  const handleSave = async () => {
    if (!name.trim()) {
      setError(t('Vui lòng nhập tên', 'Please enter your name'));
      return;
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('Email không hợp lệ', 'Invalid email address'));
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await api.patch('/users/profile', { name: name.trim(), email: email.trim(), phone: phone.trim() });

      if (res.success && res.data) {
        updateProfile(res.data as Partial<typeof user>);
        setSuccess(true);
        setTimeout(() => {
          router.back();
        }, 1200);
      } else {
        setError(res.error?.message || t('Cập nhật thất bại', 'Update failed'));
      }
    } catch {
      setError(t('Lỗi kết nối', 'Connection error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Chỉnh sửa hồ sơ', 'Edit Profile')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-4 pt-3 space-y-4">
        {/* Avatar section */}
        <div className="flex justify-center py-4">
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarImage src={user?.avatarUrl || undefined} />
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {user?.name?.slice(0, 2)?.toUpperCase() || 'A'}
              </AvatarFallback>
            </Avatar>
            <button className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md border-2 border-background">
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t('Tên hiển thị', 'Display Name')} <span className="text-destructive">*</span>
              </Label>
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder={t('Nhập tên...', 'Enter name...')}
                className="h-11"
              />
            </div>

            <Separator />

            {/* Phone */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t('Số điện thoại', 'Phone Number')}
              </Label>
              <Input
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setError(''); }}
                placeholder="0901 234 567"
                className="h-11"
                type="tel"
                disabled
              />
              <p className="text-[11px] text-muted-foreground">
                {t('Liên hệ hỗ trợ để thay đổi SĐT', 'Contact support to change phone number')}
              </p>
            </div>

            <Separator />

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t('Email', 'Email')}
              </Label>
              <Input
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder={t('email@example.com', 'email@example.com')}
                className="h-11"
                type="email"
              />
            </div>

            <Separator />

            {/* Role (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t('Vai trò', 'Role')}
              </Label>
              <div className="h-11 rounded-md border bg-muted/50 flex items-center px-3">
                <span className="text-sm text-muted-foreground">
                  {user?.role === 'SHOP_OWNER'
                    ? t('Chủ cửa hàng', 'Shop Owner')
                    : user?.role === 'ADMIN'
                    ? t('Quản trị viên', 'Admin')
                    : user?.role === 'SALES_REP'
                    ? t('Nhân viên sales', 'Sales Rep')
                    : user?.role === 'DRIVER'
                    ? t('Tài xế', 'Driver')
                    : user?.role === 'BROKER'
                    ? t('Đại lý', 'Broker')
                    : user?.role}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error message */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 text-destructive text-sm">
            <X className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-yellow-50 dark:bg-emerald-950/30 text-red-600 text-sm">
            <Check className="h-4 w-4 shrink-0" />
            {t('Cập nhật thành công!', 'Profile updated!')}
          </div>
        )}

        {/* Save button */}
        <Button
          className="w-full h-12"
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('Đang lưu...', 'Saving...')}
            </>
          ) : (
            t('Lưu thay đổi', 'Save Changes')
          )}
        </Button>

        {/* Cancel */}
        <Button
          variant="outline"
          className="w-full h-11"
          onClick={() => router.back()}
        >
          {t('Hủy', 'Cancel')}
        </Button>
      </main>
    </div>
  );
}
