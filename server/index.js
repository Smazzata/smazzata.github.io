'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server } = require('socket.io');
const E = require('./engine');
const Bot = require('./bot');
const Rules = require('../shared/rules');
const createSocial = require('./social');

const PORT = process.env.PORT || 3000;
const BOT_DELAY = Number(process.env.BOT_DELAY || 700);
// solo per i test automatici: accelera il timer del turno (es. 0.02 = 50 volte più veloce)
const TIMER_SCALE = Number(process.env.TIMER_SCALE || 1);
const BOT_SPEEDS = { lenta: BOT_DELAY * 1.9, normale: BOT_DELAY, veloce: BOT_DELAY * 0.45 };
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'stato.json');

/* ---------- Ultimi errori (per la pagina di stato) ---------- */
const recentErrors = [];
const origError = console.error.bind(console);
console.error = (...args) => {
  recentErrors.push({ at: Date.now(), text: args.map((a) => (a && a.stack) || String(a)).join(' ').slice(0, 500) });
  if (recentErrors.length > 30) recentErrors.shift();
  origError(...args);
};
const startedAt = Date.now();

/* chiave della pagina di stato: generata al primo avvio e salvata accanto ai dati */
function adminKey() {
  const f = path.join(DATA_DIR, 'admin-key.txt');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch (e) { /* da creare */ }
  const k = crypto.randomBytes(9).toString('base64url');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(f, k);
  return k;
}
const ADMIN_KEY = process.env.ADMIN_KEY || adminKey();

function gitVersion() {
  try {
    const head = fs.readFileSync(path.join(__dirname, '..', '.git', 'HEAD'), 'utf8').trim();
    const ref = head.startsWith('ref:') ? fs.readFileSync(path.join(__dirname, '..', '.git', head.slice(5).trim()), 'utf8').trim() : head;
    return ref.slice(0, 7);
  } catch (e) { return 'sconosciuta'; }
}

const app = express();
// usato dalla pagina d'ingresso su GitHub Pages per sapere se il server è acceso
app.get('/health', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, tavoli: rooms.size });
});
/* ---------- Pagina di stato (solo con la chiave) ---------- */
function statusData() {
  const online = new Set([...io.sockets.sockets.values()].map((so) => so.data.token).filter(Boolean));
  return {
    acceso_da_min: Math.round((Date.now() - startedAt) / 60000),
    versione: gitVersion(),
    memoria_mb: Math.round(process.memoryUsage().rss / 1048576),
    connessi: online.size,
    profili: [...sessions.values()].filter((x) => x.nick).length,
    tavoli: [...rooms.values()].map((r) => ({
      codice: r.code,
      regole: Rules.matchPreset(r.rules) || 'personalizzate',
      giocatori: r.seats.map((x) => (x ? `${x.name}${x.isBot ? ' 🤖' : isConnected(x.token) ? ' 🟢' : ' ⚪'}` : '—')),
      fase: !r.game ? 'in attesa' : r.game.over ? 'partita finita' : r.game.phase === 'handEnd' ? `fine smazzata ${r.game.handNo}` : `smazzata ${r.game.handNo}`,
      punteggi: r.game ? r.game.scores : null,
    })),
    errori: recentErrors.slice().reverse().map((e) => ({ quando: new Date(e.at).toLocaleString('it-IT'), testo: e.text })),
  };
}

app.get('/stato.json', (req, res) => {
  if (req.query.k !== ADMIN_KEY) return res.status(403).json({ errore: 'chiave mancante o sbagliata' });
  res.set('Cache-Control', 'no-store').json(statusData());
});

app.get('/stato', (req, res) => {
  if (req.query.k !== ADMIN_KEY) return res.status(403).send('Accesso negato');
  const d = statusData();
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  res.set('Cache-Control', 'no-store').send(`<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="10"><title>Stato Burraco</title>
<style>body{font-family:system-ui,sans-serif;background:#0f5132;color:#fff;margin:0;padding:16px}h1{margin:0 0 12px}
.box{background:rgba(0,0,0,.25);border-radius:12px;padding:12px;margin:10px 0}.k{display:inline-block;margin:4px 14px 4px 0}
.k b{display:block;font-size:22px;color:#f2c14e}table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:5px;border-bottom:1px solid rgba(255,255,255,.15)}
pre{white-space:pre-wrap;font-size:12px;margin:4px 0;color:#ffd7d7}.m{color:#bcd6c8;font-size:12px}</style></head><body>
<h1>🃏 Stato del server</h1>
<div class="box"><span class="k">Acceso da<b>${d.acceso_da_min} min</b></span><span class="k">Connessi<b>${d.connessi}</b></span>
<span class="k">Profili<b>${d.profili}</b></span><span class="k">Tavoli<b>${d.tavoli.length}</b></span><span class="k">Memoria<b>${d.memoria_mb} MB</b></span>
<span class="k">Versione<b>${esc(d.versione)}</b></span></div>
<div class="box"><b>Tavoli</b>${d.tavoli.length ? `<table><tr><th>Codice</th><th>Fase</th><th>Giocatori</th><th>Regole</th></tr>${d.tavoli.map((t) => `<tr><td>${esc(t.codice)}</td><td>${esc(t.fase)}</td><td>${t.giocatori.map(esc).join(', ')}</td><td>${esc(t.regole)}</td></tr>`).join('')}</table>` : '<p class="m">Nessun tavolo aperto.</p>'}</div>
<div class="box"><b>Ultimi errori</b>${d.errori.length ? d.errori.map((e) => `<pre>${esc(e.quando)} — ${esc(e.testo)}</pre>`).join('') : '<p class="m">Nessun errore 🎉</p>'}</div>
<p class="m">La pagina si aggiorna ogni 10 secondi. 🟢 online · ⚪ offline · 🤖 computer</p></body></html>`);
});

