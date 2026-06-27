// ALADIN WebSocket Server — Port 3004
// Real-time notification broadcasting with JWT auth, rooms, heartbeat, HTTP bridge
// Run: npx tsx server/ws-server.ts

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import jwt from 'jsonwebtoken';
import { URL } from 'url';

// ============================================
// CONFIGURATION
// ============================================

const PORT = parseInt(process.env.WS_PORT || '3004');
const JWT_SECRET = process.env.JWT_SECRET || 'aladin-platform-jwt-secret-2024-secure-key-do-not-share';
const BRIDGE_SECRET = process.env.BRIDGE_SECRET || 'aladin-bridge-secret-2024';
const HEARTBEAT_INTERVAL_MS = 30_000; // 30s
const HEARTBEAT_TIMEOUT_MS = 60_000;  // 60s no pong = disconnect
const MAX_CONNECTIONS_PER_USER = 5;   // Allow multi-device

// ============================================
// TYPES
// ============================================

interface ClientInfo {
  ws: WebSocket;
  userId: string;
  role: string;
  shopId?: string;
  distributorId?: string;
  connectedAt: number;
  lastPong: number;
  rooms: Set<string>;
}

interface WsMessage {
  type: string;
  payload?: Record<string, unknown>;
  timestamp?: string;
}

interface BridgeRequest {
  type: 'BROADCAST_USER' | 'BROADCAST_ROLE' | 'BROADCAST_DISTRIBUTOR' | 'BROADCAST_SHOP' | 'BROADCAST_ALL' | 'BROADCAST_ROOM';
  targetId: string;
  event: WsMessage;
}

// ============================================
// STATE
// ============================================

// userId → ClientInfo[]
const clientsByUser = new Map<string, ClientInfo[]>();
// role → Set<userId>
const usersByRole = new Map<string, Set<string>>();
// roomId → Set<userId>
const rooms = new Map<string, Set<string>>();

let totalConnections = 0;
let activeConnections = 0;
let bridgeMessagesProcessed = 0;

// ============================================
// HTTP SERVER (for bridge API + health check)
// ============================================

