'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  connectWebSocket,
  onMessage,
  onConnectionState,
  disconnect,
} from '@/lib/websocket';
import { toast } from '@/hooks/use-toast';

// ============================================
// Real-time event type
// ============================================

interface RealtimeEvent {
  type: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

// ============================================
// Hook return type
// ============================================

interface UseRealtimeReturn {
  /** Whether the WebSocket is currently connected */
  connected: boolean;
  /** The last event received from the server */
  lastEvent: RealtimeEvent | null;
}

// ============================================
// useRealtime Hook
// ============================================

/**
 * React hook that manages a real-time WebSocket connection.
 * - Connects on mount using the stored auth token
 * - Disconnects on unmount
 * - Shows toast notifications for incoming events
 *
 * This is a foundation hook — it will fully activate when the
 * WebSocket server (port 3004) is deployed.
 */
export function useRealtime(): UseRealtimeReturn {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const mountedRef = useRef(true);

  // Track last toast time to avoid spam
  const lastToastTimeRef = useRef(0);

  // Stable callback for toast (avoid re-subscribing)
  const handleMessage = useCallback((data: unknown) => {
    if (!mountedRef.current) return;

    const event = data as RealtimeEvent;
    setLastEvent(event);

    // Show toast for notification-type events (throttled to 1 per 3 seconds)
    if (event.type === 'NOTIFICATION' || event.type === 'ORDER_UPDATE') {
      const now = Date.now();
      if (now - lastToastTimeRef.current > 3000) {
        lastToastTimeRef.current = now;

        const title = (event.payload?.title as string) || 'Thông báo mới';
        const message = (event.payload?.message as string) || '';

        toast({
          title,
          description: message || undefined,
          duration: 4000,
        });
      }
    }
  }, []);

  const handleConnectionState = useCallback((state: boolean) => {
    if (mountedRef.current) {
      setConnected(state);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Get the auth token from localStorage
    let token: string | null = null;
    try {
      token = localStorage.getItem('aladin-access-token');
    } catch {
      // SSR-safe
    }

    // Only connect if we have a token
    if (token) {
      // Subscribe before connecting to catch early events
      const unsubMessage = onMessage(handleMessage);
      const unsubState = onConnectionState(handleConnectionState);

      connectWebSocket(token);

      return () => {
        unsubMessage();
        unsubState();
        disconnect();
      };
    }

    return () => {
      disconnect();
    };
  }, [handleMessage, handleConnectionState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { connected, lastEvent };
}