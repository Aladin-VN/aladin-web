'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, Lock, Eye, EyeOff, Loader2, ShieldCheck, Store, Truck, Users, BarChart3, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ============================================
// Admin / Desktop Login Page
// All roles login here, then see filtered views
// ============================================

const DEMO_ACCOUNTS = [
  { phone: '0901234567', role: 'Admin', icon: ShieldCheck, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', description: 'Full access to all platform features' },
  { phone: '0901234600', role: 'Shop Owner', icon: Store, color: 'text-blue-600 bg-blue-50 border-blue-200', description: 'See only their shop data, orders, and credit' },
  { phone: '0911111111', role: 'Sales Rep', icon: Users, color: 'text-purple-600 bg-purple-50 border-purple-200', description: 'See all shops, orders, and collect payments' },
  { phone: '0922222222', role: 'Driver', icon: Truck, color: 'text-orange-600 bg-orange-50 border-orange-200', description: 'See only assigned deliveries' },
  { phone: '0933333333', role: 'Broker', icon: BarChart3, color: 'text-amber-600 bg-amber-50 border-amber-200', description: 'See referred shops and commissions' },
];

export default function AuthLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, redirect to dashboard
  useEffect(() => {
    const token = localStorage.getItem('aladin-access-token');
    const userData = localStorage.getItem('aladin-user');
    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        if (user?.userId) {
          router.replace('/');
          return;
        }
      } catch {}
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || !password.trim()) {
      setError('Please enter phone number and password.');
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
        const { accessToken, refreshToken, user } = json.data;

        // Save to localStorage for admin panel
        localStorage.setItem('aladin-access-token', accessToken);
        localStorage.setItem('aladin-refresh-token', refreshToken);
        localStorage.setItem('aladin-user', JSON.stringify({
          userId: user.id || user.userId,
          phone: user.phone,
          name: user.name,
          role: user.role,
          shopId: user.shopId,
          shop: user.shop || null,
        }));

        // Redirect based on role
        if (user.role === 'DRIVER') {
          router.replace('/shipments');
        } else if (user.role === 'SHOP_OWNER') {
          router.replace('/');
        } else {
          router.replace('/');
        }
      } else {
        const msg = json.error?.message || 'Login failed. Please check your credentials.';
        setError(msg);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoPhone: string) => {
    setPhone(demoPhone);
    setPassword('aladin123');
    setError('');
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side — Branding & Demo Accounts */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white flex-col justify-between p-8 xl:p-12 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full border-2 border-white" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full border border-white" />
          <div className="absolute top-1/2 left-1/3 w-40 h-40 rounded-full border border-white" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm font-bold text-xl">
              A
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ALADIN</h1>
              <p className="text-sm text-emerald-200">AI-Powered B2B Commerce</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <h2 className="text-3xl xl:text-4xl font-bold leading-tight mb-4">
            Order in 10 seconds,<br />not 10 minutes.
          </h2>
          <p className="text-emerald-100 text-base leading-relaxed mb-8">
            Vietnam&apos;s first AI-powered B2B commerce platform for mom-and-pop grocery shops.
          </p>

          {/* Demo Accounts */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-3">
              Demo Accounts (password: aladin123)
            </p>
            {DEMO_ACCOUNTS.map((demo) => (
              <button
                key={demo.phone}
                onClick={() => fillDemo(demo.phone)}
                className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-all text-left group"
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${demo.color.replace(/text-(\w+)-\d+/, 'bg-white/20').replace(/bg-\w+-\d+/, 'bg-white/10')}`}>
                  <demo.icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{demo.role}</span>
                    <span className="text-xs text-emerald-300 font-mono">{demo.phone}</span>
                  </div>
                  <p className="text-xs text-emerald-200 truncate">{demo.description}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] bg-white/20 text-white border-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  Fill
                </Badge>
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-emerald-300">
          &copy; {new Date().getFullYear()} ALADIN Vietnam. All rights reserved.
        </div>
      </div>

      {/* Right side — Login Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 bg-background max-w-md mx-auto w-full">
        {/* Mobile Logo */}
        <div className="lg:hidden text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white mb-3">
            <span className="text-2xl font-bold">A</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">ALADIN</h1>
          <p className="text-sm text-muted-foreground">AI-Powered B2B Commerce</p>
        </div>

        <Card className="border-0 shadow-none lg:shadow-sm lg:border">
          <CardHeader className="pb-2">
            <h2 className="text-xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to your ALADIN account
            </p>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="0912 345 678"
                    className="pl-10 h-11"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="pl-10 pr-10 h-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-3">
              <Button
                type="submit"
                className="w-full h-11 text-sm font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              {/* Mobile-only demo accounts */}
              <div className="lg:hidden w-full mt-4">
                <p className="text-xs text-muted-foreground text-center mb-2">Demo: password is aladin123</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {DEMO_ACCOUNTS.slice(0, 3).map((demo) => (
                    <button
                      key={demo.phone}
                      type="button"
                      onClick={() => fillDemo(demo.phone)}
                      className="flex items-center gap-2 p-2 rounded-md border text-left hover:bg-muted/50 transition-colors"
                    >
                      <demo.icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium flex-1">{demo.role}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{demo.phone}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardFooter>
          </form>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-6">
          Mobile app? <Link href="/m/login" className="text-primary font-medium hover:underline">Open mobile version</Link>
        </p>
      </div>
    </div>
  );
}