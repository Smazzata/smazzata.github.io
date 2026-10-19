# Burraco Online

Webapp per giocare a Burraco da browser e smartphone, in multiplayer o contro il computer.
Ogni regola della partita si può personalizzare quando si crea il tavolo.

## Avvio

```bash
npm install
npm start
```

Poi apri `http://localhost:3000`. All'avvio il server stampa anche l'indirizzo per la rete locale
(es. `http://192.168.1.3:3000`): aprilo dallo smartphone connesso allo stesso Wi‑Fi.
Dal browser del telefono puoi usare "Aggiungi a schermata Home" per averla come app.

Variabili d'ambiente: `PORT` (default 3000), `BOT_DELAY` in ms tra le mosse del computer (default 700).

## Come funziona

- **Preset**: Burraco Classico (regole da torneo), Burraco Reale, Buraco Brasiliano Aberto e Fechado.
  Sono punti di partenza: ogni regola (giocatori 2/3/4, jolly, matte, tris, scarti aperti/chiusi,
  condizioni di chiusura, fine tallone, vulnerabilità, punteggi e bonus, obiettivo) è modificabile.
- **Spiegazione regole**: generata automaticamente dalla configurazione scelta (`shared/rules.js` → `describe`).
- **Multiplayer**: chi crea il tavolo riceve un codice di 4 lettere e un link di invito; i posti liberi
  si possono riempire con giocatori del computer. Se un giocatore esce durante la partita, il suo posto passa al computer.
  Se ricarichi la pagina rientri al tuo posto.

## Struttura

- `shared/rules.js` — schema delle regole, preset, generatore della spiegazione (usato da server e browser)
- `shared/melds.js` — analisi di scale e tris, usata dal server per validare e dal browser per l'anteprima delle mosse
- `server/engine.js` — motore di gioco autoritativo (validazione mosse, pozzetti, chiusura, punteggio)
- `server/bot.js` — giocatore del computer
- `server/index.js` — server Express + Socket.IO (tavoli, posti, riconnessione, chat)
- `server/selftest.js` — test: `npm test` simula partite complete tra bot con tutti i preset e configurazioni casuali
- `npm run anim` verifica voli, atterraggi e assenza di ridisegni duplicati allo scarto. Richiede Chrome o Edge.
- `npm run anim -- --landing` esegue solo la regressione degli scarti: carta propria e avversaria, conferme da 0 a 500ms e ridisegno durante il volo, anche con CPU rallentata 4×. Controlla che la carta sulla pila compaia soltanto quando quella in volo ha raggiunto la stessa posizione. Questi controlli sono inclusi anche in `npm run anim`.
- `npm run anim -- --perf` misura il dimensionamento del tavolo in 36 scenari (telefono verticale/orizzontale e desktop, carte grandi, combinazioni in colonna, tavoli pieni), con CPU rallentata 4×. Salva le mediane di cinque misure in `test-output/render-perf.json`. Per confrontare anche la geometria con una versione precedente, impostare `PERF_BASELINE` al percorso di una copia del vecchio `public/js/tavolo.js`. Sono misure del layout, non degli FPS su un telefono reale.
- `public/` — interfaccia (HTML/CSS/JS senza build)

## Pubblicarla online

Il gioco è pensato per girare su un **telefono Android con Termux** (gratis, sempre acceso):
`scripts/android-server.sh` installa tutto, avvia il server, apre un tunnel Cloudflare gratuito
e scarica da solo gli aggiornamenti pubblicati su GitHub ogni 5 minuti.

```bash
pkg install -y git && git clone https://github.com/smazzata/smazzata.github.io.git ~/burraco && bash ~/burraco/scripts/android-server.sh
```

Con `--install-boot` (app Termux:Boot) il server riparte da solo quando il telefono si riaccende.
In alternativa va bene qualsiasi hosting Node.js con WebSocket: comando di avvio `npm start`.
Le partite vengono salvate in `data/stato.json` (cartella configurabile con `DATA_DIR`): dopo un riavvio o un aggiornamento i tavoli riprendono da dove erano.

## Link fisso e app Android

- **Link per tutti**: https://smazzata.github.io/ — pagina d'ingresso (cartella `launcher/`,
  pubblicata da `.github/workflows/pages.yml`) che legge l'indirizzo attuale del server dal ramo `indirizzo`
  (file `server.json`, scritto dallo script Android) e porta al tavolo. Su iPhone si aggiunge alla schermata Home.
- **App Android**: https://github.com/smazzata/smazzata.github.io/releases/latest/download/Burraco.apk —
  guscio Capacitor (`android-app/`) che apre la pagina d'ingresso; lo costruisce e pubblica `.github/workflows/apk.yml`.
  Va ricostruito solo se cambia `android-app/`: gli aggiornamenti del gioco arrivano dal server.
- Lo script Android pubblica l'indirizzo se trova il token in `~/.burraco-github-token`
  (`bash ~/burraco/scripts/android-server.sh --set-token`; token GitHub "fine-grained" con permesso Contents su questo repository).

## Backup

Ogni 6 ore il telefono-server cifra `data/stato.json` con una frase segreta scelta da te (scrypt + AES-256-GCM)
e lo carica nel ramo `backup` del repository (ultimi 7 giorni). Senza la frase il file è illeggibile.

- Impostare la frase (una volta): `bash ~/burraco/scripts/android-server.sh --set-backup-pass` — servono anche il token (`--set-token`).
- Ripristinare su un telefono nuovo: imposta la stessa frase, poi `bash ~/burraco/scripts/android-server.sh --restore`.
- A mano: `node scripts/backup.js crea data/stato.json backup.json` / `node scripts/backup.js ripristina backup.json data/stato.json`.
