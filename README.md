---
title: Burraco Online
emoji: 🃏
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

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

- **Preset**: Burraco Classico (FIBUR), Burraco Reale, Buraco Brasiliano Aberto e Fechado.
  Sono punti di partenza: ogni regola (giocatori 2/3/4, jolly, matte, tris, scarti aperti/chiusi,
  condizioni di chiusura, fine tallone, vulnerabilità, punteggi e bonus, obiettivo) è modificabile.
- **Spiegazione regole**: generata automaticamente dalla configurazione scelta (`shared/rules.js` → `describe`).
- **Multiplayer**: chi crea il tavolo riceve un codice di 4 lettere e un link di invito; i posti liberi
  si possono riempire con giocatori del computer. Se un giocatore esce durante la partita, il suo posto passa al computer.
  Se ricarichi la pagina rientri al tuo posto.

## Struttura

- `shared/rules.js` — schema delle regole, preset, generatore della spiegazione (usato da server e browser)
- `server/engine.js` — motore di gioco autoritativo (validazione mosse, pozzetti, chiusura, punteggio)
- `server/bot.js` — giocatore del computer
- `server/index.js` — server Express + Socket.IO (tavoli, posti, riconnessione, chat)
- `server/selftest.js` — test: `npm test` simula partite complete tra bot con tutti i preset e configurazioni casuali
- `public/` — interfaccia (HTML/CSS/JS senza build)

## Pubblicarla online

Il progetto è pronto per **Hugging Face Spaces** (gratis, senza carta): il blocco iniziale di questo README
e il `Dockerfile` configurano lo Space. Il workflow `.github/workflows/hf-sync.yml` copia automaticamente
ogni push su GitHub nello Space (richiede il secret `HF_TOKEN` nel repository GitHub).

In alternativa va bene qualsiasi hosting Node.js con WebSocket (Render, Railway, Fly.io): comando di avvio `npm start`.
Le partite sono tenute in memoria: un riavvio del server chiude i tavoli in corso.
