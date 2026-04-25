'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/app.store';

// ============================================
// Service Worker Registration Hook
// ============================================

export function useServiceWorker() {
  const setOnline = useAppStore((s) => s.setOnline);
  const registered = useRef(false);

  const registerSW = useCallback(async () => {
    if (registered.current) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    registered.current = true;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (
            newWorker.state === 'activated' &&
            navigator.serviceWorker.controller
          ) {
            // New version activated — could show "update available" prompt
            console.log('[SW] New version activated');
          }
        });
      });

      // Handle controller change (new SW took over)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        // Optionally reload to get new content
        // window.location.reload();
      });

      console.log('[SW] Registered successfully:', registration.scope);
    } catch (error) {
      console.error('[SW] Registration failed:', error);
    }
  }, []);

  const clearCache = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration.active) {
        registration.active.postMessage({ type: 'CLEAR_CACHE' });
      }
    }
    // Also clear HTTP cache
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  }, []);

  const unregisterSW = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  }, []);

  useEffect(() => {
    registerSW();
  }, [registerSW]);

  // Network status listeners
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    // Set initial state
    setOnline(navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  return {
    registerSW,
    clearCache,
    unregisterSW,
  };
}
