'use strict';
/*
 * Turni: timer del turno, computer al posto di chi è offline, mosse del computer (con i tempi
 * "umani") e le sue reazioni rapide.
 */
const Games = require('./games');
const { BOT_DELAY, TIMER_SCALE, BOT_SPEEDS } = require('./config');
const ctx = require('./contesto');
const { io } = ctx;
/** motore e computer del gioco di questo tavolo */
const GE = (room) => Games.of(room).E;
const GBot = (room) => Games.of(room).Bot;
// funzioni degli altri moduli (lette dal contesto al momento della chiamata)
const afterAction = (...a) => ctx.afterAction(...a);
const humanCount = (...a) => ctx.humanCount(...a);
const isConnected = (...a) => ctx.isConnected(...a);

/* ---------- Timer del turno: allo scadere si pesca e si scarta in automatico ---------- */
function turnTimerKey(room) {
  const g = room.game;
  if (room.slow) return null;
  if (!g || g.phase === 'handEnd' || !room.turnTime) return null;
  const s = room.seats[g.turn];
  if (!s || s.isBot) return null;
  return `${g.handNo}:${g.turn}:${room.turnCounter || 0}`;
}

/* ---------- Giocatore offline: dopo un'attesa il computer gioca al suo posto ---------- */
const ABSENT_MS = Number(process.env.ABSENT_MS || 45000) * TIMER_SCALE;

function scheduleAbsent(room) {
  if (room.slow) { clearTimeout(room.absentHandle); room.absentKey = null; return; } // con calma: la partita aspetta
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
  if (room.rankedMatch) {
    // Il watchdog Ranked concede 120 secondi per riconnettersi, senza mosse CPU.
    room.absentKey = null; return;
  }
  GE(room).note(g, `🤖 ${s.name} è offline: il computer gioca al suo posto`);
  const memo = { level: 'normale' };
  for (let i = 0; i < 60 && g.turn === seat && g.phase !== 'handEnd'; i++) {
    try { GE(room).apply(g, seat, GBot(room).nextAction(g, seat, memo)); } catch (e) { console.error('Turno per giocatore offline:', e.message); break; }
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
  if (room.rankedMatch) {
    if (!isConnected(room.seats[seat]?.token)) {
      // Al rientro il broadcast deve poter riarmare il timer, anche se turno e mano
      // sono gli stessi. Il watchdog continua intanto a misurare i 120 secondi.
      room.timerKey = null; room.turnDeadline = null; room.turnTimerHandle = null; return;
    }
    room.rankedMatch.abandoned = [...new Set([...(room.rankedMatch.abandoned || []), room.seats[seat].token])];
    GE(room).surrender(g, seat); afterAction(room); return;
  }
  const memo = { noMeld: true }; // niente calate automatiche: solo pesca e scarto
  GE(room).note(g, `⏱ Tempo scaduto per ${g.players[seat].name}: pesca e scarta in automatico`);
  for (let i = 0; i < 6 && g.turn === seat && g.phase !== 'handEnd'; i++) {
    try { GE(room).apply(g, seat, GBot(room).nextAction(g, seat, memo)); } catch (e) { console.error('Turno automatico:', e.message); break; }
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
  // memoria del bot valida solo per il turno corrente
  if (room.botMemoTurn !== room.turnCounter) {
    room.botMemo = {};
    room.botMemoTurn = room.turnCounter;
  }
  // la mossa si decide subito: il tempo di attesa dipende da cosa sta per fare (come una persona)
  let planned = null;
  try {
    room.botMemo.level = room.botLevel || 'normale';
    planned = GBot(room).nextAction(g, seat, room.botMemo);
  } catch (e) { planned = null; }
  const base = BOT_SPEEDS[room.botSpeed] || BOT_DELAY;
  room.botTimer = setTimeout(() => {
    room.botTimer = null;
    if (!room.game || room.game !== g || g.turn !== seat || g.phase === 'handEnd') return;
    const before = reactionSnapshot(g);
    try {
      room.botMemo.level = room.botLevel || 'normale';
      const a = planned && GE(room).isLegal(g, seat, planned) ? planned : GBot(room).nextAction(g, seat, room.botMemo);
      GE(room).apply(g, seat, a);
      botReactions(room, seat, before, a);
    } catch (e) {
      console.error('Errore bot:', e.message);
      try {
        if (g.phase === 'draw') GE(room).apply(g, seat, { type: 'draw' });
        else {
          const legal = g.players[seat].hand.map((c) => ({ type: 'discard', cardId: c.id })).find((x) => GE(room).isLegal(g, seat, x));
          if (legal) GE(room).apply(g, seat, legal);
          else GE(room).apply(g, seat, { type: 'undo' });
        }
      } catch (e2) { console.error('Bot bloccato:', e2.message); }
    }
    afterAction(room);
  }, planned ? GBot(room).thinkMs(g, seat, planned, base) : base);
}

/* ---------- Reazioni del computer (ogni tanto, mai troppe) ---------- */
const BOT_REACT_GAP = 20000;

function reactionSnapshot(g) {
  return { burraco: g.teams.map((t) => t.melds.filter((m) => m.length >= 7).length), phase: g.phase };
}

function botReactions(room, actor, before, action) {
  const g = room.game;
  if (!g || room.tutorial || humanCount(room) === 0) return;
  const now = Date.now();
  if (room.lastBotReact && now - room.lastBotReact < BOT_REACT_GAP) return;
  const bots = room.seats.map((s, i) => (s && s.isBot ? i : -1)).filter((i) => i >= 0);
  if (!bots.length) return;
  const team = (seat) => g.teams.findIndex((t) => t.members.includes(seat));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const actorIsBot = bots.includes(actor);
  const mates = bots.filter((b) => b !== actor && team(b) === team(actor));
  const rivals = bots.filter((b) => team(b) !== team(actor));
  let who = null, emoji = null;
  const newBurraco = Games.idOf(room.rules) === 'burraco' && before.burraco.length === g.teams.length && g.teams.some((t, i) => t.melds.filter((m) => m.length >= 7).length > before.burraco[i]);
  if (newBurraco) {
    if (actorIsBot && Math.random() < 0.35) { who = actor; emoji = pick(['🔥', '😍']); }
    else if (!actorIsBot && rivals.length && Math.random() < 0.3) { who = pick(rivals); emoji = pick(['😱', '👏']); }
    else if (!actorIsBot && mates.length && Math.random() < 0.35) { who = pick(mates); emoji = pick(['🔥', '👍']); }
  } else if (action && action.type === 'takePile' && g.players[actor].hand.length >= 14 && rivals.length && Math.random() < 0.25) {
    who = pick(rivals); emoji = '😱';
  } else if (before.phase !== 'handEnd' && g.phase === 'handEnd' && g.handResult) {
    const best = Math.max(...g.handResult.teams.map((t) => t.total));
    const winners = bots.filter((b) => g.handResult.teams.some((t) => t.total === best && t.members.includes(b)));
    const losers = bots.filter((b) => !winners.includes(b));
    if (winners.length && Math.random() < 0.3) { who = pick(winners); emoji = pick(['🔥', '😂']); }
    else if (losers.length && Math.random() < 0.25) { who = pick(losers); emoji = pick(['🙏', '😡']); }
  }
  if (who == null) return;
  room.lastBotReact = now;
  setTimeout(() => io.to(room.code).emit('reaction', { seat: who, emoji }), 500 + Math.random() * 900);
}

Object.assign(ctx, { turnTimerKey, scheduleAbsent, playForAbsent, scheduleTurnTimer, autoPlay, scheduleBot, reactionSnapshot, botReactions });
