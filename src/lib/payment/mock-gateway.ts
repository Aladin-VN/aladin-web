// ALADIN Mock Payment Gateway
// Sprint 4F — Development-only mock gateway for testing

import type { CreatePaymentRequest, CreatePaymentResult, PaymentCallback, PaymentQuery } from './gateway';

// ============================================
// MOCK: CREATE PAYMENT
// ============================================

export async function createMockPayment(request: CreatePaymentRequest): Promise<CreatePaymentResult> {
  const transactionId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const confirmUrl = `/api/payments/mock/confirm?orderId=${request.orderId}&txId=${transactionId}&amount=${request.amount}&gateway=MOCK`;

  return {
    success: true,
    paymentUrl: confirmUrl,
    transactionId,
    gatewayTxId: transactionId,
  };
}

// ============================================
// MOCK: VERIFY CALLBACK
// ============================================

export function verifyMockCallback(data: Record<string, unknown>): PaymentCallback {
  return {
    orderId: (data.orderId as string) || '',
    transactionId: (data.txId as string) || '',
    amount: parseInt((data.amount as string) || '0', 10),
    status: (data.status as 'SUCCESS' | 'FAILED' | 'PENDING') || 'SUCCESS',
    gateway: 'MOCK',
    rawData: data,
  };
}

// ============================================
// MOCK: QUERY STATUS
// ============================================

export async function queryMockStatus(orderId: string): Promise<PaymentQuery> {
  return {
    orderId,
    transactionId: `mock_${orderId}`,
    amount: 0,
    status: 'PENDING',
    gateway: 'MOCK',
  };
}
