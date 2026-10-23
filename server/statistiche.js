'use strict';
/*
 * Statistiche e premi: classifica, statistiche per gioco, storico, trofei, livelli,
 * sfida del giorno e mini-torneo (al meglio di 3/5).
 */
const Games = require('./games');
const Levels = require('./levels');
const Trophies = require('./trophies');
const ctx = require('./contesto');
const Elo = require('./elo');
const Premi = require('../shared/premi');
const countsForProgress = require('./progress-rules');
const { io, sessions, leaderboard, daily } = ctx;
// funzioni degli altri moduli (lette dal contesto al momento della chiamata)
const tournamentsChanged = (...a) => ctx.tournamentsChanged(...a);

/** Assegna trofei a un giocatore (se non li ha già) e lo avvisa */
function awardTrophies(token, name, ids) {
  const e = { ...STATS0, ...(leaderboard.get(token) || {}) };
  e.name = e.name || name;
  e.trophies = { ...(e.trophies || {}) };
  const fresh = [...new Set(ids)].filter((id) => !e.trophies[id]);
  if (!fresh.length) return;
  for (const id of fresh) e.trophies[id] = Date.now();
  leaderboard.set(token, e);
  const list = fresh.map((id) => { const t = Trophies.BY_ID.get(id); return { id, e: t.e, name: t.name, desc: t.desc }; });
  for (const sock of io.sockets.sockets.values()) if (sock.data.token === token) sock.emit('trophy', list);
}

/** A fine partita aggiorna la classifica una sola volta per partita */
const STATS0 = { games: 0, wins: 0, points: 0, burraco: 0, hands: 0, handsWon: 0, closures: 0, bestHand: null, handPoints: 0, history: [] };
/* statistiche di un singolo gioco (e.byGame[gioco]); quelle in cima a e sono il totale (livello e trofei) */
const GSTATS0 = { games: 0, wins: 0, points: 0, burraco: 0, hands: 0, handsWon: 0, closures: 0, bestHand: null, handPoints: 0 };
function gameStats(e, gid) {
  e.byGame = { ...(e.byGame || {}) };
  e.byGame[gid] = { ...GSTATS0, ...(e.byGame[gid] || {}) };
  return e.byGame[gid];
}

/**
 * Variazioni di Elo di una partita classificata, con i punteggi di tutti prima della partita. Chi ha abbandonato
 * (posto al computer, s.leftToken) conta ancora come persona, e per lui la partita vale come persa.
 */
function rankedDeltas(room, gid) {
  const g = room.game;
  const tokenOf = (s) => s && (s.token || s.leftToken);
  const seats = room.seats.map((s) => {
    const x = ((leaderboard.get(tokenOf(s)) || {}).byGame || {})[gid] || {};
    return { human: !!tokenOf(s), rating: x.elo || Elo.START, games: x.rankedGames || 0 };
  });
  const teams = g.teams.map((t) => t.members);
  const out = Elo.deltas(seats, teams, g.winners || []);
  room.seats.forEach((s, seat) => {
    if (!s || !s.leftToken) return;
    const mine = teams.find((t) => t.includes(seat)) || [seat];
    const lost = Elo.deltas(seats, teams, teams.filter((t) => t !== mine).flat())[seat];
    out[seat] = Math.min(out[seat], lost);
  });
  return out;
}

/** Applica una variazione di Elo (partita classificata) al giocatore; e = la sua scheda già in modifica, se c'è */
function applyElo(token, gid, delta, won, e) {
  const own = !e;
  if (own) { e = leaderboard.get(token); if (!e) return; e = { ...e }; }
  const gs = gameStats(e, gid);
  gs.rankedGames = (gs.rankedGames || 0) + 1;
  if (won) gs.rankedWins = (gs.rankedWins || 0) + 1;
  const before = gs.elo || Elo.START;
  gs.elo = before + delta;
  gs.eloMax = Math.max(gs.eloMax || Elo.START, gs.elo);
  if (own) leaderboard.set(token, e);
  for (const sock of io.sockets.sockets.values()) if (sock.data.token === token) sock.emit('elo', { game: gid, before, after: gs.elo });
}

/**
 * Statistiche dei giocatori sul server: aggiornate a ogni fine smazzata e a fine partita
 * (una sola volta ciascuna), con lo storico delle ultime 20 partite.
 */
