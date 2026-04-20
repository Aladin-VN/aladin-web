// ALADIN Zalo Bot — Background Worker
// Consumes messages from the in-memory queue and processes them asynchronously.
// In production, this would be replaced by a separate worker process (e.g., BullMQ, SQS consumer).
// For Next.js dev, it runs as a singleton background loop.

import { messageQueue, type QueueMessage, type QueueStats } from './message-queue';
import { sendTextMessage, type ZaloApiError } from './zalo-api';
import { handleZaloMessage, type BotResponse } from './conversation-engine';
import { ZALO_CONFIG } from './config';

// ============================================
// WORKER CONFIGURATION
// ============================================

const WORKER_CONFIG = {
  // Poll interval between dequeue checks (ms)
  POLL_INTERVAL_MS: 100,

  // Max concurrent messages being processed
  MAX_CONCURRENT: 5,

  // Timeout for a single message processing (ms)
  PROCESSING_TIMEOUT_MS: ZALO_CONFIG.ASYNC_PROCESS_TIMEOUT_MS,

  // Delay between retries (ms) — will be multiplied by attempt number
  BASE_RETRY_DELAY_MS: 1000,

  // Max messages to process before queue gets a break (fairness)
  BATCH_SIZE: 20,
} as const;

// ============================================
// WORKER STATE
// ============================================

let workerRunning = false;
let activeProcessingCount = 0;
let workerStartTime = Date.now();
let lastProcessedAt = 0;
let totalProcessedByWorker = 0;

// ============================================
// WORKER PROCESSOR
// ============================================

/**
 * Start the background worker loop.
 * In Next.js, this runs as an async background process within the server.
 * Call startWorker() once at server startup.
 */
export function startWorker(): void {
  if (workerRunning) {
    console.log('[WORKER] Already running, skipping start');
    return;
  }

  workerRunning = true;
  workerStartTime = Date.now();
  console.log('[WORKER] Starting background worker...');

  // Start the processing loop
  processQueueLoop().catch((err) => {
    console.error('[WORKER] Fatal error in queue loop:', err);
    workerRunning = false;
  });

  // Start stats logger (every 60 seconds)
  setInterval(() => {
    const stats = getWorkerStats();
    if (stats.totalProcessed > 0 || stats.queued > 0 || stats.deadLetter > 0) {
      console.log(
        `[WORKER STATS] Queue: ${stats.queued} | Processing: ${stats.processing} | ` +
        `Completed: ${stats.completed} | Failed: ${stats.failed} | ` +
        `DLQ: ${stats.deadLetter} | Avg: ${stats.avgProcessingTimeMs}ms | ` +
        `Uptime: ${stats.uptimeSeconds}s`
      );
    }
  }, 60_000);
}

/**
 * Stop the worker gracefully.
 */
export function stopWorker(): void {
  workerRunning = false;
  console.log('[WORKER] Stopped');
}

/**
 * Get comprehensive worker statistics.
 */
export function getWorkerStats(): QueueStats & {
  workerRunning: boolean;
  activeProcessingCount: number;
  lastProcessedAt: number;
  totalProcessedByWorker: number;
} {
  const queueStats = messageQueue.getStats();
  return {
    ...queueStats,
    workerRunning,
    activeProcessingCount,
    lastProcessedAt,
    totalProcessedByWorker,
  };
}

// ============================================
// INTERNAL: QUEUE PROCESSING LOOP
// ============================================

async function processQueueLoop(): Promise<void> {
  while (workerRunning) {
    // Only dequeue if we have capacity
    if (activeProcessingCount < WORKER_CONFIG.MAX_CONCURRENT) {
      const message = messageQueue.dequeue();
      if (message) {
        // Process asynchronously (non-blocking)
        processMessage(message).catch((err) => {
          console.error(`[WORKER] Unhandled error processing ${message.id}:`, err);
        });
      }
    }

    // Wait before next poll
    await sleep(WORKER_CONFIG.POLL_INTERVAL_MS);
  }
}

// ============================================
// INTERNAL: MESSAGE PROCESSOR
// ============================================

