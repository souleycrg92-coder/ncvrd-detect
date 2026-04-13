// Service Worker for NCVRD Detect PWA — v3
const CACHE_NAME = 'ncvrd-detect-v3';

// Ressources locales à cacher obligatoirement
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Ressources CDN critiques (Firebase + Fonts) — cachées au premier usage
const CDN_ASSETS = [
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage-compat.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Rajdhani:wght@600;700&family=Orbitron:wght@700;900&display=swap'
];

// Libs chargées à la demande (docx, jszip) — cachées au premier usage
const LAZY_CDN = [
  'https://unpkg.com/docx@8.5.0/build/index.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// ── Install : cacher les ressources locales + CDN critiques ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // Locales — obligatoires
      await cache.addAll(LOCAL_ASSETS).catch(() => {});
      // CDN critiques — best effort (ne bloque pas l'install)
      for(const url of CDN_ASSETS){
        try { await cache.add(url); } catch(_){}
      }
    })
  );
  self.skipWaiting();
});

// ── Activate : nettoyer les anciens caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// ── Fetch : stratégie réseau-first avec cache fallback ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Ignorer les requêtes non-GET
  if(event.request.method !== 'GET') return;

  // Ignorer les requêtes Firebase Firestore/Auth (temps réel, pas cachable)
  if(url.includes('firestore.googleapis.com') ||
     url.includes('identitytoolkit.googleapis.com') ||
     url.includes('securetoken.googleapis.com')) return;

  // Stratégie pour les fonts Google (cache-first, rarement changent)
  if(url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')){
    event.respondWith(
      caches.match(event.request).then(cached => {
        if(cached) return cached;
        return fetch(event.request).then(res => {
          if(res && res.status === 200){
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        }).catch(() => cached);
      })
    );
    return;
  }

  // Stratégie pour les scripts CDN (cache-first — version figée)
  if(url.includes('gstatic.com/firebasejs/') ||
     url.includes('unpkg.com/docx@') ||
     url.includes('cdnjs.cloudflare.com/')){
    event.respondWith(
      caches.match(event.request).then(cached => {
        if(cached) return cached;
        return fetch(event.request).then(res => {
          if(res && res.status === 200){
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Stratégie pour les ressources locales (network-first, fallback cache)
  if(url.startsWith(self.location.origin)){
    event.respondWith(
      fetch(event.request).then(res => {
        if(res && res.status === 200){
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
});
