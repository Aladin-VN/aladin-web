import { create } from 'zustand';

// ============================================
// Types
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
  role: 'ADMIN' | 'SHOP_OWNER' | 'SALES_REP' | 'DRIVER' | 'BROKER';
  shopId?: string;
  email?: string;
  avatarUrl?: string;
  shop?: ShopInfo | null;
}

interface AuthState {
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  setUser: (user: UserInfo) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  login: (userData: UserInfo & { accessToken: string; refreshToken: string }) => void;
  logout: () => void;
  updateProfile: (data: Partial<UserInfo>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  hydrate: () => void;
}

// ============================================
// Storage Keys
// ============================================

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'aladin-access-token',
  REFRESH_TOKEN: 'aladin-refresh-token',
  USER: 'aladin-user',
} as const;

// ============================================
// Store
// ============================================

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  setUser: (user) => set({ user, isAuthenticated: true }),

  setTokens: (accessToken, refreshToken) => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    } catch {}
    set({ accessToken, refreshToken });
  },

  login: (userData) => {
    const { accessToken, refreshToken, ...userInfo } = userData;
    try {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userInfo));
    } catch {}
    set({
      user: userInfo,
      accessToken,
      refreshToken,
      isAuthenticated: true,
      error: null,
      isLoading: false,
    });
  },

  logout: () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    } catch {}
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
      isLoading: false,
    });
  },

  updateProfile: (data) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, ...data };
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
    } catch {}
    set({ user: updated });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),

  hydrate: () => {
    try {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const userData = localStorage.getItem(STORAGE_KEYS.USER);
      if (token && userData) {
        const user = JSON.parse(userData);
        if (user?.userId) {
          set({
            user,
            accessToken: token,
            refreshToken: localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }
    } catch {}
    set({ isLoading: false });
  },
}));
