/* NoteAI service worker — офлайн + быстрый запуск */
const VERSION = 'v5-2026-05-25';
const CACHE = 'noteai-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Anthropic API — никогда не кэшируем
  if (url.host.endsWith('api.anthropic.com')) return;

  // Навигация (HTML) — network-first, fallback на кэш
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Прочее — stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req);
      const fetchPromise = fetch(req)
        .then(res => {
          if (res && res.ok && (url.origin === location.origin || res.type === 'basic' || res.type === 'cors')) {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
