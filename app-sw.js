/* E.BANK – Service Worker (یکپارچه برای ورود، اعضا و ادمین) */
const CACHE = 'ebank-app-v1';
const SHELL = [
  '/index.html',
  '/member.html',
  '/admin.html',
  '/app.js',
  '/admin_app.js',
  '/app-manifest.json',
  '/icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ebank-app-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first (always fresh code/data), fall back to cache when offline.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // never touch POST/PATCH (Supabase writes)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Supabase / CDNs go straight to network

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('/index.html') : undefined))
      )
  );
});
