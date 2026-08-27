// Service Worker: cache-first mit versioniertem Cache — offline nach erstem Laden
// (Constitution III). Bei neuer Version Cache-Namen hochzählen.

const CACHE = 'icp-cache-v16';

const ASSETS = [
  './',
  './index.html',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './fonts/archivo-latin.woff2',
  './fonts/inter-latin.woff2',
  './js/gate.js',
  './js/app.js',
  './js/store.js',
  './js/templates.js',
  './js/core/model.js',
  './js/core/scoring.js',
  './js/core/csv.js',
  './js/core/profile-io.js',
  './js/core/screening.js',
  './js/core/profile-code.js',
  './js/core/backup.js',
  './js/screening-api.js',
  './js/ui/workflow.js',
  './js/ui/criterion-editor.js',
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
  // Lokale Konfiguration nie zwischenspeichern — ein alter Schlüssel wäre schlimmer
  // als gar keiner (Feature 006).
  if (new URL(event.request.url).pathname.endsWith('/__local-config')) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || fetch(event.request)),
  );
});
