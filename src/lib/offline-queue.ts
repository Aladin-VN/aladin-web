// ALADIN Offline Queue — IndexedDB-based request queue for offline-first PWA
// Stores failed API requests and syncs them when back online

const DB_NAME = 'aladin-offline';
const DB_VERSION = 1;
const QUEUE_STORE = 'request-queue';
const PRODUCT_CACHE_STORE = 'product-cache';

// ============================================
// TYPES
// ============================================

export interface QueuedRequest {
  id?: number;
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  priority: number; // Lower = higher priority (0 = immediate)
  tag?: string; // For grouping: 'order', 'checkin', 'pod', etc.
}

export interface CachedProduct {
  id?: number;
  productId: string;
  data: string; // JSON
  cachedAt: number;
  ttl: number; // ms
}

// ============================================
// DATABASE INITIALIZATION
// ============================================

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Request queue store
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const queueStore = db.createObjectStore(QUEUE_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        queueStore.createIndex('createdAt', 'createdAt');
        queueStore.createIndex('priority', 'priority');
        queueStore.createIndex('tag', 'tag', { unique: false });
      }

      // Product cache store
      if (!db.objectStoreNames.contains(PRODUCT_CACHE_STORE)) {
        const productStore = db.createObjectStore(PRODUCT_CACHE_STORE, {
          keyPath: 'productId',
        });
        productStore.createIndex('cachedAt', 'cachedAt');
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };
  });
}

// ============================================
// QUEUE OPERATIONS
// ============================================

/** Add a request to the offline queue */
export async function enqueue(request: Omit<QueuedRequest, 'id' | 'retryCount' | 'createdAt'>): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(QUEUE_STORE);

  const entry: QueuedRequest = {
    ...request,
    createdAt: Date.now(),
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const req = store.add(entry);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

/** Get all queued requests, ordered by priority then creation time */
export async function getQueue(): Promise<QueuedRequest[]> {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readonly');
  const store = tx.objectStore(QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const request = store.index('priority').openCursor();
    const results: QueuedRequest[] = [];

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/** Get queue count, optionally filtered by tag */
export async function getQueueCount(tag?: string): Promise<number> {
  const db = await openDB();

  if (tag) {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const store = tx.objectStore(QUEUE_STORE);
    const index = store.index('tag');
    return new Promise((resolve, reject) => {
      const request = index.count(IDBKeyRange.only(tag));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  const tx = db.transaction(QUEUE_STORE, 'readonly');
  const store = tx.objectStore(QUEUE_STORE);
  return new Promise((resolve, reject) => {
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Remove a queued request by ID */
export async function dequeue(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Update a queued request (increment retry count) */
export async function updateQueuedRequest(item: QueuedRequest): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Clear the entire queue */
export async function clearQueue(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, 'readwrite');
  const store = tx.objectStore(QUEUE_STORE);

  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ============================================
// PRODUCT CACHE OPERATIONS
// ============================================

/** Cache a product's data */
export async function cacheProduct(productId: string, data: unknown, ttlMs: number = 5 * 60 * 1000): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(PRODUCT_CACHE_STORE, 'readwrite');
  const store = tx.objectStore(PRODUCT_CACHE_STORE);

  const entry: CachedProduct = {
    productId,
    data: JSON.stringify(data),
    cachedAt: Date.now(),
    ttl: ttlMs,
  };

  return new Promise((resolve, reject) => {
    const req = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Get a cached product if still fresh */
export async function getCachedProduct(productId: string): Promise<unknown | null> {
  const db = await openDB();
  const tx = db.transaction(PRODUCT_CACHE_STORE, 'readonly');
  const store = tx.objectStore(PRODUCT_CACHE_STORE);

  return new Promise((resolve, reject) => {
    const req = store.get(productId);
    req.onsuccess = () => {
      const entry = req.result as CachedProduct | undefined;
      if (!entry) { resolve(null); return; }
      if (Date.now() - entry.cachedAt > entry.ttl) {
        // Expired — delete and return null
        tx.objectStore(PRODUCT_CACHE_STORE).delete(productId);
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(entry.data));
      } catch {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

/** Clear all cached products */
export async function clearProductCache(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(PRODUCT_CACHE_STORE, 'readwrite');
  const store = tx.objectStore(PRODUCT_CACHE_STORE);

  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ============================================
// OFFLINE SYNC MANAGER
// ============================================

let isSyncing = false;

/**
 * Process the offline queue: retry all queued requests.
 * Returns the number of successfully synced items.
 */
export async function syncOfflineQueue(): Promise<{ synced: number; failed: number; remaining: number }> {
  if (isSyncing) return { synced: 0, failed: 0, remaining: 0 };
  isSyncing = true;

  let synced = 0;
  let failed = 0;

  try {
    const queue = await getQueue();

    for (const item of queue) {
      if (item.retryCount >= item.maxRetries) {
        // Max retries exceeded — remove from queue
        await dequeue(item.id!);
        failed++;
        continue;
      }

      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            ...item.headers,
          },
          body: item.body,
        });

        if (response.ok || response.status === 409) {
          // Success or idempotent conflict — remove from queue
          await dequeue(item.id!);
          synced++;
        } else if (response.status >= 500) {
          // Server error — retry later
          item.retryCount++;
          await updateQueuedRequest(item);
          failed++;
        } else {
          // Client error (4xx) — don't retry
          await dequeue(item.id!);
          failed++;
        }
      } catch {
        // Network error — will retry on next sync
        item.retryCount++;
        await updateQueuedRequest(item);
        failed++;
      }
    }
  } finally {
    isSyncing = false;
  }

  const remaining = await getQueueCount();
  return { synced, failed, remaining };
}

/**
 * Hook-friendly sync trigger — call when going back online
 */
export async function triggerSync(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!navigator.onLine) return;

  const result = await syncOfflineQueue();

  if (result.synced > 0) {
    // Dispatch a custom event for UI to react to
    window.dispatchEvent(new CustomEvent('aladin:sync-complete', {
      detail: result,
    }));
  }
}