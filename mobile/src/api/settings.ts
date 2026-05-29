// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Settings API
// ─────────────────────────────────────────────────────────────────────

import { apiClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────

export interface PlatformSettings {
  platformName: string;
  supportPhone?: string;
  supportEmail?: string;
  supportAddress?: string;
  minimumOrderAmount: number;
  creditTerms: string;
  shippingPolicy?: string;
  returnPolicy?: string;
  maintenanceMode: boolean;
  version: string;
}

export interface PlatformSettingsResponse {
  success: true;
  data: PlatformSettings;
}

export interface UpdateProfilePayload {
  name?: string;
  shopName?: string;
  shopAddress?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface UpdateProfileResponse {
  success: true;
  data: {
    user: {
      userId: string;
      phone: string;
      name: string;
      role: string;
      shopId: string;
      shopName: string;
    };
    message: string;
  };
}

// ─── Endpoints ──────────────────────────────────────────────────────

/** GET /api/settings/platform */
export async function getPlatformSettings(): Promise<PlatformSettingsResponse> {
  const { data } = await apiClient.get<PlatformSettingsResponse>(
    '/api/settings/platform',
  );
  return data;
}

/** PATCH /api/users/profile */
export async function updateProfile(
  payload: UpdateProfilePayload,
): Promise<UpdateProfileResponse> {
  const { data } = await apiClient.patch<UpdateProfileResponse>(
    '/api/users/profile',
    payload,
  );
  return data;
}