app.get('/vendor/qrcode.js', (req, res) => res.sendFile(require.resolve('qrcode-generator')));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
const server = http.createServer(app);
const io = new Server(server);

/* sessions: token -> { name, room, nick, code, pw, friends, reqIn, reqOut } ; rooms: code -> room */
const sessions = new Map();
const rooms = new Map();
/* classifica: token -> { name, games, wins, points, burraco } (solo giocatori umani) */
const leaderboard = new Map();
const BOT_NAMES = ['Nonna Pina', 'Zio Gino', 'Carmela', 'Totò', 'Rosetta', 'Peppino', 'Ninetta', 'Gegè'];

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c));
  return c;
}

function roomOfToken(token) {
  const sess = sessions.get(token);
  const room = sess && sess.room && rooms.get(sess.room);
  return room && seatOfToken(room, token) >= 0 ? room : null;
}

/** Il nickname scelto diventa il nome mostrato nei tavoli e in classifica */
function renamePlayer(token, nick) {
  const sess = sessions.get(token) || {};
  for (const room of rooms.values()) {
    const seat = seatOfToken(room, token);
    if (seat < 0) continue;
    if (nick) room.seats[seat].name = nick;
    room.seats[seat].avatar = sess.avatar || null;
    if (room.game && nick) room.game.players[seat].name = nick;
    broadcast(room);
  }
  const e = leaderboard.get(token);
  if (e && nick) e.name = nick;
}

function seatOfToken(room, token) {
  return room.seats.findIndex((s) => s && s.token === token);
}

function roomInfo(room) {
  return {
    code: room.code, host: room.seats.findIndex((s) => s && s.token === room.hostToken),
    rules: room.rules, n: room.n, preset: Rules.matchPreset(room.rules),
    seats: room.seats.map((s) => (s ? { name: s.name, isBot: !!s.isBot, connected: s.isBot || isConnected(s.token), avatar: s.isBot ? null : s.avatar || null } : null)),
    started: !!room.game, ready: [...room.ready], botSpeed: room.botSpeed || 'normale',
    hints: !!room.hints && humanCount(room) <= 1, humans: humanCount(room),
    music: room.music || null,
    spectators: (room.spectators || []).filter((t) => isConnected(t)).map((t) => (sessions.get(t) || {}).name || 'Ospite'),
    botLevel: room.botLevel || 'normale',
    turnTime: room.turnTime || 0,
    tutorial: !!room.tutorial,
    quick: room.quick || 0,
    series: room.series || null,
    turnLeft: room.turnDeadline ? Math.max(0, room.turnDeadline - Date.now()) : null,
  };
}

function humanCount(room) {
  return room.seats.filter((s) => s && !s.isBot).length;
}

function isConnected(token) {
  for (const s of io.sockets.sockets.values()) if (s.data.token === token) return true;
  return false;
}

function broadcast(room) {
  scheduleTurnTimer(room);
  scheduleAbsent(room);
  for (const s of io.sockets.sockets.values()) {
    if (s.data.room !== room.code) continue;
    const seat = seatOfToken(room, s.data.token);
    s.emit('state', {
      room: { ...roomInfo(room), you: seat, isHost: s.data.token === room.hostToken },
      game: room.game ? E.viewFor(room.game, seat) : null,
    });
  }
  scheduleBot(room);
  scheduleSave();
}

/* ---------- Timer del turno: allo scadere si pesca e si scarta in automatico ---------- */
function turnTimerKey(room) {
  const g = room.game;
  if (!g || g.phase === 'handEnd' || !room.turnTime) return null;
  const s = room.seats[g.turn];
  if (!s || s.isBot) return null;
  return `${g.handNo}:${g.turn}:${room.turnCounter || 0}`;
}

