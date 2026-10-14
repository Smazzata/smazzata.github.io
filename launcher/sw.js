// Service worker della pagina d'ingresso: salva la pagina e la copia del gioco (cartella gioca/)
// così, senza internet, l'app si apre lo stesso e si può giocare contro il computer.
// "Prima la rete": da collegati si usa sempre la versione più recente.
const CACHE = 'burraco-ingresso-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'gioca/', 'gioca/index.html', 'gioca/app.js', 'gioca/style.css', 'gioca/local-server.js', 'gioca/engine.js',
  'gioca/shared/rules.js', 'gioca/shared/melds.js', 'gioca/icon.svg', 'gioca/manifest.webmanifest',
  'gioca/privacy.html', 'gioca/icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('burraco-ingresso-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // solo i file di questo sito (l'indirizzo del server e il server stesso passano sempre dalla rete)
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then((hit) => hit || (req.mode === 'navigate' ? caches.match(new URL('index.html', self.registration.scope).href) : Response.error()))),
  );
});
