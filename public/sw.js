// Service worker: notifiche e copia del gioco per giocare anche senza internet.
// "Prima la rete": da collegati si usa sempre la versione più recente (e se ne salva una copia);
// senza rete si usa l'ultima copia salvata. La connessione di gioco (socket.io) non passa mai dalla copia.
const CACHE = 'burraco-gioco-v53';
const SHELL = [
  'ranked.css', 'js/ranked.js', 'art/ranked/bronze-I.svg', 'art/ranked/bronze-II.svg', 'art/ranked/bronze-III.svg', 'art/ranked/bronze-IV.svg', 'art/ranked/champion-I.svg', 'art/ranked/champion-II.svg', 'art/ranked/champion-III.svg', 'art/ranked/champion-IV.svg', 'art/ranked/diamond-I.svg', 'art/ranked/diamond-II.svg', 'art/ranked/diamond-III.svg', 'art/ranked/diamond-IV.svg', 'art/ranked/gold-I.svg', 'art/ranked/gold-II.svg', 'art/ranked/gold-III.svg', 'art/ranked/gold-IV.svg', 'art/ranked/grandmaster-I.svg', 'art/ranked/grandmaster-II.svg', 'art/ranked/grandmaster-III.svg', 'art/ranked/grandmaster-IV.svg', 'art/ranked/legend.svg', 'art/ranked/master-I.svg', 'art/ranked/master-II.svg', 'art/ranked/master-III.svg', 'art/ranked/master-IV.svg', 'art/ranked/platinum-I.svg', 'art/ranked/platinum-II.svg', 'art/ranked/platinum-III.svg', 'art/ranked/platinum-IV.svg', 'art/ranked/silver-I.svg', 'art/ranked/silver-II.svg', 'art/ranked/silver-III.svg', 'art/ranked/silver-IV.svg',
  'classifica.css', 'js/classifica.js', 'art/leagues/unranked.webp', 'art/leagues/bronze.webp', 'art/leagues/silver.webp', 'art/leagues/gold.webp', 'art/leagues/platinum.webp', 'art/leagues/diamond.webp', 'art/leagues/master.webp', 'art/leagues/grandmaster.webp', 'art/leagues/champion.webp', 'art/leagues/legend.webp',
  'campaign-story.css', 'js/campaign-story.js', 'art/campaign/garden.webp', 'art/campaign/rosa.webp', 'art/campaign/bruno.webp', 'art/campaign/barone.webp', 'art/campaign/boosters.webp',
  'art/campaign/clockwork.webp', 'art/campaign/arturo.webp', 'art/campaign/nina.webp', 'art/campaign/conte.webp', 'art/campaign/bay.webp', 'art/campaign/marina.webp', 'art/campaign/pippo.webp', 'art/campaign/nebbia.webp', 'art/campaign/boosters-scala40.webp', 'art/campaign/boosters-ramino.webp',
  './', 'index.html', 'intro.css', 'style.css', 'campaign.css', 'shared/campaign.js', 'js/campagna.js', 'js/campaign-adventure.js', 'fonts/nunito.woff2', 'fonts/playfair.woff2',
  'js/lingue.js', 'lingue/en.js', 'lingue/es.js', 'lingue/pt.js', 'js/base.js', 'js/connessione.js', 'js/carte.js', 'js/ui.js', 'js/profilo.js', 'js/tutorial.js', 'js/schermate.js', 'js/tavolo.js', 'js/animazioni.js', 'js/finestre.js', 'js/moviola.js', 'js/azioni.js', 'js/comandi.js', 'local-server.js', 'engine.js',
  'shared/rules.js', 'shared/melds.js', 'shared/scala40.js', 'shared/ramino.js', 'shared/canasta.js', 'shared/scopa.js', 'shared/briscola.js', 'shared/tressette.js', 'shared/rubamazzetto.js', 'shared/briscola5.js', 'shared/premi.js', 'icon.svg', 'manifest.webmanifest', 'licenze.html', 'fonts/nunito-OFL.txt', 'fonts/playfair-OFL.txt', 'privacy.html', 'elimina-profilo.html', 'regole.html', 'icons/icon-192.png',
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

// notifiche push dal server (tocca a te nelle partite con calma, inviti degli amici)
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'Burraco', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Burraco', {
    body: d.body || '', tag: d.tag || 'burraco', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
    data: { url: d.url || null }, renotify: true,
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data && e.notification.data.url;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // dalla notifica push si apre la pagina d'ingresso fissa (trova il server e porta al tavolo)
      if (url) return self.clients.openWindow(url);
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow(self.registration.scope);
    }),
  );
});
