// Prosty service worker: pozwala zainstalować aplikację i otwiera ją szybciej.
// Dane zawsze idą z serwera; pliki aplikacji są w pamięci podręcznej jako zapas na słaby internet.
const CACHE = "zp-v14";
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

// Przypomnienia push (rano, południe, wieczór)
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Zadbany Pazurek", {
    body: d.body || "Obserwuj dłonie i zapisuj każdy moment.", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "pora-dnia", data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    const c = list.find(x => x.url.startsWith(self.registration.scope));
    return c ? c.focus() : self.clients.openWindow(e.notification.data && e.notification.data.url || "./");
  }));
});
