// Network first, so students get new screens and course data as soon as they are online.
// Without a connection (or if it takes too long) the last saved copy is used.
const CACHE = 'class-schedule-v1';
const CORE = ['./', 'index.html', 'styles.css', 'app.js', 'i18n.js', 'data/courses.js', 'manifest.webmanifest', 'icon.svg'];
const TIMEOUT_MS = 5000;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await Promise.race([
        fetch(request, { cache: 'no-cache' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS))
      ]);
      if (response.ok) cache.put(request, response.clone());
      return response;
    } catch (err) {
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      throw err;
    }
  })());
});
