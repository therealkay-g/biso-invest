// BISO INVEST — Service Worker PWA
// STRICT POLICY: Cache uniquement les assets statiques de l'application.
// AUCUNE donnée financière, transactionnelle, page dynamique ou navigation n'est interceptée.

const CACHE_NAME = 'biso-static-v2';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignorer toute méthode non-GET
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  // 1. Uniquement les requêtes de même origine (ignore les scripts tiers, extensions, etc.)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 2. Ne JAMAIS intercepter la navigation (pages HTML/SSR), Supabase, API ou authentification
  if (
    event.request.mode === 'navigate' ||
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/auth') ||
    url.pathname.startsWith('/rest') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/wallet') ||
    url.pathname.startsWith('/invest') ||
    url.pathname.startsWith('/team') ||
    url.pathname.startsWith('/profile') ||
    url.pathname.startsWith('/vip') ||
    url.pathname.startsWith('/about') ||
    url.pathname.startsWith('/service')
  ) {
    return;
  }

  // 3. Intercepter UNIQUEMENT les assets statiques connus
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/icon.svg' ||
    url.pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|css|js)$/i);

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Si le réseau échoue pour un asset, retourner une réponse vide plutôt que de faire échouer la promesse
          return new Response('', { status: 408, headers: { 'Content-Type': 'text/plain' } });
        });
    })
  );
});
