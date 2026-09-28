// سرویس‌ورکر حداقلی برای نصب‌پذیری PWA
// عمداً هیچ چیزی کش نمی‌کند تا از لوپ رفرش جلوگیری شود
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
