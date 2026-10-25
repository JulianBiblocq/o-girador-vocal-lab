// Service Worker léger O Girador — Cantador (Cache-Buster & Network-First)
const CACHE_NAME = 'cantador-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. version.json : no-store strict pour détecter immédiatement les mises à jour
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(
      fetch(request.url, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return (
            cached ||
            new Response('{}', {
              status: 200,
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
            })
          );
        })
    );
    return;
  }

  // 2. Navigation HTML (navigate) : network-first standard
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = (await caches.match(request)) || (await caches.match('/index.html'));
          return (
            cached ||
            new Response('Hors ligne / Offline', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        })
    );
    return;
  }

  // 3. Autres requêtes statiques (assets hachés, polices, manifest, sw, etc.)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return (
          cached ||
          new Response('Hors ligne / Offline', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
          })
        );
      })
  );
});
