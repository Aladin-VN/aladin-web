// ALADIN Payment Gateway Interface
// Sprint 4F — Abstract types for ZaloPay / MoMo / Mock gateways

import crypto from 'crypto';

export interface CreatePaymentRequest {
  orderId: string;        // ALADIN order ID (cuid)
  orderNumber: string;    // ALD-YYYYMMDD-XXX
  amount: number;         // in VND (smallest unit: dong, no decimals)
  description: string;
  shopName: string;
  userId: string;         // for tracking
}

export interface CreatePaymentResult {
  success: boolean;
  paymentUrl?: string;    // redirect URL for user to pay
  qrCodeUrl?: string;     // optional QR code URL
  transactionId?: string; // gateway transaction ID
  gatewayTxId?: string;   // raw gateway transaction ID
  error?: string;
}

export interface PaymentCallback {
  orderId: string;
  transactionId: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  gateway: 'ZALOPAY' | 'MOMO' | 'MOCK';
  rawData: Record<string, unknown>;
}

export interface PaymentQuery {
  orderId: string;
  transactionId: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'EXPIRED';
  gateway: 'ZALOPAY' | 'MOMO' | 'MOCK';
}

// ============================================
// HMAC-SHA256 HELPER
// ============================================

/**
 * Create HMAC-SHA256 signature.
 * Uses Node.js crypto — server-side only.
 */
export function createHmacSha256(key: string, data: string): string {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

/**
 * Fetch with timeout wrapper.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
