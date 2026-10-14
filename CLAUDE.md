# Burraco Online — guida per Claude Code

Webapp di Burraco multiplayer (Node.js + Express + Socket.IO, frontend HTML/CSS/JS senza build).
Autore: Muliello S.F. L'utente scrive in italiano: rispondi, commenta il codice e scrivi i messaggi di commit in italiano.

## Come è fatta
- `shared/rules.js` — schema delle regole modificabili, preset (Classico FIBUR, Reale, Buraco Aberto/Fechado), testo delle regole generato dalla configurazione. Condiviso server/browser (UMD).
- `shared/melds.js` — analisi di scale/tris e divisione in più combinazioni (`partitionMelds`): il server valida, il browser fa l'anteprima.
- `server/engine.js` — motore autoritativo, stato JSON puro; `apply()` è transazionale (in caso di errore ripristina). Le giocate NON si annullano; da vulnerabili una calata sotto i 75 punti è rifiutata.
- `server/bot.js` — computer a tre livelli (`memo.level`: facile/normale/difficile).
- `server/index.js` — tavoli, posti, riconnessione via token, chat, musica Spotify, timer del turno, rivincita a voto, classifica; salva tutto in `data/stato.json` (anche ai riavvii); `/health` per la pagina d'ingresso.
- `public/` — interfaccia: tavolo mobile-first, trascinamento carte, animazioni, suoni sintetizzati, temi, statistiche personali in localStorage.
- `launcher/` — pagina d'ingresso su GitHub Pages (link fisso) che legge l'indirizzo del server dal ramo `indirizzo` (`server.json`).
- `android-app/` — guscio Capacitor dell'APK (apre la pagina d'ingresso); `burraco.p12` è la chiave di firma fissa (non cambiarla: gli aggiornamenti non si installerebbero più).
- `scripts/android-server.sh` — avvio sul telefono-server (Termux): dipendenze, aggiornamento da GitHub ogni 5 min, tunnel Cloudflare, pubblicazione dell'indirizzo (`--set-token`, `--install-boot`).

## Hosting e pubblicazione
- Il server gira su un telefono Android con Termux e un tunnel Cloudflare gratuito (indirizzo che cambia). Un `git push` su `main` aggiorna il gioco sul telefono entro ~5 minuti; le partite in corso riprendono dopo il riavvio.
- Link fisso: https://simonemuliello010500-web.github.io/BurracoByMSF/ — APK: https://github.com/simonemuliello010500-web/BurracoByMSF/releases/latest/download/Burraco.apk
- Workflow: `.github/workflows/pages.yml` (pagina d'ingresso, solo se cambia `launcher/`), `.github/workflows/apk.yml` (APK, solo se cambia `android-app/`).
- Render, Hugging Face e Koyeb sono stati scartati (carta richiesta / quota zero / iscrizioni bloccate).

## Verifiche prima di pubblicare
- `npm test` — test del motore e partite simulate tra bot con tutti i preset e regole casuali.
- `npm run e2e` — prova multigiocatore end-to-end su un server di prova (porta 3999).
- `npm run bench` — forza relativa dei livelli del computer.
- Controlla le modifiche visive nel browser a misura di telefono (375×812).

## Preferenze dell'utente
- Mobile-first, niente pulsanti grandi: si gioca toccando/trascinando; solo piccole icone. Il tavolo non deve scorrere su smartphone.
- Soluzioni gratuite. Spiega in modo semplice: l'utente non è uno sviluppatore esperto.
- Commit con autore "Muliello S.F." e email noreply GitHub già configurati nel repository.
