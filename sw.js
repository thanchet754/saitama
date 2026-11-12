// Saitama offline service worker
// - own files: network-first (updates show up immediately), cache fallback when offline
// - versioned CDN libs, fonts, MediaPipe model: cache-first
// - map tiles: cache-first, capped
// - Supabase / geocoding APIs: never cached (data is stored in localStorage and synced by the page)
const VERSION = 'saitama-v4';
const SHELL = `${VERSION}-shell`;
const CDN = `${VERSION}-cdn`;
const TILES = `${VERSION}-tiles`;
const MAX_TILES = 600;

const SHELL_FILES = [
    '/', '/style.css', '/native.js', '/exercises.js', '/script.js', '/recorder.js', '/videos.js',
    '/activity.js', '/programs.js', '/demo3d.js', '/offline.js', '/app-version.json'
];

const MP = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/';
const CDN_WARM = [
    MP + 'pose.js',
    MP + 'pose_solution_packed_assets_loader.js',
    MP + 'pose_solution_packed_assets.data',
    MP + 'pose_solution_simd_wasm_bin.js',
    MP + 'pose_solution_simd_wasm_bin.wasm',
    MP + 'pose_web.binarypb',
    MP + 'pose_landmark_full.tflite',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js',
    'https://cdn.jsdelivr.net/npm/@capacitor/core@8.6.0/dist/capacitor.js',
    'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-regular-400.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-brands-400.woff2'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const shell = await caches.open(SHELL);
        await Promise.all(SHELL_FILES.map(u => shell.add(new Request(u, { cache: 'reload' })).catch(() => {})));
        self.skipWaiting();
        // Warm the libraries + AI model in the background so the camera works offline
        // even if it was never opened online (failures are fine: runtime caching covers them)
        const cdn = await caches.open(CDN);
        for (const u of CDN_WARM) {
            if (await cdn.match(u)) continue;
            try { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await cdn.put(u, r); } catch (e) {}
        }
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keep = [SHELL, CDN, TILES];
        for (const k of await caches.keys()) if (!keep.includes(k)) await caches.delete(k);
        await self.clients.claim();
    })());
});

const isCdn = (url) => /(^|\.)(jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname);
const isTile = (url) => url.hostname === 'tile.openstreetmap.org';

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    if (url.origin === self.location.origin) {
        if (url.pathname === '/sw.js') return;
        event.respondWith(networkFirst(req));
    } else if (isCdn(url)) {
        event.respondWith(cacheFirst(req, CDN));
    } else if (isTile(url)) {
        event.respondWith(cacheFirst(req, TILES, MAX_TILES));
    }
    // everything else (Supabase, geocoding...) goes straight to the network
});

async function networkFirst(req) {
    const cache = await caches.open(SHELL);
    const key = req.mode === 'navigate' ? '/' : req;
    try {
        const res = await fetch(req);
        if (res.ok && res.type === 'basic' && !res.redirected) cache.put(key, res.clone());
        return res;
    } catch (e) {
        const hit = await cache.match(key, { ignoreSearch: true });
        if (hit) return hit;
        throw e;
    }
}

async function cacheFirst(req, name, max) {
    const cache = await caches.open(name);
    const hit = await cache.match(req, { ignoreVary: true }) || await cache.match(req.url, { ignoreVary: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') {
        await cache.put(req, res.clone());
        if (max) trim(cache, max);
    }
    return res;
}

async function trim(cache, max) {
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
