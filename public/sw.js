// Service worker: notifiche e copia del gioco per giocare anche senza internet.
// "Prima la rete": da collegati si usa sempre la versione più recente (e se ne salva una copia);
// senza rete si usa l'ultima copia salvata. La connessione di gioco (socket.io) non passa mai dalla copia.
const CACHE = 'burraco-gioco-v1';
const SHELL = [
  './', 'index.html', 'app.js', 'style.css', 'local-server.js', 'engine.js',
  'shared/rules.js', 'shared/melds.js', 'icon.svg', 'manifest.webmanifest', 'privacy.html', 'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  // ogni file per conto suo: se uno manca, gli altri si salvano lo stesso
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('burraco-gioco-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const SKIP = /\/(socket\.io|health|stato|stato\.json)(\/|$|\?)/;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || SKIP.test(url.pathname)) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })
      .then((hit) => hit || (req.mode === 'navigate' ? caches.match(new URL('index.html', self.registration.scope).href) : Response.error()))),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow(self.registration.scope);
    }),
  );
});
