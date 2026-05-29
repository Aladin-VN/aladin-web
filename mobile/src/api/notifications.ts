// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Notifications API (Push Registration Stub)
// ─────────────────────────────────────────────────────────────────────

import { apiClient } from './client';

// ─── Types ──────────────────────────────────────────────────────────

export interface RegisterPushTokenPayload {
  token: string;
  platform: 'ios' | 'android';
  deviceId?: string;
}

export interface RegisterPushTokenResponse {
  success: true;
  data: {
    message: string;
  };
}

// ─── Endpoints ──────────────────────────────────────────────────────

/**
 * POST /api/notifications/register-token
 *
 * Registers the device's push notification token with the backend so the
 * server can send push notifications to this device.
 *
 * @param token — Expo push token string
 * @param platform — Device platform ('ios' | 'android')
 * @param deviceId — Optional device identifier for targeting
 */
export async function registerPushToken(
  token: string,
  platform: 'ios' | 'android',
  deviceId?: string,
): Promise<RegisterPushTokenResponse> {
  const { data } = await apiClient.post<RegisterPushTokenResponse>(
    '/api/notifications/register-token',
    { token, platform, deviceId } satisfies RegisterPushTokenPayload,
  );
  return data;
}
