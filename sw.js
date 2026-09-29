// SLA Keuken tel-app — offline cache.
// Zet dit bestand naast index.html (zelfde map op GitHub Pages).
// App-pagina: eerst internet (altijd de nieuwste versie), zonder bereik de bewaarde versie.
// Excel-module (cdnjs): uit de cache, want die verandert niet.
const CACHE = 'sla-telapp-2026-09-28';
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => Promise.all([
                cache.add('./').catch(() => {}),
                cache.add(new Request(XLSX_URL, { mode: 'cors' })).catch(() => {})
            ]))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k.startsWith('sla-telapp-') && k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

function metTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), ms);
        promise.then(r => { clearTimeout(t); resolve(r); }, e => { clearTimeout(t); reject(e); });
    });
}

async function netwerkEerst(request) {
    const cache = await caches.open(CACHE);
    try {
        const res = await metTimeout(fetch(request), 5000);
        if (res && res.ok) cache.put(request.mode === 'navigate' ? './' : request, res.clone());
        return res;
    } catch (e) {
        const hit = (await cache.match(request, { ignoreSearch: true })) || (request.mode === 'navigate' ? await cache.match('./') : null);
        if (hit) return hit;
        throw e;
    }
}

async function cacheEerst(request) {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(request.url);
    if (hit) return hit;
    const res = await fetch(request);
    if (res && (res.ok || res.type === 'opaque')) cache.put(request.url, res.clone());
    return res;
}

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return; // verzenden naar Google Apps Script (POST) niet aanraken
    const url = new URL(req.url);
    if (req.mode === 'navigate' && url.origin === self.location.origin) {
        event.respondWith(netwerkEerst(req));
    } else if (url.href === XLSX_URL) {
        event.respondWith(cacheEerst(req));
    }
});
