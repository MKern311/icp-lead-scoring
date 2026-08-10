// Service Worker: cache-first mit versioniertem Cache — offline nach erstem Laden
// (Constitution III). Bei neuer Version Cache-Namen hochzählen.

const CACHE = 'icp-cache-v3';

const ASSETS = [
  './',
  './index.html',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './js/app.js',
  './js/store.js',
  './js/templates.js',
  './js/core/model.js',
  './js/core/scoring.js',
  './js/core/csv.js',
  './js/core/profile-io.js',
  './js/core/screening.js',
  './js/screening-api.js',
  './js/ui/workflow.js',
  './js/ui/profile-list.js',
  './js/ui/profile-editor.js',
  './js/ui/lead-form.js',
  './js/ui/lead-list.js',
  './js/ui/import-wizard.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('icp-cache-') && key !== CACHE).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || fetch(event.request)),
  );
});
