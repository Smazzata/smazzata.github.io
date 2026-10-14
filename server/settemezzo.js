'use strict';
/*
 * Motore del Sette e mezzo (mazzo italiano da 40, fiches finte). Stato JSON puro, azioni validate qui.
 * Ognuno per sé; il banco passa a turno (g.banker). Ogni giocatore ha una carta coperta e chiede carte scoperte.
 * Azioni: { type: 'draw' } (chiedo carta) e { type: 'stand' } (sto bene). I punti della partita (scores) sono le fiches.
 * La partita dura cfg.target smazzate (o finisce prima se qualcuno resta senza fiches).
 */
const SM = require('../shared/settemezzo');
const { GameError } = require('./engine');

const fail = (msg) => { throw new GameError(msg); };
const SUITS = ['d', 'c', 's', 'b'];
const SUIT_NAMES = { d: 'denari', c: 'coppe', s: 'spade', b: 'bastoni' };
const RANK_NAMES = { 1: 'Asso', 8: 'Fante', 9: 'Cavallo', 10: 'Re' };
const cardName = (c) => `${RANK_NAMES[c.r] || c.r} di ${SUIT_NAMES[c.s]}`;

function rand(g) {
  if (!g || g.rng == null) return Math.random();
  let t = (g.rng = (g.rng + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(a, g) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(g) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildDeck() { const d = []; let id = 0; for (const s of SUITS) for (let r = 1; r <= 10; r++) d.push({ id: id++, r, s }); return d; }

function addLog(g, text) { g.log.push(text); if (g.log.length > 60) g.log.splice(0, g.log.length - 60); }
const note = (g, text) => addLog(g, text);
function setEvent(g, ev) {
  g.eventSeq = (g.eventSeq || 0) + 1;
  g.lastEvent = { ...ev, n: g.eventSeq };
  if (!g.events) g.events = [];
  g.events.push(g.lastEvent);
  if (g.events.length > 30) g.events.splice(0, g.events.length - 30);
}
const teamOf = (g, seat) => g.teams.find((t) => t.members.includes(seat));
function buildCfg(rules) { const r = SM.normalize(rules); return { game: 'settemezzo', rules: r, target: r.target, matta: r.matta }; }
const tot = (g, seat) => SM.total(g.players[seat].hand, g.cfg);

function createGame({ rules, players, seed }) {
  const n = players.length;
  if (n < 2 || n > 4) fail('Il Sette e mezzo si gioca da 2 a 4');
  const g = {
    game: 'settemezzo', cfg: buildCfg({ ...rules, players: n }), n,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, hand: [], team: i, status: 'play' })),
    scores: Array(n).fill(SM.START_CHIPS), handNo: 0, dealer: 0, banker: 0, history: [], over: false, winners: null, log: [],
    rng: seed == null ? null : seed >>> 0,
  };
  g.banker = Math.floor(rand(g) * n);
  g.dealer = g.banker;
  startHand(g, true);
  return g;
}
function replayStart(g) { const { replay, lastReplay, history, log, events, handResult, ...rest } = g; return JSON.parse(JSON.stringify(rest)); }

function startHand(g, first) {
  g.handNo++;
  if (!first) g.banker = (g.banker + 1) % g.n;
  g.dealer = g.banker;
  g.stock = shuffle(buildDeck(), g);
  g.teams = g.players.map((p) => ({ id: p.seat, members: [p.seat], melds: [], taken: [] }));
  for (const p of g.players) { p.hand = [g.stock.pop()]; p.status = 'play'; }
  g.discard = [];
  g.pozzetti = [];
  g.phase = 'play';
  g.turn = (g.banker + 1) % g.n; // prima gli altri, il banco per ultimo
  g.turnInfo = null;
  g.events = [];
  g.handResult = null;
  g.lastEvent = null;
  addLog(g, `— Smazzata ${g.handNo}: tiene il banco ${g.players[g.banker].name}`);
  g.replay = { start: replayStart(g), actions: [] };
}

