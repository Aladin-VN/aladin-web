// ALADIN Zalo Bot — Message Queue
// In-memory priority queue for Zalo webhook messages
// SQS-ready interface: swap this with SQS producer/consumer in production

// ============================================
// QUEUE MESSAGE TYPES
// ============================================

export type QueueMessageType =
  | 'TEXT_MESSAGE'
  | 'IMAGE_MESSAGE'
  | 'EVENT_CALLBACK';

export interface QueueMessage {
  id: string;
  type: QueueMessageType;
  userId: string;
  payload: Record<string, unknown>;
  createdAt: number;
  priority: number; // Lower = higher priority (0 = highest)
  attempts: number;
  maxAttempts: number;
  processingStartedAt?: number;
  lastError?: string;
  // Deduplication: Zalo may send the same webhook twice
  dedupKey?: string;
}

// ============================================
// QUEUE STATISTICS
// ============================================

export interface QueueStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  deadLetter: number;
  totalProcessed: number;
  avgProcessingTimeMs: number;
  uptimeSeconds: number;
}

// ============================================
// IN-MEMORY MESSAGE QUEUE
// ============================================

class MessageQueue {
  private queue: QueueMessage[] = [];
  private processing: Map<string, number> = new Map(); // messageId → processingStartedAt
  private deadLetterQueue: QueueMessage[] = [];
  private dedupCache: Set<string> = new Set(); // dedupKey
  private completedCount = 0;
  private failedCount = 0;
  private totalProcessingTimeMs = 0;
  private readonly createdAt = Date.now();
  private readonly maxQueueSize = 10000;
  private readonly dedupTtlMs = 60000; // Ignore duplicate webhooks within 60s
  private processingCount = 0;

  // ============================================
  // PRODUCER
  // ============================================

