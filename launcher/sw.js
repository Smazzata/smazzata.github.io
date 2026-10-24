// Service worker della pagina d'ingresso: salva la pagina e la copia del gioco (cartella gioca/)
// così, senza internet, l'app si apre lo stesso e si può giocare contro il computer.
// "Prima la rete": da collegati si usa sempre la versione più recente.
const CACHE = 'burraco-ingresso-v69';
const SHELL = [
  'gioca/art/chests/chest-opening.webp', 'gioca/art/chests/chest-rare.webp', 'gioca/art/chests/chest-epic.webp', 'gioca/art/chests/chest-legendary.webp', 'gioca/js/chests.js',
  'gioca/art/avatars/fante-quadri.webp', 'gioca/art/avatars/dama-fiori.webp', 'gioca/art/avatars/mazziere.webp', 'gioca/art/avatars/volpe.webp', 'gioca/art/avatars/gatto.webp', 'gioca/art/avatars/gufo.webp', 'gioca/art/avatars/orso.webp', 'gioca/art/avatars/tartaruga.webp', 'gioca/art/avatars/giardiniere-fiori.webp', 'gioca/art/avatars/asso-cuori.webp', 'gioca/art/avatars/asso-picche.webp', 'gioca/art/avatars/asso-quadri.webp', 'gioca/art/avatars/asso-fiori.webp', 'gioca/art/avatars/coniglio-gentile.webp', 'gioca/art/avatars/marinaia-coppe.webp', 'gioca/art/avatars/procione-curioso.webp', 'gioca/art/avatars/lontra-allegra.webp', 'gioca/art/avatars/riccio-trifoglio.webp', 'gioca/art/avatars/scoiattolo-ghianda.webp', 'gioca/art/avatars/topo-lettore.webp', 'gioca/art/avatars/koala-rilassato.webp', 'gioca/art/avatars/pinguino-elegante.webp', 'gioca/art/avatars/pasticciera-vaniglia.webp', 'gioca/art/avatars/panda-rosso.webp', 'gioca/art/avatars/re-cuori.webp', 'gioca/art/avatars/regina-picche.webp', 'gioca/art/avatars/jolly-corallo.webp', 'gioca/art/avatars/jolly-zaffiro.webp', 'gioca/art/avatars/leone.webp', 'gioca/art/avatars/volpe-lunare.webp', 'gioca/art/avatars/gatto-zaffiro.webp', 'gioca/art/avatars/gufo-astronomo.webp', 'gioca/art/avatars/coniglio-prestigiatore.webp', 'gioca/art/avatars/panda-imperiale.webp', 'gioca/art/avatars/lupo-argento.webp', 'gioca/art/avatars/pinguino-ammiraglio.webp', 'gioca/art/avatars/incantatrice-fiori.webp', 'gioca/art/avatars/alchimista-mazzo.webp', 'gioca/art/avatars/pavone-giada.webp', 'gioca/art/avatars/drago.webp', 'gioca/art/avatars/kitsune-corallo.webp', 'gioca/art/avatars/gatto-stregone.webp', 'gioca/art/avatars/gufo-oracolo.webp', 'gioca/art/avatars/unicorno-perlaceo.webp', 'gioca/art/avatars/grifone-dorato.webp', 'gioca/art/avatars/kraken-mazzo.webp', 'gioca/art/avatars/regina-nebbie.webp', 'gioca/art/avatars/fenice.webp', 'gioca/art/avatars/drago-imperatore.webp', 'gioca/art/avatars/volpe-nove-code.webp',
  'gioca/js/avatars.js',
  'gioca/shared/avatars.js',
  'gioca/ranked.css', 'gioca/js/ranked.js', 'gioca/art/ranked/bronze-I.svg', 'gioca/art/ranked/bronze-II.svg', 'gioca/art/ranked/bronze-III.svg', 'gioca/art/ranked/bronze-IV.svg', 'gioca/art/ranked/champion-I.svg', 'gioca/art/ranked/champion-II.svg', 'gioca/art/ranked/champion-III.svg', 'gioca/art/ranked/champion-IV.svg', 'gioca/art/ranked/diamond-I.svg', 'gioca/art/ranked/diamond-II.svg', 'gioca/art/ranked/diamond-III.svg', 'gioca/art/ranked/diamond-IV.svg', 'gioca/art/ranked/gold-I.svg', 'gioca/art/ranked/gold-II.svg', 'gioca/art/ranked/gold-III.svg', 'gioca/art/ranked/gold-IV.svg', 'gioca/art/ranked/grandmaster-I.svg', 'gioca/art/ranked/grandmaster-II.svg', 'gioca/art/ranked/grandmaster-III.svg', 'gioca/art/ranked/grandmaster-IV.svg', 'gioca/art/ranked/legend.svg', 'gioca/art/ranked/master-I.svg', 'gioca/art/ranked/master-II.svg', 'gioca/art/ranked/master-III.svg', 'gioca/art/ranked/master-IV.svg', 'gioca/art/ranked/platinum-I.svg', 'gioca/art/ranked/platinum-II.svg', 'gioca/art/ranked/platinum-III.svg', 'gioca/art/ranked/platinum-IV.svg', 'gioca/art/ranked/silver-I.svg', 'gioca/art/ranked/silver-II.svg', 'gioca/art/ranked/silver-III.svg', 'gioca/art/ranked/silver-IV.svg',
  'gioca/classifica.css', 'gioca/js/classifica.js', 'gioca/art/leagues/unranked.webp', 'gioca/art/leagues/bronze.webp', 'gioca/art/leagues/silver.webp', 'gioca/art/leagues/gold.webp', 'gioca/art/leagues/platinum.webp', 'gioca/art/leagues/diamond.webp', 'gioca/art/leagues/master.webp', 'gioca/art/leagues/grandmaster.webp', 'gioca/art/leagues/champion.webp', 'gioca/art/leagues/legend.webp',
  'gioca/campaign-story.css', 'gioca/js/campaign-story.js', 'gioca/art/campaign/garden.webp', 'gioca/art/campaign/rosa.webp', 'gioca/art/campaign/bruno.webp', 'gioca/art/campaign/barone.webp', 'gioca/art/campaign/boosters.webp',
  'gioca/art/campaign/clockwork.webp', 'gioca/art/campaign/arturo.webp', 'gioca/art/campaign/nina.webp', 'gioca/art/campaign/conte.webp', 'gioca/art/campaign/bay.webp', 'gioca/art/campaign/marina.webp', 'gioca/art/campaign/pippo.webp', 'gioca/art/campaign/nebbia.webp', 'gioca/art/campaign/boosters-scala40.webp', 'gioca/art/campaign/boosters-ramino.webp',
  './', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'gioca/', 'gioca/index.html', 'gioca/intro.css', 'gioca/js/lingue.js', 'gioca/lingue/en.js', 'gioca/lingue/es.js', 'gioca/lingue/pt.js', 'gioca/js/base.js', 'gioca/js/connessione.js', 'gioca/js/carte.js', 'gioca/js/ui.js', 'gioca/js/profilo.js', 'gioca/js/tutorial.js', 'gioca/js/schermate.js', 'gioca/js/tavolo.js', 'gioca/js/animazioni.js', 'gioca/js/finestre.js', 'gioca/js/moviola.js', 'gioca/js/azioni.js', 'gioca/js/campagna.js', 'gioca/js/comandi.js',
  'gioca/style.css', 'gioca/campaign.css', 'gioca/fonts/nunito.woff2', 'gioca/fonts/playfair.woff2', 'gioca/local-server.js', 'gioca/engine.js',
  'gioca/js/campaign-adventure.js',
  'gioca/shared/available-games.js', 'gioca/shared/rules.js', 'gioca/shared/melds.js', 'gioca/shared/scala40.js', 'gioca/shared/ramino.js', 'gioca/shared/canasta.js', 'gioca/shared/scopa.js', 'gioca/shared/briscola.js', 'gioca/shared/tressette.js', 'gioca/shared/rubamazzetto.js', 'gioca/shared/briscola5.js', 'gioca/shared/campaign.js', 'gioca/shared/premi.js', 'gioca/icon.svg', 'gioca/manifest.webmanifest',
  'gioca/licenze.html', 'gioca/fonts/nunito-OFL.txt', 'gioca/fonts/playfair-OFL.txt', 'gioca/privacy.html', 'gioca/elimina-profilo.html', 'gioca/regole.html', 'gioca/icons/icon-192.png',
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
