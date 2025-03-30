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

// إضافة متغير لتتبع حالة الاتصال
let isOnline = true;

// إضافة مستمع لحدث الاتصال
self.addEventListener('online', () => {
    isOnline = true;
    refreshCache();
});

// إضافة مستمع لحدث قطع الاتصال
self.addEventListener('offline', () => {
    isOnline = false;
});

// دالة لتحديث الكاش
async function refreshCache() {
    if (!isOnline) return;

    try {
        const cache = await caches.open(CACHE_NAME);
        
        // تحديث جميع الأصول المخزنة
        const keys = await cache.keys();
        const refreshPromises = keys.map(async (request) => {
            try {
                const response = await fetch(request);
                if (response && response.status === 200) {
                    await cache.put(request, response);
                }
            } catch (error) {
                console.warn(`Failed to refresh: ${request.url}`, error);
            }
        });

        await Promise.allSettled(refreshPromises);
    } catch (error) {
        console.error('Cache refresh failed:', error);
    }
}

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

// تحديث مستمع الـ fetch
self.addEventListener('fetch', (event) => {
    // Only handle HTTP(S) requests
    if (!event.request.url.startsWith('http')) {
        return;
    }

    const url = new URL(event.request.url);
    
    const isAllowedHost = CACHE_ALLOWED_HOSTS.some(host => url.hostname.includes(host));
    const isSameOrigin = url.origin === location.origin;
    
    if (!isSameOrigin && !isAllowedHost) {
        return;
    }

    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME)
                        .then(cache => {
                            cache.put(event.request, responseToCache);
                        });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});

// تحديث دورياً كل ساعة
setInterval(refreshCache, 60 * 60 * 1000);