/** passa al giocatore successivo che deve ancora decidere; dopo l'ultimo tocca al banco, poi si chiude */
function advance(g) {
  if (g.turn === g.banker) return endHand(g);
  let s = (g.turn + 1) % g.n;
  while (s !== g.banker && g.players[s].status !== 'play') s = (s + 1) % g.n;
  // se tutti gli altri hanno sballato il banco ha già vinto: non serve che giochi
  if (s === g.banker && g.players.every((p) => p.seat === g.banker || p.status === 'bust')) return endHand(g);
  g.turn = s;
}

function draw(g, seat) {
  const p = g.players[seat];
  if (!g.stock.length) fail('Il mazzo è finito: devi stare');
  const c = g.stock.pop();
  p.hand.push(c);
  const t = tot(g, seat);
  addLog(g, `${p.name} chiede carta: ${cardName(c)}`);
  setEvent(g, { type: 'draw', seat, cardId: c.id });
  if (t > 7.5) {
    p.status = 'bust';
    addLog(g, `${p.name} ha sballato!`);
    advance(g);
  } else if (t === 7.5) { p.status = 'stand'; addLog(g, `${p.name}: sette e mezzo!`); advance(g); }
}

function endHand(g) {
  g.phase = 'handEnd';
  const b = g.banker;
  const bt = tot(g, b);
  const bankBust = bt > 7.5;
  const delta = Array(g.n).fill(0);
  const notes = Array(g.n).fill('');
  for (const p of g.players) {
    if (p.seat === b) continue;
    const pt = tot(g, p.seat);
    let win;
    if (p.status === 'bust') win = false;
    else if (bankBust) win = true;
    else win = pt > bt; // a parità vince il banco
    const stake = win && SM.reale(p.hand, g.cfg) ? 2 : 1;
    delta[p.seat] += win ? stake : -stake;
    delta[b] -= win ? stake : -stake;
    notes[p.seat] = p.status === 'bust' ? 'sballato' : win ? (stake === 2 ? 'reale!' : 'vince') : 'perde';
  }
  notes[b] = bankBust ? 'banco sballato' : 'banco';
  for (let s = 0; s < g.n; s++) g.scores[s] += delta[s];
  const results = g.teams.map((t, i) => ({
    members: t.members.slice(), names: [g.players[i].name],
    meldPts: 0, burraco: [], bonusPts: 0, handPts: 0, closePts: 0, pozPts: 0, total: delta[i], points: tot(g, i),
    reale: i !== b && g.players[i].status !== 'bust' && SM.reale(g.players[i].hand, g.cfg),
  }));
  const rows = [
    { label: 'Punti', values: g.players.map((p) => p.seat).map((s) => SM.fmt(tot(g, s))), notes, plain: true },
    { label: 'Fiches', values: delta, notes: delta.map(() => '') },
  ];
  g.handResult = { reason: 'end', closer: null, rows, teams: results, scores: g.scores.slice(), hands: g.players.map((p) => p.hand.slice()) };
  g.history.push({ handNo: g.handNo, teams: results.map((r) => ({ members: r.members, total: r.total })) });
  g.lastReplay = g.replay ? { handNo: g.handNo, ...g.replay } : null;
  g.replay = null;
  addLog(g, `Il banco (${g.players[b].name}) ha ${bankBust ? 'sballato' : SM.fmt(bt)}.`);
  if (g.handNo >= g.cfg.target || g.scores.some((x) => x <= 0)) {
    g.over = true;
    const top = Math.max(...g.scores);
    g.winners = g.players.map((p) => p.seat).filter((s) => g.scores[s] === top);
    addLog(g, `Partita finita! Vince ${g.winners.map((s) => g.players[s].name).join(' e ')} con ${top} fiches`);
  }
}

function nextHand(g) { if (g.phase !== 'handEnd') fail('La smazzata non è finita'); if (g.over) fail('La partita è finita'); startHand(g); }

