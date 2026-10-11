// Admin PWA install support only. Never cache customer orders, auth tokens, or API responses.
const CACHE = 'ds-admin-test-shell-v2';
const SHELL = ['./admin.html', './admin.css', './admin.js',
  './admin-manifest.webmanifest', './admin-icon-192.png', './admin-icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ds-admin-test-shell-') && k !== CACHE).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  // Network only: authentication and orders must never be served from a cache.
  const u = new URL(event.request.url);
  if (event.request.method !== 'GET' || u.origin !== self.location.origin) return;
  if (!SHELL.some(path => u.pathname === new URL(path, self.registration.scope).pathname)) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
