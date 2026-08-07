// SierraVista Behavioral Health service worker — enables offline use and installability.
// Bump this version any time index.html (or any cached file) changes,
// so returning users get the update instead of a stale cached copy.
const CACHE_VERSION = "sierravista-v9";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./apple-touch-icon-167.png",
  "./apple-touch-icon-152.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      // Cache each asset independently so one missing/mis-cased file
      // (e.g. an icon that failed to upload) doesn't sink the whole
      // service worker and silently break offline support + installability.
      return Promise.all(
        CORE_ASSETS.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn("SierraVista: could not precache", url, err);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_VERSION; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var networkFetch = fetch(event.request)
        .then(function (response) {
          // Keep the cache fresh with a copy of any successful same-origin response
          if (response && response.status === 200 && response.type === "basic") {
            var copy = response.clone();
            caches.open(CACHE_VERSION).then(function (cache) {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(function () {
          // Offline and not cached — for page navigations, fall back to the app shell
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });

      // Serve from cache immediately if we have it, still refresh in background
      return cached || networkFetch;
    })
  );
});
