'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/app.store';
import { triggerSync, syncOfflineQueue, getQueueCount } from '@/lib/offline-queue';

// ============================================
// Offline Sync Hook
// ============================================

interface UseOfflineSyncReturn {
  /** Number of items in the offline queue */
  queueCount: number;
  /** Whether a sync is in progress */
  syncing: boolean;
  /** Last sync result */
  lastSyncResult: { synced: number; failed: number; remaining: number } | null;
  /** Manually trigger a sync */
  syncNow: () => Promise<void>;
}

export function useOfflineSync(): UseOfflineSyncReturn {
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<UseOfflineSyncReturn['lastSyncResult']>(null);
  const isOnline = useAppStore((s) => s.isOnline);
  const mountedRef = useRef(true);
  const pollTimer = useRef<ReturnType<typeof setInterval>>();

  // Poll queue count every 10 seconds when offline
  useEffect(() => {
    mountedRef.current = true;

    const updateCount = async () => {
      try {
        const count = await getQueueCount();
        if (mountedRef.current) setQueueCount(count);
      } catch {}
    };

    updateCount();

    // Poll more frequently when offline
    const interval = !isOnline ? 5000 : 30000;
    pollTimer.current = setInterval(updateCount, interval);

    return () => {
      mountedRef.current = false;
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [isOnline]);

  // Listen for online event → auto sync
  useEffect(() => {
    if (!isOnline) return;

    const handleOnline = async () => {
      // Wait 2 seconds for network to stabilize
      await new Promise((r) => setTimeout(r, 2000));
      if (!mountedRef.current) return;
      await doSync();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [isOnline]);

  // Listen for SW sync-complete message
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_COMPLETE') {
        if (mountedRef.current) {
          setLastSyncResult(event.data.data);
          getQueueCount().then(setQueueCount).catch(() => {});
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, []);

  // Listen for custom sync-complete event (from offline-queue.ts)
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (mountedRef.current) {
        setLastSyncResult(detail);
        getQueueCount().then(setQueueCount).catch(() => {});
      }
    };

    window.addEventListener('aladin:sync-complete', handler);
    return () => window.removeEventListener('aladin:sync-complete', handler);
  }, []);

  const doSync = useCallback(async () => {
    if (syncing || !isOnline) return;
    setSyncing(true);
    try {
      const result = await syncOfflineQueue();
      if (mountedRef.current) {
        setLastSyncResult(result);
        setQueueCount(result.remaining);
      }

      // Also register background sync if available
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register('aladin-offline-queue').catch(() => {});
      }
    } catch {}
    if (mountedRef.current) setSyncing(false);
  }, [syncing, isOnline]);

  const syncNow = useCallback(async () => {
    await doSync();
  }, [doSync]);

  return { queueCount, syncing, lastSyncResult, syncNow };
}