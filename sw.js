const CACHE_VERSION = 'fuel-v1';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/state.js?v=8',
  './js/api.js?v=8',
  './js/ui.js?v=8',
  './js/log.js?v=8',
  './js/meals.js?v=8',
  './js/recipes.js?v=8',
  './js/progress.js?v=8',
  './js/settings.js?v=8',
  './js/barcode.js?v=8',
  './js/main.js?v=8',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: always prefer fresh content when online (avoids serving stale
// app code), fall back to the cached app shell only when the network fails.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;
  if (url.includes('api.anthropic.com') || url.includes('api.nal.usda.gov')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
