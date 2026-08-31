// Service Worker لمنصة المبادرات — نطاقه ./ داخل مجلد المنصة فقط
// أسماء التخزين ببادئة مستقلة كي لا تتعارض مع أي تطبيق آخر في المستودع
const CACHE_PREFIX = 'madinah-initiatives-platform-';
const STATIC_CACHE = CACHE_PREFIX + 'static-v3';
const RUNTIME_CACHE = CACHE_PREFIX + 'runtime-v3';

const PRECACHE = [
  './',
  './index.html',
  './app.html',
  './login.html',
  './submit.html',
  './opportunity.html',
  './initiative-details.html',
  './partner-portal.html',
  './dashboard.html',
  './print.html',
  './offline.html',
  './404.html',
  './manifest.webmanifest',
  './assets/logo-placeholder.svg',
  './css/tokens.css',
  './css/base.css',
  './css/components.css',
  './css/layout.css',
  './css/navigation.css',
  './css/forms.css',
  './css/tables.css',
  './css/dashboard.css',
  './css/map.css',
  './css/print.css',
  './css/responsive.css',
  './css/themes.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        // ننظف فقط ما يخص هذه المنصة — لا نلمس أي Cache لتطبيق آخر
        .filter((k) => k.startsWith(CACHE_PREFIX) && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
        .map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // لا نتدخل في طلبات خارج نطاق المنصة (نطاق التسجيل يضمن ذلك للصفحات،
  // وهذا الشرط يضمنه للموارد الخارجية كالخطوط)
  const scopePath = new URL(self.registration.scope).pathname;
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scopePath)) return;

  // الصفحات: الشبكة أولًا مع الرجوع للتخزين ثم صفحة عدم الاتصال
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('./offline.html')))
    );
    return;
  }

  // شيفرة وأنماط المنصة (js/css/manifest): الشبكة أولًا كي تصل التحديثات فورًا،
  // مع الرجوع للتخزين دون اتصال
  if (/\.(js|mjs|css|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // بقية الموارد (صور وأيقونات): التخزين أولًا مع تحديث بالخلفية
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
