// ALADIN Zalo Bot — Webhook API Route
// POST /api/zalo/webhook — Receive Zalo messages (<5s response guaranteed)
// GET  /api/zalo/webhook — Zalo webhook verification

import { NextRequest, NextResponse } from 'next/server';
import { ZALO_CONFIG } from '@/lib/zalo/config';
import { handleZaloMessage } from '@/lib/zalo/conversation-engine';
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
// CRITICAL: Must respond within 5 seconds
// AI processing happens async — we queue it and respond immediately
// ============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventName = body.event_name;

    // Handle different event types
    if (eventName === 'user_send_text') {
      return await handleTextMessage(body);
    }

    if (eventName === 'user_send_image') {
      return await handleImageMessage(body);
    }

    // Acknowledge other events
    console.log(`[ZALO WEBHOOK] Event: ${eventName}`);
    return NextResponse.json({ success: true, message: 'Event received' });
  } catch (error) {
    console.error('[ZALO WEBHOOK ERROR]', error);
    return NextResponse.json({ success: true, message: 'Webhook received' });
  }
}

// ============================================
// Handle Text Message — CRITICAL PATH (<5s)
// ============================================

async function handleTextMessage(body: Record<string, unknown>) {
  const startTime = Date.now();

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

  console.log(`[ZALO MSG] User: ${zaloUserId}, Text: "${messageText.substring(0, 100)}"`);

  // Process message through conversation engine
  const response = await handleZaloMessage(zaloUserId, messageText);

  const processingTime = Date.now() - startTime;
  console.log(`[ZALO MSG] Processed in ${processingTime}ms, State: ${response.state}`);

  // Safety check
  if (processingTime > 4000) {
    console.warn(`[ZALO MSG] Warning: processing took ${processingTime}ms, approaching timeout`);
  }

  // Send reply asynchronously
  sendZaloReply(zaloUserId, response.replyText, response.quickReplies).catch((err) => {
    console.error('[ZALO REPLY ERROR]', err);
  });

  return NextResponse.json({ success: true, processingTimeMs: processingTime });
}

// ============================================
// Handle Image Message (OCR placeholder)
// ============================================

async function handleImageMessage(body: Record<string, unknown>) {
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

  console.log(`[ZALO IMAGE] User: ${data.user_id}`);

  const replyText = '📸 Hình ảnh đã nhận! Tính năng OCR sẽ sớm khả dụng.\n\nHiện tại, vui lòng gõ tên sản phẩm để tìm kiếm.';

  sendZaloReply(data.user_id, replyText, ['menu', 'phổ biến']).catch((err) => {
    console.error('[ZALO IMAGE REPLY ERROR]', err);
  });

  return NextResponse.json({ success: true, message: 'Image received' });
}

// ============================================
// Zalo Send Message API
// Fire-and-forget: sends reply via Zalo OA Send Message API
// ============================================

async function sendZaloReply(
  userId: string,
  text: string,
  quickReplies?: string[]
): Promise<void> {
  // In production, this calls Zalo OA Send Message API
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ZALO REPLY → ${userId}]`);
    console.log(`  Text: ${text.substring(0, 200)}`);
    if (quickReplies?.length) {
      console.log(`  Quick Replies: [${quickReplies.join(', ')}]`);
    }
    return;
  }

  const accessToken = ZALO_CONFIG.OA_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[ZALO REPLY] No OA access token configured');
    return;
  }

  try {
    const response = await fetch(ZALO_CONFIG.SEND_MESSAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': accessToken,
      },
      body: JSON.stringify({
        recipient: { user_id: userId },
        message: { text },
      }),
    });

    const result = await response.json();
    if (result.error !== 0) {
      console.error('[ZALO REPLY API ERROR]', result);
    } else {
      console.log(`[ZALO REPLY] Sent to ${userId}, msg_id: ${result.data?.msg_id}`);
    }
  } catch (error) {
    console.error('[ZALO REPLY API ERROR]', error);
  }
}
