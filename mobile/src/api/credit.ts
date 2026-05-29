// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Credit API
// ─────────────────────────────────────────────────────────────────────

import { apiClient } from './client';
import type { PaginatedResponse } from './products';

// ─── Types ──────────────────────────────────────────────────────────

export type CreditTransactionType = 'purchase' | 'repayment' | 'adjustment';

export interface CreditSummary {
  shopId: string;
  shopName: string;
  totalCredit: number;
  usedCredit: number;
  availableCredit: number;
  outstandingBalance: number;
  creditLimit: number;
}

export interface CreditTransaction {
  transactionId: string;
  shopId: string;
  type: CreditTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  orderId?: string;
  orderNumber?: string;
  description?: string;
  createdAt: string;
}

export interface CreditSummaryResponse {
  success: true;
  data: CreditSummary;
}

export interface GetCreditTransactionsParams {
  shopId?: string;
  type?: CreditTransactionType | '';
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface RepayCreditPayload {
  shopId: string;
  amount: number;
  paymentMethod: string;
  reference?: string;
  notes?: string;
}

export interface RepayCreditResponse {
  success: true;
  data: {
    transaction: CreditTransaction;
    newBalance: number;
    message: string;
  };
}

// ─── Endpoints ──────────────────────────────────────────────────────

/** GET /api/credit/summary */
export async function getCreditSummary(
  shopId: string,
): Promise<CreditSummaryResponse> {
  const { data } = await apiClient.get<CreditSummaryResponse>(
    '/api/credit/summary',
    { params: { shopId } },
  );
  return data;
}

/** GET /api/credit/transactions */
export async function getCreditTransactions(
  params?: GetCreditTransactionsParams,
): Promise<PaginatedResponse<CreditTransaction>> {
  const { data } = await apiClient.get<PaginatedResponse<CreditTransaction>>(
    '/api/credit/transactions',
    { params },
  );
  return data;
}

/** POST /api/credit/repay */
export async function repayCredit(
  payload: RepayCreditPayload,
): Promise<RepayCreditResponse> {
  const { data } = await apiClient.post<RepayCreditResponse>(
    '/api/credit/repay',
    payload,
  );
  return data;
}
