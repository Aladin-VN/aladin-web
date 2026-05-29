// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Auth API
// ─────────────────────────────────────────────────────────────────────

import { apiClient, setAuthTokens } from './client';

// ─── Types ──────────────────────────────────────────────────────────

export interface LoginPayload {
  phone: string;
  password: string;
}

export interface RegisterPayload {
  phone: string;
  password: string;
  name: string;
  shopName: string;
  shopAddress?: string;
}

export interface AuthResponse {
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
    accessToken: string;
    refreshToken: string;
  };
}

export interface MeResponse {
  success: true;
  data: {
    user: {
      userId: string;
      phone: string;
      name: string;
      role: string;
      shopId: string;
      shopName: string;
      mustChangePassword?: boolean;
    };
  };
}

export interface RefreshPayload {
  refreshToken: string;
}

export interface RefreshResponse {
  success: true;
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponse {
  success: true;
  data: {
    message: string;
  };
}

// ─── Endpoints ──────────────────────────────────────────────────────

/** POST /api/auth/login */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>(
    '/api/auth/login',
    payload,
  );

  // Persist tokens on successful login
  if (data.success) {
    await setAuthTokens(data.data.accessToken, data.data.refreshToken);
  }

  return data;
}

/** POST /api/auth/register */
export async function register(
  payload: RegisterPayload,
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>(
    '/api/auth/register',
    payload,
  );

  if (data.success) {
    await setAuthTokens(data.data.accessToken, data.data.refreshToken);
  }

  return data;
}

/** GET /api/auth/me */
export async function getMe(): Promise<MeResponse> {
  const { data } = await apiClient.get<MeResponse>('/api/auth/me');
  return data;
}

/** POST /api/auth/refresh */
export async function refreshToken(
  payload: RefreshPayload,
): Promise<RefreshResponse> {
  const { data } = await apiClient.post<RefreshResponse>(
    '/api/auth/refresh',
    payload,
  );
  return data;
}

/** PATCH /api/users/change-password */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResponse> {
  const { data } = await apiClient.patch<ChangePasswordResponse>(
    '/api/users/change-password',
    { currentPassword, newPassword },
  );
  return data;
}
