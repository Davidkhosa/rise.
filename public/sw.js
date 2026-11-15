/* Rise service worker: makes the app installable and usable offline.
   Change VERSION when you want every installed copy to drop its old cache. */
const VERSION = "rise-v1";
const SHELL = ["/", "/index.html", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

const putInCache = async (request, response) => {
  if (response && (response.ok || response.type === "opaque")) {
    const cache = await caches.open(VERSION);
    await cache.put(request, response.clone());
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) return;

  /* pages: newest version when online, saved copy when offline */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((res) => putInCache("/index.html", res)).catch(() => caches.match("/index.html"))
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  /* app files, fonts and icons: saved copy first, refreshed in the background */
  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request).then((res) => putInCache(request, res)).catch(() => cached);
      return cached || fresh;
    })
  );
});

/* tapping a reminder opens Rise */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) if ("focus" in client) return client.focus();
      return self.clients.openWindow("/");
    })
  );
});
