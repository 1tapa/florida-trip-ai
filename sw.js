/* Service worker: o guia abre sem internet. Só trata o próprio site; outros domínios (previsão do tempo, OpenAI) vão direto à rede. */
const CACHE = "florida-guia-v28";
const CORE = [
  "./", "./index.html", "./manifest.webmanifest", "./icon.svg",
  "./css/app.css", "./js/data.js", "./js/checklist-data.js", "./js/store.js", "./js/sync.js", "./js/backup.js", "./js/push.js", "./js/ai.js", "./js/extra-data.js", "./js/extra.js", "./js/app.js",
  "./fonts/marcellus-latin-400-normal.woff2", "./fonts/hanken-grotesk-latin-wght-normal.woff2",
  "./icons/icon.svg", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const STATIC = /\.(woff2|png|svg)$/;

function networkFirst(request, fallbackUrl) {
  return new Promise(resolve => {
    let settled = false;
    const useCache = () => caches.match(request).then(hit => hit || (fallbackUrl ? caches.match(fallbackUrl) : undefined));
    const timer = setTimeout(() => useCache().then(hit => { if (hit && !settled) { settled = true; resolve(hit); } }), 4000);
    fetch(request, { cache: "no-cache" }).then(response => {
      clearTimeout(timer);
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(c => c.put(request, copy)); }
      if (!settled) { settled = true; resolve(response); }
    }).catch(() => {
      clearTimeout(timer);
      useCache().then(hit => { if (!settled) { settled = true; resolve(hit || Response.error()); } });
    });
  });
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (STATIC.test(url.pathname)) {
    event.respondWith(caches.match(request).then(hit => hit || fetch(request).then(response => {
      if (response.ok) { const copy = response.clone(); caches.open(CACHE).then(c => c.put(request, copy)); }
      return response;
    })));
    return;
  }
  event.respondWith(networkFirst(request, request.mode === "navigate" ? "./index.html" : null));
});

/* Avisos no celular (filas dos parques e prazos do checklist). O texto chega criptografado e só este aparelho abre. */
self.addEventListener("push", event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { titulo: event.data ? event.data.text() : "Caderno de viagem" }; }
  event.waitUntil(self.registration.showNotification(d.titulo || "Caderno de viagem", {
    body: d.corpo || "", icon: "./icons/icon-192.png", badge: "./icons/icon-192.png", tag: d.tag || undefined, renotify: !!d.tag,
    data: { link: d.link || "#/" }
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const alvo = new URL("./" + ((event.notification.data && event.notification.data.link) || "#/"), self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    const w = ws.find(c => c.url.startsWith(self.registration.scope));
    if (w) { w.navigate(alvo).catch(() => {}); return w.focus(); }
    return self.clients.openWindow(alvo);
  }));
});
