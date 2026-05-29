// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Promotions API
// ─────────────────────────────────────────────────────────────────────

import { apiClient } from './client';
import type { PaginatedResponse } from './products';

// ─── Types ──────────────────────────────────────────────────────────

export type PromotionType = 'percentage' | 'fixed' | 'bogo' | 'free_shipping';
export type PromotionStatus = 'active' | 'upcoming' | 'expired' | 'cancelled';

export interface Promotion {
  promotionId: string;
  title: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;
  type: PromotionType;
  value: number;
  minOrderAmount?: number;
  maxDiscount?: number;
  applicableCategories?: string[];
  applicableProducts?: string[];
  startDate: string;
  endDate: string;
  status: PromotionStatus;
  usageCount: number;
  usageLimit?: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetPromotionsParams {
  search?: string;
  type?: PromotionType | '';
  status?: PromotionStatus | '';
  page?: number;
  limit?: number;
}

// ─── Endpoints ──────────────────────────────────────────────────────

/** GET /api/promotions */
export async function getPromotions(
  params?: GetPromotionsParams,
): Promise<PaginatedResponse<Promotion>> {
  const { data } = await apiClient.get<PaginatedResponse<Promotion>>(
    '/api/promotions',
    { params },
  );
  return data;
}
