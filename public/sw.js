// Service worker: notifiche e copia del gioco per giocare anche senza internet.
// "Prima la rete": da collegati si usa sempre la versione più recente (e se ne salva una copia);
// senza rete si usa l'ultima copia salvata. La connessione di gioco (socket.io) non passa mai dalla copia.
const CACHE = 'burraco-gioco-v86';
const SHELL = [
  'js/collection.js', 'collection.css', 'shared/cosmetics.js', 'js/cosmetics.js', 'cosmetics.css', 'art/cosmetics/back/trama-rubino.webp', 'art/cosmetics/back/picche-del-bosco.webp', 'art/cosmetics/back/fiordaliso.webp', 'art/cosmetics/back/filo-di-rame.webp', 'art/cosmetics/back/vento-marino.webp', 'art/cosmetics/back/lavanda.webp', 'art/cosmetics/back/geometrie-salvia.webp', 'art/cosmetics/back/righe-del-mazziere.webp', 'art/cosmetics/back/mosaico-terracotta.webp', 'art/cosmetics/back/foglie-d-autunno.webp', 'art/cosmetics/back/rosa-dei-venti.webp', 'art/cosmetics/back/vetri-di-murano.webp', 'art/cosmetics/back/piuma-di-pavone.webp', 'art/cosmetics/back/orologio-lunare.webp', 'art/cosmetics/back/giardino-d-inverno.webp', 'art/cosmetics/back/scaglie-d-ambra.webp', 'art/cosmetics/back/biblioteca-arcana.webp', 'art/cosmetics/back/cometa-di-cristallo.webp', 'art/cosmetics/back/drago-d-ossidiana.webp', 'art/cosmetics/back/sigillo-dell-aurora.webp', 'art/cosmetics/felt/panno-foresta.webp', 'art/cosmetics/felt/velluto-blu-notte.webp', 'art/cosmetics/felt/cotone-bordeaux.webp', 'art/cosmetics/felt/ardesia-soffice.webp', 'art/cosmetics/felt/tessuto-petrolio.webp', 'art/cosmetics/felt/muschio.webp', 'art/cosmetics/felt/zaffiro-fume.webp', 'art/cosmetics/felt/crepuscolo-viola.webp', 'art/cosmetics/felt/sabbia-d-ulivo.webp', 'art/cosmetics/felt/terracotta-scura.webp', 'art/cosmetics/felt/salotto-veneziano.webp', 'art/cosmetics/felt/serra-al-tramonto.webp', 'art/cosmetics/felt/salone-d-ambra.webp', 'art/cosmetics/felt/osservatorio.webp', 'art/cosmetics/felt/riva-notturna.webp', 'art/cosmetics/felt/biblioteca-di-noce.webp', 'art/cosmetics/felt/santuario-di-giada.webp', 'art/cosmetics/felt/palazzo-delle-nuvole.webp', 'art/cosmetics/felt/forgia-celeste.webp', 'art/cosmetics/felt/giardino-dell-eternita.webp', 'art/cosmetics/reaction/orso-applaude.webp', 'art/cosmetics/reaction/volpe-saluta.webp', 'art/cosmetics/reaction/gatto-ringrazia.webp', 'art/cosmetics/reaction/coniglio-sorpreso.webp', 'art/cosmetics/reaction/gufo-riflette.webp', 'art/cosmetics/reaction/lontra-ride.webp', 'art/cosmetics/reaction/riccio-incoraggia.webp', 'art/cosmetics/reaction/pinguino-approva.webp', 'art/cosmetics/reaction/panda-rosso-abbraccia.webp', 'art/cosmetics/reaction/tartaruga-aspetta.webp', 'art/cosmetics/reaction/leone-si-inchina.webp', 'art/cosmetics/reaction/prestigiatore-festeggia.webp', 'art/cosmetics/reaction/gufo-meravigliato.webp', 'art/cosmetics/reaction/lupo-ammicca.webp', 'art/cosmetics/reaction/pavone-elegante.webp', 'art/cosmetics/reaction/alchimista-brillante.webp', 'art/cosmetics/reaction/grifone-esulta.webp', 'art/cosmetics/reaction/unicorno-incanta.webp', 'art/cosmetics/reaction/gatto-stregone-trionfa.webp', 'art/cosmetics/reaction/fenice-celebra.webp',
  'art/chests/chest-opening.webp', 'art/chests/chest-rare.webp', 'art/chests/chest-epic.webp', 'art/chests/chest-legendary.webp', 'js/chests.js',
  'art/avatars/fante-quadri.webp', 'art/avatars/dama-fiori.webp', 'art/avatars/mazziere.webp', 'art/avatars/volpe.webp', 'art/avatars/gatto.webp', 'art/avatars/gufo.webp', 'art/avatars/orso.webp', 'art/avatars/tartaruga.webp', 'art/avatars/giardiniere-fiori.webp', 'art/avatars/asso-cuori.webp', 'art/avatars/asso-picche.webp', 'art/avatars/asso-quadri.webp', 'art/avatars/asso-fiori.webp', 'art/avatars/coniglio-gentile.webp', 'art/avatars/marinaia-coppe.webp', 'art/avatars/procione-curioso.webp', 'art/avatars/lontra-allegra.webp', 'art/avatars/riccio-trifoglio.webp', 'art/avatars/scoiattolo-ghianda.webp', 'art/avatars/topo-lettore.webp', 'art/avatars/koala-rilassato.webp', 'art/avatars/pinguino-elegante.webp', 'art/avatars/pasticciera-vaniglia.webp', 'art/avatars/panda-rosso.webp', 'art/avatars/re-cuori.webp', 'art/avatars/regina-picche.webp', 'art/avatars/jolly-corallo.webp', 'art/avatars/jolly-zaffiro.webp', 'art/avatars/leone.webp', 'art/avatars/volpe-lunare.webp', 'art/avatars/gatto-zaffiro.webp', 'art/avatars/gufo-astronomo.webp', 'art/avatars/coniglio-prestigiatore.webp', 'art/avatars/panda-imperiale.webp', 'art/avatars/lupo-argento.webp', 'art/avatars/pinguino-ammiraglio.webp', 'art/avatars/incantatrice-fiori.webp', 'art/avatars/alchimista-mazzo.webp', 'art/avatars/pavone-giada.webp', 'art/avatars/drago.webp', 'art/avatars/kitsune-corallo.webp', 'art/avatars/gatto-stregone.webp', 'art/avatars/gufo-oracolo.webp', 'art/avatars/unicorno-perlaceo.webp', 'art/avatars/grifone-dorato.webp', 'art/avatars/kraken-mazzo.webp', 'art/avatars/regina-nebbie.webp', 'art/avatars/fenice.webp', 'art/avatars/drago-imperatore.webp', 'art/avatars/volpe-nove-code.webp',
  'js/avatars.js',
  'shared/avatars.js',
  'ranked.css', 'js/ranked.js', 'art/ranked/bronze-I.svg', 'art/ranked/bronze-II.svg', 'art/ranked/bronze-III.svg', 'art/ranked/bronze-IV.svg', 'art/ranked/champion-I.svg', 'art/ranked/champion-II.svg', 'art/ranked/champion-III.svg', 'art/ranked/champion-IV.svg', 'art/ranked/diamond-I.svg', 'art/ranked/diamond-II.svg', 'art/ranked/diamond-III.svg', 'art/ranked/diamond-IV.svg', 'art/ranked/gold-I.svg', 'art/ranked/gold-II.svg', 'art/ranked/gold-III.svg', 'art/ranked/gold-IV.svg', 'art/ranked/grandmaster-I.svg', 'art/ranked/grandmaster-II.svg', 'art/ranked/grandmaster-III.svg', 'art/ranked/grandmaster-IV.svg', 'art/ranked/legend.svg', 'art/ranked/master-I.svg', 'art/ranked/master-II.svg', 'art/ranked/master-III.svg', 'art/ranked/master-IV.svg', 'art/ranked/platinum-I.svg', 'art/ranked/platinum-II.svg', 'art/ranked/platinum-III.svg', 'art/ranked/platinum-IV.svg', 'art/ranked/silver-I.svg', 'art/ranked/silver-II.svg', 'art/ranked/silver-III.svg', 'art/ranked/silver-IV.svg',
  'classifica.css', 'js/classifica.js', 'art/leagues/unranked.webp', 'art/leagues/bronze.webp', 'art/leagues/silver.webp', 'art/leagues/gold.webp', 'art/leagues/platinum.webp', 'art/leagues/diamond.webp', 'art/leagues/master.webp', 'art/leagues/grandmaster.webp', 'art/leagues/champion.webp', 'art/leagues/legend.webp',
  'campaign-story.css', 'js/campaign-story.js', 'art/campaign/garden.webp', 'art/campaign/rosa.webp', 'art/campaign/bruno.webp', 'art/campaign/barone.webp', 'art/campaign/boosters.webp',
  'art/campaign/clockwork.webp', 'art/campaign/arturo.webp', 'art/campaign/nina.webp', 'art/campaign/conte.webp', 'art/campaign/bay.webp', 'art/campaign/marina.webp', 'art/campaign/pippo.webp', 'art/campaign/nebbia.webp', 'art/campaign/boosters-scala40.webp', 'art/campaign/boosters-ramino.webp',
  './', 'index.html', 'intro.css', 'style.css', 'campaign.css', 'shared/campaign.js', 'js/campagna.js', 'js/campaign-adventure.js', 'fonts/nunito.woff2', 'fonts/playfair.woff2',
  'js/lingue.js', 'lingue/en.js', 'lingue/es.js', 'lingue/pt.js', 'js/base.js', 'js/music.js', 'js/connessione.js', 'js/carte.js', 'js/ui.js', 'js/profilo.js', 'js/tutorial.js', 'js/schermate.js', 'js/tavolo.js', 'js/animazioni.js', 'js/finestre.js', 'js/moviola.js', 'js/azioni.js', 'js/comandi.js', 'local-server.js', 'engine.js',
  'shared/available-games.js', 'shared/rules.js', 'shared/melds.js', 'shared/scala40.js', 'shared/ramino.js', 'shared/canasta.js', 'shared/scopa.js', 'shared/briscola.js', 'shared/tressette.js', 'shared/rubamazzetto.js', 'shared/briscola5.js', 'shared/premi.js', 'icon.svg', 'manifest.webmanifest', 'licenze.html', 'fonts/nunito-OFL.txt', 'fonts/playfair-OFL.txt', 'privacy.html', 'elimina-profilo.html', 'regole.html', 'icons/icon-192.png',
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
