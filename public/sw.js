// ALADIN B2B — Service Worker v3 (Mobile PWA)
// Adds: Push notifications, Background Sync, offline order queue sync, stale-while-revalidate for products
// Strategy: Only intercept /m/ (mobile) routes and static assets
// Admin dashboard routes (/orders, /shops, etc.) are NEVER intercepted

const CACHE_NAME = 'aladin-v3';
const STATIC_CACHE = 'aladin-static-v3';
const OFFLINE_URL = '/m/offline';

// ============================================
// Install — Pre-cache shell resources
// ============================================

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll([
        OFFLINE_URL,
        '/manifest.json',
        '/icons/icon-192x192.png',
      ]);
    }).catch(() => {})
  );
  self.skipWaiting();
});

// ============================================
// Activate — Clean ALL old caches
// ============================================

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME && name !== STATIC_CACHE) {
            return caches.delete(name);
          }
          return Promise.resolve();
        })
      );
    })
  );
  self.clients.claim();
});

// ============================================
// Push Notification Handler
// ============================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data: any;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'ALADIN', body: event.data.text() };
  }

  const title = data.title || 'ALADIN';
  const options: NotificationOptions = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-72x72.png',
    tag: data.tag || 'aladin-default',
    renotify: data.renotify !== false,
    data: data.data || {},
    vibrate: [100, 50, 100],
    actions: data.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ============================================
// Notification Click Handler
// ============================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/m/notifications';
  const action = event.action;

  // Handle action clicks
  if (action === 'view' || !action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // If app is already open, focus it and navigate
        for (const client of clientList) {
          if (client.url.includes('/m/') && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Otherwise open new window
        return self.clients.openWindow(urlToOpen);
      })
    );
  }
});

// ============================================
// Background Sync Handler
// ============================================

self.addEventListener('sync', (event) => {
  if (event.tag === 'aladin-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
  if (event.tag === 'aladin-clear-cache') {
    event.waitUntil(
      caches.keys().then((names) => Promise.all(names.map((n) => caches.delete(n))))
    );
  }
});

// ============================================
// Periodic Background Sync (if supported)
// ============================================

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'aladin-daily-sync') {
    event.waitUntil(syncOfflineQueue());
  }
});

// ============================================
// Fetch — Enhanced caching strategies
// ============================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests entirely (let them go through for background sync registration)
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // ============================================
  // CRITICAL: Skip ALL admin dashboard routes
  // ============================================
  if (!url.pathname.startsWith('/m/') && !url.pathname.startsWith('/api/')) {
    if (
      url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot)$/) ||
      url.pathname.startsWith('/icons/')
    ) {
      event.respondWith(cacheFirst(request));
    }
    return;
  }

  // API routes — Network only, no caching
  if (url.pathname.startsWith('/api/')) return;

  // Mobile PWA pages (/m/*) — Network first, cache fallback
  if (url.pathname.startsWith('/m/')) {
    event.respondWith(networkFirstCacheFallback(request));
    return;
  }
});

// ============================================
// Caching Strategies
// ============================================

/** Cache-first for static assets */
async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
    }
    return response;
  } catch {
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

/** Network-first with cache fallback for PWA pages */
async function networkFirstCacheFallback(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline || new Response('Offline', { status: 503 });
  }
}

// ============================================
// Offline Queue Sync (from SW)
// ============================================

async function syncOfflineQueue(): Promise<void> {
  try {
    // Open IndexedDB and process queue
    const db = await openOfflineDB();
    const tx = db.transaction('request-queue', 'readonly');
    const store = tx.objectStore('request-queue');
    const index = store.index('priority');
    const items = await getAllFromIndex(index);

    let synced = 0;
    let failed = 0;

    for (const item of items) {
      if (item.retryCount >= item.maxRetries) {
        await deleteFromDB(db, item.id);
        failed++;
        continue;
      }

      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: { 'Content-Type': 'application/json', ...(item.headers || {}) },
          body: item.body,
        });

        if (response.ok || response.status === 409) {
          await deleteFromDB(db, item.id);
          synced++;
        } else if (response.status >= 500) {
          await updateRetryCount(db, item);
          failed++;
        } else {
          await deleteFromDB(db, item.id);
          failed++;
        }
      } catch {
        await updateRetryCount(db, item);
        failed++;
      }
    }

    db.close();

    // Notify all clients about sync results
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        data: { synced, failed },
      });
    });
  } catch (err) {
    console.error('[SW SYNC ERROR]', err);
  }
}

// ============================================
// IndexedDB helpers for SW (no import)
// ============================================

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('aladin-offline', 1);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('request-queue')) {
        const store = db.createObjectStore('request-queue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('priority', 'priority');
        store.createIndex('tag', 'tag', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function getAllFromIndex(index: IDBIndex): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const request = index.openCursor();
    const results: any[] = [];
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

function deleteFromDB(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('request-queue', 'readwrite');
    tx.objectStore('request-queue').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function updateRetryCount(db: IDBDatabase, item: any): Promise<void> {
  return new Promise((resolve, reject) => {
    item.retryCount++;
    const tx = db.transaction('request-queue', 'readwrite');
    tx.objectStore('request-queue').put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================
// Message handler
// ============================================

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }

  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // Register background sync (called from client)
  if (event.data?.type === 'REGISTER_SYNC') {
    if ('serviceWorker' in self && 'SyncManager' in self) {
      self.registration.sync.register(event.data.tag || 'aladin-offline-queue').catch(() => {
        // Background sync not supported — will use manual sync instead
      });
    }
  }

  // Get current queue count (respond to client)
  if (event.data?.type === 'GET_QUEUE_COUNT') {
    openOfflineDB().then((db) => {
      const tx = db.transaction('request-queue', 'readonly');
      const store = tx.objectStore('request-queue');
      const request = store.count();
      request.onsuccess = () => {
        // Send back to client
        event.ports[0]?.postMessage({ type: 'QUEUE_COUNT', count: request.result });
      };
    }).catch(() => {
      event.ports[0]?.postMessage({ type: 'QUEUE_COUNT', count: 0 });
    });
  }
});