const CACHE_NAME = 'trece-v18'; // Change this number every time you push big changes

self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Claim any currently open tabs immediately
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // "Network First" strategy: Try the internet first, fall back to cache if offline
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});