function recordLeaderboard(room) {
  const g = room.game;
  if (!g || g.phase !== 'handEnd' || !g.handResult) return;
  if (room.daily) { recordDaily(room); return; }
  const eligible = countsForProgress(room);
  const handKey = `${room.gameSeq}:${g.handNo}`;
  const hr = g.handResult;
  const gameEnds = g.over && room.recordedGame !== room.gameSeq;
  if (gameEnds) recordSeries(room);
  // punteggio Elo: si calcola una volta per partita, con i punteggi di tutti prima della partita
  const eloGid = Games.idOf(room.rules);
  // Solo le classificate cambiano l'Elo; le amichevoli tra persone contano per i progressi.
  const ranked = gameEnds && Elo.isRanked(room);
  if (gameEnds && room.rankedMatch) ctx.Ranked.record(room);
  const eloDelta = ranked && !room.rankedMatch ? rankedDeltas(room, eloGid) : null;
  // chi ha abbandonato una classificata (posto passato al computer) perde comunque i suoi punti
  if (eloDelta) room.seats.forEach((s, seat) => { if (s && s.isBot && s.leftToken) applyElo(s.leftToken, eloGid, eloDelta[seat], false); });
  room.seats.forEach((s, seat) => {
    if (!eligible || !s || s.isBot || !s.token) return;
    const e = { ...STATS0, ...(leaderboard.get(s.token) || {}) };
    e.name = s.name;
    const levelBefore = Levels.levelOf(e).level;
    const won = []; // trofei guadagnati con questa smazzata/partita
    const gid = Games.idOf(room.rules);
    const gs = gameStats(e, gid);
    // giorni di gioco di fila: conta ogni smazzata finita (una volta al giorno)
    if (room.recordedHand !== handKey) ctx.markPlayed(e);
    if (room.recordedHand !== handKey) {
      const mine = hr.teams.find((t) => t.members.includes(seat));
      if (mine && hr.reason !== 'surrender') {
        won.push(...(gid === 'scala40' ? Trophies.fromScala40(g.lastReplay, hr, seat) : Trophies.fromHand(mine, gid)));
        const handWon = mine.total === Math.max(...hr.teams.map((t) => t.total));
        for (const x of [e, gs]) {
          x.hands++;
          if (handWon) x.handsWon++;
          x.burraco += mine.burraco.length;
          x.handPoints += mine.total;
          x.bestHand = x.bestHand == null ? mine.total : Math.max(x.bestHand, mine.total);
        }
      }
      if (hr.reason === 'close' && hr.closer === seat) { e.closures++; gs.closures++; }
    }
    if (gameEnds) {
      const myTeam = g.teams.find((t) => t.members.includes(seat));
      const friends = (sessions.get(s.token) || {}).friends || [];
      won.push(...Trophies.fromGame(g, seat, {
        tutorial: !!room.tutorial, gid,
        withFriend: room.seats.some((o) => o && !o.isBot && o.token !== s.token && friends.includes(o.token)),
        allBotsDifficile: ['difficile', 'esperto'].includes(room.botLevel) && room.seats.every((o, i) => myTeam.members.includes(i) || (o && o.isBot)),
      }));
      if (room.series && room.series.champion && room.series.champion.includes(seat)) won.push('campione');
      for (const x of [e, gs]) {
        x.games++;
        if (g.winners.includes(seat)) x.wins++;
        x.points += g.scores[seat];
      }
      if (eloDelta) applyElo(s.token, gid, eloDelta[seat], g.winners.includes(seat), e);
      const team = g.teams.find((t) => t.members.includes(seat));
      e.history = [{
        at: Date.now(), game: gid, preset: Games.of(room).presetOf(room.rules) || 'personalizzate', won: g.winners.includes(seat), ranked: !!ranked,
        hands: g.history.length,
        teams: g.teams.map((t) => ({ names: t.members.map((x) => room.seats[x].name), score: g.scores[t.members[0]], mine: t === team })),
        tokens: room.seats.filter((x) => x && !x.isBot && x.token).map((x) => x.token),
      }, ...(e.history || [])].slice(0, 20);
      // cronologia compatta per i grafici: data, gioco, vinta, avversari (le ultime 200 partite)
      const rivals = g.teams.filter((t) => t !== team).flatMap((t) => t.members.map((x) => room.seats[x].name.replace(/ \(bot\)$/, '')));
      const opponentTokens = g.teams.filter((t) => t !== team).flatMap((t) => t.members.map((x) => room.seats[x].token || room.seats[x].leftToken || null));
      e.timeline = [...(e.timeline || []), { at: Date.now(), g: gid, w: g.winners.includes(seat) ? 1 : 0, o: rivals, opponentTokens }].slice(-200);
    }
    won.push(...Trophies.fromStats(e));
    e.trophies = { ...(e.trophies || {}) };
    const fresh = [...new Set(won)].filter((id) => !e.trophies[id]);
    for (const id of fresh) e.trophies[id] = Date.now();
    leaderboard.set(s.token, e);
    const lv = Levels.levelOf(e);
    if (room.recordedHand !== handKey || gameEnds) {
      const unlocks = Premi.unlockedIds({ level: lv.level, trophies: e.trophies || {} });
      for (const sock of io.sockets.sockets.values()) if (sock.data.token === s.token) sock.emit('progress', { ...lv, unlocks, up: lv.level > levelBefore, streak: ctx.streakOf(e) });
    }
    if (fresh.length) {
      const list = fresh.map((id) => { const t = Trophies.BY_ID.get(id); return { id, e: t.e, name: t.name, desc: t.desc }; });
      for (const sock of io.sockets.sockets.values()) if (sock.data.token === s.token) sock.emit('trophy', list);
    }
  });
  if (gameEnds && room.tournament) {
    const tr = room.tournament;
    setTimeout(() => { ctx.Tour.matchDone(tr.id, tr.round, tr.index, g.winners.includes(0) ? 'a' : 'b'); tournamentsChanged(); }, 0);
  }
  if (gameEnds && eligible) {
    const players = room.seats.map((s, seat) => (s && !s.isBot && s.token ? { token: s.token, name: s.name, won: g.winners.includes(seat) } : null)).filter(Boolean);
    for (const t of ctx.League.recordGame(players)) awardTrophies(t, '', ['campione_lega']);
  }
  room.recordedHand = handKey;
  if (g.over) room.recordedGame = room.gameSeq;
}

