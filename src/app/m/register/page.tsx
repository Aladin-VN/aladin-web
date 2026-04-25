'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, Lock, Eye, EyeOff, User, Store, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';

// ============================================
// Mobile Register Page
// ============================================

export default function MobileRegisterPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const locale = useAppStore((s) => s.locale);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: '',
    shopName: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const update = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.phone.trim() || !form.password.trim()) {
      setError(t('Vui lòng nhập đầy đủ thông tin', 'Please fill in all required fields'));
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError(t('Mật khẩu không khớp', 'Passwords do not match'));
      return;
    }

    if (form.password.length < 6) {
      setError(t('Mật khẩu ít nhất 6 ký tự', 'Password must be at least 6 characters'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          password: form.password,
          shopName: form.shopName || undefined,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        login(json.data);
        router.replace('/m');
      } else {
        const msg = json.error?.message || t('Đăng ký thất bại', 'Registration failed');
        setError(msg);
      }
    } catch (err) {
      setError(t('Lỗi kết nối mạng', 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-8 bg-background">
      {/* Logo */}
      <div className="text-center mb-6">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-3">
          <span className="text-xl font-bold">A</span>
        </div>
        <h1 className="text-xl font-bold tracking-tight">ALADIN</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('Tạo tài khoản mới', 'Create new account')}
        </p>
      </div>

      <Card className="border-0 shadow-none px-0">
        <CardHeader className="px-0 pb-2">
          <h2 className="text-lg font-semibold">{t('Đăng ký', 'Sign Up')}</h2>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="px-0 space-y-3">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm">
                {t('Họ và tên', 'Full Name')} *
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder={t('Nguyễn Văn A', 'Nguyen Van A')}
                  className="pl-10 h-11 text-base"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-phone" className="text-sm">
                {t('Số điện thoại', 'Phone Number')} *
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reg-phone"
                  type="tel"
                  placeholder="0912 345 678"
                  className="pl-10 h-11 text-base"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  autoComplete="tel"
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* Shop Name (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="shop-name" className="text-sm">
                {t('Tên cửa hàng', 'Shop Name')}{' '}
                <span className="text-muted-foreground">({t('tùy chọn', 'optional')})</span>
              </Label>
              <div className="relative">
                <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="shop-name"
                  placeholder={t('Cửa hàng tạp hóa ABC', 'ABC Grocery Store')}
                  className="pl-10 h-11 text-base"
                  value={form.shopName}
                  onChange={(e) => update('shopName', e.target.value)}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="reg-password" className="text-sm">
                {t('Mật khẩu', 'Password')} *
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-11 text-base"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-sm">
                {t('Xác nhận mật khẩu', 'Confirm Password')} *
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 h-11 text-base"
                  value={form.confirmPassword}
                  onChange={(e) => update('confirmPassword', e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="px-0 pt-4 flex-col gap-3">
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('Đang tạo tài khoản...', 'Creating account...')}
                </>
              ) : (
                t('Đăng ký', 'Sign Up')
              )}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              {t('Đã có tài khoản?', 'Already have an account?')}{' '}
              <Link href="/m/login" className="text-primary font-semibold hover:underline">
                {t('Đăng nhập', 'Sign In')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
