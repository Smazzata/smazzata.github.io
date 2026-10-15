'use strict';
/*
 * Tavoli: codici, posti, entrata e uscita, invio dello stato a ciascun giocatore, partite con calma,
 * fine smazzata ("pronto"), avvio della partita e pulizia dei tavoli abbandonati.
 */
const E = require('./engine');
const Games = require('./games');
const Daily = require('./daily');
const Levels = require('./levels');
const { HOME_URL } = require('./config');
const ctx = require('./contesto');
const { io, sessions, rooms, leaderboard, daily } = ctx;
/** motore e computer del gioco di questo tavolo */
const GE = (room) => Games.of(room).E;
// funzioni degli altri moduli (lette dal contesto al momento della chiamata)
const recordLeaderboard = (...a) => ctx.recordLeaderboard(...a);
const scheduleAbsent = (...a) => ctx.scheduleAbsent(...a);
const scheduleBot = (...a) => ctx.scheduleBot(...a);
const scheduleSave = (...a) => ctx.scheduleSave(...a);
const scheduleTurnTimer = (...a) => ctx.scheduleTurnTimer(...a);

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
    rules: room.rules, n: room.n, preset: Games.of(room).presetOf(room.rules), game: Games.idOf(room.rules),
    seats: room.seats.map((s) => (s ? {
      name: s.name, isBot: !!s.isBot, connected: s.isBot || isConnected(s.token), avatar: s.isBot ? null : s.avatar || null,
      level: s.isBot ? null : Levels.levelOf(leaderboard.get(s.token)).level,
      voice: !s.isBot && (sessions.get(s.token) || {}).voice !== false, // ascolta i messaggi vocali
    } : null)),
    started: !!room.game, ready: [...room.ready], botSpeed: room.botSpeed || 'normale',
    hints: !!room.hints && humanCount(room) <= 1, humans: humanCount(room),
    aids: room.aids !== false,
    music: room.music || null,
    spectators: (room.spectators || []).filter((t) => isConnected(t)).map((t) => (sessions.get(t) || {}).name || 'Ospite'),
    botLevel: room.botLevel || 'normale',
    turnTime: room.turnTime || 0,
    tutorial: !!room.tutorial,
    slow: !!room.slow,
    tournament: room.tournament ? { id: room.tournament.id, name: room.tournament.name, round: room.tournament.round } : null,
    daily: room.daily ? { date: room.daily, title: Daily.challenge(room.daily).title } : null,
    quick: room.quick || 0,
    series: room.series || null,
    surrender: room.surrenderVotes && room.surrenderVotes.length ? room.surrenderVotes : null,
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
      room: { ...roomInfo(room), you: seat, isHost: s.data.token === room.hostToken, muted: seat >= 0 ? room.seats[seat].muted || [] : [] },
      game: room.game ? GE(room).viewFor(room.game, seat) : null,
    });
  }
  scheduleBot(room);
  scheduleSave();
  if (room.slow) slowRoomUpdates(room);
}

/* ---------- Partite con calma: elenco delle mie partite e avvisi "tocca a te" ---------- */
function socketsOf(token) {
  return [...io.sockets.sockets.values()].filter((s) => s.data.token === token);
}

/** Le partite con calma in cui sono seduto (per la schermata iniziale) */
function myGames(token) {
  const out = [];
  for (const room of rooms.values()) {
    if (!room.slow) continue;
    const seat = seatOfToken(room, token);
    if (seat < 0) continue;
    const g = room.game;
    const myTurn = !!g && !g.over && ((g.phase !== 'handEnd' && g.turn === seat) || (g.phase === 'handEnd' && !room.ready.has(seat)));
    out.push({
      code: room.code, started: !!g, over: !!(g && g.over), myTurn,
      players: room.seats.map((x, i) => (x ? { name: x.name, isBot: !!x.isBot, me: i === seat } : null)),
      handNo: g ? g.handNo : 0, scores: g ? g.teams.map((t) => g.scores[t.members[0]]) : [],
      at: room.lastActionAt || 0,
    });
  }
  return out.sort((a, b) => b.myTurn - a.myTurn || b.at - a.at);
}

function pushMyGames(token) {
  const list = myGames(token);
  for (const s of socketsOf(token)) s.emit('myGames', list);
}

