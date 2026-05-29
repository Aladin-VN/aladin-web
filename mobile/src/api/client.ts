// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Axios API Client
// ─────────────────────────────────────────────────────────────────────

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import * as SecureStore from 'expo-secure-store';

import {
  API_BASE_URL,
  SECURE_STORE_ACCESS_TOKEN_KEY,
  SECURE_STORE_REFRESH_TOKEN_KEY,
} from '@/src/constants';

// ─── Types ──────────────────────────────────────────────────────────

/** Normalised error returned by every failed API call */
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

/** Shape returned by the refresh endpoint */
interface RefreshResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token!);
    }
  });
  failedQueue = [];
}

/** Persist an auth token to SecureStore */
export async function setAuthToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_ACCESS_TOKEN_KEY, token);
}

/** Persist a refresh token to SecureStore */
async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY, token);
}

/** Store both tokens at once (convenience) */
export async function setAuthTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(SECURE_STORE_ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

/** Remove both tokens from SecureStore */
export async function clearAuthTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_STORE_ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(SECURE_STORE_REFRESH_TOKEN_KEY),
  ]);
}

// ─── Axios Instance ─────────────────────────────────────────────────

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Request Interceptor ────────────────────────────────────────────

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync(SECURE_STORE_ACCESS_TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor ───────────────────────────────────────────

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<unknown>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Only attempt refresh on 401 responses (and not if already retried)
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue the request while a refresh is already in-flight
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(apiClient(originalRequest));
            },
            reject,
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const currentRefreshToken = await SecureStore.getItemAsync(
          SECURE_STORE_REFRESH_TOKEN_KEY,
        );

        if (!currentRefreshToken) {
          throw new Error('No refresh token available');
        }

        // Call refresh endpoint (using a raw axios call to avoid interceptor loop)
        const { data } = await axios.post<RefreshResponse>(
          `${API_BASE_URL}/api/auth/refresh`,
          { refreshToken: currentRefreshToken },
          { headers: { 'Content-Type': 'application/json' } },
        );

        const { accessToken, refreshToken } = data.data;
        await setAuthTokens(accessToken, refreshToken);

        processQueue(null, accessToken);

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        await clearAuthTokens();

        // Redirect to login — dispatch a custom event so the app can listen
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:session-expired'));
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Normalise non-401 errors
    return Promise.reject(normaliseError(error));
  },
);

// ─── Error Normalisation ────────────────────────────────────────────

function normaliseError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const response = error.response?.data as
      | { error?: { code?: string; message?: string } }
      | undefined;

    const code =
      response?.error?.code ??
      (error.response?.status?.toString() ?? 'UNKNOWN_ERROR');

    const message =
      response?.error?.message ??
      error.message ??
      'An unexpected error occurred';

    return { success: false, error: { code, message } };
  }

  if (error instanceof Error) {
    return {
      success: false,
      error: { code: 'UNKNOWN_ERROR', message: error.message },
    };
  }

  return {
    success: false,
    error: { code: 'UNKNOWN_ERROR', message: 'An unexpected error occurred' },
  };
}

export { apiClient };
export default apiClient;
