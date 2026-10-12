// Admin PWA install support only. Never cache customer orders, auth tokens, or API responses.
const CACHE = 'ds-admin-test-shell-v5';
const SHELL = ['./admin.html', './admin.css', './admin.js',
  './push-config.js', './admin-manifest.webmanifest', './admin-icon-192.png', './admin-icon-512.png'];
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

// Server-originated Web Push: displays an Android system notification when received.
self.addEventListener('push', event => {
  let payload={};
  try { payload=event.data ? event.data.json() : {}; } catch (_) {}
  const orderNumber=typeof payload.order_number==='string' && /^[-A-Za-z0-9]{1,40}$/.test(payload.order_number)
    ? payload.order_number : 'New order';
  const title='☕ Dark Secrets Coffee — New order';
  event.waitUntil(self.registration.showNotification(title,{
    body:`${orderNumber} is waiting for acceptance.`,
    icon:'./admin-icon-192.png',badge:'./admin-icon-192.png',
    tag:`ds-order-${orderNumber}`,renotify:true,
    data:{url:new URL('./admin.html',self.registration.scope).href}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target=new URL('./admin.html',self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    const existing=clients.find(client=>client.url.split('#')[0]===target);
    if(existing)return existing.focus();
    return self.clients.openWindow(target);
  }));
});
