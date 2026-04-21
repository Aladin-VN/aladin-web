// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Dashboard API
// ─────────────────────────────────────────────────────────────────────

import { apiClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  totalCredit: number;
  upcomingGroupDeals: number;
  activePromotions: number;
}

export interface DashboardStatsResponse {
  success: true;
  data: DashboardStats;
}

// ─── Endpoints ──────────────────────────────────────────────────────

/** GET /api/dashboard/stats */
export async function getDashboardStats(): Promise<DashboardStatsResponse> {
  const { data } = await apiClient.get<DashboardStatsResponse>(
    '/api/dashboard/stats',
  );
  return data;
}
