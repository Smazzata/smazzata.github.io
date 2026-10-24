# Smazzata (ex Burraco Online) — guida per Claude Code

Nome dell'app: **Smazzata** (giochi di carte: Burraco, Scala 40, Canasta, Scopa, Briscola). Il progetto su GitHub è
`smazzata/smazzata.github.io` (organizzazione `smazzata`, ex `simonemuliello010500-web/BurracoByMSF`): da lui dipendono l'indirizzo fisso
della pagina d'ingresso (https://smazzata.github.io/), il link degli aggiornamenti dell'APK e il ramo `indirizzo`, non cambiarlo.
Identificativo dell'app Android: `it.smazzata.app` (fisso per sempre dopo il primo caricamento sul Play Store).

Giochi: **Burraco**, **Scala 40**, **Ramino** (`shared/ramino.js`: motore e computer della Scala 40, nessun minimo per aprire, `rules.game: 'ramino'`), **Canasta** e con le carte italiane **Scopa** (anche Scopone), **Briscola**, **Briscola in 5** (chiamata, asta e socio segreto), **Tressette**, **Rubamazzetto**
(`shared/<gioco>.js` regole condivise, `server/<gioco>.js` motore, `server/<gioco>-bot.js` computer). Le carte italiane
hanno i semi in minuscolo (d, c, s, b); i motori a prese espongono `presa: true` e il client usa `presaCenterHTML`. `server/games.js` è il registro dei giochi (motore, computer, regole):
il server sceglie il gioco da `rules.game` (senza = Burraco). Un nuovo gioco = motore con la stessa interfaccia
(createGame, apply, isLegal, viewFor, nextHand, surrender, teamOf, note) + computer (nextAction, thinkMs) + regole condivise.
Scala 40: `shared/scala40.js` (regole e analisi), `server/scala40.js`, `server/scala40-bot.js`; nel browser `RX` (in public/js/base.js)
sceglie regole e preset del gioco.

Webapp di Burraco multiplayer (Node.js + Express + Socket.IO, frontend HTML/CSS/JS senza build).
Autore: Muliello S.F. L'utente scrive in italiano: rispondi, commenta il codice e scrivi i messaggi di commit in italiano.

