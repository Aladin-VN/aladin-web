// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Auth Store (Zustand)
// ─────────────────────────────────────────────────────────────────────
//
// Persisted storage strategy:
//   • Tokens  → expo-secure-store (encrypted)
//   • User info → @react-native-async-storage/async-storage (JSON)
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import {
  ASYNC_STORAGE_USER_KEY,
  SECURE_STORE_ACCESS_TOKEN_KEY,
  SECURE_STORE_REFRESH_TOKEN_KEY,
} from '@/src/constants';

// ─── Types ──────────────────────────────────────────────────────────

export interface AuthUser {
  userId: string;
  phone: string;
  name: string;
  role: string;
  shopId: string;
  shopName: string;
}

export interface AuthState {
  /** Currently authenticated user (null when logged out) */
  user: AuthUser | null;

  /** Whether the user has an active, verified session */
  isAuthenticated: boolean;

  /** True while an auth check (e.g. bootstrap / refresh) is in-flight */
  isLoading: boolean;

  /** Server flag — user must change password before proceeding */
  mustChangePassword: boolean;

  // ── Actions ──
  setUser: (user: AuthUser) => void;
  clearUser: () => void;
  setLoading: (loading: boolean) => void;
  setMustChangePassword: (value: boolean) => void;
  hydrate: () => Promise<void>;
}

// ─── Token Helpers ──────────────────────────────────────────────────

/** Retrieve the stored access token (or null) */
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_ACCESS_TOKEN_KEY);
}

/** Retrieve the stored refresh token (or null) */
export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY);
}

/** Persist both tokens */
export async function setTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(SECURE_STORE_ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

/** Remove both tokens */
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_STORE_ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY),
  ]);
}

// ─── Store ──────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // start as loading until hydration completes
  mustChangePassword: false,

  setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),

  clearUser: () => {
    // Fire-and-forget token & user cleanup
    clearTokens().catch(() => {});
    AsyncStorage.removeItem(ASYNC_STORAGE_USER_KEY).catch(() => {});
    set({
      user: null,
      isAuthenticated: false,
      mustChangePassword: false,
    });
  },

  setLoading: (isLoading) => set({ isLoading }),

  setMustChangePassword: (value) => set({ mustChangePassword: value }),

  /**
   * Hydrate auth state from persisted storage on app boot.
   * Reads user info from AsyncStorage; tokens remain in SecureStore.
   */
  hydrate: async () => {
    set({ isLoading: true });
    try {
      const raw = await AsyncStorage.getItem(ASYNC_STORAGE_USER_KEY);
      if (raw) {
        const user: AuthUser = JSON.parse(raw);
        set({ user, isAuthenticated: true, isLoading: false });
        return;
      }
      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch {
      // Corrupted stored data — treat as unauthenticated
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