const httpServer = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = parsedUrl.pathname;

  // Health check (no auth)
  if (path === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      connections: activeConnections,
      totalConnections,
      usersConnected: clientsByUser.size,
      bridgeMessagesProcessed,
    }));
    return;
  }

  // Bridge API (requires BRIDGE_SECRET)
  if (path === '/bridge' && req.method === 'POST') {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${BRIDGE_SECRET}`) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid bridge secret' }));
      return;
    }

    try {
      const body = await readBody(req);
      const bridgeReq: BridgeRequest = JSON.parse(body);
      const result = handleBridgeRequest(bridgeReq);
      bridgeMessagesProcessed++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, ...result }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Bad request' }));
    }
    return;
  }

  // Stats (admin)
  if (path === '/stats' && req.method === 'GET') {
    const roleStats: Record<string, number> = {};
    for (const [role, users] of usersByRole.entries()) {
      let count = 0;
      for (const uid of users) {
        count += (clientsByUser.get(uid) || []).filter(c => c.ws.readyState === WebSocket.OPEN).length;
      }
      roleStats[role] = count;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      uptime: process.uptime(),
      activeConnections,
      totalConnections,
      usersConnected: clientsByUser.size,
      roleStats,
      rooms: rooms.size,
      bridgeMessagesProcessed,
      memoryUsage: process.memoryUsage().heapUsed,
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ============================================
// WEBSOCKET SERVER
// ============================================

const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: 4096, // 4KB max message size
  perMessageDeflate: false, // Disable compression for speed
});

wss.on('connection', (ws, req) => {
  // Extract token from URL query param
  const parsedUrl = new URL(req.url || '/', `http://localhost:${PORT}`);
  const token = parsedUrl.searchParams.get('token');

  if (!token) {
    ws.close(4001, 'No token provided');
    return;
  }

  // Verify JWT
  let payload: { userId: string; phone: string; role: string; shopId?: string; distributorId?: string } | null;
  try {
    payload = jwt.verify(token, JWT_SECRET) as any;
  } catch {
    ws.close(4003, 'Invalid or expired token');
    return;
  }

  if (!payload?.userId) {
    ws.close(4003, 'Invalid token payload');
    return;
  }

  // Check max connections per user
  const existing = clientsByUser.get(payload.userId) || [];
  const liveConnections = existing.filter(c => c.ws.readyState === WebSocket.OPEN);
  if (liveConnections.length >= MAX_CONNECTIONS_PER_USER) {
    // Close oldest connection
    const oldest = liveConnections[0];
    oldest.ws.close(4005, 'Max connections exceeded — new device connected');
  }

  // Create client info
  const client: ClientInfo = {
    ws,
    userId: payload.userId,
    role: payload.role,
    shopId: payload.shopId,
    distributorId: payload.distributorId,
    connectedAt: Date.now(),
    lastPong: Date.now(),
    rooms: new Set([
      `user:${payload.userId}`,
      `role:${payload.role}`,
    ]),
  };

  // Add role-specific rooms
  if (payload.shopId) client.rooms.add(`shop:${payload.shopId}`);
  if (payload.distributorId) client.rooms.add(`distributor:${payload.distributorId}`);

  // Register client
  registerClient(client);
  totalConnections++;
  activeConnections++;

  console.log(`[WS] +${payload.role} ${payload.userId.slice(0, 8)} (${activeConnections} total)`);

  // Send welcome message
  sendToClient(client, {
    type: 'CONNECTED',
    payload: {
      userId: payload.userId,
      role: payload.role,
      serverTime: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });

  // Handle incoming messages from client
  ws.on('message', (data) => {
    try {
      const msg: WsMessage = JSON.parse(data.toString());
      handleMessage(client, msg);
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on('pong', () => {
    client.lastPong = Date.now();
  });

  ws.on('close', (code, reason) => {
    activeConnections--;
    unregisterClient(client);
    console.log(`[WS] -${client.role} ${client.userId.slice(0, 8)} (code: ${code}) — ${activeConnections} total`);
  });

  ws.on('error', (err) => {
    console.error(`[WS] Error ${client.userId.slice(0, 8)}:`, err.message);
  });
});

// ============================================
// HEARTBEAT — Send ping every 30s
// ============================================

const heartbeatTimer = setInterval(() => {
  const now = Date.now();
  for (const [userId, clients] of clientsByUser.entries()) {
    for (const client of clients) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      // Check for timeout (no pong in 60s)
      if (now - client.lastPong > HEARTBEAT_TIMEOUT_MS) {
        console.log(`[WS] Heartbeat timeout: ${userId.slice(0, 8)}`);
        client.ws.terminate();
        continue;
      }

      // Send ping
      client.ws.ping();
    }
  }
}, HEARTBEAT_INTERVAL_MS);

// ============================================
// MESSAGE HANDLING (client → server)
// ============================================

function handleMessage(client: ClientInfo, msg: WsMessage) {
  switch (msg.type) {
    case 'JOIN_ROOM':
      if (msg.payload?.room && typeof msg.payload.room === 'string') {
        const room = msg.payload.room as string;
        client.rooms.add(room);
        joinRoom(room, client.userId);
        sendToClient(client, {
          type: 'ROOM_JOINED',
          payload: { room },
          timestamp: new Date().toISOString(),
        });
      }
      break;

    case 'LEAVE_ROOM':
      if (msg.payload?.room && typeof msg.payload.room === 'string') {
        const room = msg.payload.room as string;
        client.rooms.delete(room);
        leaveRoom(room, client.userId);
        sendToClient(client, {
          type: 'ROOM_LEFT',
          payload: { room },
          timestamp: new Date().toISOString(),
        });
      }
      break;

    case 'SUBSCRIBE_NOTIFICATIONS':
      // Client is ready to receive notifications
      client.rooms.add('notifications');
      joinRoom('notifications', client.userId);
      sendToClient(client, {
        type: 'NOTIFICATION_SUBSCRIBED',
        timestamp: new Date().toISOString(),
      });
      break;

    // Ignore unknown message types silently
  }
}

// ============================================
// BRIDGE REQUEST HANDLING (HTTP → WS broadcast)
// ============================================

function handleBridgeRequest(req: BridgeRequest): { sent: number } {
  const event: WsMessage = {
    ...req.event,
    timestamp: req.event.timestamp || new Date().toISOString(),
  };

  let sent = 0;

  switch (req.type) {
    case 'BROADCAST_USER':
      sent = broadcastToUser(req.targetId, event);
      break;

    case 'BROADCAST_ROLE':
      sent = broadcastToRole(req.targetId, event);
      break;

    case 'BROADCAST_DISTRIBUTOR':
      sent = broadcastToRoom(`distributor:${req.targetId}`, event);
      break;

    case 'BROADCAST_SHOP':
      sent = broadcastToRoom(`shop:${req.targetId}`, event);
      break;

    case 'BROADCAST_ALL':
      sent = broadcastToAll(event);
      break;

    case 'BROADCAST_ROOM':
      sent = broadcastToRoom(req.targetId, event);
      break;

    default:
      console.warn(`[BRIDGE] Unknown type: ${req.type}`);
  }

  return { sent };
}

// ============================================
// CLIENT REGISTRATION & ROOM MANAGEMENT
// ============================================

function registerClient(client: ClientInfo) {
  // Add to user map
  const existing = clientsByUser.get(client.userId) || [];
  existing.push(client);
  clientsByUser.set(client.userId, existing);

  // Add to role map
  const roleSet = usersByRole.get(client.role) || new Set();
  roleSet.add(client.userId);
  usersByRole.set(client.role, roleSet);

  // Join all initial rooms
  for (const room of client.rooms) {
    joinRoom(room, client.userId);
  }
}

function unregisterClient(client: ClientInfo) {
  // Remove from user map
  const userClients = clientsByUser.get(client.userId) || [];
  const filtered = userClients.filter(c => c !== client);
  if (filtered.length === 0) {
    clientsByUser.delete(client.userId);
    // Remove from role map
    const roleSet = usersByRole.get(client.role);
    if (roleSet) {
      roleSet.delete(client.userId);
      if (roleSet.size === 0) usersByRole.delete(client.role);
    }
  } else {
    clientsByUser.set(client.userId, filtered);
  }

  // Leave all rooms
  for (const room of client.rooms) {
    leaveRoom(room, client.userId);
  }
}

function joinRoom(room: string, userId: string) {
 const members = rooms.get(room) || new Set();
  members.add(userId);
  rooms.set(room, members);
}

function leaveRoom(room: string, userId: string) {
  const members = rooms.get(room);
  if (!members) return;
  members.delete(userId);
  if (members.size === 0) rooms.delete(room);
}

// ============================================
// BROADCAST FUNCTIONS
// ============================================

function sendToClient(client: ClientInfo, msg: WsMessage) {
  if (client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(msg));
  }
}

function broadcastToUser(userId: string, msg: WsMessage): number {
  const clients = clientsByUser.get(userId);
  if (!clients) return 0;
  let sent = 0;
  for (const client of clients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(msg));
      sent++;
    }
  }
  return sent;
}

