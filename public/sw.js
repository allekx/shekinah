/* ============================================================
 * Service Worker do Sistema Shekinah (PWA).
 * Habilita instalação standalone (Android) e app-shell offline básico.
 * ============================================================ */
const VERSION = "shekinah-v2";
const APP_SHELL = ["/login", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

async function cacheShell(cache) {
  await Promise.all(
    APP_SHELL.map(async (url) => {
      try {
        await cache.add(url);
      } catch {
        /* "/" pode redirecionar (307) — não quebra a instalação do SW */
      }
    })
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cacheShell(cache)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(VERSION);
        try {
          const fresh = await fetch(request);
          if (
            new URL(request.url).origin === self.location.origin &&
            request.destination !== "document"
          ) {
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          if (request.mode === "navigate") {
            const shell = (await cache.match("/login")) || (await cache.match("/"));
            if (shell) return shell;
          }
          throw new Error("offline");
        }
      } catch {
        return new Response("Sem conexão. Verifique a internet.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
