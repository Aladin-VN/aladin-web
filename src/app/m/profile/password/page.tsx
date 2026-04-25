'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Loader2, Check, X, Shield, AlertTriangle } from 'lucide-react';

// ============================================
// Change Password Page
// ============================================

export default function ChangePasswordPage() {
  const router = useRouter();
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Password strength indicators
  const hasMinLength = newPassword.length >= 8;
  const hasUpperCase = /[A-Z]/.test(newPassword);
  const hasLowerCase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const strengthScore = [hasMinLength, hasUpperCase, hasLowerCase, hasNumber].filter(Boolean).length;

  const strengthLabel =
    strengthScore <= 1
      ? t('Yếu', 'Weak')
      : strengthScore === 2
      ? t('Trung bình', 'Fair')
      : strengthScore === 3
      ? t('Khá', 'Good')
      : t('Mạnh', 'Strong');

  const strengthColor =
    strengthScore <= 1
      ? 'bg-red-500'
      : strengthScore === 2
      ? 'bg-amber-500'
      : strengthScore === 3
      ? 'bg-blue-500'
      : 'bg-emerald-500';

  const canSubmit =
    currentPassword &&
    newPassword &&
    confirmPassword &&
    newPassword === confirmPassword &&
    hasMinLength &&
    strengthScore >= 2;

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setError(t('Mật khẩu xác nhận không khớp', 'Passwords do not match'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('Mật khẩu phải có ít nhất 8 ký tự', 'Password must be at least 8 characters'));
      return;
    }
    if (currentPassword === newPassword) {
      setError(t('Mật khẩu mới phải khác mật khẩu hiện tại', 'New password must differ from current'));
      return;
    }

    setSaving(true);
    setError('');

    try {
      const res = await api.patch('/auth/password', {
        currentPassword,
        newPassword,
      });

      if (res.success) {
        setSuccess(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          router.back();
        }, 1500);
      } else {
        setError(res.error?.message || t('Đổi mật khẩu thất bại', 'Password change failed'));
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
        title={t('Đổi mật khẩu', 'Change Password')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-4 pt-3 space-y-4">
        {/* Security icon */}
        <div className="flex justify-center py-2">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="text-xs">
            {t(
              'Sau khi đổi mật khẩu, bạn sẽ cần đăng nhập lại trên tất cả thiết bị.',
              'After changing your password, you will need to sign in again on all devices.'
            )}
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {/* Current password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t('Mật khẩu hiện tại', 'Current Password')} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className="h-11 pr-10"
                  type={showCurrent ? 'text' : 'password'}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t('Mật khẩu mới', 'New Password')} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className="h-11 pr-10"
                  type={showNew ? 'text' : 'password'}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Strength indicator */}
              {newPassword && (
                <div className="space-y-2 mt-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= strengthScore ? strengthColor : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t('Độ mạnh:', 'Strength:')} <span className="font-medium">{strengthLabel}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    <Requirement met={hasMinLength} label={t('≥ 8 ký tự', '≥ 8 chars')} />
                    <Requirement met={hasUpperCase} label={t('Chữ hoa', 'Uppercase')} />
                    <Requirement met={hasLowerCase} label={t('Chữ thường', 'Lowercase')} />
                    <Requirement met={hasNumber} label={t('Chữ số', 'Number')} />
                  </div>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {t('Xác nhận mật khẩu mới', 'Confirm New Password')} <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className="h-11 pr-10"
                  type={showConfirm ? 'text' : 'password'}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-[11px] text-destructive">
                  {t('Mật khẩu không khớp', 'Passwords do not match')}
                </p>
              )}
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
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 text-sm">
            <Check className="h-4 w-4 shrink-0" />
            {t('Đổi mật khẩu thành công!', 'Password changed successfully!')}
          </div>
        )}

        {/* Submit button */}
        <Button
          className="w-full h-12"
          onClick={handleChangePassword}
          disabled={!canSubmit || saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('Đang cập nhật...', 'Updating...')}
            </>
          ) : (
            t('Đổi mật khẩu', 'Change Password')
          )}
        </Button>
      </main>
    </div>
  );
}

// ============================================
// Requirement Check Item
// ============================================

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <div
        className={`h-1.5 w-1.5 rounded-full ${
          met ? 'bg-emerald-500' : 'bg-muted-foreground/30'
        }`}
      />
      <span className={met ? 'text-emerald-600' : 'text-muted-foreground'}>
        {label}
      </span>
    </div>
  );
}
