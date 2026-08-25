/* BoutiquePOS Service Worker for Offline Mode & Auto-Sync */
const CACHE_NAME = 'boutique-pos-shell-v1';
const DYNAMIC_CACHE = 'boutique-pos-dynamic-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/version.json'
];

// Install Event - Pre-cache core app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching offline app shell');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Some static assets failed to cache:', err);
      });
    })
  );
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== DYNAMIC_CACHE) {
            console.log('[ServiceWorker] Removing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Serve offline content and handle network degradation
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests or chrome-extension URLs
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Navigation / HTML page requests -> Network First, fallback to cached index.html
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => {
          console.log('[ServiceWorker] Serving cached app shell for navigation');
          return caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }

  // Static Assets / JS / CSS / Fonts -> Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        })
        .catch((err) => {
          // Quiet failure for background revalidation
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Background Sync Event - Trigger sync when network connection is restored
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pos-transactions' || event.tag === 'sync-offline-queue') {
    console.log('[ServiceWorker] Background sync event triggered:', event.tag);
    event.waitUntil(notifyClientsToSync());
  }
});

// Helper function to send message to active window clients
async function notifyClientsToSync() {
  const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of allClients) {
    client.postMessage({
      type: 'NETWORK_RESTORED_SYNC',
      timestamp: Date.now()
    });
  }
}

// PostMessage Listener for manual client commands
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'TRIGGER_SYNC') {
    notifyClientsToSync();
  }

  if (event.data.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({
      version: CACHE_NAME,
      online: navigator.onLine
    });
  }
});
