/* Offline-Speicher: Die App-Dateien werden beim ersten Öffnen auf dem Gerät abgelegt.
   Danach läuft die App komplett ohne Internet (auch im Flugmodus).
   Dieser Service Worker lädt nur die eigenen App-Dateien und sendet nie Daten. */
const CACHE = 'mosaik-v2';
const FILES = ['./', './index.html', './app.js', './engine.js', './shapes.js', './jpeg-worker.js',
  './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Nur eigene Dateien per GET: erst Netz (für Updates), sonst Offline-Kopie
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith(fetch(r).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match('./index.html'))));
});
