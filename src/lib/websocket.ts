// ALADIN WebSocket Client Foundation
// Phase 4 — Real-Time & Scale
// This is the CLIENT-SIDE connection manager.
// The actual WebSocket server will be added later.
//
// Usage:
//   import { connectWebSocket, onMessage, disconnect } from '@/lib/websocket';
//   connectWebSocket(token);
//   onMessage((event) => { ... });
//   // on unmount:
//   disconnect();

type MessageHandler = (data: unknown) => void;
type ConnectionStateHandler = (connected: boolean) => void;

// ============================================
// State
// ============================================

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1s, exponential backoff

const messageHandlers: Set<MessageHandler> = new Set();
const connectionStateHandlers: Set<ConnectionStateHandler> = new Set();

// ============================================
// Get WebSocket URL
// ============================================

function getWsUrl(token: string): string {
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
  // Use the gateway — will route via XTransformPort when WS server is ready
  return `${protocol}//${host}/?XTransformPort=3004&token=${encodeURIComponent(token)}`;
}

// ============================================
// Connect
// ============================================

/**
 * Connect to the WebSocket server.
 * @param token - JWT access token for authentication
 */
export function connectWebSocket(token: string): void {
  // Cleanup any existing connection
  disconnect();

  try {
    ws = new WebSocket(getWsUrl(token));
    reconnectAttempt = 0;

    ws.onopen = () => {
      console.log('[WS] Connected');
      reconnectAttempt = 0; // Reset on successful connection
      connectionStateHandlers.forEach((handler) => handler(true));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        messageHandlers.forEach((handler) => handler(data));
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log(`[WS] Disconnected (code: ${event.code})`);
      connectionStateHandlers.forEach((handler) => handler(false));
      ws = null;

      // Auto-reconnect unless intentional close
      if (event.code !== 1000 && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
        scheduleReconnect(token);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      // onclose will fire after onerror, handling reconnect there
    };
  } catch (error) {
    console.error('[WS] Failed to create connection:', error);
  }
}

// ============================================
// Reconnect with Exponential Backoff
// ============================================

function scheduleReconnect(token: string): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  const delay = Math.min(
    BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempt) + Math.random() * 1000,
    30000 // Cap at 30s
  );
  reconnectAttempt++;

  console.log(`[WS] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempt})`);

  reconnectTimer = setTimeout(() => {
    connectWebSocket(token);
  }, delay);
}

// ============================================
// Subscribe to Messages
// ============================================

/**
 * Register a handler for incoming WebSocket messages.
 * @param handler - Callback invoked with parsed JSON data
 * @returns Unsubscribe function
 */
export function onMessage(handler: MessageHandler): () => void {
  messageHandlers.add(handler);
  return () => {
    messageHandlers.delete(handler);
  };
}

// ============================================
// Subscribe to Connection State
// ============================================

/**
 * Register a handler for connection state changes.
 * @param handler - Callback invoked with `true` (connected) or `false` (disconnected)
 * @returns Unsubscribe function
 */
export function onConnectionState(handler: ConnectionStateHandler): () => void {
  connectionStateHandlers.add(handler);
  return () => {
    connectionStateHandlers.delete(handler);
  };
}

// ============================================
// Disconnect
// ============================================

/**
 * Gracefully close the WebSocket connection.
 * Prevents auto-reconnect.
 */
export function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    // Use code 1000 (normal closure) to prevent auto-reconnect
    ws.close(1000, 'Client disconnect');
    ws = null;
  }

  reconnectAttempt = MAX_RECONNECT_ATTEMPTS; // Prevent reconnect
  connectionStateHandlers.forEach((handler) => handler(false));
}

// ============================================
// Send Message (for future use)
// ============================================

/**
 * Send a message through the WebSocket connection.
 * @param data - Data to send (will be JSON-stringified)
 */
export function sendMessage(data: unknown): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  } else {
    console.warn('[WS] Cannot send — not connected');
  }
}