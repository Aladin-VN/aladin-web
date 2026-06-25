'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/mobile/api';

// ============================================
// Push Permission Hook
// ============================================

interface UsePushNotificationsReturn {
  /** Whether push notifications are supported */
  supported: boolean;
  /** Current permission state */
  permission: NotificationPermission | 'unsupported';
  /** Whether currently subscribing */
  loading: boolean;
  /** Whether push is active (permission + subscription registered) */
  isActive: boolean;
  /** Request permission and subscribe */
  requestPermission: () => Promise<boolean>;
  /** Unsubscribe from push */
  unsubscribe: () => Promise<void>;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [loading, setLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (typeof window === 'undefined') return;

    const isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(isSupported);

    if (isSupported) {
      setPermission(Notification.permission);
      checkSubscriptionStatus();
    }

    // Listen for permission changes
    if (isSupported) {
      const handler = () => {
        if (mountedRef.current) setPermission(Notification.permission);
      };
      Notification.addEventListener('permissionchange', handler);
      return () => {
        Notification.removeEventListener('permissionchange', handler);
        mountedRef.current = false;
      };
    }

    return () => { mountedRef.current = false; };
  }, [isAuthenticated]);

  async function checkSubscriptionStatus() {
    if (!isAuthenticated) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (mountedRef.current) setIsActive(!!subscription);
    } catch {}
  }

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    if (loading) return false;
    setLoading(true);

    try {
      // Step 1: Request permission
      const result = await Notification.requestPermission();
      if (mountedRef.current) setPermission(result);

      if (result !== 'granted') {
        setLoading(false);
        return false;
      }

      // Step 2: Subscribe to push
      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = VAPID_PUBLIC_KEY
        ? urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        : undefined;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Step 3: Send subscription to server
      const subJson = subscription.toJSON();
      const response = await api.post('/push/subscribe', {
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      });

      if (mountedRef.current) setIsActive(true);
      setLoading(false);
      return true;
    } catch (error) {
      console.error('[PUSH SUBSCRIBE ERROR]', error);
      if (mountedRef.current) setIsActive(false);
      setLoading(false);
      return false;
    }
  }, [supported, loading, isAuthenticated]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const subJson = subscription.toJSON();
        // Unregister from server
        await api.delete('/push/subscribe', {
          endpoint: subJson.endpoint,
        }).catch(() => {});
        // Unregister from push service
        await subscription.unsubscribe();
      }
      if (mountedRef.current) setIsActive(false);
    } catch (error) {
      console.error('[PUSH UNSUBSCRIBE ERROR]', error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [isAuthenticated]);

  return {
    supported,
    permission,
    loading,
    isActive,
    requestPermission,
    unsubscribe,
  };
}