function surrender(g, seat) {
  if (g.over) fail('La partita è già finita');
  const open = g.phase !== 'handEnd';
  g.phase = 'handEnd';
  g.handResult = {
    reason: 'surrender', closer: null, surrendered: [seat], scores: g.scores.slice(), hands: null,
    teams: g.teams.map((t) => ({ members: t.members.slice(), names: t.members.map((x) => g.players[x].name), meldPts: 0, burraco: [], bonusPts: 0, handPts: 0, closePts: 0, pozPts: 0, total: 0 })),
  };
  g.replay = null;
  if (open) g.lastReplay = null;
  g.over = true;
  const others = g.players.map((p) => p.seat).filter((x) => x !== seat);
  const best = Math.max(...others.map((s) => g.scores[s]));
  g.winners = others.filter((s) => g.scores[s] === best);
  addLog(g, `${g.players[seat].name} si arrende`);
}

function apply(g, seat, action) {
  const backup = JSON.stringify(g);
  try {
    if (g.replay) g.replay.actions.push({ s: seat, a: action });
    if (g.phase === 'handEnd' || g.over) fail('La smazzata è terminata');
    if (g.turn !== seat) fail('Non è il tuo turno');
    if (action.type === 'draw') draw(g, seat);
    else if (action.type === 'stand') {
      g.players[seat].status = 'stand';
      addLog(g, `${g.players[seat].name} sta bene`);
      setEvent(g, { type: 'stand', seat });
      advance(g);
    } else fail('Azione sconosciuta');
  } catch (e) {
    const restored = JSON.parse(backup);
    for (const k of Object.keys(g)) delete g[k];
    Object.assign(g, restored);
    throw e;
  }
}
function isLegal(g, seat, action) { const copy = JSON.parse(JSON.stringify(g)); try { apply(copy, seat, action); return copy; } catch (e) { return null; } }

function viewFor(g, seat) {
  const open = g.phase === 'handEnd';
  return {
    game: 'settemezzo', presa: true,
    cfg: { game: 'settemezzo', rules: g.cfg.rules, target: g.cfg.target, pile: 'top', pozzettoName: '', burracoName: '' },
    n: g.n, you: seat, handNo: g.handNo, dealer: g.dealer, banker: g.banker,
    players: g.players.map((p) => ({ seat: p.seat, name: p.name, isBot: p.isBot, team: p.team, handCount: p.hand.length })),
    hand: seat >= 0 && g.players[seat] ? g.players[seat].hand : [],
    // la prima carta di ognuno è coperta per gli altri fino alla fine della smazzata
    seats: g.players.map((p) => {
      const mine = p.seat === seat;
      const cards = p.hand.map((c, i) => (i === 0 && !mine && !open && p.status !== 'bust' ? { id: -1 - p.seat, hidden: true } : c));
      const shown = cards.filter((c) => !c.hidden);
      return { seat: p.seat, status: p.status, cards, total: SM.total(shown, g.cfg), full: !cards.some((c) => c.hidden) };
    }),
    teams: g.teams.map((t) => ({ id: t.id, members: t.members, melds: [], taken: 0, pozzettoTaken: false, closed: false, canClose: false })),
    stockCount: g.stock.length, discard: [], discardCount: 0, pozzetti: [],
    turn: g.turn, phase: g.phase, lastTurn: false, mustDraw: false, canUndo: false, singlePickId: null,
    scores: g.scores, history: g.history.slice(-30), handResult: g.handResult, over: g.over, winners: g.winners,
    partnershipFormed: true, log: g.log.slice(-25), lastEvent: g.lastEvent, events: g.events || [], hasReplay: !!g.lastReplay,
  };
}

module.exports = {
  GameError, note, createGame, apply, isLegal, viewFor, nextHand, surrender, teamOf, cardName, buildCfg,
  isWild: () => false, meldKind: () => ({ kind: null, bonus: 0, label: '' }), canClose: () => false,
};
