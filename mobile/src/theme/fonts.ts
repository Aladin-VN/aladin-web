/**
 * ALADIN B2B Mobile — Font Configuration
 *
 * Uses Inter as the primary typeface.
 * Call `loadFonts()` in your root layout before rendering the app.
 */

import { useFonts as useExpoFonts } from 'expo-font';

/**
 * Inter font definitions for expo-font.
 * Add font files to `assets/fonts/` and uncomment entries as needed.
 *
 * To download Inter: https://rsms.me/inter/#download
 * Place .ttf files in `/assets/fonts/`:
 *   - Inter-Regular.ttf
 *   - Inter-Medium.ttf
 *   - Inter-SemiBold.ttf
 *   - Inter-Bold.ttf
 */
export const INTER_FONTS = {
  'Inter-Regular': require('../../assets/fonts/Inter-Regular.ttf'),
  'Inter-Medium': require('../../assets/fonts/Inter-Medium.ttf'),
  'Inter-SemiBold': require('../../assets/fonts/Inter-SemiBold.ttf'),
  'Inter-Bold': require('../../assets/fonts/Inter-Bold.ttf'),
} as const;

export type InterFontWeight = keyof typeof INTER_FONTS;

/** Font weight mapping for React Native's fontFamily + fontWeight API */
export const FontWeights = {
  Regular: '400' as const,
  Medium: '500' as const,
  SemiBold: '600' as const,
  Bold: '700' as const,
} as const;

export type FontWeight = keyof typeof FontWeights;

/** Font size scale — consistent with Tailwind's text sizing */
export const FontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

/** Line height ratios paired with font sizes */
export const LineHeights = {
  xs: 16,
  sm: 20,
  base: 24,
  lg: 28,
  xl: 28,
  '2xl': 32,
  '3xl': 36,
  '4xl': 40,
} as const;

/**
 * Hook to load Inter fonts via expo-font.
 *
 * @example
 * ```tsx
 * const [fontsLoaded] = useFonts();
 * if (!fontsLoaded) return <AppLoading />;
 * return <App />;
 * ```
 */
export function useFonts(): [boolean, Error | null] {
  return useExpoFonts(INTER_FONTS);
}

/** Re-export for convenience when combining with other font sources */
export { useExpoFonts };
