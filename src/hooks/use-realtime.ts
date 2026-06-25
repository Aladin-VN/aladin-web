'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  connectWebSocket,
  onMessage,
  onConnectionState,
  disconnect,
  sendMessage,
} from '@/lib/websocket';
import { useAppStore } from '@/stores/app.store';
import { useAuthStore } from '@/stores/auth.store';
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
  /** Unread notification count (synced from WS events) */
  wsUnreadDelta: number;
}

// ============================================
// Type-to-store mapping
// ============================================

const EVENT_TO_STORE_TYPE: Record<string, 'order' | 'shipment' | 'credit' | 'promotion' | 'system' | 'chat'> = {
  NOTIFICATION: 'system',
  ORDER_UPDATE: 'order',
  DELIVERY_UPDATE: 'shipment',
  SHIPMENT_UPDATE: 'shipment',
  INVENTORY_ALERT: 'system',
  CREDIT_REMINDER: 'credit',
  SETTLEMENT_UPDATE: 'system',
  PAYMENT_RECEIVED: 'credit',
  DRIVER_ISSUE: 'system',
  EARNING_UPDATE: 'system',
  COMMISSION_UPDATE: 'system',
  PROMOTION: 'promotion',
  CONNECTED: 'system',
};

// ============================================
// useRealtime Hook
// ============================================

/**
 * React hook that manages a real-time WebSocket connection.
 * - Connects on mount using the stored auth token
 * - Subscribes to notifications channel
 * - Syncs incoming events to Zustand store (updates notification bell in real-time)
 * - Shows toast notifications for important events
 * - Tracks connection state for UI indicators
 */
export function useRealtime(): UseRealtimeReturn {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [wsUnreadDelta, setWsUnreadDelta] = useState(0);
  const mountedRef = useRef(true);

  // Track last toast time per event type to avoid spam (5s per type)
  const lastToastTimeRef = useRef<Record<string, number>>({});
  const addNotification = useAppStore((s) => s.addNotification);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userRole = useAuthStore((s) => s.user?.role);

  // Stable callback for incoming messages
  const handleMessage = useCallback((data: unknown) => {
    if (!mountedRef.current) return;

    const event = data as RealtimeEvent;
    setLastEvent(event);

    // Sync notification events to Zustand store (for notification bell)
    if (event.type === 'NOTIFICATION' && event.payload) {
      const storeType = EVENT_TO_STORE_TYPE[event.type] || 'system';

      addNotification({
        title: (event.payload.title as string) || 'Thông báo mới',
        titleVi: (event.payload.title as string),
        body: (event.payload.message as string) || '',
        bodyVi: (event.payload.message as string),
        type: storeType,
        actionUrl: event.payload.data
          ? buildActionUrl(event.payload.data as Record<string, string>)
          : undefined,
      });

      setWsUnreadDelta((d) => d + 1);
    }

    // Show toast for important events (throttled per type)
    const isToastable = [
      'NOTIFICATION', 'ORDER_UPDATE', 'SHIPMENT_UPDATE', 'CREDIT_REMINDER',
      'DRIVER_ISSUE', 'PROMOTION', 'DELIVERY_UPDATE',
    ].includes(event.type);

    if (isToastable) {
      const now = Date.now();
      const lastToast = lastToastTimeRef.current[event.type] || 0;
      if (now - lastToast > 5000) {
        lastToastTimeRef.current[event.type] = now;

        const title = (event.payload?.title as string) ||
          eventToTitle(event.type);
        const message = (event.payload?.message as string) || '';

        toast({
          title,
          description: message || undefined,
          duration: 4000,
        });
      }
    }
  }, [addNotification]);

  const handleConnectionState = useCallback((state: boolean) => {
    if (mountedRef.current) {
      setConnected(state);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Get the auth token from store (hydrated from localStorage)
    const token = accessToken || null;

    // Only connect if authenticated and have token
    if (token && isAuthenticated) {
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
  }, [accessToken, isAuthenticated, handleMessage, handleConnectionState]);

  // Subscribe to notifications channel once connected
  useEffect(() => {
    if (connected) {
      // Tell server we want notifications
      sendMessage({ type: 'SUBSCRIBE_NOTIFICATIONS' });

      // Join role-specific room
      if (userRole) {
        sendMessage({ type: 'JOIN_ROOM', payload: { room: `role:${userRole}` } });
      }
    }
  }, [connected, userRole]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { connected, lastEvent, wsUnreadDelta };
}

// ============================================
// HELPERS
// ============================================

function eventToTitle(type: string): string {
  const titles: Record<string, string> = {
    ORDER_UPDATE: 'Cập nhật đơn hàng',
    SHIPMENT_UPDATE: 'Cập nhật vận chuyển',
    DELIVERY_UPDATE: 'Cập nhật giao hàng',
    INVENTORY_ALERT: 'Cảnh báo tồn kho',
    CREDIT_REMINDER: 'Nhắc nhở công nợ',
    SETTLEMENT_UPDATE: 'Cập nhật quyết toán',
    PAYMENT_RECEIVED: 'Nhận thanh toán',
    DRIVER_ISSUE: 'Báo cáo giao hàng',
    EARNING_UPDATE: 'Cập nhật thu nhập',
    COMMISSION_UPDATE: 'Hoa hồng mới',
    PROMOTION: 'Khuyến mãi',
    CONNECTED: 'Đã kết nối',
  };
  return titles[type] || 'Thông báo mới';
}

function buildActionUrl(data: Record<string, string>): string | undefined {
  if (data.orderId) return `/m/orders/${data.orderId}`;
  if (data.shipmentId) return `/m/shipments`;
  if (data.settlementId) return `/m/distributor/settlements/${data.settlementId}`;
  return undefined;
}