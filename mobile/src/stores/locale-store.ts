// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Locale Store (Zustand)
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import {
  ASYNC_STORAGE_LOCALE_KEY,
  DEFAULT_LOCALE,
  type SupportedLocale,
  SUPPORTED_LOCALES,
} from '@/src/constants';

// ─── Types ──────────────────────────────────────────────────────────

export interface LocaleState {
  locale: SupportedLocale;

  setLocale: (locale: SupportedLocale) => void;
  toggleLocale: () => void;
  hydrate: () => Promise<void>;
}

// ─── Persist helpers ────────────────────────────────────────────────

async function persistLocale(locale: SupportedLocale): Promise<void> {
  try {
    await AsyncStorage.setItem(ASYNC_STORAGE_LOCALE_KEY, locale);
  } catch {
    // Silently ignore storage errors (e.g. web without AsyncStorage polyfill)
  }
}

async function readPersistedLocale(): Promise<SupportedLocale> {
  try {
    const raw = await AsyncStorage.getItem(ASYNC_STORAGE_LOCALE_KEY);
    if (raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
      return raw as SupportedLocale;
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_LOCALE;
}

// ─── Store ──────────────────────────────────────────────────────────

export const useLocaleStore = create<LocaleState>()((set) => ({
  locale: DEFAULT_LOCALE,

  setLocale: (locale) => {
    set({ locale });
    persistLocale(locale);
  },

  toggleLocale: () => {
    set((state) => {
      const next: SupportedLocale = state.locale === 'vi' ? 'en' : 'vi';
      persistLocale(next);
      return { locale: next };
    });
  },

  hydrate: async () => {
    const locale = await readPersistedLocale();
    set({ locale });
  },
}));
