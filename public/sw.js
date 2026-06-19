// ALADIN B2B — Service Worker (Mobile PWA only)
// Strategy: Only intercept /m/ (mobile) routes and static assets
// Admin dashboard routes (/orders, /shops, etc.) are NEVER intercepted

const CACHE_NAME = 'aladin-v2';
const STATIC_CACHE = 'aladin-static-v2';
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
      ]);
    }).catch(() => {
      // If pre-cache fails (e.g., offline page not available), continue anyway
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// ============================================
// Activate — Clean ALL old caches (forces fresh start)
// ============================================

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ============================================
// Fetch — Only handle mobile PWA routes
// ============================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests entirely
  if (request.method !== 'GET') return;

  // Skip non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // ============================================
  // CRITICAL: Skip ALL admin dashboard routes
  // Let the browser handle them normally (no SW interception)
  // ============================================
  if (!url.pathname.startsWith('/m/') && !url.pathname.startsWith('/api/')) {
    // Only handle static asset caching for _next/static and common assets
    if (
      url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot)$/) ||
      url.pathname.startsWith('/icons/')
    ) {
      event.respondWith(
        caches.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
              }).catch(() => {});
            }
            return response;
          }).catch(() => {
            return new Response('', { status: 408, statusText: 'Offline' });
          });
        })
      );
    }
    // Do NOT intercept _next/static here — let Next.js handle its own caching
    // Skip everything else (admin pages, etc.)
    return;
  }

  // API routes — Network only, no caching
  if (url.pathname.startsWith('/api/')) {
    return; // Let the browser handle API calls directly
  }

  // Mobile PWA pages (/m/*) — Network first, cache fallback
  if (url.pathname.startsWith('/m/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            }).catch(() => {});
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match(OFFLINE_URL).then((offline) => {
              return offline || new Response('Offline', { status: 503 });
            });
          });
        })
    );
    return;
  }
});

// ============================================
// Message handler — for cache management
// ============================================

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
