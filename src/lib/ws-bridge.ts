// ALADIN WebSocket Bridge Client
// Server-side library for API routes to push events through the WS server
// Uses HTTP bridge API — no WS dependency in Next.js server

const BRIDGE_URL = process.env.WS_BRIDGE_URL || 'http://localhost:3004/bridge';
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || 'aladin-bridge-secret-2024';

// ============================================
// TYPES
// ============================================

export interface WsEvent {
  type: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

export type BroadcastType =
  | 'BROADCAST_USER'
  | 'BROADCAST_ROLE'
  | 'BROADCAST_DISTRIBUTOR'
  | 'BROADCAST_SHOP'
  | 'BROADCAST_ALL'
  | 'BROADCAST_ROOM';

interface BridgeRequest {
  type: BroadcastType;
  targetId: string;
  event: WsEvent;
}

// ============================================
// BRIDGE CLIENT
// ============================================

/**
 * Send an event to the WebSocket server for broadcasting.
 * This is fire-and-forget — it should never block or throw.
 * If the WS server is down, the notification is silently skipped
 * (notifications are already in the DB for polling fallback).
 */
export async function broadcastWs(
  type: BroadcastType,
  targetId: string,
  event: WsEvent
): Promise<{ sent: number } | null> {
  try {
    const body: BridgeRequest = {
      type,
      targetId,
      event: {
        ...event,
        timestamp: event.timestamp || new Date().toISOString(),
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const response = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRIDGE_SECRET}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const result = await response.json();
      return result as { sent: number };
    }

    return null;
  } catch {
    // WS server may be down — silently fail
    // Notifications still work via DB polling
    return null;
  }
}

// ============================================
// CONVENIENCE HELPERS
// ============================================

/** Broadcast a notification event to a specific user */
export async function wsNotifyUser(userId: string, event: WsEvent) {
  return broadcastWs('BROADCAST_USER', userId, event);
}

/** Broadcast to all users with a specific role */
export async function wsNotifyRole(role: string, event: WsEvent) {
  return broadcastWs('BROADCAST_ROLE', role, event);
}

/** Broadcast to all staff of a specific distributor */
export async function wsNotifyDistributor(distributorId: string, event: WsEvent) {
  return broadcastWs('BROADCAST_DISTRIBUTOR', distributorId, event);
}

/** Broadcast to the owner of a specific shop */
export async function wsNotifyShop(shopId: string, event: WsEvent) {
  return broadcastWs('BROADCAST_SHOP', shopId, event);
}

/** Broadcast to all connected users */
export async function wsNotifyAll(event: WsEvent) {
  return broadcastWs('BROADCAST_ALL', '*', event);
}

/** Broadcast to a custom room */
export async function wsNotifyRoom(room: string, event: WsEvent) {
  return broadcastWs('BROADCAST_ROOM', room, event);
}