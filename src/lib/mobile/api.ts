// ALADIN Mobile API Client
// Thin wrapper around fetch with auth token injection and refresh logic

import { useAuthStore } from '@/stores/auth.store';

// ============================================
// Types
// ============================================

interface ApiOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
  skipAuth?: boolean;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// ============================================
// Base URL
// ============================================

const API_BASE = '/api';

// ============================================
// Token helpers
// ============================================

function getAccessToken(): string | null {
  try {
    return localStorage.getItem('aladin-access-token');
  } catch {
    return null;
  }
}

function getRefreshToken(): string | null {
  try {
    return localStorage.getItem('aladin-refresh-token');
  } catch {
    return null;
  }
}

// ============================================
// Refresh token flow
// ============================================

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = getRefreshToken();
      if (!refreshToken) return false;

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const json = await res.json();
      if (json.success && json.data?.accessToken) {
        try {
          localStorage.setItem('aladin-access-token', json.data.accessToken);
          if (json.data.refreshToken) {
            localStorage.setItem('aladin-refresh-token', json.data.refreshToken);
          }
        } catch {}
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// ============================================
// Core fetch wrapper
// ============================================

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: ApiOptions = {}
): Promise<ApiResponse<T>> {
  const { params, skipAuth, ...fetchOptions } = options;

  // Build URL with query params
  let url = `${API_BASE}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    // Handle 401 — try refresh
    if (res.status === 401 && !skipAuth) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        const newToken = getAccessToken();
        if (newToken) {
          headers['Authorization'] = `Bearer ${newToken}`;
        }
        const retryRes = await fetch(url, { ...fetchOptions, headers });
        const retryJson = await retryRes.json();
        return retryJson as ApiResponse<T>;
      }
      // Refresh failed — logout
      useAuthStore.getState().logout();
      return { success: false, error: { code: 'AUTH_REQUIRED', message: 'Please login again' } };
    }

    const json = await res.json();
    return json as ApiResponse<T>;
  } catch (err) {
    console.error('API fetch error:', err);
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Kiểm tra kết nối mạng và thử lại' },
    };
  }
}

// ============================================
// Convenience methods
// ============================================

export const api = {
  get: <T = unknown>(endpoint: string, params?: Record<string, string | number | undefined>) =>
    apiFetch<T>(endpoint, { method: 'GET', params }),

  post: <T = unknown>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),

  put: <T = unknown>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),

  patch: <T = unknown>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),

  delete: <T = unknown>(endpoint: string, body?: unknown) =>
    apiFetch<T>(endpoint, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
};

export type { ApiResponse };
