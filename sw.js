/**
 * Service worker d'Agendari.
 *
 * Estratègia:
 *  - navegacions: xarxa primer (per veure els canvis publicats) i, si no hi ha
 *    connexió, la còpia de index.html.
 *  - la resta de fitxers propis: cau primer i actualització en segon pla.
 *
 * En publicar canvis cal pujar CACHE_VERSION perquè els clients es refresquin.
 */

const CACHE_VERSION = 'agendari-v3';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/styles.css',
  './assets/js/app.js',
  './assets/js/backup.js',
  './assets/js/classfeed.js',
  './assets/js/ics.js',
  './assets/js/publish.js',
  './assets/js/dates.js',
  './assets/js/dialogs.js',
  './assets/js/dom.js',
  './assets/js/store.js',
  './assets/js/theme.js',
  './assets/js/toast.js',
  './assets/js/views.js',
  './assets/fonts/inter-latin.woff2',
  './assets/fonts/fraunces-latin.woff2',
  './assets/icons/favicon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Les classes publicades han de ser sempre les més recents que hi hagi.
  if (url.pathname.includes('/classes/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