/** Sfida del giorno: a fine smazzata si registra il punteggio e la partita finisce */
function recordDaily(room) {
  const g = room.game;
  if (g.dailyRecorded) return;
  const hr = g.handResult;
  const best = Math.max(...hr.teams.map((t) => t.total));
  g.over = true;
  g.winners = hr.teams.filter((t) => t.total === best).flatMap((t) => t.members);
  const board = daily.get(room.daily) || {};
  room.seats.forEach((s, seat) => {
    if (!s || s.isBot || !s.token) return;
    const mine = hr.teams.find((t) => t.members.includes(seat));
    // Briscola: in classifica i punti delle prese (il totale della smazzata è solo vinta/persa)
    const score = mine.points != null ? mine.points : mine.total;
    board[s.token] = { name: s.name, score, at: Date.now() };
    if (!countsForProgress(room)) return;
    // trofei: sfida completata, primo in classifica al momento della chiusura
    const e = { ...STATS0, ...(leaderboard.get(s.token) || {}) };
    e.name = e.name || s.name;
    const done = Object.values(board).filter((x) => x.score != null);
    const won = ['sfida'];
    if (done.length >= 3 && done.every((x) => x.score <= score)) won.push('sfida_primo');
    e.trophies = { ...(e.trophies || {}) };
    const fresh = won.filter((id) => !e.trophies[id]);
    for (const id of fresh) e.trophies[id] = Date.now();
    leaderboard.set(s.token, e);
    if (fresh.length) {
      const list = fresh.map((id) => { const t = Trophies.BY_ID.get(id); return { id, e: t.e, name: t.name, desc: t.desc }; });
      for (const sock of io.sockets.sockets.values()) if (sock.data.token === s.token) sock.emit('trophy', list);
    }
  });
  daily.set(room.daily, board);
  g.dailyRecorded = true;
  // si tengono solo gli ultimi 7 giorni
  for (const d of [...daily.keys()].sort().slice(0, -7)) daily.delete(d);
}

/** Classifica di una sfida: solo chi l'ha finita, dal punteggio più alto */
function dailyBoard(date, me) {
  const board = daily.get(date) || {};
  const list = Object.entries(board).filter(([, x]) => x.score != null)
    .sort((a, b) => b[1].score - a[1].score || a[1].at - b[1].at)
    .map(([token, x], i) => ({ pos: i + 1, name: x.name, score: x.score, me: token === me }));
  return { list, mine: board[me] || null, myPos: (list.find((x) => x.me) || {}).pos || null };
}

/** Mini-torneo: conta le partite vinte da ogni posto; vince chi arriva per primo alla maggioranza */
function recordSeries(room) {
  const sr = room.series;
  const g = room.game;
  if (!sr || sr.champion) return;
  sr.games++;
  for (const s of g.winners) sr.wins[s]++;
  const need = Math.ceil(sr.bestOf / 2);
  const top = Math.max(...sr.wins);
  if (top >= need || sr.games >= sr.bestOf) {
    sr.champion = sr.wins.map((w, i) => (w === top ? i : -1)).filter((i) => i >= 0);
  }
}

/** Statistiche pubblicabili di un giocatore (senza token) */
/** Statistiche pubblicabili di ogni gioco giocato: { burraco: {...}, scala40: {...} } */
function statsByGame(e) {
  const out = {};
  for (const [gid, x] of Object.entries((e && e.byGame) || {})) if (x.games || x.hands) out[gid] = publicStats({ ...x, name: e.name });
  return out;
}

function publicStats(e) {
  return {
    name: e.name, games: e.games, wins: e.wins, points: e.points, burraco: e.burraco, hands: e.hands || 0,
    handsWon: e.handsWon || 0, closures: e.closures || 0, bestHand: e.bestHand == null ? null : e.bestHand,
    avgHand: e.hands ? Math.round((e.handPoints || 0) / e.hands) : null,
    elo: e.elo || null, eloMax: e.eloMax || null, rankedGames: e.rankedGames || 0, rankedWins: e.rankedWins || 0,
  };
}

Object.assign(ctx, { awardTrophies, gameStats, recordLeaderboard, recordDaily, dailyBoard, recordSeries, statsByGame, publicStats });
module.exports = { STATS0, GSTATS0 };
