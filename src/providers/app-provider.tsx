'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// ============================================
// Locale Context — persists to localStorage
// ============================================

interface LocaleContextType {
  locale: string;
  setLocale: (locale: string) => void;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: 'vi',
  setLocale: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}

// ============================================
// Auth Context — persists to localStorage
// ============================================

interface ShopInfo {
  id: string;
  name: string;
  district?: string;
  province: string;
  loyaltyTier: string;
  creditLimit: number;
  creditBalance: number;
  creditStatus: string;
}

interface UserInfo {
  userId: string;
  phone: string;
  name: string;
  role: string;
  shopId?: string;
  shop?: ShopInfo | null;
}

interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  login: (userData: UserInfo & { accessToken: string; refreshToken: string }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  login: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ============================================
// Combined App Provider
// ============================================

export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  // Locale state — default Vietnamese
  const [locale, setLocaleState] = useState('vi');

  // Auth state
  const [user, setUser] = useState<UserInfo | null>(null);

  // Initialize locale from localStorage (client-only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aladin-locale');
      if (saved === 'vi' || saved === 'en') {
        setLocaleState(saved);
        document.documentElement.lang = saved;
      }
    } catch { /* SSR-safe */ }
  }, []);

  // Initialize auth from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('aladin-user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.userId) {
          setUser(parsed);
        }
      }
    } catch { /* SSR-safe */ }
  }, []);

  const setLocale = useCallback((newLocale: string) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem('aladin-locale', newLocale);
    } catch {}
    document.documentElement.lang = newLocale;
  }, []);

  const login = useCallback((userData: UserInfo & { accessToken: string; refreshToken: string }) => {
    const { accessToken, refreshToken, ...userInfo } = userData;
    try {
      localStorage.setItem('aladin-access-token', accessToken);
      localStorage.setItem('aladin-refresh-token', refreshToken);
      localStorage.setItem('aladin-user', JSON.stringify(userInfo));
    } catch {}
    setUser(userInfo);
  }, []);

  const logout = useCallback(async () => {
    // Clear localStorage
    try {
      localStorage.removeItem('aladin-access-token');
      localStorage.removeItem('aladin-refresh-token');
      localStorage.removeItem('aladin-user');
    } catch {}

    // Clear server-side cookie
    try {
      await adminFetch('/api/auth/logout', { method: 'POST' });
    } catch {}

    setUser(null);
    router.replace('/auth/login');
  }, [router]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
        {children}
      </AuthContext.Provider>
    </LocaleContext.Provider>
  );
}