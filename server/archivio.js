'use strict';
/*
 * Salvataggio: tutto lo stato (profili, classifica, tavoli, gare) va nell'archivio (SQLite o stato.json)
 * un secondo dopo ogni modifica e alla chiusura; all'avvio si ripristina, partite in corso comprese.
 */
const { openStore } = require('./store');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./config');
/**
 * "Epoca" dei profili: alzandola (es. a 2), al prossimo avvio si riparte da zero (profili, amici, classifica,
 * tavoli, gare). Una copia dei dati vecchi resta in data/prima-del-reset-*.json.
 * 2 = ottobre 2026: password obbligatoria, email, chiavi per dispositivo. 3 = di nuovo, per riprovare la registrazione con conferma via email.
 */
const ACCOUNTS_EPOCH = 3;
const { PROGRESS_EPOCH, resetProgress } = require('./progress-reset');
const ctx = require('./contesto');
const { sessions, rooms, leaderboard, daily, leagues, tournaments } = ctx;
// funzioni degli altri moduli (lette dal contesto al momento della chiamata)
const scheduleBot = (...a) => ctx.scheduleBot(...a);

/* ---------- Salvataggio su file: le partite sopravvivono ai riavvii ---------- */
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, 1000);
}

function saveNow(throwOnError = false, purgeResiduals = true) {
  try {
    const data = {
      savedAt: Date.now(),
      accountsEpoch: ACCOUNTS_EPOCH,
      progressEpoch: PROGRESS_EPOCH,
      sessions: [...sessions],
      leaderboard: [...leaderboard],
      reports: ctx.reports,
      deliveries: ctx.deliveries || [],
      ranked: ctx.ranked,
      daily: [...daily].map(([d, m]) => [d, m]),
      leagues: [...leagues.values()],
      tournaments: [...tournaments.values()],
      rooms: [...rooms.values()].map((r) => ({
        code: r.code, rules: r.rules, n: r.n, hostToken: r.hostToken, seats: r.seats, game: r.game, rankedMatch: r.rankedMatch, chestGameId:r.chestGameId, chestRecordedGame:r.chestRecordedGame,
        ready: [...r.ready], turnCounter: r.turnCounter, lastTurnSeat: r.lastTurnSeat, botSpeed: r.botSpeed, hints: r.hints, aids: r.aids, music: r.music, turnTime: r.turnTime, botLevel: r.botLevel, gameSeq: r.gameSeq, recordedGame: r.recordedGame, spectators: r.spectators || [], tutorial: r.tutorial, quick: r.quick, queueMode: r.queueMode, series: r.series, daily: r.daily, seed: r.seed, slow: r.slow, lastActionAt: r.lastActionAt, tournament: r.tournament, rankedGame: r.rankedGame, progressEligible: r.progressEligible,
      })),
    };
    store.save(data);
    if (throwOnError === true && purgeResiduals && store.purgeResiduals) store.purgeResiduals();
  } catch (e) {
    console.error('Salvataggio non riuscito:', e.message);
    if (throwOnError) throw e;
  }
}

// archivio: database SQLite se disponibile, altrimenti stato.json (vedi server/store.js)
const store = openStore(DATA_DIR);

function loadSaved() {
  try {
    let data = store.load();
    console.log(`Archivio dati: ${store.kind === 'sqlite' ? 'database SQLite (data/burraco.db)' : 'file data/stato.json'}`);
    if (!data) return;
    if ((data.accountsEpoch || 1) < ACCOUNTS_EPOCH) {
      const copy = path.join(DATA_DIR, `prima-del-reset-${new Date().toISOString().slice(0, 10)}.json`);
      try { fs.writeFileSync(copy, JSON.stringify(data)); } catch (e) { /* la copia è solo per sicurezza */ }
      console.log(`Profili azzerati (nuova epoca ${ACCOUNTS_EPOCH}): copia dei dati vecchi in ${copy}`);
      setTimeout(saveNow, 0);
      return;
    }
    if ((data.progressEpoch || 0) < PROGRESS_EPOCH) {
      const copy = path.join(DATA_DIR, `prima-del-reset-progressi-${Date.now()}.json`);
      // Se la copia o il salvataggio falliscono, non avviare un archivio vuoto.
      try {
        fs.writeFileSync(copy, JSON.stringify(data), { flag: 'wx' });
        data = resetProgress(data);
        store.save(data);
      } catch (err) {
        console.error('Reset progressi interrotto: archivio precedente conservato', err.message);
        process.exit(1);
      }
      console.log(`Progressi azzerati (epoca ${PROGRESS_EPOCH}); profili e amicizie conservati`);
    }
    for (const [token, sess] of data.sessions || []) sessions.set(token, sess);
    for (const [token, e] of data.leaderboard || []) {
      // prima delle statistiche per gioco si giocava solo a Burraco
      if (!e.byGame && (e.games || e.hands)) {
        e.byGame = { burraco: { games: e.games || 0, wins: e.wins || 0, points: e.points || 0, burraco: e.burraco || 0, hands: e.hands || 0, handsWon: e.handsWon || 0, closures: e.closures || 0, bestHand: e.bestHand == null ? null : e.bestHand, handPoints: e.handPoints || 0 } };
      }
      leaderboard.set(token, e);
    }
    ctx.reports = data.reports || [];
    ctx.deliveries = data.deliveries || [];
    ctx.ranked = data.ranked || require('./ranked').empty();
    for (const [d, m] of data.daily || []) daily.set(d, m);
    for (const lg of data.leagues || []) leagues.set(lg.id, lg);
    for (const t of data.tournaments || []) tournaments.set(t.id, t);
    ctx.social.rebuildIndexes();
    for (const r of data.rooms || []) {
      // tavoli di giochi tolti dall'app (es. Sette e mezzo): non si riaprono
      if (r.rules && r.rules.game && !require('./games').GAMES[r.rules.game]) continue;
      rooms.set(r.code, { ...r, ready: new Set(r.ready || []), botTimer: null, botMemo: {}, botMemoTurn: -1 });
    }
    for (const room of rooms.values()) scheduleBot(room);
    console.log(`Ripristinati ${rooms.size} tavoli salvati`);
  } catch (e) {
    console.error('Impossibile leggere il salvataggio:', e.message);
  }
}

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { clearTimeout(saveTimer); saveNow(); process.exit(0); });
}

Object.assign(ctx, { scheduleSave, saveNow, loadSaved });
