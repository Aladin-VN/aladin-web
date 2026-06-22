'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/providers/app-provider';
import { Phone, Lock, Eye, EyeOff, Loader2, ShieldCheck, Store, Truck, Users, BarChart3, Sparkles, Zap, Warehouse } from 'lucide-react';

// ============================================
// ALADIN Admin / Desktop Login Page
// Yellow + Red brand theme with modern animations
// ============================================

const DEMO_ACCOUNTS = [
  { phone: '0900000001', role: 'Admin', icon: ShieldCheck, desc: 'Full platform access' },
  { phone: '0901234600', role: 'Shop Owner', icon: Store, desc: 'Own shop data only' },
  { phone: '0911111111', role: 'Sales Rep', icon: Users, desc: 'All shops & payments' },
  { phone: '0922222222', role: 'Driver', icon: Truck, desc: 'Assigned deliveries' },
  { phone: '0933333333', role: 'Broker', icon: BarChart3, desc: 'Referred shops & commission' },
  { phone: '0944444444', role: 'Distributor', icon: Warehouse, desc: 'Inventory & settlements' },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login: authLogin } = useAuth();
  const redirectPath = searchParams.get('redirect') || '/';
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [fillAnimation, setFillAnimation] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    // CRITICAL: Unregister any old service worker that may be intercepting requests
    // The old SW (v1) was breaking admin page navigation with FetchEvent errors
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => {
          if (reg.scope === window.location.origin + '/') {
            reg.unregister().catch(() => {});
          }
        });
      }).catch(() => {});
    }

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

        // Use AppProvider's login() to update state + localStorage atomically
        authLogin({
          accessToken,
          refreshToken,
          userId: user.id || user.userId,
          phone: user.phone,
          name: user.name,
          role: user.role,
          shopId: user.shop?.id || user.shopId || null,
          shop: user.shop || null,
          distributorId: user.distributor?.distributorId || user.distributorId || null,
          distributor: user.distributor?.distributor ? {
            id: user.distributor.distributor.id,
            name: user.distributor.distributor.name,
            address: user.distributor.distributor.address,
            commissionRate: user.distributor.distributor.commissionRate,
            pendingPayoutAmount: user.distributor.distributor.pendingPayoutAmount,
          } : null,
        });

        if (user.role === 'DRIVER' && redirectPath === '/') {
          router.replace('/shipments');
        } else if (user.role === 'DISTRIBUTOR' && redirectPath === '/') {
          router.replace('/distributor');
        } else {
          router.replace(redirectPath);
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
    setFillAnimation(demoPhone);
    setTimeout(() => setFillAnimation(null), 600);
    setPhone(demoPhone);
    setPassword('aladin123');
    setError('');
  };

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#0a0a0a] overflow-hidden relative">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-red-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Left Panel — Branding */}
      <div
        className={`hidden lg:flex lg:w-[520px] xl:w-[580px] flex-col justify-between p-8 xl:p-12 relative overflow-hidden
          transition-all duration-1000 ease-out ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}
        style={{
          background: 'linear-gradient(160deg, #DC2626 0%, #B91C1C 30%, #991B1B 60%, #7F1D1D 100%)',
        }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
          {/* Animated circles */}
          <div className="absolute -top-24 -right-24 w-72 h-72 border border-white/10 rounded-full animate-[spin_20s_linear_infinite]" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 border border-white/5 rounded-full animate-[spin_30s_linear_infinite_reverse]" />
          <div className="absolute top-1/3 right-16 w-24 h-24 border border-yellow-400/20 rounded-full animate-[ping_3s_ease-in-out_infinite]" />
          {/* Sparkle dots */}
          <div className="absolute top-20 right-32 w-2 h-2 bg-yellow-300/40 rounded-full animate-[pulse_2s_ease-in-out_infinite]" />
          <div className="absolute top-40 right-20 w-1.5 h-1.5 bg-yellow-200/30 rounded-full animate-[pulse_2s_ease-in-out_infinite_0.5s]" />
          <div className="absolute bottom-32 left-24 w-2 h-2 bg-yellow-300/30 rounded-full animate-[pulse_2s_ease-in-out_infinite_1s]" />
          <div className="absolute top-1/2 right-1/4 w-1 h-1 bg-white/20 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" />
          {/* Large decorative "A" watermark */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[280px] font-black text-white/[0.03] leading-none select-none">
            A
          </div>
        </div>

        {/* Top — Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3.5 group cursor-pointer">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400 text-red-700 font-black text-xl shadow-lg shadow-yellow-400/25
                group-hover:shadow-yellow-400/40 group-hover:scale-105 transition-all duration-300">
                A
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-300 rounded-full flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-red-700" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">ALADIN</h1>
              <p className="text-[11px] font-medium text-yellow-300/80 tracking-widest uppercase">AI-Powered B2B Commerce</p>
            </div>
          </div>
        </div>

        {/* Center — Hero */}
        <div className="relative z-10 flex-1 flex flex-col justify-center">
          <div className={`transition-all duration-700 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-400/15 border border-yellow-400/20 mb-6 w-fit">
              <Zap className="w-3.5 h-3.5 text-yellow-300" />
              <span className="text-xs font-semibold text-yellow-200">Voice-first ordering</span>
            </div>
            <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] mb-5">
              Order in<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-100">
                10 seconds,
              </span>
              <br />
              not 10 minutes.
            </h2>
            <p className="text-red-100/70 text-base leading-relaxed max-w-md mb-10">
              Vietnam&apos;s first AI-powered B2B commerce platform for mom-and-pop grocery shops. Order via voice, manage credit, and grow your business.
            </p>
          </div>

          {/* Demo Accounts */}
          <div className={`transition-all duration-700 delay-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-yellow-300/60 mb-3">
              Quick Demo Access
            </p>
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map((demo, i) => (
                <button
                  key={demo.phone}
                  onClick={() => fillDemo(demo.phone)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 text-left group relative overflow-hidden
                    ${fillAnimation === demo.phone
                      ? 'bg-yellow-400/25 scale-[1.02]'
                      : 'bg-white/[0.06] hover:bg-white/[0.12]'
                    }`}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {/* Shimmer effect on hover */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
                      transform: 'translateX(-100%)',
                    }}
                  />
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200
                    ${fillAnimation === demo.phone ? 'bg-yellow-400' : 'bg-white/10 group-hover:bg-yellow-400/20'}`}>
                    <demo.icon className={`h-4 w-4 transition-colors duration-200
                      ${fillAnimation === demo.phone ? 'text-red-700' : 'text-white/70 group-hover:text-yellow-300'}`} />
                  </div>
                  <div className="flex-1 min-w-0 relative z-10">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{demo.role}</span>
                      <span className="text-[10px] text-yellow-300/50 font-mono">{demo.phone}</span>
                    </div>
                    <p className="text-[11px] text-red-200/50 truncate">{demo.desc}</p>
                  </div>
                  <div className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full transition-all duration-200
                    ${fillAnimation === demo.phone
                      ? 'bg-yellow-400 text-red-700'
                      : 'bg-white/10 text-white/40 opacity-0 group-hover:opacity-100'
                    }`}>
                    Fill
                  </div>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-red-200/30 mt-3 pl-1">Password: aladin123</p>
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10 text-[11px] text-red-200/30">
          &copy; {new Date().getFullYear()} ALADIN Vietnam. All rights reserved.
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex flex-col justify-center px-6 py-8 relative z-10">
        <div className="max-w-sm mx-auto w-full">
          {/* Mobile Logo */}
          <div className={`lg:hidden text-center mb-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
            <div className="inline-flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-700 text-yellow-400 shadow-lg shadow-red-600/25">
                  <span className="text-3xl font-black">A</span>
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
                  <Sparkles className="w-3 h-3 text-red-700" />
                </div>
              </div>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">ALADIN</h1>
            <p className="text-xs text-neutral-500 mt-1">AI-Powered B2B Commerce</p>
          </div>

          {/* Form Card */}
          <div className={`transition-all duration-700 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white tracking-tight">Welcome back</h2>
              <p className="text-sm text-neutral-500 mt-1.5">
                Sign in to your ALADIN account
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl p-3.5 flex items-start gap-2.5 animate-[shake_0.4s_ease-in-out]">
                  <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-xs font-bold">!</span>
                  </div>
                  <span>{error}</span>
                </div>
              )}

              {/* Phone Field */}
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium text-neutral-300">Phone Number</label>
                <div className="relative group">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-neutral-500 group-focus-within:text-yellow-400 transition-colors duration-200" />
                  <input
                    id="phone"
                    type="tel"
                    placeholder="0912 345 678"
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-neutral-600
                      focus:outline-none focus:border-yellow-400/40 focus:bg-white/[0.06] focus:ring-2 focus:ring-yellow-400/10
                      transition-all duration-200 text-sm"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    inputMode="numeric"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-neutral-300">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-neutral-500 group-focus-within:text-yellow-400 transition-colors duration-200" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="w-full h-12 pl-11 pr-12 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-neutral-600
                      focus:outline-none focus:border-yellow-400/40 focus:bg-white/[0.06] focus:ring-2 focus:ring-yellow-400/10
                      transition-all duration-200 text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-yellow-400 transition-colors duration-200"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl font-semibold text-sm text-red-700
                  bg-gradient-to-r from-yellow-400 via-yellow-400 to-yellow-500
                  hover:from-yellow-300 hover:via-yellow-300 hover:to-yellow-400
                  active:scale-[0.98]
                  shadow-lg shadow-yellow-400/20 hover:shadow-yellow-400/30
                  transition-all duration-200
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                  relative overflow-hidden group"
              >
                {/* Shimmer on hover */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${!loading ? 'animate-[shimmer_2.5s_infinite]' : ''}`}
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                  }}
                />
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </span>
              </button>
            </form>

            {/* Mobile-only demo accounts */}
            <div className="lg:hidden mt-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-600 text-center mb-3">
                Quick Demo Access
              </p>
              <div className="space-y-1.5">
                {DEMO_ACCOUNTS.slice(0, 3).map((demo) => (
                  <button
                    key={demo.phone}
                    type="button"
                    onClick={() => fillDemo(demo.phone)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl border border-white/[0.06] text-left transition-all duration-200
                      ${fillAnimation === demo.phone
                        ? 'bg-yellow-400/10 border-yellow-400/20'
                        : 'hover:bg-white/[0.04]'
                      }`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors duration-200
                      ${fillAnimation === demo.phone ? 'bg-yellow-400' : 'bg-white/[0.06]'}`}>
                      <demo.icon className={`h-4 w-4 transition-colors duration-200
                        ${fillAnimation === demo.phone ? 'text-red-700' : 'text-neutral-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white">{demo.role}</span>
                      <span className="text-[10px] text-neutral-600 font-mono ml-2">{demo.phone}</span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-neutral-600 text-center mt-2">Password: aladin123</p>
            </div>

            {/* Footer link */}
            <p className="text-xs text-center text-neutral-600 mt-8">
              Mobile app?{' '}
              <Link href="/m/login" className="text-yellow-400/70 font-medium hover:text-yellow-400 transition-colors duration-200">
                Open mobile version
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Global CSS Animations */}
      <style dangerouslySetInnerHTML={{ __html: `@keyframes shake{0%,100%{transform:translateX(0)}10%,30%,50%,70%,90%{transform:translateX(-4px)}20%,40%,60%,80%{transform:translateX(4px)}}@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}` }} />
    </div>
  );
}

export default function AuthLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}