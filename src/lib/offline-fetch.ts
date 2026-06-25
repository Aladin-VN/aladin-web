'use client';

// ALADIN Offline-Aware Fetch Wrapper
// Intercepts API calls and queues them when offline

import { enqueue, getQueueCount } from '@/lib/offline-queue';
import { useAppStore } from '@/stores/app.store';

// ============================================
// QUEUEABLE ENDPOINTS
// ============================================

// These endpoints will be queued when offline (POST/PUT/PATCH only)
const QUEUEABLE_ENDPOINTS = [
  { pattern: /\/orders\/?$/, methods: ['POST'] },
  { pattern: /\/orders\/[^/]+\/cancel/, methods: ['POST'] },
  { pattern: /\/sales-rep\/check-in/, methods: ['POST'] },
  { pattern: /\/sales-rep\/check-out/, methods: ['POST'] },
  { pattern: /\/driver\/deliveries\/[^/]+\/pod/, methods: ['POST'] },
  { pattern: /\/driver\/deliveries\/[^/]+\/status/, methods: ['PATCH'] },
  { pattern: /\/driver\/deliveries\/[^/]+\/issue/, methods: ['POST'] },
  { pattern: /\/credit\/repay/, methods: ['POST'] },
  { pattern: /\/notifications/, methods: ['PATCH'] }, // mark-read is fine to queue
];

function isQueueable(url: string, method: string): boolean {
  const upperMethod = method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH'].includes(upperMethod)) return false;

  return QUEUEABLE_ENDPOINTS.some(({ pattern, methods }) =>
    pattern.test(url) && methods.includes(upperMethod)
  );
}

// ============================================
// OFFLINE-AWARE FETCH
// ============================================

interface OfflineFetchOptions extends RequestInit {
  /** Force skip offline queue (e.g., for idempotent reads) */
  skipQueue?: boolean;
  /** Tag for grouping in the offline queue */
  queueTag?: string;
}

/**
 * Offline-aware fetch that queues requests when offline.
 * Falls back to cache for GET requests when offline.
 */
export async function offlineFetch(url: string, options: OfflineFetchOptions = {}): Promise<Response> {
  const { skipQueue, queueTag, ...fetchOptions } = options;
  const isOnline = useAppStore.getState().isOnline;
  const method = (options.method || 'GET').toUpperCase();

  // If online, proceed normally
  if (isOnline) {
    return fetch(url, fetchOptions);
  }

  // If offline and it's a GET, try cache first
  if (method === 'GET' && 'caches' in window) {
    try {
      const cached = await caches.match(url);
      if (cached) return cached;
    } catch {}
    // Return a synthetic 503 response
    return new Response(JSON.stringify({ success: false, error: { code: 'OFFLINE', message: 'Offline — no cached data' } }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // If offline and it's a queueable mutation, queue it
  if (!skipQueue && isQueueable(url, method)) {
    try {
      await enqueue({
        url,
        method,
        body: options.body as string || undefined,
        headers: options.headers as Record<string, string> || {},
        maxRetries: 10,
        priority: queueTag === 'pod' ? 0 : queueTag === 'checkin' ? 1 : 2,
        tag: queueTag,
      });

      // Return a synthetic 202 "queued" response
      return new Response(JSON.stringify({
        success: true,
        data: { queued: true, message: 'Sẽ được gửi khi có mạng lại' },
      }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      // IndexedDB not available — fail normally
    }
  }

  // Not queueable and offline — return error
  return new Response(JSON.stringify({ success: false, error: { code: 'OFFLINE', message: 'Không có kết nối mạng' } }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================
// HOOKS
// ============================================

/**
 * Hook to get the offline queue count.
 * Polls every 5 seconds when offline.
 */
export function useOfflineQueueCount(): number {
  // This is a simplified version — in the full app you'd use a Zustand store
  // The actual implementation uses setInterval + getQueueCount
  return 0; // Placeholder — real implementation in component
}