async function processMessage(message: QueueMessage): Promise<void> {
  const startTime = Date.now();
  activeProcessingCount++;

  try {
    switch (message.type) {
      case 'TEXT_MESSAGE':
        await processTextMessage(message);
        break;
      case 'IMAGE_MESSAGE':
        await processImageMessage(message);
        break;
      case 'EVENT_CALLBACK':
        await processEventCallback(message);
        break;
      default:
        console.warn(`[WORKER] Unknown message type: ${message.type}`);
    }

    // Success
    messageQueue.acknowledge(message.id);
    totalProcessedByWorker++;
    lastProcessedAt = Date.now();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[WORKER] Error processing ${message.id} (${message.type}):`, errorMsg);

    // Check if it's a non-retryable error
    const isRetryable = !isNonRetryableError(errorMsg);
    if (isRetryable) {
      // Calculate retry delay with exponential backoff
      const retryDelay = WORKER_CONFIG.BASE_RETRY_DELAY_MS * message.attempts;
      await sleep(retryDelay);

      // Requeue or move to DLQ
      const requeued = messageQueue.requeueOrFail(message, errorMsg);
      if (!requeued) {
        console.error(`[WORKER] Message ${message.id} moved to dead-letter queue`);
      }
    } else {
      // Non-retryable — straight to DLQ
      messageQueue.reject(message, errorMsg);
    }
  } finally {
    activeProcessingCount--;
  }
}

// ============================================
// INTERNAL: TEXT MESSAGE HANDLER
// ============================================

async function processTextMessage(message: QueueMessage): Promise<void> {
  const text = message.payload.text as string;
  if (!text) return;

  console.log(`[WORKER] Processing text from ${message.userId}: "${text.substring(0, 50)}..."`);

  // Run through conversation engine
  const response: BotResponse = await withTimeout(
    handleZaloMessage(message.userId, text),
    WORKER_CONFIG.PROCESSING_TIMEOUT_MS
  );

  console.log(`[WORKER] Engine response (${Date.now() - message.createdAt}ms), state: ${response.state}`);

  // Send reply via Zalo API
  const sendResult = await sendTextMessage({
    userId: message.userId,
    text: response.replyText,
    quickReplies: response.quickReplies,
  });

  if (!sendResult.success && sendResult.error) {
    const zaloErr = sendResult.error;
    // If Zalo API fails with non-retryable error, don't throw (message was processed)
    if (!zaloErr.retryable) {
      console.error(`[WORKER] Zalo API non-retryable error (${zaloErr.type}): ${zaloErr.message}`);
      // Don't throw — the message was already processed, just the reply failed
      // TODO: In Sprint 4E, queue a notification retry
      return;
    }
    // Retryable Zalo error — throw to trigger retry
    throw new Error(`Zalo API ${zaloErr.type}: ${zaloErr.message}`);
  }
}

// ============================================
// INTERNAL: IMAGE MESSAGE HANDLER
// ============================================

async function processImageMessage(message: QueueMessage): Promise<void> {
  const imageUrl = message.payload.imageUrl as string;
  console.log(`[WORKER] Processing image from ${message.userId}: ${imageUrl?.substring(0, 80)}...`);

  // OCR not yet implemented — send placeholder reply
  const replyText =
    '📸 Hình ảnh đã nhận! Tính năng OCR sẽ sớm khả dụng.\n\nHiện tại, vui lòng gõ tên sản phẩm để tìm kiếm.';

  const sendResult = await sendTextMessage({
    userId: message.userId,
    text: replyText,
    quickReplies: ['menu', 'phổ biến'],
  });

  if (!sendResult.success && sendResult.error?.retryable) {
    throw new Error(`Zalo API retryable: ${sendResult.error.message}`);
  }
}

// ============================================
// INTERNAL: EVENT CALLBACK HANDLER
// ============================================

async function processEventCallback(message: QueueMessage): Promise<void> {
  const eventName = message.payload.eventName as string;
  console.log(`[WORKER] Processing event: ${eventName} from ${message.userId}`);

  // Handle Zalo follow/unfollow events
  if (eventName === 'user_follow') {
    console.log(`[WORKER] New follower: ${message.userId}`);
    await sendTextMessage({
      userId: message.userId,
      text: '👋 Chào mừng bạn đến với ALADIN!\n\nGõ "menu" để xem danh mục sản phẩm.',
      quickReplies: ['menu', 'phổ biến', 'giúp đỡ'],
    });
    return;
  }

  if (eventName === 'user_unfollow') {
    console.log(`[WORKER] User unfollowed: ${message.userId}`);
    return;
  }

  // Handle notification events (from notification-engine)
  if (message.payload.notificationText) {
    const notifEvent = message.payload.notificationEvent as string;
    console.log(`[WORKER] Sending notification: ${notifEvent} to ${message.userId}`);

    const quickReplies = message.payload.quickReplies as string[] | undefined;
    const sendResult = await sendTextMessage({
      userId: message.userId,
      text: message.payload.notificationText as string,
      quickReplies: quickReplies?.length ? quickReplies : undefined,
    });

    if (!sendResult.success && sendResult.error?.retryable) {
      throw new Error(`Notification send failed: ${sendResult.error.message}`);
    }
    return;
  }

  console.log(`[WORKER] Unhandled event: ${eventName}`);
}

// ============================================
// HELPERS
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Processing timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Classify errors that should NOT be retried.
 */
function isNonRetryableError(errorMsg: string): boolean {
  const nonRetryablePatterns = [
    'Shop not found',
    'Invalid user',
    'non-retryable',
    'OA access token',
  ];
  return nonRetryablePatterns.some((p) => errorMsg.includes(p));
}
