'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, Lock, Eye, EyeOff, Loader2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/auth.store';
import { useAppStore } from '@/stores/app.store';

// ============================================
// Mobile Login Page
// ============================================

export default function MobileLoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const locale = useAppStore((s) => s.locale);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      setError(t('Vui lòng nhập đầy đủ thông tin', 'Please fill in all fields'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        login(json.data);
        router.replace('/m');
      } else {
        const msg = json.error?.message || t('Đăng nhập thất bại', 'Login failed');
        setError(msg);
      }
    } catch (err) {
      setError(t('Lỗi kết nối mạng', 'Network error'));
    } finally {
      setLoading(false);
    }
  };

  const handleZaloLogin = () => {
    // Zalo OA OAuth flow — placeholder for Sprint M7
    // Will redirect to Zalo OAuth consent page
    setError(t('Zalo đăng nhập sẽ có ở bản cập nhật tiếp theo', 'Zalo login coming in next update'));
  };

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-8 bg-background">
      {/* Logo & branding */}
      <div className="text-center mb-8">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground mb-4">
          <span className="text-2xl font-bold">A</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">ALADIN</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('Đặt hàng trong 10 giây', 'Order in 10 seconds')}
        </p>
      </div>

      {/* Login form */}
      <Card className="border-0 shadow-none px-0">
        <CardHeader className="px-0 pb-4">
          <h2 className="text-lg font-semibold">
            {t('Đăng nhập', 'Sign In')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('Nhập số điện thoại và mật khẩu', 'Enter your phone and password')}
          </p>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="px-0 space-y-4">
            {/* Error */}
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm">
                {t('Số điện thoại', 'Phone Number')}
              </Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="0912 345 678"
                  className="pl-10 h-12 text-base"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">
                {t('Mật khẩu', 'Password')}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-12 text-base"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
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
          </CardContent>

          <CardFooter className="px-0 pt-2 flex-col gap-3">
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('Đang đăng nhập...', 'Signing in...')}
                </>
              ) : (
                t('Đăng nhập', 'Sign In')
              )}
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 w-full my-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">{t('hoặc', 'or')}</span>
              <Separator className="flex-1" />
            </div>

            {/* Zalo login */}
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 text-base font-semibold"
              onClick={handleZaloLogin}
            >
              <MessageCircle className="mr-2 h-5 w-5 text-[#0068ff]" />
              {t('Đăng nhập bằng Zalo', 'Login with Zalo')}
            </Button>

            {/* Register link */}
            <p className="text-sm text-center text-muted-foreground">
              {t('Chưa có tài khoản?', "Don't have an account?")}{' '}
              <Link href="/m/register" className="text-primary font-semibold hover:underline">
                {t('Đăng ký ngay', 'Register now')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
