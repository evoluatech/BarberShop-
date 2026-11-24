const CACHE_NAME = 'barber-shop-pwa-v7';
const MAX_STATIC_CACHE_ENTRIES = 80;
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/apple-touch-icon.png',
  '/favicon.png',
  '/assets/aistudio/1794865202433_4193a4e3.jpg',
  '/images/barbershop_hero_1794653287317.jpg',
  '/images/barbershop_lounge_1794653288316.jpg',
  '/images/barber_rafael_1794653288488.jpg',
  '/images/barber_lucas_1794653289184.jpg',
  '/images/barber_diego_1794653289512.jpg',
  '/images/service_fade_cut_1794653288698.jpg',
  '/images/service_scissor_cut_1794653290939.jpg',
  '/images/service_beard_ritual_1794653292138.jpg',
  '/images/service_combo_finish_1794653292260.jpg',
];

async function safeCachePut(request, response) {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response);
    const keys = await cache.keys();
    if (keys.length > MAX_STATIC_CACHE_ENTRIES + PRECACHE_URLS.length) {
      const staleKeys = keys.filter(
        (k) => !PRECACHE_URLS.includes(new URL(k.url).pathname)
      );
      if (staleKeys.length > MAX_STATIC_CACHE_ENTRIES) {
        const toDelete = staleKeys.slice(0, staleKeys.length - MAX_STATIC_CACHE_ENTRIES);
        await Promise.all(toDelete.map((k) => cache.delete(k)));
      }
    }
  } catch {
    // Ignore cache quota failures gracefully so mobile clients never freeze
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const {request} = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache auth sessions, CSRF tokens, appointments, availability, or AI endpoints
  if (url.pathname.startsWith('/api/') && url.pathname !== '/api/shop') {
    return;
  }

  // Shop metadata API: network-first with cache fallback for offline catalog viewing
  if (url.pathname === '/api/shop') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            safeCachePut(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || Response.error();
        })
    );
    return;
  }

  // Next.js static chunks & CSS: network-first so dev stays fresh, with offline cache fallback
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            safeCachePut(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || Response.error();
        })
    );
    return;
  }

  // Skip Next.js dynamic image optimizer and dev HMR endpoints
  if (url.pathname.startsWith('/_next/')) {
    return;
  }

  // Navigation requests: network-first with cached app shell fallback for offline usage
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = (await caches.match(request)) || (await caches.match('/'));
          return (
            cached ||
            new Response(
              'Modo offline ativo. Conecte-se novamente para atualizar a Barber Shop.',
              {
                status: 503,
                headers: {'Content-Type': 'text/plain; charset=utf-8'},
              }
            )
          );
        })
    );
    return;
  }

  // Brand assets and static images: stale-while-revalidate with guaranteed Response fallback
  if (
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/pwa-') ||
    url.pathname === '/apple-touch-icon.png' ||
    url.pathname === '/favicon.png' ||
    url.pathname === '/manifest.webmanifest'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cached || Response.error());

        return cached || fetchPromise;
      })
    );
  }
});
