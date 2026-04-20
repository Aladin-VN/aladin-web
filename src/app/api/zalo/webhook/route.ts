// ALADIN Zalo Bot — Webhook API Route
// POST /api/zalo/webhook — Receive Zalo messages (<5s response guaranteed)
// GET  /api/zalo/webhook — Zalo webhook verification
//
// Sprint 4D: Async architecture — webhook enqueues and returns 200 immediately.
// Actual processing happens in background worker (worker.ts).

import { NextRequest, NextResponse } from 'next/server';
import { ZALO_CONFIG } from '@/lib/zalo/config';
import { messageQueue } from '@/lib/zalo/message-queue';
import { startWorker } from '@/lib/zalo/worker';
import crypto from 'crypto';

// ============================================
// GET /api/zalo/webhook — Webhook Verification
// Zalo sends this to verify the webhook during setup
// ============================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Zalo webhook verification
  const challenge = searchParams.get('challenge');
  const timestamp = searchParams.get('timestamp');
  const oaId = searchParams.get('oa_id');

  if (challenge && timestamp && oaId) {
    // Verify the webhook by computing HMAC
    const data = `${oaId}${timestamp}`;
    const computedHmac = crypto
      .createHmac('sha256', ZALO_CONFIG.APP_SECRET || 'dev-secret')
      .update(data)
      .digest('hex');

    // For development, accept any verification
    if (process.env.NODE_ENV === 'development' || computedHmac === challenge) {
      return new NextResponse(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  }

  // Simple token-based verification (alternative method)
  const token = searchParams.get('hub.verify_token');
  const mode = searchParams.get('hub.mode');

  if (mode === 'subscribe' && token === ZALO_CONFIG.WEBHOOK_VERIFICATION_TOKEN) {
    const hubChallenge = searchParams.get('hub.challenge');
    return new NextResponse(hubChallenge || 'verified', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ============================================
// POST /api/zalo/webhook — Receive Message
// Sprint 4D: Enqueue immediately, return 200 in <50ms.
// All heavy processing happens in the background worker.
// ============================================

export async function POST(request: NextRequest) {
  // Ensure worker is running (idempotent — safe to call multiple times)
  startWorker();

  try {
    const body = await request.json();
    const eventName = body.event_name;

    // Handle different event types
    if (eventName === 'user_send_text') {
      return await enqueueTextMessage(body);
    }

    if (eventName === 'user_send_image') {
      return await enqueueImageMessage(body);
    }

    // Handle other Zalo events (follow, unfollow, etc.)
    const data = body.data as { user_id?: string } | undefined;
    if (data?.user_id) {
      messageQueue.enqueueEvent(data.user_id, eventName, body.data);
    }

    // Acknowledge all events immediately
    return NextResponse.json({ success: true, message: 'Event queued' });
  } catch (error) {
    console.error('[ZALO WEBHOOK ERROR]', error);
    // Always return 200 to prevent Zalo from retrying
    return NextResponse.json({ success: true, message: 'Webhook received' });
  }
}

// ============================================
// ENQUEUE TEXT MESSAGE — Returns 200 immediately
// ============================================

async function enqueueTextMessage(body: Record<string, unknown>) {
  const data = body.data as {
    user_id: string;
    message: {
      msg_id: string;
      text?: string;
    };
    timestamp: number;
  };

  if (!data?.user_id || !data?.message?.text) {
    return NextResponse.json({ success: true, message: 'No text content' });
  }

  const { user_id: zaloUserId, message } = data;
  const messageText = message.text || '';

  console.log(`[ZALO WEBHOOK] Text from ${zaloUserId}: "${messageText.substring(0, 80)}"`);

  // Enqueue for async processing — this is O(1), returns immediately
  const result = messageQueue.enqueueTextMessage(zaloUserId, messageText, message.msg_id);

  if (!result.enqueued) {
    console.warn(`[ZALO WEBHOOK] Message not enqueued: ${result.reason} (user: ${zaloUserId})`);
    // Still return 200 — Zalo shouldn't know about our queue issues
    return NextResponse.json({ success: true, message: 'Message deduplicated' });
  }

  console.log(`[ZALO WEBHOOK] Enqueued: ${result.messageId} (user: ${zaloUserId})`);
  return NextResponse.json({ success: true, messageId: result.messageId });
}

// ============================================
// ENQUEUE IMAGE MESSAGE — Returns 200 immediately
// ============================================

async function enqueueImageMessage(body: Record<string, unknown>) {
  const data = body.data as {
    user_id: string;
    message: {
      msg_id: string;
      attachments?: Array<{
        type: string;
        thumbnail_url?: string;
        full_size_url?: string;
      }>;
    };
    timestamp: number;
  };

  if (!data?.user_id) {
    return NextResponse.json({ success: true, message: 'No user' });
  }

  const imageUrl = data.message?.attachments?.[0]?.full_size_url || '';

  console.log(`[ZALO WEBHOOK] Image from ${data.user_id}: ${imageUrl.substring(0, 80)}`);

  const result = messageQueue.enqueueImageMessage(data.user_id, imageUrl, data.message.msg_id);

  return NextResponse.json({
    success: true,
    messageId: result.messageId,
    message: 'Image queued',
  });
}
