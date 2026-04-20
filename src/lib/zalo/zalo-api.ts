// ALADIN Zalo Bot — Zalo OA Send Message API Client
// Handles sending text messages and quick replies via Zalo OA API
// Supports rate limiting, retries, and error categorization

import { ZALO_CONFIG } from './config';

// ============================================
// TYPES
// ============================================

export interface ZaloMessagePayload {
  recipient: { user_id: string };
  message: {
    text: string;
    attachment?: {
      type: 'list';
      content: {
        elements: Array<{
          title: string;
          subtitle?: string;
          buttons?: Array<{
            type: 'oa.query.show';
            payload: string;
            label: string;
          }>;
        }>;
      };
    };
  };
}

export interface ZaloApiResponse {
  error: number;
  message: string;
  data?: {
    msg_id?: string;
  };
}

export type ZaloApiErrorType = 'AUTH' | 'RATE_LIMIT' | 'INVALID_USER' | 'SERVER' | 'UNKNOWN';

export interface ZaloApiError {
  type: ZaloApiErrorType;
  code: number;
  message: string;
  retryable: boolean;
}

// ============================================
// RATE LIMITER
// ============================================

// Zalo OA API: ~50 messages/second per OA
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_REQUESTS = 40; // Conservative: 40/sec

const sendTimestamps: number[] = [];

function checkRateLimit(): { allowed: boolean; waitMs: number } {
  const now = Date.now();
  // Clean old timestamps
  while (sendTimestamps.length > 0 && sendTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
    sendTimestamps.shift();
  }

  if (sendTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestInWindow = sendTimestamps[0];
    const waitMs = RATE_LIMIT_WINDOW_MS - (now - oldestInWindow);
    return { allowed: false, waitMs };
  }

  sendTimestamps.push(now);
  return { allowed: true, waitMs: 0 };
}

// ============================================
// ERROR CLASSIFICATION
// ============================================

function classifyError(statusCode: number, responseBody: ZaloApiResponse): ZaloApiError {
  const errorCode = responseBody?.error ?? -1;

  // Zalo API error codes
  if (errorCode === -124 || errorCode === -216) {
    return {
      type: 'AUTH',
      code: errorCode,
      message: 'OA access token expired or invalid',
      retryable: false,
    };
  }

  if (errorCode === -201 || errorCode === -200) {
    return {
      type: 'INVALID_USER',
      code: errorCode,
      message: `Invalid user or user has not followed OA`,
      retryable: false,
    };
  }

  if (errorCode === -100 || errorCode === -101) {
    return {
      type: 'RATE_LIMIT',
      code: errorCode,
      message: 'API rate limit exceeded',
      retryable: true,
    };
  }

  // HTTP-level errors
  if (statusCode === 429) {
    return {
      type: 'RATE_LIMIT',
      code: statusCode,
      message: 'HTTP 429: Too Many Requests',
      retryable: true,
    };
  }

  if (statusCode === 401 || statusCode === 403) {
    return {
      type: 'AUTH',
      code: statusCode,
      message: `HTTP ${statusCode}: Authentication failed`,
      retryable: false,
    };
  }

  if (statusCode >= 500) {
    return {
      type: 'SERVER',
      code: statusCode,
      message: `HTTP ${statusCode}: Zalo server error`,
      retryable: true,
    };
  }

  return {
    type: 'UNKNOWN',
    code: statusCode,
    message: responseBody?.message || `HTTP ${statusCode}`,
    retryable: false,
  };
}

// ============================================
// SEND TEXT MESSAGE
// ============================================

export interface SendTextOptions {
  userId: string;
  text: string;
  quickReplies?: string[];
  timeoutMs?: number;
}

export async function sendTextMessage(options: SendTextOptions): Promise<{
  success: boolean;
  msgId?: string;
  error?: ZaloApiError;
}> {
  const { userId, text, quickReplies, timeoutMs = 10000 } = options;

  // Rate limit check
  const { allowed, waitMs } = checkRateLimit();
  if (!allowed) {
    // Wait and retry once
    await new Promise((resolve) => setTimeout(resolve, waitMs + 50));
    const retry = checkRateLimit();
    if (!retry.allowed) {
      console.warn(`[ZALO API] Rate limit hit, dropping message to ${userId}`);
      return {
        success: false,
        error: {
          type: 'RATE_LIMIT',
          code: 429,
          message: 'Rate limit exceeded after retry',
          retryable: true,
        },
      };
    }
  }

  // Development mode: log and return
  if (process.env.NODE_ENV === 'development') {
    console.log(`[ZALO SEND → ${userId}]`);
    console.log(`  Text: ${text.substring(0, 300)}${text.length > 300 ? '...' : ''}`);
    if (quickReplies?.length) {
      console.log(`  Quick Replies: [${quickReplies.join(', ')}]`);
    }
    return { success: true, msgId: `dev-${Date.now()}` };
  }

  // Validate access token
  const accessToken = ZALO_CONFIG.OA_ACCESS_TOKEN;
  if (!accessToken) {
    console.error('[ZALO API] No OA access token configured');
    return {
      success: false,
      error: {
        type: 'AUTH',
        code: 0,
        message: 'No OA access token configured',
        retryable: false,
      },
    };
  }

  // Build payload
  const payload: ZaloMessagePayload = {
    recipient: { user_id: userId },
    message: { text },
  };

  // Add quick replies as list template if provided
  if (quickReplies && quickReplies.length > 0) {
    payload.message.attachment = {
      type: 'list',
      content: {
        elements: [
          {
            title: '',
            subtitle: quickReplies.join('  |  '),
            buttons: quickReplies.map((label) => ({
              type: 'oa.query.show' as const,
              payload: label,
              label,
            })),
          },
        ],
      },
    };
  }

  // Send with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(ZALO_CONFIG.SEND_MESSAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        access_token: accessToken,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result: ZaloApiResponse = await response.json();

    if (result.error === 0 && response.ok) {
      console.log(`[ZALO API] Sent to ${userId}, msg_id: ${result.data?.msg_id}`);
      return { success: true, msgId: result.data?.msg_id };
    }

    const error = classifyError(response.status, result);
    console.error(`[ZALO API ERROR] ${error.type} (${error.code}): ${error.message}`);
    return { success: false, error };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error(`[ZALO API] Timeout (${timeoutMs}ms) sending to ${userId}`);
      return {
        success: false,
        error: {
          type: 'SERVER',
          code: 0,
          message: `Request timeout after ${timeoutMs}ms`,
          retryable: true,
        },
      };
    }

    console.error('[ZALO API ERROR]', error);
    return {
      success: false,
      error: {
        type: 'UNKNOWN',
        code: 0,
        message: error instanceof Error ? error.message : 'Unknown error',
        retryable: false,
      },
    };
  }
}

// ============================================
// GET USER PROFILE
// ============================================

export interface ZaloUserProfile {
  user_id: string;
  name?: string;
  avatar?: string;
}

export async function getUserProfile(userId: string): Promise<ZaloUserProfile | null> {
  const accessToken = ZALO_CONFIG.OA_ACCESS_TOKEN;
  if (!accessToken) return null;

  try {
    const response = await fetch(
      `${ZALO_CONFIG.GET_PROFILE_URL}?user_id=${userId}`,
      {
        headers: { access_token: accessToken },
      }
    );

    const result = await response.json();
    if (result.error === 0) {
      return result.data as ZaloUserProfile;
    }
    return null;
  } catch {
    return null;
  }
}