function broadcastToRole(role: string, msg: WsMessage): number {
  const userIds = usersByRole.get(role);
  if (!userIds) return 0;
  let sent = 0;
  for (const uid of userIds) {
    sent += broadcastToUser(uid, msg);
  }
  return sent;
}

function broadcastToRoom(room: string, msg: WsMessage): number {
  const members = rooms.get(room);
  if (!members) return 0;
  let sent = 0;
  for (const uid of members) {
    sent += broadcastToUser(uid, msg);
  }
  return sent;
}

function broadcastToAll(msg: WsMessage): number {
  let sent = 0;
  for (const [userId] of clientsByUser) {
    sent += broadcastToUser(userId, msg);
  }
  return sent;
}

// ============================================
// HELPERS
// ============================================

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
    req.on('error', reject);
    // Timeout after 5s
    setTimeout(() => reject(new Error('Body read timeout')), 5000);
  });
}

// ============================================
// START SERVER
// ============================================

httpServer.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   ALADIN WebSocket Server — :${PORT}     ║`);
  console.log(`  ║   Health: http://localhost:${PORT}/health  ║`);
  console.log(`  ║   Bridge: http://localhost:${PORT}/bridge  ║`);
  console.log(`  ║   Stats:  http://localhost:${PORT}/stats   ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[WS] SIGTERM received, shutting down...');
  clearInterval(heartbeatTimer);
  wss.close(() => {
    httpServer.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[WS] SIGINT received, shutting down...');
  clearInterval(heartbeatTimer);
  wss.close(() => {
    httpServer.close();
    process.exit(0);
  });
});
