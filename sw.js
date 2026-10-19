/* Service worker: o guia abre sem internet. Só trata o próprio site; outros domínios (previsão do tempo, OpenAI) vão direto à rede. */
const CACHE = "florida-guia-v19";
const CORE = [
  "./", "./index.html", "./manifest.webmanifest", "./icon.svg",
  "./css/app.css", "./js/data.js", "./js/checklist-data.js", "./js/store.js", "./js/sync.js", "./js/ai.js", "./js/extra-data.js", "./js/extra.js", "./js/app.js",
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
