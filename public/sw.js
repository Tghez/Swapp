/*
 * Minimal service worker.
 *
 * Its purpose is installability, not offline support. Swapp is a live board of
 * who needs a shift covered right now; serving a cached copy of that would be
 * actively harmful — an intern could take a shift that was handed off
 * yesterday. So network wins for everything, and the cache exists only as a
 * last resort when navigation would otherwise fail outright.
 *
 * If real offline behaviour is ever wanted, replace this with @serwist/next
 * rather than growing it.
 */

const CACHE = "swapp-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only page navigations are handled. Static assets fall through to the
  // browser's own HTTP cache, which already does this better.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE_URL)) ?? Response.error();
    }),
  );
});