## Come è fatta
- `shared/rules.js` — schema delle regole modificabili, preset (Classico da torneo, Reale, Buraco Aberto/Fechado), testo delle regole generato dalla configurazione. Condiviso server/browser (UMD).
- `shared/melds.js` — analisi di scale/tris e divisione in più combinazioni (`partitionMelds`): il server valida, il browser fa l'anteprima.
- `server/engine.js` — motore autoritativo, stato JSON puro; `apply()` è transazionale (in caso di errore ripristina). Le giocate NON si annullano; da vulnerabili una calata sotto i 75 punti è rifiutata.
- `server/bot.js` — computer a quattro livelli (`memo.level`: facile/normale/difficile/esperto; l'esperto ricorda le carte raccolte, `g.known`).
- `server/social.js` — profili: nickname univoco, password obbligatoria (scrypt), codice di recupero/QR, email facoltativa confermata con codice (invio da `server/posta.js` col Gmail del gioco, credenziali in `~/.burraco-mail` scritte con `android-server.sh --set-mail`; nelle prove `MAIL_TEST=1`), recupero password via email o codice, una chiave per dispositivo (cambiando password gli altri vengono scollegati), amici, inviti, eliminazione profilo. `ACCOUNTS_EPOCH` in `server/archivio.js` azzera i profili se alzato.
- Regole e prudenza legale: `public/regole.html` (regole di comportamento), età minima 14 anni (spunta alla creazione del profilo, controllata anche da `server/social.js`: `adult: true` in `startSignup`/`setNick`), moderazione dalla pagina di stato (`adminModerate` in social.js: avviso, chat bloccata, nickname cambiato, profilo eliminato), chi blocca non riceve la chat del bloccato, filtro delle parolacce `shared/parole.js` (nickname e nomi di tornei/campionati rifiutati, chat con asterischi; tre gruppi OVUNQUE/INIZIO/PAROLA + SALVE per evitare i falsi positivi, prove in `selftest.js`).
- `server/index.js` — avvio: Express, Socket.IO, collega i moduli. I moduli condividono stato e funzioni tramite `server/contesto.js` (ognuno si registra con `Object.assign(ctx, {...})` e chiama gli altri con piccoli "rimandi" `(...a) => ctx.f(...a)`):
  `config.js` (impostazioni), `admin.js` (/health, pagina di stato), `tavoli.js` (tavoli, posti, stato ai giocatori, pronto, avvio), `turni.js` (timer, computer, reazioni),
  `statistiche.js` (classifica, trofei, sfida del giorno), `gare.js` (campionati, tornei), `archivio.js` (salvataggio/ripristino),
  `messaggi-tavolo.js` e `messaggi-comunita.js` (i messaggi socket dal browser).
- `public/js/` — interfaccia divisa per sezioni (base, connessione, carte, ui, profilo, tutorial, schermate, tavolo,
  animazioni, finestre, azioni, comandi): file normali caricati in ordine da `index.html` che condividono le stesse
  dichiarazioni. Un file nuovo va aggiunto a `index.html` e ai due service worker (`npm test` lo controlla).
- Caratteri: Nunito (testi) e Playfair Display (titoli, `--font-title`) salvati in `public/fonts/` (dichiarati in `intro.css`, valgono anche per la pagina d'ingresso; nei due service worker).
- `public/` — interfaccia: tavolo mobile-first, trascinamento carte, animazioni, suoni sintetizzati, tema chiaro/scuro a scelta dell'utente, statistiche personali in localStorage.
- Lingue (it/en/es/pt): l'interfaccia resta scritta in italiano; `public/js/lingue.js` traduce al volo i testi che compaiono (dizionario `public/lingue/xx.js`, generato da `lingue/*.txt` con `node scripts/lingue.js`; righe `italiano ‖ English ‖ Español ‖ Português`, `{0}` = parte variabile). Per un testo nuovo aggiungi la riga e rigenera (npm test controlla). In console `[...I18N.missing]` mostra i testi visti senza traduzione.
- `launcher/` — pagina d'ingresso su GitHub Pages (link fisso) che legge l'indirizzo del server dal ramo `indirizzo` (`server.json`).
- Partite contro il computer **sul telefono** anche online (mosse istantanee): `createBots` usa `public/local-server.js` (`onDevice`), le mosse vanno lì (`LOCAL_EVENTS` in connessione.js) e a ogni fine smazzata il risultato completo va al server con `localResult` (statistiche, livello, trofei; niente Elo), in coda se manca la rete.
- Gioco senza internet: `public/local-server.js` è un "server" nel browser (stessi eventi di socket.io) che usa motore e computer
  impacchettati da `scripts/bundle-engine.js` (il server li offre su `/engine.js`). Si attiva da solo se socket.io non si carica,
  o con `?offline=1`. `scripts/build-pages.js` pubblica su GitHub Pages la pagina d'ingresso + una copia del gioco in `gioca/`;
  i service worker (`public/sw.js`, `launcher/sw.js`) salvano tutto sul dispositivo ("prima la rete").
- `android-app/` — app Capacitor (APK e AAB): pagina d'ingresso e gioco senza internet sono dentro l'app (`www/`, generata con `npm run app:www`, origine `https://localhost`); da collegati porta al server sul tunnel come il sito. User agent `BurracoApp/N SmazzataLocale` (+ `SmazzataStore` nell'AAB: niente avviso di aggiornamento APK). `burraco.p12` è la chiave di firma fissa (non cambiarla: gli aggiornamenti non si installerebbero più).
- `scripts/android-server.sh` — avvio sul telefono-server (Termux): dipendenze, aggiornamento da GitHub ogni 5 min, tunnel Cloudflare, pubblicazione dell'indirizzo (`--set-token`, `--install-boot`).

## Giochi disponibili al lancio

La disponibilità è definita in `shared/available-games.js`: Burraco, Scala 40, Ramino e Canasta.
I motori dei giochi italiani restano conservati e testati, ma i loro accessi online/offline sono disabilitati.
Il gioco si sceglie nella Home: setup e Classificate ereditano la scelta senza riproporre un selettore.
Il pulsante «Classifica» apre il resoconto personale (`rankedOverview`): risultati Solo/Duo e storico stagionale. Il pulsante «Classificata» apre invece la scelta della coda e la ricerca (`leaders`).
La Home privilegia le modalità di gioco; comandi secondari compatti in alto, testi leggibili e pulsanti facili da toccare.
Ranked: ogni gioco ha un solo punteggio Solo (`gioco:solo`), comune ai tavoli da 2, 3 e 4, e un punteggio Duo separato (`gioco:4:duo`). Il matchmaking continua a separare i tavoli per dimensione. La migrazione v2 accorpa i vecchi profili Solo conservandone gli originali in `legacyFormats`.
Il pubblico di riferimento è adulto/maturo: mantenere un aspetto tradizionale da tavolo da carte, etichette chiare e contrasti netti.

## Funzioni principali (oltre al gioco)
Avatar: 50 ritratti illustrati nello stile 3D dei personaggi Avventura: 24 comuni, 15 rari, 8 epici e 3 leggendari. Catalogo e compatibilità dei precedenti ID in `shared/avatars.js`; rendering in `public/js/avatars.js`, WebP in `public/art/avatars/`. I tre leggendari hanno tre pose e loop delicati; rispettare `body.noanim` e `prefers-reduced-motion`. Il profilo mostra soltanto gli avatar posseduti: quattro iniziali (Fante di quadri, Dama di fiori, Giardiniere di fiori e Pasticciera vaniglia), oltre agli sblocchi espliciti e alle scelte pregresse conservate. Gli avatar non posseduti e i titoli non sbloccati sono nascosti. Chest gratuite in `server/chests.js`: una ogni tre partite online umane concluse, massimo due al giorno (Europe/Rome); tipi comune/rara/epica/leggendaria al 75/20/4/1%, leggendaria con oggetto leggendario garantito. Aperture e scambi idempotenti, inventario versionato salvato prima della conferma; regole in `docs/chest-design.md`, UI in `public/js/chests.js`, quattro sprite originali in `public/art/chests/`. `server/social.js` verifica il possesso, restituisce `ownedAvatarIds` e conserva `avatarOwned`; nessuna API pubblica consente di assegnarsi sblocchi. Non introdurre sblocchi o acquisti senza definirli con l’utente. Il campo `avatar.id` identifica il ritratto, `avatar.e` serve ai vecchi client. Conservare colori, titoli e cornici. Rigenerare screenshot store dopo modifiche alla collezione.

Punteggio Elo per gioco (`server/elo.js`), premi da sbloccare (titoli, cornici, dorsi: `shared/premi.js`), accessibilità (testo grande,
alto contrasto, senza animazioni, mosse lette ad alta voce), materiale Play Store in `store/`. I messaggi vocali sono stati tolti (niente microfono).
Profili (nickname univoco, codice/QR, password facoltativa, avatar, eliminazione), amici (richieste, blocco, inviti, scheda con partite insieme),
statistiche e storico sul server, classifica (tutti / amici), spettatori, Gioca subito (tavoli veloci), mini-torneo (al meglio di 3/5),
tutorial "Impara a giocare" con partita di allenamento e allenatore, musica Spotify, timer del turno, rivincita, reazioni rapide,
sfida del giorno (`server/daily.js`, mazzo con seme), partite "con calma" (posto tenuto, niente gioco automatico, avvisi),
notifiche push Web Push (`server/push.js`, chiavi in `data/vapid.json`), trofei (`server/trophies.js`), livello (`server/levels.js`),
gioco senza internet contro il computer, pagina di stato `/stato?k=CHIAVE` (chiave in `data/admin-key.txt`), backup cifrato nel ramo `backup` (`scripts/backup.js`).
Computer: 3 livelli + apertura da vulnerabile con più combinazioni + pianificatore di chiusura (decisione media ~2 ms).

## Hosting e pubblicazione
- Il server gira su un telefono Android con Termux e un tunnel Cloudflare gratuito (indirizzo che cambia). Un `git push` su `main` aggiorna il gioco sul telefono entro ~5 minuti; le partite in corso riprendono dopo il riavvio.
- Link fisso: https://smazzata.github.io/ — APK: https://github.com/smazzata/smazzata.github.io/releases/latest/download/Burraco.apk
- Workflow: `.github/workflows/pages.yml` (pagina d'ingresso + gioco offline in `gioca/`, quando cambiano launcher, public, shared, motore o computer), `.github/workflows/apk.yml` (APK, solo se cambia `android-app/`).
- Render, Hugging Face e Koyeb sono stati scartati (carta richiesta / quota zero / iscrizioni bloccate).

## Verifiche prima di pubblicare
- `npm run test:rapido` — versione veloce di `npm test` (meno partite simulate, ~1 minuto): usala durante il lavoro.
- `npm test` — test del motore e partite simulate tra bot con tutti i preset e regole casuali.
- `npm run e2e` — prova multigiocatore end-to-end su un server di prova (porta 3999).
- `npm run bench` — forza relativa dei livelli del computer.
- `npm run load [tavoli] [secondi]` — prova di carico (tavoli simulati insieme: tempi di risposta, ritardo, CPU, memoria).
- `npm run anim` — prova delle animazioni delle carte in tutti i giochi con il ritardo del server simulato: atterraggi al pixel, mosse rifiutate senza voli, fotogrammi in `test-output/animazioni/`.
- `npm run ui` — prova dell'interfaccia in un vero browser senza finestra (Chrome/Edge, 375×812): gioca toccando Burraco e Scala 40, moviola, impostazioni, offline; schermate in `test-output/`.
- `npm run playtest [partite] [varianti]` — statistiche su partite simulate in massa (durata, finali, punteggi, dati inviati).
- Controlla le modifiche visive nel browser a misura di telefono (375×812).
- Server di prova per le verifiche a mano: `node scripts/qa-server.js` (porta 3100, dati in una cartella temporanea, computer veloci): non toccare il server vero.

## Preferenze dell'utente
- Al termine di ogni modifica completata e verificata, eseguire commit e push su GitHub, senza attendere una richiesta separata.
- Mobile-first, niente pulsanti grandi: si gioca toccando/trascinando; solo piccole icone. Il tavolo non deve scorrere su smartphone.
- Soluzioni gratuite. Spiega in modo semplice: l'utente non è uno sviluppatore esperto.
- Commit con autore "Muliello S.F." e email noreply GitHub già configurati nel repository.

Cosmetici delle chest: catalogo `shared/cosmetics.js`, 100 oggetti indipendenti (dorsi, cornici, tappetini, reazioni, vittorie), 20 per tipo con distribuzione 10/6/3/1. Un solo premio per chest: prima rarità, poi scelta uniforme tra tutti gli oggetti di quella rarità, avatar compresi, esclusi i quattro iniziali. Nessun extra al 25% e nessun set. UI `public/js/cosmetics.js` e `public/cosmetics.css`, materiali in `public/art/cosmetics/`; cornici SVG ed effetti canvas. Il server verifica possesso e selezioni tramite `setCosmetic`; le reazioni illustrate sono validate anche al tavolo. Conservare stili base e premi precedenti. Prove dedicate in `server/cosmetics-test.js`, `server/chest-e2e-test.js` e `server/chest-uitest.js`.

Inventario e posta: `server/deliveries.js` gestisce messaggi e regali amministrativi atomici e idempotenti; `server/admin-deliveries.js` espone il compositore protetto dalla pagina di stato, anteprima destinatari e conferma anti-CSRF. Destinatari: nickname, tutti, intervallo iscrizione (Europe/Rome, dal incluso/prima del escluso). `registeredAt` sui nuovi profili, `terms` per i precedenti; date ignote escluse dai filtri. Nessuna campagna automatica futura. Un solo regalo per invio e profilo, chest chiusa o oggetto specifico; doppioni in frammenti. Posta server paginata e badge non letti; inventario selezionabile per tipo in `public/js/chests.js`. Conservare lo storico globale `deliveries` in entrambi i formati dell’archivio. Le prove inviano soltanto a profili nei server temporanei, mai agli utenti reali.
