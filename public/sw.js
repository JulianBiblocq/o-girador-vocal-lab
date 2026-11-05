// Service Worker léger O Girador — Cantador (Cache-Buster, Same-Origin Strict & Network-First)
const CACHE_NAME = 'cantador-cache-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 1. Ignorer toute requête non-GET
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // 2. Ignorer les protocoles non HTTP/HTTPS (ex: chrome-extension://)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // 3. Ignorer strictement toute requête Cross-Origin (Firestore, Storage .wav, Auth, Fonts)
  if (url.origin !== self.location.origin) return;

  // 4. Ignorer les requêtes Range (flux audio / streaming partiel HTTP 206)
  if (request.headers.has('range')) return;

  // 5. version.json : no-store strict pour détecter immédiatement les mises à jour
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(
      fetch(request.url, { cache: 'no-store' })
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
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

  // 6. Navigation HTML (navigate) : network-first avec repli SPA /index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
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

  // 7. Assets statiques same-origin (JS/CSS hachés, icônes, manifest)
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
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
