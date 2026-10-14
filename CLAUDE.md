# Burraco Online — guida per Claude Code

Giochi: **Burraco**, **Scala 40**, **Canasta** e i giochi a prese con carte italiane **Scopa** e **Briscola**
(`shared/<gioco>.js` regole condivise, `server/<gioco>.js` motore, `server/<gioco>-bot.js` computer). Le carte italiane
hanno i semi in minuscolo (d, c, s, b); i motori a prese espongono `presa: true` e il client usa `presaCenterHTML`. `server/games.js` è il registro dei giochi (motore, computer, regole):
il server sceglie il gioco da `rules.game` (senza = Burraco). Un nuovo gioco = motore con la stessa interfaccia
(createGame, apply, isLegal, viewFor, nextHand, surrender, teamOf, note) + computer (nextAction, thinkMs) + regole condivise.
Scala 40: `shared/scala40.js` (regole e analisi), `server/scala40.js`, `server/scala40-bot.js`; nel browser `RX` (in public/js/base.js)
sceglie regole e preset del gioco.

Webapp di Burraco multiplayer (Node.js + Express + Socket.IO, frontend HTML/CSS/JS senza build).
Autore: Muliello S.F. L'utente scrive in italiano: rispondi, commenta il codice e scrivi i messaggi di commit in italiano.

## Come è fatta
- `shared/rules.js` — schema delle regole modificabili, preset (Classico FIBUR, Reale, Buraco Aberto/Fechado), testo delle regole generato dalla configurazione. Condiviso server/browser (UMD).
- `shared/melds.js` — analisi di scale/tris e divisione in più combinazioni (`partitionMelds`): il server valida, il browser fa l'anteprima.
- `server/engine.js` — motore autoritativo, stato JSON puro; `apply()` è transazionale (in caso di errore ripristina). Le giocate NON si annullano; da vulnerabili una calata sotto i 75 punti è rifiutata.
- `server/bot.js` — computer a quattro livelli (`memo.level`: facile/normale/difficile/esperto; l'esperto ricorda le carte raccolte, `g.known`).
- `server/social.js` — profili: nickname univoco, codice personale/QR, password facoltativa (scrypt), amici, inviti, eliminazione profilo.
- `server/index.js` — tavoli, posti, riconnessione via token, chat, musica Spotify, timer del turno, rivincita a voto, classifica; salva tutto in `data/stato.json` (anche ai riavvii); `/health` per la pagina d'ingresso.
- `public/js/` — interfaccia divisa per sezioni (base, connessione, carte, ui, profilo, tutorial, schermate, tavolo,
  animazioni, finestre, azioni, comandi): file normali caricati in ordine da `index.html` che condividono le stesse
  dichiarazioni. Un file nuovo va aggiunto a `index.html` e ai due service worker (`npm test` lo controlla).
- `public/` — interfaccia: tavolo mobile-first, trascinamento carte, animazioni, suoni sintetizzati, tema chiaro/scuro a scelta dell'utente, statistiche personali in localStorage.
- `launcher/` — pagina d'ingresso su GitHub Pages (link fisso) che legge l'indirizzo del server dal ramo `indirizzo` (`server.json`).
- Gioco senza internet: `public/local-server.js` è un "server" nel browser (stessi eventi di socket.io) che usa motore e computer
  impacchettati da `scripts/bundle-engine.js` (il server li offre su `/engine.js`). Si attiva da solo se socket.io non si carica,
  o con `?offline=1`. `scripts/build-pages.js` pubblica su GitHub Pages la pagina d'ingresso + una copia del gioco in `gioca/`;
  i service worker (`public/sw.js`, `launcher/sw.js`) salvano tutto sul dispositivo ("prima la rete").
- `android-app/` — guscio Capacitor dell'APK (apre la pagina d'ingresso); `burraco.p12` è la chiave di firma fissa (non cambiarla: gli aggiornamenti non si installerebbero più).
- `scripts/android-server.sh` — avvio sul telefono-server (Termux): dipendenze, aggiornamento da GitHub ogni 5 min, tunnel Cloudflare, pubblicazione dell'indirizzo (`--set-token`, `--install-boot`).

## Funzioni principali (oltre al gioco)
Profili (nickname univoco, codice/QR, password facoltativa, avatar, eliminazione), amici (richieste, blocco, inviti, scheda con partite insieme),
statistiche e storico sul server, classifica (tutti / amici), spettatori, Gioca subito (tavoli veloci), mini-torneo (al meglio di 3/5),
tutorial "Impara a giocare" con partita di allenamento e allenatore, musica Spotify, timer del turno, rivincita, reazioni rapide,
sfida del giorno (`server/daily.js`, mazzo con seme), partite "con calma" (posto tenuto, niente gioco automatico, avvisi),
notifiche push Web Push (`server/push.js`, chiavi in `data/vapid.json`), trofei (`server/trophies.js`), livello (`server/levels.js`),
gioco senza internet contro il computer, pagina di stato `/stato?k=CHIAVE` (chiave in `data/admin-key.txt`), backup cifrato nel ramo `backup` (`scripts/backup.js`).
Computer: 3 livelli + apertura da vulnerabile con più combinazioni + pianificatore di chiusura (decisione media ~2 ms).

## Hosting e pubblicazione
- Il server gira su un telefono Android con Termux e un tunnel Cloudflare gratuito (indirizzo che cambia). Un `git push` su `main` aggiorna il gioco sul telefono entro ~5 minuti; le partite in corso riprendono dopo il riavvio.
- Link fisso: https://simonemuliello010500-web.github.io/BurracoByMSF/ — APK: https://github.com/simonemuliello010500-web/BurracoByMSF/releases/latest/download/Burraco.apk
- Workflow: `.github/workflows/pages.yml` (pagina d'ingresso + gioco offline in `gioca/`, quando cambiano launcher, public, shared, motore o computer), `.github/workflows/apk.yml` (APK, solo se cambia `android-app/`).
- Render, Hugging Face e Koyeb sono stati scartati (carta richiesta / quota zero / iscrizioni bloccate).

## Verifiche prima di pubblicare
- `npm run test:rapido` — versione veloce di `npm test` (meno partite simulate, ~1 minuto): usala durante il lavoro.
- `npm test` — test del motore e partite simulate tra bot con tutti i preset e regole casuali.
- `npm run e2e` — prova multigiocatore end-to-end su un server di prova (porta 3999).
- `npm run bench` — forza relativa dei livelli del computer.
- `npm run load [tavoli] [secondi]` — prova di carico (tavoli simulati insieme: tempi di risposta, ritardo, CPU, memoria).
- `npm run ui` — prova dell'interfaccia in un vero browser senza finestra (Chrome/Edge, 375×812): gioca toccando Burraco e Scala 40, moviola, impostazioni, offline; schermate in `test-output/`.
- `npm run playtest [partite] [varianti]` — statistiche su partite simulate in massa (durata, finali, punteggi, dati inviati).
- Controlla le modifiche visive nel browser a misura di telefono (375×812).
- Server di prova per le verifiche a mano: `node scripts/qa-server.js` (porta 3100, dati in una cartella temporanea, computer veloci): non toccare il server vero.

## Preferenze dell'utente
- Mobile-first, niente pulsanti grandi: si gioca toccando/trascinando; solo piccole icone. Il tavolo non deve scorrere su smartphone.
- Soluzioni gratuite. Spiega in modo semplice: l'utente non è uno sviluppatore esperto.
- Commit con autore "Muliello S.F." e email noreply GitHub già configurati nel repository.
