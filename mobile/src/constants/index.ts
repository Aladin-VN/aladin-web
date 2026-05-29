// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — App Constants
// ─────────────────────────────────────────────────────────────────────

/** Base URL for the ALADIN B2B API */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.aladin.vn';

/** SecureStore key for the access token */
export const SECURE_STORE_ACCESS_TOKEN_KEY = 'aladin_access_token';

/** SecureStore key for the refresh token */
export const SECURE_STORE_REFRESH_TOKEN_KEY = 'aladin_refresh_token';

/** AsyncStorage key prefix for persisted stores */
export const ASYNC_STORAGE_PREFIX = 'aladin:';

/** AsyncStorage key for locale preference */
export const ASYNC_STORAGE_LOCALE_KEY = `${ASYNC_STORAGE_PREFIX}locale`;

/** AsyncStorage key for cart items */
export const ASYNC_STORAGE_CART_KEY = `${ASYNC_STORAGE_PREFIX}cart`;

/** AsyncStorage key for persisted user info */
export const ASYNC_STORAGE_USER_KEY = `${ASYNC_STORAGE_PREFIX}user`;

/** Default locale */
export const DEFAULT_LOCALE = 'vi' as const;

/** Supported locales */
export const SUPPORTED_LOCALES = ['vi', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Pagination defaults */
export const DEFAULT_PAGE_SIZE = 20;

/** Order statuses */
export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
