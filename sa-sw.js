// سرویس‌ورکر حداقلی برای نصب‌پذیری اپ سوپر ادمین؛ عمداً هیچ چیزی کش نمی‌کند
// (داده‌های مالی و نشست همیشه مستقیم از شبکه می‌آیند).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
