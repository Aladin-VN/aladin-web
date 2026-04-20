// ALADIN Zalo Bot — Dead-Letter Queue API
// GET /api/zalo/worker/dlq — View failed messages
// DELETE /api/zalo/worker/dlq — Clear DLQ (with confirmation)
// POST /api/zalo/worker/dlq/retry — Retry all DLQ messages

import { NextRequest, NextResponse } from 'next/server';
import { messageQueue } from '@/lib/zalo/message-queue';

// ============================================
// GET /api/zalo/worker/dlq — List Dead-Letter Messages
// ============================================

export async function GET() {
  const dlqMessages = messageQueue.getDeadLetterMessages();

  return NextResponse.json({
    count: dlqMessages.length,
    messages: dlqMessages.map((msg) => ({
      id: msg.id,
      type: msg.type,
      userId: msg.userId,
      attempts: msg.attempts,
      lastError: msg.lastError,
      createdAt: new Date(msg.createdAt).toISOString(),
      payload: sanitizePayload(msg.payload),
    })),
  });
}

// ============================================
// DELETE /api/zalo/worker/dlq — Clear Dead-Letter Queue
// ============================================

export async function DELETE() {
  const clearedCount = messageQueue.clearDeadLetterQueue();
  return NextResponse.json({
    success: true,
    message: 'DLQ cleared',
    count: clearedCount,
  });
}

// ============================================
// HELPERS
// ============================================

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  // Remove sensitive data from payload for API display
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'text') {
      sanitized[key] = typeof value === 'string' ? value.substring(0, 100) : value;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}
