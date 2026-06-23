// Shared fetch helper for admin pages — automatically attaches auth token
// Auto-refreshes expired access tokens using refresh token
// Returns parsed JSON (not raw Response)
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('aladin-refresh-token');
  if (!refreshToken) return false;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json = await res.json();
    if (json.success && json.data?.accessToken) {
      localStorage.setItem('aladin-access-token', json.data.accessToken);
      if (json.data.refreshToken) {
        localStorage.setItem('aladin-refresh-token', json.data.refreshToken);
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function adminFetch(url: string, options: RequestInit = {}): Promise<any> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('aladin-access-token') : null;
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // Ensure content-type for POST/PUT/PATCH
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, { ...options, headers }).then(async (res) => {
    // If 401, try to refresh token and retry once
    if (res.status === 401 && typeof window !== 'undefined') {
      // Avoid parallel refresh calls
      if (!refreshPromise) {
        refreshPromise = tryRefreshToken();
      }
      const refreshed = await refreshPromise;
      refreshPromise = null;

      if (refreshed) {
        const newToken = localStorage.getItem('aladin-access-token');
        headers.set('Authorization', `Bearer ${newToken}`);
        const retryRes = await fetch(url, { ...options, headers });
        return retryRes.json();
      }
    }
    return res.json();
  });
}