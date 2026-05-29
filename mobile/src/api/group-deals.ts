// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Group Deals API
// ─────────────────────────────────────────────────────────────────────

import { apiClient } from './client';
import type { PaginatedResponse, Product } from './products';

// ─── Types ──────────────────────────────────────────────────────────

export type GroupDealStatus =
  | 'upcoming'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface GroupDeal {
  dealId: string;
  title: string;
  titleEn?: string;
  description?: string;
  descriptionEn?: string;
  product: Product;
  groupPrice: number;
  originalPrice: number;
  minParticipants: number;
  currentParticipants: number;
  maxParticipants?: number;
  status: GroupDealStatus;
  startDate: string;
  endDate: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetGroupDealsParams {
  search?: string;
  status?: GroupDealStatus | '';
  page?: number;
  limit?: number;
}

export interface GroupDealDetailResponse {
  success: true;
  data: GroupDeal;
}

export interface JoinGroupDealPayload {
  quantity: number;
  notes?: string;
}

export interface JoinGroupDealResponse {
  success: true;
  data: {
    participationId: string;
    dealId: string;
    quantity: number;
    groupPrice: number;
    estimatedTotal: number;
    message: string;
  };
}

export interface GroupDealStats {
  activeDeals: number;
  upcomingDeals: number;
  completedDeals: number;
  totalSaved: number;
}

export interface GroupDealStatsResponse {
  success: true;
  data: GroupDealStats;
}

// ─── Endpoints ──────────────────────────────────────────────────────

/** GET /api/group-deals */
export async function getGroupDeals(
  params?: GetGroupDealsParams,
): Promise<PaginatedResponse<GroupDeal>> {
  const { data } = await apiClient.get<PaginatedResponse<GroupDeal>>(
    '/api/group-deals',
    { params },
  );
  return data;
}

/** GET /api/group-deals/:id */
export async function getGroupDealDetail(
  id: string,
): Promise<GroupDealDetailResponse> {
  const { data } = await apiClient.get<GroupDealDetailResponse>(
    `/api/group-deals/${id}`,
  );
  return data;
}

/** POST /api/group-deals/:id/join */
export async function joinGroupDeal(
  id: string,
  payload: JoinGroupDealPayload,
): Promise<JoinGroupDealResponse> {
  const { data } = await apiClient.post<JoinGroupDealResponse>(
    `/api/group-deals/${id}/join`,
    payload,
  );
  return data;
}

/** GET /api/group-deals/stats */
export async function getGroupDealStats(): Promise<GroupDealStatsResponse> {
  const { data } = await apiClient.get<GroupDealStatsResponse>(
    '/api/group-deals/stats',
  );
  return data;
}