  /**
   * Enqueue a message for async processing.
   * Returns { enqueued: true } or { enqueued: false, reason: 'duplicate' | 'full' }
   */
  enqueue(message: Omit<QueueMessage, 'id' | 'createdAt' | 'attempts'>): {
    enqueued: boolean;
    messageId?: string;
    reason?: string;
  } {
    // Check deduplication
    if (message.dedupKey) {
      if (this.dedupCache.has(message.dedupKey)) {
        return { enqueued: false, reason: 'duplicate' };
      }
      this.dedupCache.add(message.dedupKey);
      // Clean old dedup entries
      this.cleanDedupCache();
    }

    // Check queue capacity
    if (this.queue.length >= this.maxQueueSize) {
      console.warn(`[QUEUE] Full (${this.maxQueueSize}), dropping message for ${message.userId}`);
      return { enqueued: false, reason: 'full' };
    }

    const fullMessage: QueueMessage = {
      ...message,
      id: `mq-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      createdAt: Date.now(),
      attempts: 0,
    };

    // Insert by priority (lower priority number = processed first)
    let inserted = false;
    for (let i = 0; i < this.queue.length; i++) {
      if (message.priority < this.queue[i].priority) {
        this.queue.splice(i, 0, fullMessage);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      this.queue.push(fullMessage);
    }

    return { enqueued: true, messageId: fullMessage.id };
  }

  /**
   * Convenience: enqueue a Zalo text message
   */
  enqueueTextMessage(
    userId: string,
    text: string,
    msgId: string,
    extraPayload?: Record<string, unknown>
  ): { enqueued: boolean; messageId?: string; reason?: string } {
    return this.enqueue({
      type: 'TEXT_MESSAGE',
      userId,
      payload: { text, msgId, ...extraPayload },
      priority: 0, // Text messages are highest priority
      maxAttempts: 3,
      dedupKey: `text-${msgId}`,
    });
  }

  /**
   * Convenience: enqueue a Zalo image message
   */
  enqueueImageMessage(
    userId: string,
    imageUrl: string,
    msgId: string,
    extraPayload?: Record<string, unknown>
  ): { enqueued: boolean; messageId?: string; reason?: string } {
    return this.enqueue({
      type: 'IMAGE_MESSAGE',
      userId,
      payload: { imageUrl, msgId, ...extraPayload },
      priority: 1, // Image messages slightly lower priority
      maxAttempts: 2,
      dedupKey: `image-${msgId}`,
    });
  }

  /**
   * Convenience: enqueue a generic event callback
   */
  enqueueEvent(
    userId: string,
    eventName: string,
    payload: Record<string, unknown>
  ): { enqueued: boolean; messageId?: string; reason?: string } {
    return this.enqueue({
      type: 'EVENT_CALLBACK',
      userId,
      payload: { eventName, ...payload },
      priority: 5, // Events are lowest priority
      maxAttempts: 1,
      dedupKey: `event-${eventName}-${userId}-${Date.now()}`,
    });
  }

  // ============================================
  // CONSUMER
  // ============================================

  /**
   * Dequeue the next message for processing.
   * Returns null if queue is empty.
   */
  dequeue(): QueueMessage | null {
    if (this.queue.length === 0) return null;

    const message = this.queue.shift()!;
    message.attempts++;
    message.processingStartedAt = Date.now();
    this.processing.set(message.id, message.processingStartedAt);
    this.processingCount++;

    return message;
  }

  /**
   * Mark a message as successfully processed.
   */
  acknowledge(messageId: string): void {
    const startedAt = this.processing.get(messageId) ?? Date.now();
    const duration = Date.now() - startedAt;
    this.processing.delete(messageId);
    this.completedCount++;
    this.totalProcessingTimeMs += duration;
    this.processingCount--;
  }

  /**
   * Mark a message as failed. Will retry if attempts remain,
   * otherwise moves to dead-letter queue.
   */
  reject(message: QueueMessage, error: string): void {
    this.processing.delete(message.id);
    this.processingCount--;

    message.lastError = error;
    this.deadLetterQueue.push(message);
    this.failedCount++;
  }

  clearDeadLetterQueue(): number {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue.splice(0);
    return count;
  }

  /**
   * Re-enqueue a failed message for retry.
   * If max attempts exceeded, moves to dead-letter queue.
   */
  requeueOrFail(message: QueueMessage, error: string): boolean {
    this.processing.delete(message.id);
    this.processingCount--;

    message.lastError = error;

    if (message.attempts >= message.maxAttempts) {
      console.error(
        `[QUEUE] Max attempts (${message.maxAttempts}) exceeded for ${message.id}, moving to DLQ`
      );
      this.deadLetterQueue.push(message);
      return false; // Not requeued
    }

    // Exponential backoff: re-prioritize with delay
    const backoffPriority = message.priority + message.attempts * 10;
    message.priority = backoffPriority;

    this.queue.push(message);
    console.warn(
      `[QUEUE] Requeued ${message.id} (attempt ${message.attempts}/${message.maxAttempts}): ${error}`
    );
    return true; // Requeued
  }

  // ============================================
  // STATISTICS
  // ============================================

  getStats(): QueueStats {
    const avgTime =
      this.completedCount > 0
        ? Math.round(this.totalProcessingTimeMs / this.completedCount)
        : 0;

    return {
      queued: this.queue.length,
      processing: this.processing.size,
      completed: this.completedCount,
      failed: this.failedCount,
      deadLetter: this.deadLetterQueue.length,
      totalProcessed: this.completedCount + this.failedCount,
      avgProcessingTimeMs: avgTime,
      uptimeSeconds: Math.round((Date.now() - this.createdAt) / 1000),
    };
  }

  getDeadLetterMessages(): QueueMessage[] {
    return [...this.deadLetterQueue];
  }

  // ============================================
  // MAINTENANCE
  // ============================================

  private cleanDedupCache(): void {
    // In production with SQS, deduplication is handled by SQS natively.
    // For in-memory, clear the cache if it grows too large.
    if (this.dedupCache.size > 5000) {
      this.dedupCache.clear();
    }
  }

  /**
   * Clean stale messages in processing that have been there too long.
   * This handles worker crashes.
   */
  recoverStaleMessages(timeoutMs: number = 60000): number {
    const now = Date.now();
    let recovered = 0;

    for (const [messageId, startedAt] of this.processing.entries()) {
      if (now - startedAt > timeoutMs) {
        this.processing.delete(messageId);
        this.processingCount--;
        this.failedCount++;
        recovered++;
      }
    }

    return recovered;
  }
}

// Singleton queue instance
export const messageQueue = new MessageQueue();
