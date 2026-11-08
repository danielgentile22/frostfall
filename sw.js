// The build stamps the cache name below with a hash of index.html, so every deploy ships a changed
// worker: the phone installs it, and the old cache is dropped on activate.
const CACHE = 'frostfall-516c0eb91b';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => {
        // 'reload' skips the HTTP cache (GitHub Pages sends max-age=600), so a new worker never
        // precaches the previous deploy's page.
        await cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })));
        // Vite's hashed bundles are only named in the built index.html, so read them from there.
        const html = await (await cache.match('./index.html')).text();
        await cache.addAll([...html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)].map((m) => new Request('./' + m[1], { cache: 'reload' })));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  // Pages go to the network first so a new deploy shows up on the next open; the cached copy
  // is only the offline fallback. Hashed assets never change, so they stay cache-first.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