function slowRoomUpdates(room) {
  const g = room.game;
  for (const x of room.seats) if (x && !x.isBot && x.token) pushMyGames(x.token);
  if (!g || g.over || g.phase === 'handEnd') return;
  const s = room.seats[g.turn];
  if (!s || s.isBot || !s.token) return;
  const key = `${room.gameSeq}:${g.handNo}:${room.turnCounter || 0}`;
  if (room.notifiedKey === key) return;
  const socks = socketsOf(s.token);
  if (socks.some((x) => x.data.room === room.code)) return; // è già al tavolo: niente avviso (per ora)
  room.notifiedKey = key;
  const others = room.seats.filter((x, i) => x && i !== g.turn).map((x) => x.name.replace(/ \(bot\)$/, ''));
  const text = `Tocca a te nella partita con ${others.join(', ')}`;
  if (socks.length) for (const x of socks) x.emit('yourTurn', { code: room.code, text });
  else ctx.push.send(s.token, { title: 'Smazzata: tocca a te 🐢', body: text, tag: 'turn-' + room.code, url: `${HOME_URL}?t=${room.code}` }).catch(() => {});
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
    GE(room).nextHand(g);
    room.ready = new Set();
    room.turnCounter = (room.turnCounter || 0) + 1;
  }
  broadcast(room);
}

function afterAction(room) {
  const g = room.game;
  room.lastActionAt = Date.now();
  recordLeaderboard(room);
  if (g && g.turn !== room.lastTurnSeat) {
    room.lastTurnSeat = g.turn;
    room.turnCounter = (room.turnCounter || 0) + 1;
  }
  if (g && g.phase === 'handEnd') room.ready = new Set();
  broadcast(room);
}

function leaveRoom(socket, abandon = false) {
  const code = socket.data.room;
  if (!code) return;
  const room = rooms.get(code);
  socket.leave(code);
  socket.data.room = null;
  const sess = sessions.get(socket.data.token);
  if (sess) sess.room = null;
  if (!room) return;
  // partita con calma già iniziata: si torna alla schermata iniziale e il posto resta tuo
  if (room.slow && room.game && !room.game.over && !abandon && seatOfToken(room, socket.data.token) >= 0) {
    broadcast(room);
    return;
  }
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
    GE(room).note(room.game, `${s.name} è tornato al tavolo`);
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
  if (room.tournament && !room.game && room.seats.every((x) => x && (x.isBot || isConnected(x.token)))) { startGame(room); return; }
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
  room.game = GE(room).createGame({
    rules: room.rules,
    players: room.seats.map((s) => ({ name: s.name, isBot: !!s.isBot })),
    seed: room.daily ? room.seed : undefined,
  });
  room.ready = new Set();
  room.botMemo = {};
  room.gameSeq = (room.gameSeq || 0) + 1;
  room.turnCounter = 0;
  room.botMemoTurn = -1;
  room.lastTurnSeat = room.game.turn;
  broadcast(room);
  if (!room.tutorial && !room.daily) ctx.friendsPlaying(room);
}

// Pulizia dei tavoli abbandonati
setInterval(() => {
  for (const room of rooms.values()) {
    const anyone = room.seats.some((s) => s && !s.isBot && isConnected(s.token));
    if (room.slow && room.seats.some((s) => s && !s.isBot)) {
      if (Date.now() - (room.lastActionAt || Date.now()) > 14 * 24 * 3600 * 1000) { clearTimeout(room.botTimer); rooms.delete(room.code); scheduleSave(); }
      continue;
    }
    if (anyone) room.idleSince = null;
    else if (!room.idleSince) room.idleSince = Date.now();
    else if (Date.now() - room.idleSince > 60 * 60 * 1000) {
      clearTimeout(room.botTimer);
      rooms.delete(room.code);
      scheduleSave();
    }
  }
}, 60 * 1000);

Object.assign(ctx, { newCode, roomOfToken, renamePlayer, seatOfToken, roomInfo, humanCount, isConnected, broadcast, socketsOf, myGames, pushMyGames, slowRoomUpdates, checkReady, afterAction, leaveRoom, joinRoom, getRoom, requireHost, cleanName, botName, fillBots, startGame });