/* ---------- Giocatore offline: dopo un'attesa il computer gioca al suo posto ---------- */
const ABSENT_MS = Number(process.env.ABSENT_MS || 45000) * TIMER_SCALE;

function scheduleAbsent(room) {
  const g = room.game;
  const s = g && g.phase !== 'handEnd' && !g.over ? room.seats[g.turn] : null;
  const absent = s && !s.isBot && s.token && !isConnected(s.token);
  room.absentSince = room.absentSince || {};
  // ricorda da quando ciascun giocatore è offline (si azzera quando rientra)
  room.seats.forEach((x, i) => {
    if (!x || x.isBot || !x.token) return;
    if (isConnected(x.token)) delete room.absentSince[i];
    else if (!room.absentSince[i]) room.absentSince[i] = Date.now();
  });
  const key = absent ? `${g.handNo}:${g.turn}:${room.turnCounter || 0}` : null;
  if (key === room.absentKey) return;
  clearTimeout(room.absentHandle);
  room.absentKey = key;
  if (!key) return;
  // la prima volta si aspetta ABSENT_MS; se è già offline da tanto si gioca subito
  const waited = Date.now() - room.absentSince[g.turn];
  const delay = Math.max(BOT_DELAY, ABSENT_MS - waited);
  room.absentHandle = setTimeout(() => playForAbsent(room, key), delay);
}

function playForAbsent(room, key) {
  const g = room.game;
  if (!g || room.absentKey !== key) return;
  const seat = g.turn;
  const s = room.seats[seat];
  if (!s || s.isBot || isConnected(s.token)) return;
  E.note(g, `🤖 ${s.name} è offline: il computer gioca al suo posto`);
  const memo = { level: 'normale' };
  for (let i = 0; i < 60 && g.turn === seat && g.phase !== 'handEnd'; i++) {
    try { E.apply(g, seat, Bot.nextAction(g, seat, memo)); } catch (e) { console.error('Turno per giocatore offline:', e.message); break; }
  }
  room.absentKey = null;
  afterAction(room);
}

function scheduleTurnTimer(room) {
  const key = turnTimerKey(room);
  if (key === room.timerKey) return;
  clearTimeout(room.turnTimerHandle);
  room.timerKey = key;
  room.turnDeadline = key ? Date.now() + room.turnTime * 1000 * TIMER_SCALE : null;
  if (!key) return;
  room.turnTimerHandle = setTimeout(() => autoPlay(room, key), room.turnTime * 1000 * TIMER_SCALE);
}

function autoPlay(room, key) {
  const g = room.game;
  if (!g || turnTimerKey(room) !== key) return;
  const seat = g.turn;
  const memo = { noMeld: true }; // niente calate automatiche: solo pesca e scarto
  E.note(g, `⏱ Tempo scaduto per ${g.players[seat].name}: pesca e scarta in automatico`);
  for (let i = 0; i < 6 && g.turn === seat && g.phase !== 'handEnd'; i++) {
    try { E.apply(g, seat, Bot.nextAction(g, seat, memo)); } catch (e) { console.error('Turno automatico:', e.message); break; }
  }
  afterAction(room);
}

function scheduleBot(room) {
  const g = room.game;
  if (!g || room.botTimer) return;
  if (g.phase === 'handEnd') {
    // se al tavolo ci sono solo bot pronti, prosegue da solo
    return;
  }
  const seat = g.turn;
  if (!room.seats[seat] || !room.seats[seat].isBot) return;
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (!room.game || room.game !== g || g.turn !== seat || g.phase === 'handEnd') return;
    // memoria del bot valida solo per il turno corrente
    if (room.botMemoTurn !== room.turnCounter) {
      room.botMemo = {};
      room.botMemoTurn = room.turnCounter;
    }
    try {
      room.botMemo.level = room.botLevel || 'normale';
      const a = Bot.nextAction(g, seat, room.botMemo);
      E.apply(g, seat, a);
    } catch (e) {
      console.error('Errore bot:', e.message);
      try {
        if (g.phase === 'draw') E.apply(g, seat, { type: 'draw' });
        else {
          const legal = g.players[seat].hand.map((c) => ({ type: 'discard', cardId: c.id })).find((x) => E.isLegal(g, seat, x));
          if (legal) E.apply(g, seat, legal);
          else E.apply(g, seat, { type: 'undo' });
        }
      } catch (e2) { console.error('Bot bloccato:', e2.message); }
    }
    afterAction(room);
  }, BOT_SPEEDS[room.botSpeed] || BOT_DELAY);
}

/** A fine partita aggiorna la classifica una sola volta per partita */
const STATS0 = { games: 0, wins: 0, points: 0, burraco: 0, hands: 0, handsWon: 0, closures: 0, bestHand: null, handPoints: 0, history: [] };

