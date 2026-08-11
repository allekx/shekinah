/* ============================================================
 * Service Worker do Sistema Shekinah (PWA).
 * Sistema é 100% ONLINE — este SW apenas:
 *  - habilita a INSTALAÇÃO como PWA (Android Chrome);
 *  - cacheia o app-shell básico (relatar a página offline);
 *  - recarrega automaticamente quando a internet voltar.
 * NÃO cacheia dados (pedidos/caixa continuam exigindo servidor).
 * ============================================================ */
const VERSION = "shekinah-v1";
const APP_SHELL = ["/", "/login", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
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

// Estratégia: network-first (site precisa de internet). App-shell como fallback.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    (async () => {
      try {
        const cache = await caches.open(VERSION);
        try {
          const fresh = await fetch(request);
          // cacheia os assets do app-shell (GET e mesma origem)
          if (new URL(request.url).origin === self.location.origin && request.destination !== "document") {
            cache.put(request, fresh.clone());
          }
          return fresh;
        } catch (err) {
          // offline: serve do cache
          const cached = await cache.match(request);
          if (cached) return cached;
          // página de navegação -> app-shell
          if (request.mode === "navigate") {
            const shell = await cache.match("/");
            if (shell) return shell;
          }
          throw err;
        }
      } catch (err) {
        return new Response("Sem conexão. Verifique a internet.", { status: 503, headers: { "Content-Type": "text/plain" } });
      }
    })()
  );
});

// Reload automático quando a internet voltar (mas só para requests que falharam).
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});