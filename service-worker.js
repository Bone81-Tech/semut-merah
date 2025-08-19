
            const CACHE_NAME = 'luwe-cache-v1';
            const urlsToCache = [
                '/',
                '/index.html',
                'style.css',
                'script.js',
                'https://placehold.co/1200x400/FFD700/000000?text=Luwe',
                'https://placehold.co/400x400/FFA500/FFFFFF?text=Lumpia',
                'https://placehold.co/400x400/FFA500/FFFFFF?text=Rujak+Cingur',
                'https://placehold.co/400x400/FFA500/FFFFFF?text=Sate+Madura',
                'https://placehold.co/400x400/FFA500/FFFFFF?text=Tahu+Telor'
            ];
            
            self.addEventListener('install', event => {
              event.waitUntil(
                caches.open(CACHE_NAME)
                  .then(cache => {
                    console.log('Cache terbuka');
                    return cache.addAll(urlsToCache);
                  })
              );
            });
            
            self.addEventListener('fetch', event => {
              event.respondWith(
                caches.match(event.request)
                  .then(response => {
                    if (response) {
                      return response;
                    }
                    return fetch(event.request);
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
        