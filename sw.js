const CACHE_NAME = 'student-attendance-v1';
const ASSETS_TO_CACHE = [
    './index.html',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

const CACHE_ALLOWED_HOSTS = [
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache opened');
                return Promise.allSettled(
                    ASSETS_TO_CACHE.map(url => 
                        cache.add(url)
                            .then(() => console.log(`Cached: ${url}`))
                            .catch(error => console.warn(`Failed to cache ${url}:`, error))
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
    // تجاهل الطلبات غير HTTP/HTTPS
    if (!event.request.url.startsWith('http')) return;

    // تجاهل طلبات chrome-extension
    if (event.request.url.startsWith('chrome-extension://')) return;

    const url = new URL(event.request.url);
    
    // التحقق من مصدر الطلب
    const isAllowedHost = CACHE_ALLOWED_HOSTS.some(host => url.hostname.includes(host));
    const isSameOrigin = url.origin === location.origin;
    
    if (!isSameOrigin && !isAllowedHost) return;

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }

                return fetch(event.request.clone())
                    .then(response => {
                        if (!response || response.status !== 200) {
                            return response;
                        }

                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache)
                                    .catch(err => console.warn('Cache put error:', err));
                            });

                        return response;
                    })
                    .catch(() => {
                        // في حالة فشل الطلب، نعيد استجابة "غير متصل"
                        return new Response('{"offline": true}', {
                            headers: { 'Content-Type': 'application/json' }
                        });
                    });
            })
    );
});