/**
 * Statistiche dei giocatori sul server: aggiornate a ogni fine smazzata e a fine partita
 * (una sola volta ciascuna), con lo storico delle ultime 20 partite.
 */
function recordLeaderboard(room) {
  const g = room.game;
  if (!g || g.phase !== 'handEnd' || !g.handResult) return;
  const handKey = `${room.gameSeq}:${g.handNo}`;
  const hr = g.handResult;
  room.seats.forEach((s, seat) => {
    if (!s || s.isBot || !s.token) return;
    const e = { ...STATS0, ...(leaderboard.get(s.token) || {}) };
    e.name = s.name;
    if (room.recordedHand !== handKey) {
      const mine = hr.teams.find((t) => t.members.includes(seat));
      if (mine) {
        e.hands++;
        if (mine.total === Math.max(...hr.teams.map((t) => t.total))) e.handsWon++;
        e.burraco += mine.burraco.length;
        e.handPoints += mine.total;
        e.bestHand = e.bestHand == null ? mine.total : Math.max(e.bestHand, mine.total);
      }
      if (hr.reason === 'close' && hr.closer === seat) e.closures++;
    }
    if (g.over && room.recordedGame !== room.gameSeq) {
      e.games++;
      if (g.winners.includes(seat)) e.wins++;
      e.points += g.scores[seat];
      const team = g.teams.find((t) => t.members.includes(seat));
      e.history = [{
        at: Date.now(), preset: Rules.matchPreset(room.rules) || 'personalizzate', won: g.winners.includes(seat),
        hands: g.history.length,
        teams: g.teams.map((t) => ({ names: t.members.map((x) => room.seats[x].name), score: g.scores[t.members[0]], mine: t === team })),
        tokens: room.seats.filter((x) => x && !x.isBot && x.token).map((x) => x.token),
      }, ...(e.history || [])].slice(0, 20);
    }
    leaderboard.set(s.token, e);
  });
  room.recordedHand = handKey;
  if (g.over && room.recordedGame !== room.gameSeq) recordSeries(room);
  if (g.over) room.recordedGame = room.gameSeq;
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
function publicStats(e) {
  return {
    name: e.name, games: e.games, wins: e.wins, points: e.points, burraco: e.burraco, hands: e.hands || 0,
    handsWon: e.handsWon || 0, closures: e.closures || 0, bestHand: e.bestHand == null ? null : e.bestHand,
    avgHand: e.hands ? Math.round((e.handPoints || 0) / e.hands) : null,
  };
}

/**
 * Fine smazzata / fine partita: si prosegue quando tutti i giocatori COLLEGATI sono pronti
 * (chi è offline non blocca il tavolo). A fine partita "pronto" vale come voto per la rivincita.
 */
function checkReady(room) {
  const g = room.game;
  if (!g || g.phase !== 'handEnd') return;
  const humans = room.seats.map((s, i) => (s && !s.isBot && isConnected(s.token) ? i : -1)).filter((i) => i >= 0);
  const allReady = humans.length > 0 && humans.every((i) => room.ready.has(i));
  if (allReady && g.over) { startGame(room); return; }
  if (allReady) {
    E.nextHand(g);
    room.ready = new Set();
    room.turnCounter = (room.turnCounter || 0) + 1;
  }
  broadcast(room);
}

function afterAction(room) {
  const g = room.game;
  recordLeaderboard(room);
  if (g && g.turn !== room.lastTurnSeat) {
    room.lastTurnSeat = g.turn;
    room.turnCounter = (room.turnCounter || 0) + 1;
  }
  if (g && g.phase === 'handEnd') room.ready = new Set();
  broadcast(room);
}

function leaveRoom(socket) {
  const code = socket.data.room;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  socket.data.room = null;
  const sess = sessions.get(socket.data.token);
  if (sess) sess.room = null;
  if (!room) return;
  room.spectators = (room.spectators || []).filter((t) => t !== socket.data.token);
  const seat = seatOfToken(room, socket.data.token);
  if (seat >= 0 && !room.game) room.seats[seat] = null;
  if (seat >= 0 && room.game) {
    // in partita: il posto passa a un bot
    const s = room.seats[seat];
    s.isBot = true;
    s.leftToken = s.token; // per poter tornare al proprio posto
    s.leftName = s.name;
    s.token = null;
    s.name = s.name + ' (bot)';
    room.game.players[seat].isBot = true;
    room.game.players[seat].name = s.name;
  }
  if (room.hostToken === socket.data.token) {
    const h = room.seats.find((s) => s && !s.isBot);
    room.hostToken = h ? h.token : null;
  }
  if (!room.seats.some((s) => s && !s.isBot)) {
    clearTimeout(room.botTimer);
    rooms.delete(code);
    scheduleSave();
    return;
  }
  broadcast(room);
}

function joinRoom(socket, room) {
  const token = socket.data.token;
  const sess = sessions.get(token);
  let seat = seatOfToken(room, token);
  room.spectators = room.spectators || [];
  // rientro al proprio posto dopo essere usciti da una partita in corso
  const back = seat < 0 && room.game ? room.seats.findIndex((x) => x && x.leftToken === token) : -1;
  if (back >= 0) {
    const s = room.seats[back];
    Object.assign(s, { isBot: false, token, name: sess.name || s.leftName, avatar: sess.avatar || null });
    delete s.leftToken; delete s.leftName;
    room.game.players[back].isBot = false;
    room.game.players[back].name = s.name;
    E.note(room.game, `${s.name} è tornato al tavolo`);
    seat = back;
    room.spectators = room.spectators.filter((t) => t !== token);
  }
  if (seat < 0) {
    const free = room.game ? -1 : room.seats.findIndex((s) => !s);
    if (free >= 0) {
      room.seats[free] = { token, name: sess.name, avatar: sess.avatar || null };
      room.spectators = room.spectators.filter((t) => t !== token);
    } else if (!room.spectators.includes(token)) {
      // partita iniziata o tavolo pieno: si entra a guardare (senza vedere le carte in mano)
      if (room.spectators.length >= 20) throw new E.GameError('Troppi spettatori a questo tavolo');
      room.spectators.push(token);
    }
  }
  if (socket.data.room && socket.data.room !== room.code) leaveRoom(socket);
  socket.join(room.code);
  socket.data.room = room.code;
  sess.room = room.code;
  if (room.quick && !room.game && room.seats.every(Boolean)) { startGame(room); return; }
  broadcast(room);
}

function getRoom(socket) {
  const room = rooms.get(socket.data.room);
  if (!room) throw new E.GameError('Non sei in nessun tavolo');
  return room;
}

function requireHost(socket, room) {
  if (room.hostToken !== socket.data.token) throw new E.GameError('Solo chi ha creato il tavolo può farlo');
}

function cleanName(n) {
  return String(n || '').replace(/[<>]/g, '').trim().slice(0, 18) || 'Giocatore';
}

const social = createSocial({
  io, sessions, isConnected: (t) => isConnected(t), roomOfToken, renamePlayer,
  onDelete: (token) => { leaderboard.delete(token); scheduleSave(); },
});

io.on('connection', (socket) => {
  const handler = (fn) => (data, cb) => {
    try { const res = fn(data || {}); if (typeof cb === 'function') cb({ ok: true, ...(res || {}) }); }
    catch (e) {
      if (!(e instanceof E.GameError)) console.error(e);
      if (typeof cb === 'function') cb({ ok: false, error: e.message });
    }
  };

  socket.on('hello', handler(({ token, name }) => {
    if (!token || !sessions.has(token)) {
      token = crypto.randomBytes(12).toString('hex');
      sessions.set(token, { name: cleanName(name), room: null });
    }
    const sess = sessions.get(token);
    // con un nickname il nome mostrato è sempre quello
    if (sess.nick) sess.name = sess.nick; else if (name) sess.name = cleanName(name);
    socket.data.token = token;
    socket.emit('welcome', { token, name: sess.name, nick: sess.nick || null });
    social.push(token);
    social.pushFriends(token);
    if (sess.room && rooms.has(sess.room)) {
      const room = rooms.get(sess.room);
      if (seatOfToken(room, token) >= 0 || (room.spectators || []).includes(token)) {
        socket.join(room.code);
        socket.data.room = room.code;
        broadcast(room);
        return;
      }
    }
    socket.emit('state', { room: null, game: null });
  }));

  socket.on('setName', handler(({ name }) => {
    const sess = sessions.get(socket.data.token);
    if (!sess) throw new E.GameError('Sessione non valida');
    if (sess.nick) return; // il nome è il nickname
    sess.name = cleanName(name);
    const room = rooms.get(socket.data.room);
    if (room) {
      const seat = seatOfToken(room, socket.data.token);
      if (seat >= 0) {
        room.seats[seat].name = sess.name;
        if (room.game) room.game.players[seat].name = sess.name;
      }
      broadcast(room);
    }
  }));

  socket.on('createRoom', handler(({ rules, vsBots, tutorial }) => {
    // allenamento: Classico in 2 contro un computer facile e lento, con i suggerimenti
    const r = Rules.normalize(tutorial ? { ...Rules.PRESETS[0].rules, players: 2, target: 505 } : rules);
    const code = newCode();
    const room = {
      code, rules: r, n: r.players, hostToken: socket.data.token,
      seats: Array(r.players).fill(null), game: null, ready: new Set(), botTimer: null, botMemo: {},
    };
    if (tutorial) Object.assign(room, { tutorial: true, hints: true, botLevel: 'facile', botSpeed: 'lenta' });
    rooms.set(code, room);
    joinRoom(socket, room);
    if (tutorial) { fillBots(room); startGame(room); return; }
    if (vsBots) {
      fillBots(room);
      startGame(room);
    }
  }));

  socket.on('quickPlay', handler(({ n }) => {
    n = Number(n) === 2 ? 2 : 4;
    const sess = sessions.get(socket.data.token);
    if (!sess || !sess.nick) throw new E.GameError('Scegli prima il tuo nickname');
    let room = [...rooms.values()].find((r) => r.quick === n && !r.game && r.seats.some((s) => !s)
      && seatOfToken(r, socket.data.token) < 0 && r.seats.some((s) => s && !s.isBot && isConnected(s.token)));
    if (!room) {
      const r = Rules.normalize({ ...Rules.PRESETS[0].rules, players: n });
      room = {
        code: newCode(), rules: r, n, hostToken: socket.data.token, quick: n,
        seats: Array(n).fill(null), game: null, ready: new Set(), botTimer: null, botMemo: {},
      };
      rooms.set(room.code, room);
    }
    joinRoom(socket, room);
    return { code: room.code };
  }));

  socket.on('joinRoom', handler(({ code }) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) throw new E.GameError('Tavolo non trovato');
    joinRoom(socket, room);
  }));

  socket.on('leaveRoom', handler(() => {
    leaveRoom(socket);
    socket.emit('state', { room: null, game: null });
  }));

  socket.on('sit', handler(({ seat }) => {
    const room = getRoom(socket);
    if (room.game) throw new E.GameError('Partita già iniziata');
    if (room.seats[seat]) throw new E.GameError('Posto occupato');
    const cur = seatOfToken(room, socket.data.token);
    room.seats[seat] = room.seats[cur];
    room.seats[cur] = null;
    broadcast(room);
  }));

  socket.on('addBot', handler(({ seat }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (room.game) throw new E.GameError('Partita già iniziata');
    if (seat === undefined) { fillBots(room); } else {
      if (room.seats[seat]) throw new E.GameError('Posto occupato');
      room.seats[seat] = { isBot: true, name: botName(room) };
    }
    broadcast(room);
  }));

  socket.on('removeSeat', handler(({ seat }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (room.game) throw new E.GameError('Partita già iniziata');
    if (!room.seats[seat] || !room.seats[seat].isBot) throw new E.GameError('Puoi togliere solo i bot');
    room.seats[seat] = null;
    broadcast(room);
  }));

  socket.on('configure', handler(({ rules }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (room.game) throw new E.GameError('Partita già iniziata');
    const r = Rules.normalize(rules);
    const n = r.players;
    const people = room.seats.filter(Boolean);
    if (people.filter((s) => !s.isBot).length > n) throw new E.GameError('Troppi giocatori al tavolo per questa variante');
    const humans = people.filter((s) => !s.isBot);
    const bots = people.filter((s) => s.isBot);
    room.seats = Array(n).fill(null);
    [...humans, ...bots].slice(0, n).forEach((s, i) => { room.seats[i] = s; });
    room.rules = r; room.n = n;
    broadcast(room);
  }));

  socket.on('start', handler(() => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (room.game) throw new E.GameError('Partita già iniziata');
    if (room.seats.some((s) => !s)) throw new E.GameError('Ci sono posti liberi: aspetta altri giocatori o aggiungi dei bot');
    startGame(room);
  }));

  socket.on('action', handler((action) => {
    const room = getRoom(socket);
    if (!room.game) throw new E.GameError('Partita non iniziata');
    const seat = seatOfToken(room, socket.data.token);
    E.apply(room.game, seat, action);
    afterAction(room);
  }));

  socket.on('hint', handler(() => {
    const room = getRoom(socket);
    const g = room.game;
    const seat = seatOfToken(room, socket.data.token);
    if (humanCount(room) > 1 || !room.hints) throw new E.GameError('I suggerimenti sono disponibili solo giocando da soli contro il computer');
    if (!g || g.turn !== seat || g.phase === 'handEnd') throw new E.GameError('Il suggerimento è disponibile solo nel tuo turno');
    const hint = Bot.nextAction(JSON.parse(JSON.stringify(g)), seat, { level: 'difficile' });
    return { hint };
  }));

  // Musica del tavolo: l'host condivide un link Spotify (Jam, playlist, album o brano)
  socket.on('setMusic', handler(({ url }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (!url) { room.music = null; broadcast(room); return; }
    const u = String(url).trim().slice(0, 300);
    let parsed;
    try { parsed = new URL(u); } catch (e) { throw new E.GameError('Link non valido'); }
    if (parsed.protocol !== 'https:' || !/(^|\.)(spotify\.com|spotify\.link)$/.test(parsed.hostname)) {
      throw new E.GameError('Incolla un link di Spotify (Jam, playlist, album o brano)');
    }
    const seat = seatOfToken(room, socket.data.token);
    room.music = { url: parsed.href, by: seat >= 0 ? room.seats[seat].name : 'Host', at: Date.now() };
    broadcast(room);
  }));

  socket.on('leaderboard', handler(({ friends } = {}) => {
    const me = socket.data.token;
    const mine = sessions.get(me) || {};
    const allowed = friends ? new Set([me, ...(mine.friends || [])]) : null;
    const list = [...leaderboard.entries()]
      .filter(([token]) => !allowed || allowed.has(token))
      .map(([token, e]) => ({ name: e.name, games: e.games, wins: e.wins, points: e.points, burraco: e.burraco, me: token === me }))
      .filter((e) => e.games > 0)
      .sort((a, b) => b.wins - a.wins || (b.wins / b.games) - (a.wins / a.games) || b.points - a.points)
      .slice(0, 30);
    return { list };
  }));

  // Le mie statistiche e il mio storico
  socket.on('myStats', handler(() => {
    const e = leaderboard.get(socket.data.token);
    if (!e) return { stats: null, history: [] };
    return {
      stats: publicStats(e),
      history: (e.history || []).map((h) => ({ at: h.at, preset: h.preset, won: h.won, hands: h.hands, teams: h.teams })),
    };
  }));

  // Scheda di un amico: le sue statistiche e le partite giocate insieme
  socket.on('playerCard', handler(({ nick }) => {
    const me = socket.data.token;
    const mine = sessions.get(me) || {};
    const other = [...sessions.entries()].find(([, x]) => x.nick && x.nick.toLowerCase() === String(nick || '').toLowerCase());
    if (!other) throw new E.GameError('Giocatore non trovato');
    const [token, sess] = other;
    if (token !== me && !(mine.friends || []).includes(token)) throw new E.GameError('Puoi vedere solo la scheda dei tuoi amici');
    const e = leaderboard.get(token);
    const shared = ((leaderboard.get(me) || {}).history || []).filter((h) => (h.tokens || []).includes(token));
    const sameTeam = (h) => {
      const myTeam = h.teams.find((t) => t.mine);
      return myTeam && myTeam.names.includes(sess.nick);
    };
    return {
      nick: sess.nick, avatar: sess.avatar || null,
      stats: e ? publicStats(e) : null,
      together: {
        games: shared.length,
        asPartners: shared.filter(sameTeam).length,
        winsTogether: shared.filter((h) => sameTeam(h) && h.won).length,
        winsAgainst: shared.filter((h) => !sameTeam(h) && h.won).length,
        recent: shared.slice(0, 5).map((h) => ({ at: h.at, won: h.won, partner: sameTeam(h), teams: h.teams })),
      },
    };
  }));

  socket.on('setSeries', handler(({ bestOf }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    bestOf = Number(bestOf);
    if (![1, 3, 5].includes(bestOf)) throw new E.GameError('Torneo non valido');
    if (room.game && !room.game.over) throw new E.GameError('Si cambia il torneo tra una partita e l\'altra');
    room.series = bestOf > 1 ? { bestOf, wins: Array(room.n).fill(0), games: 0, champion: null } : null;
    broadcast(room);
  }));

  socket.on('setBotLevel', handler(({ level }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (!['facile', 'normale', 'difficile'].includes(level)) throw new E.GameError('Livello non valido');
    room.botLevel = level;
    broadcast(room);
  }));

  socket.on('setTurnTime', handler(({ seconds }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    const sec = Number(seconds);
    if (![0, 30, 60, 90].includes(sec)) throw new E.GameError('Tempo non valido');
    room.turnTime = sec;
    room.timerKey = undefined; // riparte il conteggio con il nuovo tempo
    broadcast(room);
  }));

  socket.on('setHints', handler(({ on }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (humanCount(room) > 1) throw new E.GameError('In multiplayer i suggerimenti non sono disponibili');
    room.hints = !!on;
    broadcast(room);
  }));

  socket.on('setBotSpeed', handler(({ speed }) => {
    const room = getRoom(socket);
    requireHost(socket, room);
    if (!BOT_SPEEDS[speed]) throw new E.GameError('Velocità non valida');
    room.botSpeed = speed;
    broadcast(room);
  }));

  socket.on('ready', handler(() => {
    const room = getRoom(socket);
    const g = room.game;
    if (!g || g.phase !== 'handEnd') throw new E.GameError('Nessuna smazzata da chiudere');
    const seat = seatOfToken(room, socket.data.token);
    if (seat < 0) throw new E.GameError('Gli spettatori non partecipano');
    room.ready.add(seat);
    checkReady(room);
  }));

  // Reazioni rapide al tavolo (con un limite per evitare raffiche)
  const REACTIONS = ['👏', '😂', '😱', '🔥', '👍', '😡', '🙏', '😍'];
  socket.on('react', handler(({ emoji }) => {
    const room = getRoom(socket);
    const seat = seatOfToken(room, socket.data.token);
    if (seat < 0) throw new E.GameError('Solo chi è seduto al tavolo può reagire');
    if (!REACTIONS.includes(emoji)) throw new E.GameError('Reazione non valida');
    const now = Date.now();
    if (socket.data.lastReact && now - socket.data.lastReact < 1000) throw new E.GameError('Piano con le reazioni 🙂');
    socket.data.lastReact = now;
    io.to(room.code).emit('reaction', { seat, emoji });
  }));

  socket.on('chat', handler(({ text }) => {
    const room = getRoom(socket);
    const t = String(text || '').replace(/[<>]/g, '').trim().slice(0, 140);
    if (!t) return;
    const seat = seatOfToken(room, socket.data.token);
    const name = seat >= 0 ? room.seats[seat].name : 'Ospite';
    io.to(room.code).emit('chat', { name, text: t, seat });
  }));

  social.register(socket, handler);

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.room);
    // chi va offline non blocca il "pronto" di fine smazzata
    if (room) setTimeout(() => { if (rooms.has(room.code)) { if (room.game && room.game.phase === 'handEnd') checkReady(room); else broadcast(room); } }, 50);
    const token = socket.data.token;
    if (token) setTimeout(() => social.pushFriends(token), 80);
  });
});

