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

const PORT = process.env.PORT || 3000;
const BOT_DELAY = Number(process.env.BOT_DELAY || 700);
// solo per i test automatici: accelera il timer del turno (es. 0.02 = 50 volte più veloce)
const TIMER_SCALE = Number(process.env.TIMER_SCALE || 1);
const BOT_SPEEDS = { lenta: BOT_DELAY * 1.9, normale: BOT_DELAY, veloce: BOT_DELAY * 0.45 };
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'stato.json');

const app = express();
// usato dalla pagina d'ingresso su GitHub Pages per sapere se il server è acceso
app.get('/health', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, tavoli: rooms.size });
});
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/shared', express.static(path.join(__dirname, '..', 'shared')));
const server = http.createServer(app);
const io = new Server(server);

/* sessions: token -> { name, room } ; rooms: code -> room */
const sessions = new Map();
const rooms = new Map();
const BOT_NAMES = ['Nonna Pina', 'Zio Gino', 'Carmela', 'Totò', 'Rosetta', 'Peppino', 'Ninetta', 'Gegè'];

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c));
  return c;
}

function seatOfToken(room, token) {
  return room.seats.findIndex((s) => s && s.token === token);
}

function roomInfo(room) {
  return {
    code: room.code, host: room.seats.findIndex((s) => s && s.token === room.hostToken),
    rules: room.rules, n: room.n, preset: Rules.matchPreset(room.rules),
    seats: room.seats.map((s) => (s ? { name: s.name, isBot: !!s.isBot, connected: s.isBot || isConnected(s.token) } : null)),
    started: !!room.game, ready: [...room.ready], botSpeed: room.botSpeed || 'normale',
    hints: !!room.hints && humanCount(room) <= 1, humans: humanCount(room),
    music: room.music || null,
    turnTime: room.turnTime || 0,
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

function afterAction(room) {
  const g = room.game;
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
  const seat = seatOfToken(room, socket.data.token);
  if (seat >= 0 && !room.game) room.seats[seat] = null;
  if (seat >= 0 && room.game) {
    // in partita: il posto passa a un bot
    const s = room.seats[seat];
    s.isBot = true;
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
  if (seat < 0) {
    if (room.game) throw new E.GameError('La partita è già iniziata');
    seat = room.seats.findIndex((s) => !s);
    if (seat < 0) throw new E.GameError('Il tavolo è pieno');
    room.seats[seat] = { token, name: sess.name };
  }
  if (socket.data.room && socket.data.room !== room.code) leaveRoom(socket);
  socket.join(room.code);
  socket.data.room = room.code;
  sess.room = room.code;
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
    if (name) sess.name = cleanName(name);
    socket.data.token = token;
    socket.emit('welcome', { token, name: sess.name });
    if (sess.room && rooms.has(sess.room)) {
      const room = rooms.get(sess.room);
      if (seatOfToken(room, token) >= 0) {
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

  socket.on('createRoom', handler(({ rules, vsBots }) => {
    const r = Rules.normalize(rules);
    const code = newCode();
    const room = {
      code, rules: r, n: r.players, hostToken: socket.data.token,
      seats: Array(r.players).fill(null), game: null, ready: new Set(), botTimer: null, botMemo: {},
    };
    rooms.set(code, room);
    joinRoom(socket, room);
    if (vsBots) {
      fillBots(room);
      startGame(room);
    }
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
    const hint = Bot.nextAction(JSON.parse(JSON.stringify(g)), seat, {});
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
    room.ready.add(seat);
    const humans = room.seats.map((s, i) => (s && !s.isBot ? i : -1)).filter((i) => i >= 0);
    // a fine partita "pronto" vale come voto per la rivincita: si riparte quando tutti hanno votato
    if (g.over) {
      if (humans.every((i) => room.ready.has(i))) startGame(room);
      else broadcast(room);
      return;
    }
    if (humans.every((i) => room.ready.has(i))) {
      E.nextHand(g);
      room.ready = new Set();
      room.turnCounter = (room.turnCounter || 0) + 1;
    }
    broadcast(room);
  }));

  socket.on('chat', handler(({ text }) => {
    const room = getRoom(socket);
    const t = String(text || '').replace(/[<>]/g, '').trim().slice(0, 140);
    if (!t) return;
    const seat = seatOfToken(room, socket.data.token);
    const name = seat >= 0 ? room.seats[seat].name : 'Ospite';
    io.to(room.code).emit('chat', { name, text: t, seat });
  }));

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.room);
    if (room) setTimeout(() => rooms.has(room.code) && broadcast(room), 50);
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
  clearTimeout(room.botTimer);
  room.botTimer = null;
  room.game = E.createGame({
    rules: room.rules,
    players: room.seats.map((s) => ({ name: s.name, isBot: !!s.isBot })),
  });
  room.ready = new Set();
  room.botMemo = {};
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
      rooms: [...rooms.values()].map((r) => ({
        code: r.code, rules: r.rules, n: r.n, hostToken: r.hostToken, seats: r.seats, game: r.game,
        ready: [...r.ready], turnCounter: r.turnCounter, lastTurnSeat: r.lastTurnSeat, botSpeed: r.botSpeed, hints: r.hints, music: r.music, turnTime: r.turnTime,
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
  for (const ip of ips) console.log(`  dalla rete locale (smartphone): http://${ip}:${PORT}`);
});
