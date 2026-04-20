// ALADIN Payment Gateway Configuration
// Sprint 4F — ZaloPay / MoMo / Mock integration

export type PaymentGatewayType = 'ZALOPAY' | 'MOMO' | 'MOCK';

// ============================================
// ZALOPAY CONFIGURATION
// ============================================

export const ZALOPAY_CONFIG = {
  APP_ID: process.env.ZALOPAY_APP_ID || '',
  KEY1: process.env.ZALOPAY_KEY1 || '',
  KEY2: process.env.ZALOPAY_KEY2 || '',
  CREATE_ORDER_URL: process.env.ZALOPAY_CREATE_ORDER_URL || 'https://openapi.zalopay.com/v2/create',
  QUERY_URL: process.env.ZALOPAY_QUERY_URL || 'https://openapi.zalopay.com/v2/query',
  CALLBACK_URL: process.env.ZALOPAY_CALLBACK_URL || '/api/payments/zalopay/callback',
} as const;

// ============================================
// MOMO CONFIGURATION
// ============================================

export const MOMO_CONFIG = {
  PARTNER_CODE: process.env.MOMO_PARTNER_CODE || '',
  ACCESS_KEY: process.env.MOMO_ACCESS_KEY || '',
  SECRET_KEY: process.env.MOMO_SECRET_KEY || '',
  CREATE_URL: process.env.MOMO_CREATE_URL || 'https://test-payment.momo.vn/v2/gateway/payment/create',
  QUERY_URL: process.env.MOMO_QUERY_URL || 'https://test-payment.momo.vn/v2/gateway/payment/query',
  CALLBACK_URL: process.env.MOMO_CALLBACK_URL || '/api/payments/momo/callback',
  IPN_URL: process.env.MOMO_IPN_URL || '/api/payments/momo/callback',
} as const;

// ============================================
// PAYMENT GENERAL CONFIGURATION
// ============================================

export const PAYMENT_CONFIG = {
  // Payment link expiry: 15 minutes
  EXPIRY_MINUTES: 15,

  // API call timeout: 10 seconds
  API_TIMEOUT_MS: 10_000,

  // Dev mode: use mock gateway when no real credentials configured
  isDevMode(): boolean {
    return process.env.NODE_ENV === 'development';
  },

  // Check if ZaloPay is properly configured
  isZaloPayConfigured(): boolean {
    return !!(ZALOPAY_CONFIG.APP_ID && ZALOPAY_CONFIG.KEY1 && ZALOPAY_CONFIG.KEY2);
  },

  // Check if MoMo is properly configured
  isMoMoConfigured(): boolean {
    return !!(MOMO_CONFIG.PARTNER_CODE && MOMO_CONFIG.ACCESS_KEY && MOMO_CONFIG.SECRET_KEY);
  },

  // Resolve the effective gateway (fallback to MOCK in dev if not configured)
  resolveGateway(requested: PaymentGatewayType): PaymentGatewayType {
    if (requested === 'MOCK') return 'MOCK';
    if (requested === 'ZALOPAY' && this.isZaloPayConfigured()) return 'ZALOPAY';
    if (requested === 'MOMO' && this.isMoMoConfigured()) return 'MOMO';
    if (this.isDevMode()) {
      console.log(`[PAYMENT] Gateway "${requested}" not configured, falling back to MOCK`);
      return 'MOCK';
    }
    return requested;
  },
} as const;
