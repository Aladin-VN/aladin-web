// ALADIN Security Utilities
// Production-grade security for B2B commerce platform

import crypto from 'crypto';

// ============================================
// DATA MASKING (Show/Hide sensitive data)
// ============================================

/** Mask phone number: 0912 345 678 → 0912 *** 678 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '***';
  const clean = phone.replace(/\D/g, '');
  return clean.slice(0, 4) + ' *** ' + clean.slice(-3);
}

/** Mask name: Nguyen Van A → Nguyen V*** */
export function maskName(name: string): string {
  if (!name) return '***';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0] + '***';
  return parts.slice(0, -1).join(' ') + ' ' + parts[parts.length - 1][0] + '***';
}

/** Mask monetary amount: 2500000 → 2.500.000 ₫ (formatted) */
export function formatVND(amount: number): string {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('vi-VN').format(num) + ' ₫';
}

/** Mask monetary amount partially: 2.***.000 ₫ */
export function maskAmount(amount: number): string {
  const formatted = new Intl.NumberFormat('vi-VN').format(amount);
  const parts = formatted.split('.');
  if (parts.length <= 1) return '*** ₫';
  return parts[0] + '.' + '*'.repeat(parts[parts.length - 1].length - 2) + parts[parts.length - 1].slice(-2) + ' ₫';
}

/** Mask ID: cuid → cu...id */
export function maskId(id: string): string {
  if (!id || id.length < 8) return '***';
  return id.slice(0, 2) + '...' + id.slice(-2);
}

// ============================================
// IDEMPOTENCY KEYS (Prevent double-orders on 3G)
// ============================================

export function generateIdempotencyKey(userId: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  const random = crypto.randomBytes(16).toString('hex');
  return `${userId}-${ts}-${random}`;
}

// ============================================
// INPUT VALIDATION & SANITIZATION
// ============================================

/** Validate Vietnamese phone number (09xx, 03xx, 07xx, 08xx, 05xx) */
export function isValidVNPhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return /^(0[35789])[0-9]{8}$/.test(clean);
}

/** Sanitize string input (prevent XSS) */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/** Validate VND amount (must be positive integer) */
export function isValidVNDAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount > 0 && amount <= 100_000_000_000; // Max 100 billion VND
}

/** Validate credit limit range (500K - 10M VND) */
export function isValidCreditLimit(limit: number): boolean {
  return Number.isInteger(limit) && limit >= 500_000 && limit <= 10_000_000;
}

// ============================================
// RATE LIMITING (In-memory, per IP/User)
// ============================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

export function rateLimit(
  identifier: string,
  options: { maxRequests: number; windowMs: number } = { maxRequests: 100, windowMs: 60 * 1000 }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.maxRequests - 1, resetAt: now + options.windowMs };
  }

  if (entry.count >= options.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: options.maxRequests - entry.count, resetAt: entry.resetAt };
}

// ============================================
// API RESPONSE STANDARD (Consistent format)
// ============================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export function successResponse<T>(data: T, meta?: ApiResponse['meta']): ApiResponse<T> {
  return { success: true, data, meta };
}

export function errorResponse(code: string, message: string, details?: unknown): ApiResponse {
  return {
    success: false,
    error: { code, message, details },
  };
}

// ============================================
// CONSTANTS
// ============================================

export const ROLES = {
  ADMIN: 'ADMIN',
  SHOP_OWNER: 'SHOP_OWNER',
  SALES_REP: 'SALES_REP',
  DRIVER: 'DRIVER',
  BROKER: 'BROKER',
} as const;

export const ORDER_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PROCESSING: 'PROCESSING',
  PACKED: 'PACKED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const;

export const PAYMENT_METHOD = {
  CREDIT: 'CREDIT',
  DIGITAL: 'DIGITAL',
  COD: 'COD',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

export const TRANSACTION_TYPES = {
  CREDIT_USED: 'CREDIT_USED',
  REPAYMENT: 'REPAYMENT',
  CREDIT_LIMIT_INCREASE: 'CREDIT_LIMIT_INCREASE',
  CREDIT_LIMIT_DECREASE: 'CREDIT_LIMIT_DECREASE',
  ORDER_PAYMENT: 'ORDER_PAYMENT',
  REFUND: 'REFUND',
} as const;

export const GROUP_DEAL_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export const SHIPMENT_STATUS = {
  PENDING: 'PENDING',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
} as const;

export const LOYALTY_TIERS = {
  BRONZE: { name: 'Bronze', minOrders: 0, discount: 0 },
  SILVER: { name: 'Silver', minOrders: 6, discount: 0.03 },
  GOLD: { name: 'Gold', minOrders: 16, discount: 0.05 },
  PLATINUM: { name: 'Platinum', minOrders: 31, discount: 0.08 },
} as const;

export const BROKER_TIERS = {
  WARD_LEVEL: 'WARD_LEVEL',
  CATEGORY_SPECIALIST: 'CATEGORY_SPECIALIST',
  FACTORY_GATE: 'FACTORY_GATE',
} as const;

// Credit system constants
export const CREDIT_CONFIG = {
  DEFAULT_LIMIT: 1_000_000,       // 1M VND default
  MIN_LIMIT: 500_000,             // 500K VND minimum
  MAX_LIMIT: 10_000_000,          // 10M VND maximum
  CREDIT_DAYS: 7,                 // 7-day repayment window
  REMINDER_DAY: 5,               // Remind on Day 5
  PAY_NOW_DISCOUNT: 0.02,         // 2% instant discount for digital payment
} as const;
