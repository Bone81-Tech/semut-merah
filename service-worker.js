const CACHE_NAME = 'luwe-cache-v1';

const urlsToCache = [
    '/',
    '/index.html',
    'style.css',
    'script.js',
    // Anda bisa menambahkan URL gambar statis lainnya di sini jika perlu
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache terbuka untuk instalasi');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Aturan #1: Jika request BUKAN metode GET, jangan lakukan apa-apa.
  if (event.request.method !== 'GET') {
    return;
  }

  // Aturan #2: Untuk semua request GET, gunakan strategi "Cache First".
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request).then(networkResponse => {
            // --- PERBAIKAN KUNCI ADA DI SINI ---
            // Hanya coba cache jika respons valid DAN URL adalah http/https.
            // Ini akan mengabaikan semua request 'chrome-extension://'.
            if (networkResponse && networkResponse.status === 200 && event.request.url.startsWith('http')) {
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});