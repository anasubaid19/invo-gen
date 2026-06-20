/* ============================================================
 *  AL-WILDAN Invoice Generator — Service Worker
 *  Strategi:
 *   - App shell (index.html, manifest, ikon): cache-first
 *   - Logo cabang & font: cache-first (stale otomatis terganti versi baru)
 *   - API GAS (script.google.com): network-only (jangan pernah di-cache)
 *   - Library CDN (jspdf/docx): cache-first agar tetap jalan walau jaringan lambat
 * ============================================================ */
const CACHE = 'aw-invoice-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // POST ke GAS dibiarkan ke jaringan

  const url = new URL(req.url);

  // API GAS: selalu jaringan, jangan cache (data dinamis)
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    return; // biarkan browser menangani via jaringan
  }

  // Navigasi halaman: network-first, fallback ke cache index
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Aset statis (ikon, logo, font, CDN lib): cache-first lalu isi cache
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // cache hanya respon valid
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
