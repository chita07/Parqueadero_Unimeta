const CACHE_NAME = 'uniparking-shell-v2';
const SHELL = [
    './', './index.html', './pago.html', './mapa.html', './admin.html', './cesion.html', './anpr.html',
    './db.js', './parking-db.js', './index.js', './pago.js', './mapa.js', './admin.js', './cesion.js', './anpr.js',
    './index.css', './pago.css', './mapa.css', './admin.css', './cesion.css', './anpr.css'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL).catch(() => undefined)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('.supabase.co')) return;
    event.respondWith(
        fetch(event.request).then(response => {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
            return response;
        }).catch(() => caches.match(event.request).then(cached => cached || new Response('Sin conexión', { status: 503 })))
    );
});
