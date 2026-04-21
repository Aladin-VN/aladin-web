// ALADIN Audit Log Library
// Track all admin actions for compliance and security
// Sprint 5H — Settings & Auth Hardening

import { db } from './db';

export interface AuditLogParams {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: Record<string, unknown>;
  req?: Request;
}

// Standard audit actions
export const AUDIT_ACTIONS = {
  // User management
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',
  USER_PASSWORD_CHANGED: 'USER_PASSWORD_CHANGED',
  USER_PASSWORD_RESET: 'USER_PASSWORD_RESET',
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_REACTIVATED: 'USER_REACTIVATED',

  // Settings
  PLATFORM_SETTING_UPDATED: 'PLATFORM_SETTING_UPDATED',
  PLATFORM_SETTING_CREATED: 'PLATFORM_SETTING_CREATED',

  // Order management
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_STATUS_CHANGED: 'ORDER_STATUS_CHANGED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',

  // Shop management
  SHOP_CREDIT_LIMIT_CHANGED: 'SHOP_CREDIT_LIMIT_CHANGED',
  SHOP_CREDIT_STATUS_CHANGED: 'SHOP_CREDIT_STATUS_CHANGED',
  SHOP_UPDATED: 'SHOP_UPDATED',

  // Shipment
  SHIPMENT_STATUS_CHANGED: 'SHIPMENT_STATUS_CHANGED',

  // Credit
  CREDIT_REPAYMENT: 'CREDIT_REPAYMENT',
  CREDIT_ADJUSTMENT: 'CREDIT_ADJUSTMENT',
  CREDIT_OVERDUE_PROCESSED: 'CREDIT_OVERDUE_PROCESSED',

  // Login/Security
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',
} as const;

// Audit entity types
export const AUDIT_ENTITIES = {
  USER: 'User',
  SHOP: 'Shop',
  ORDER: 'Order',
  PRODUCT: 'Product',
  SHIPMENT: 'Shipment',
  BROKER: 'Broker',
  PROMOTION: 'Promotion',
  GROUP_DEAL: 'GroupDeal',
  PLATFORM_SETTING: 'PlatformSetting',
  CREDIT: 'Credit',
  AUTH: 'Auth',
} as const;

/**
 * Log an audit action. This is non-blocking — errors are caught and logged to console.
 * Should be called with `await logAction(...)` but errors won't propagate.
 */
export async function logAction(params: AuditLogParams): Promise<void> {
  try {
    const { userId, action, entity, entityId, details, req } = params;

    // Extract IP and user agent from request if available
    let ipAddress: string | undefined;
    let userAgent: string | undefined;

    if (req) {
      // In Next.js API routes, headers may be a Headers object or plain object
      const headers = req instanceof Request ? req.headers : (req as unknown as { headers?: Record<string, string | string[] | undefined> }).headers;
      if (headers) {
        const forwarded = headers['x-forwarded-for'];
        if (typeof forwarded === 'string') {
          ipAddress = forwarded.split(',')[0]?.trim();
        } else if (Array.isArray(forwarded)) {
          ipAddress = forwarded[0]?.trim();
        }
        if (!ipAddress) {
          const realIp = headers['x-real-ip'];
          ipAddress = typeof realIp === 'string' ? realIp : undefined;
        }

        const ua = headers['user-agent'];
        userAgent = typeof ua === 'string' ? ua : undefined;
      }
    }

    await db.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entity,
        entityId: entityId || null,
        details: details ? JSON.stringify(details) : null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });
  } catch (error) {
    // Audit logging should NEVER crash the application
    console.error('[AUDIT LOG ERROR]', error);
  }
}

/**
 * Seed default platform settings if they don't exist.
 * Called once during setup.
 */
export async function seedPlatformSettings(): Promise<void> {
  const defaults: { key: string; value: string; description: string; category: string }[] = [
    // Platform
    { key: 'platform.name', value: 'ALADIN', description: 'Platform display name', category: 'general' },
    { key: 'platform.tagline', value: 'AI B2B Commerce Platform', description: 'Platform tagline', category: 'general' },
    { key: 'platform.province', value: 'Binh Duong', description: 'Default operating province', category: 'general' },
    { key: 'platform.currency', value: 'VND', description: 'Default currency', category: 'general' },
    { key: 'platform.locale', value: 'vi', description: 'Default locale (vi/en)', category: 'general' },

    // Credit system
    { key: 'credit.defaultLimit', value: '1000000', description: 'Default credit limit in VND', category: 'credit' },
    { key: 'credit.maxLimit', value: '10000000', description: 'Maximum credit limit in VND', category: 'credit' },
    { key: 'credit.minLimit', value: '500000', description: 'Minimum credit limit in VND', category: 'credit' },
    { key: 'credit.creditDays', value: '7', description: 'Credit repayment window in days', category: 'credit' },
    { key: 'credit.reminderDay', value: '5', description: 'Day to send reminder before due', category: 'credit' },
    { key: 'credit.autoLock', value: 'true', description: 'Auto-lock shops after credit days', category: 'credit' },
    { key: 'credit.payNowDiscount', value: '0.02', description: 'Discount % for immediate digital payment', category: 'credit' },
    { key: 'credit.codFee', value: '15000', description: 'COD delivery fee in VND', category: 'credit' },

    // Notifications
    { key: 'notification.orderConfirmed', value: 'true', description: 'Send Zalo notification on order confirmed', category: 'notification' },
    { key: 'notification.orderDelivered', value: 'true', description: 'Send Zalo notification on order delivered', category: 'notification' },
    { key: 'notification.orderCancelled', value: 'true', description: 'Send Zalo notification on order cancelled', category: 'notification' },
    { key: 'notification.creditReminder', value: 'true', description: 'Send credit payment reminder', category: 'notification' },
    { key: 'notification.creditLocked', value: 'true', description: 'Send credit locked notification', category: 'notification' },

    // Security
    { key: 'security.maxLoginAttempts', value: '10', description: 'Max login attempts before rate limit', category: 'security' },
    { key: 'security.loginWindowMinutes', value: '15', description: 'Rate limit window in minutes', category: 'security' },
    { key: 'security.passwordMinLength', value: '8', description: 'Minimum password length', category: 'security' },
    { key: 'security.sessionTimeoutMinutes', value: '15', description: 'Access token expiry in minutes', category: 'security' },
    { key: 'security.refreshTokenDays', value: '7', description: 'Refresh token expiry in days', category: 'security' },
  ];

  for (const setting of defaults) {
    await db.platformSetting.upsert({
      where: { key: setting.key },
      update: {}, // Don't overwrite existing values
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
        category: setting.category,
      },
    });
  }
}
