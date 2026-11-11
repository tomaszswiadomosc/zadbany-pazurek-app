// Prosty service worker: pozwala zainstalować aplikację i otwiera ją szybciej.
// Dane zawsze idą z serwera; pliki aplikacji są w pamięci podręcznej jako zapas na słaby internet.
const CACHE = "zp-v5";
const FILES = ["./", "index.html", "style.css", "app.js", "plan.js", "config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "logo/napis-zadbany.png", "logo/napis-pazurek.png", "logo/pazurek-ikona.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // Supabase i czcionki: zawsze sieć
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); return r; })
    .catch(() => caches.match(e.request)));
});
