import { create } from 'zustand';
import type { Locale } from '@/src/i18n';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'vi',
  setLocale: (locale) => set({ locale }),
}));