function botName(room) {
  const used = new Set(room.seats.filter(Boolean).map((s) => s.name));
  const free = BOT_NAMES.filter((n) => !used.has(n));
  return free.length ? free[Math.floor(Math.random() * free.length)] : 'Bot ' + Math.floor(Math.random() * 100);
}

function fillBots(room) {
  for (let i = 0; i < room.n; i++) if (!room.seats[i]) room.seats[i] = { isBot: true, name: botName(room) };
}

function startGame(room) {
  if (room.series && room.series.champion) room.series = { ...room.series, wins: Array(room.n).fill(0), games: 0, champion: null };
  clearTimeout(room.botTimer);
  room.botTimer = null;
  room.game = E.createGame({
    rules: room.rules,
    players: room.seats.map((s) => ({ name: s.name, isBot: !!s.isBot })),
  });
  room.ready = new Set();
  room.botMemo = {};
  room.gameSeq = (room.gameSeq || 0) + 1;
  room.turnCounter = 0;
  room.botMemoTurn = -1;
  room.lastTurnSeat = room.game.turn;
  broadcast(room);
}

// Pulizia dei tavoli abbandonati
setInterval(() => {
  for (const room of rooms.values()) {
    const anyone = room.seats.some((s) => s && !s.isBot && isConnected(s.token));
    if (anyone) room.idleSince = null;
    else if (!room.idleSince) room.idleSince = Date.now();
    else if (Date.now() - room.idleSince > 60 * 60 * 1000) {
      clearTimeout(room.botTimer);
      rooms.delete(room.code);
      scheduleSave();
    }
  }
}, 60 * 1000);

