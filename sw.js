const CACHE_NAME = 'student-attendance-v1';
const ASSETS_TO_CACHE = [
    './index.html',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                // Try to cache each asset individually
                return Promise.allSettled(
                    ASSETS_TO_CACHE.map(url => 
                        cache.add(url).catch(error => {
                            console.warn(`Failed to cache ${url}:`, error);
                            return null;
                        })
                    )
                );
            })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => caches.delete(name))
                );
            })
            .catch(error => {
                console.warn('Cache cleanup error:', error);
            })
    );
});

self.addEventListener('fetch', (event) => {
    // Skip non-HTTP/HTTPS requests
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                
                // Only clone and cache HTTP/HTTPS requests
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest)
                    .then(response => {
                        // Check if valid response and is HTTP/HTTPS
                        if (!response || response.status !== 200 || 
                            !response.url.startsWith('http')) {
                            return response;
                        }

                        try {
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    // Only cache same-origin and whitelisted CDN resources
                                    const url = new URL(event.request.url);
                                    const isSameOrigin = url.origin === location.origin;
                                    const isWhitelistedCDN = ASSETS_TO_CACHE.some(asset => 
                                        event.request.url.includes(asset));

                                    if (isSameOrigin || isWhitelistedCDN) {
                                        cache.put(event.request, responseToCache)
                                            .catch(err => console.warn('Cache put error:', err));
                                    }
                                })
                                .catch(err => console.warn('Cache open error:', err));
                        } catch (error) {
                            console.warn('Cache operation error:', error);
                        }

                        return response;
                    })
                    .catch(error => {
                        console.warn('Fetch failed:', error);
                        return new Response('Offline');
                    });
            })
    );
});