/* ---------- Salvataggio su file: le partite sopravvivono ai riavvii ---------- */
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveNow(); }, 1000);
}

function saveNow() {
  try {
    const data = {
      savedAt: Date.now(),
      sessions: [...sessions],
      leaderboard: [...leaderboard],
      rooms: [...rooms.values()].map((r) => ({
        code: r.code, rules: r.rules, n: r.n, hostToken: r.hostToken, seats: r.seats, game: r.game,
        ready: [...r.ready], turnCounter: r.turnCounter, lastTurnSeat: r.lastTurnSeat, botSpeed: r.botSpeed, hints: r.hints, music: r.music, turnTime: r.turnTime, botLevel: r.botLevel, gameSeq: r.gameSeq, recordedGame: r.recordedGame, spectators: r.spectators || [], tutorial: r.tutorial, quick: r.quick, series: r.series,
      })),
    };
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(data));
    fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
  } catch (e) {
    console.error('Salvataggio non riuscito:', e.message);
  }
}

function loadSaved() {
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    for (const [token, sess] of data.sessions || []) sessions.set(token, sess);
    for (const [token, e] of data.leaderboard || []) leaderboard.set(token, e);
    social.rebuildIndexes();
    for (const r of data.rooms || []) {
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

loadSaved();

server.listen(PORT, () => {
  const nets = require('os').networkInterfaces();
  const ips = Object.values(nets).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log(`Burraco in ascolto su http://localhost:${PORT}`);
  console.log(`  pagina di stato (solo per te): /stato?k=${ADMIN_KEY}`);
  for (const ip of ips) console.log(`  dalla rete locale (smartphone): http://${ip}:${PORT}`);
});
