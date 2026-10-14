'use strict';
/*
 * Motore del Rubamazzetto (mazzo italiano da 40). Stato JSON puro, azioni validate qui.
 * Ognuno per sé (una "squadra" per giocatore): team.taken è il mazzetto, con l'ultima carta in cima.
 * Azione: { type: 'play', cardId, steal?: posto } — senza indicazioni si ruba il mazzetto più alto possibile,
 * altrimenti si prende dal tavolo, altrimenti la carta resta in tavola.
 */
const RM = require('../shared/rubamazzetto');
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
function buildCfg(rules) { const r = RM.normalize(rules); return { game: 'rubamazzetto', rules: r, target: r.target }; }

function createGame({ rules, players, seed }) {
  const n = players.length;
  if (n < 2 || n > 4) fail('Il Rubamazzetto si gioca da 2 a 4');
  const g = {
    game: 'rubamazzetto', cfg: buildCfg({ ...rules, players: n }), n,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, hand: [], team: i })),
    scores: Array(n).fill(0), handNo: 0, dealer: 0, history: [], over: false, winners: null, log: [],
    rng: seed == null ? null : seed >>> 0,
  };
  g.dealer = Math.floor(rand(g) * n);
  startHand(g);
  return g;
}
function replayStart(g) { const { replay, lastReplay, history, log, events, handResult, ...rest } = g; return JSON.parse(JSON.stringify(rest)); }
function deal(g) { for (let k = 0; k < g.n; k++) g.players[(g.dealer + 1 + k) % g.n].hand.push(...g.stock.splice(-3)); }

function startHand(g) {
  g.handNo++;
  g.dealer = (g.dealer + 1) % g.n;
  g.stock = shuffle(buildDeck(), g);
  g.teams = g.players.map((p) => ({ id: p.seat, members: [p.seat], melds: [], taken: [] }));
  for (const p of g.players) p.hand = [];
  g.table = g.stock.splice(-4);
  deal(g);
  g.discard = [];
  g.pozzetti = [];
  g.turn = (g.dealer + 1) % g.n;
  g.phase = 'play';
  g.turnInfo = null;
  g.events = [];
  g.handResult = null;
  g.lastEvent = null;
  g.lastTake = null;
  addLog(g, `— Smazzata ${g.handNo}: distribuisce ${g.players[g.dealer].name}`);
  g.replay = { start: replayStart(g), actions: [] };
}

function play(g, seat, cardId, steal) {
  if (g.phase === 'handEnd' || g.over) fail('La smazzata è terminata');
  if (g.turn !== seat) fail('Non è il tuo turno');
  const p = g.players[seat];
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) fail('Carta non presente in mano');
  const opts = RM.moves(card, g.table, g.teams.map((t) => t.taken), seat);
  let move = null;
  if (steal != null) {
    move = opts.find((o) => o.kind === 'steal' && o.from === Number(steal));
    if (!move) fail('Con questa carta non puoi rubare quel mazzetto');
  } else {
    move = opts.filter((o) => o.kind === 'steal').sort((a, b) => b.gain - a.gain)[0] || opts.find((o) => o.kind === 'table') || null;
  }
  p.hand = p.hand.filter((c) => c.id !== card.id);
  const mine = g.teams[seat].taken;
  g.lastTake = null;
  if (move && move.kind === 'steal') {
    const victim = g.teams[move.from];
    const stolen = victim.taken.splice(0);
    mine.push(...stolen, card);
    g.lastTake = { seat, from: move.from, count: stolen.length };
    addLog(g, `${p.name} gioca ${cardName(card)} e ruba il mazzetto di ${g.players[move.from].name} (${stolen.length} carte)!`);
    setEvent(g, { type: 'take', seat, cardId: card.id, card: { r: card.r, s: card.s }, cardIds: stolen.map((c) => c.id), steal: move.from });
  } else if (move) {
    const taken = g.table.find((c) => c.id === move.cardId);
    g.table = g.table.filter((c) => c.id !== taken.id);
    mine.push(taken, card);
    g.lastTake = { seat, cardIds: [taken.id] };
    addLog(g, `${p.name} gioca ${cardName(card)} e prende ${cardName(taken)}`);
    setEvent(g, { type: 'take', seat, cardId: card.id, card: { r: card.r, s: card.s }, cardIds: [taken.id] });
  } else {
    g.table.push(card);
    addLog(g, `${p.name} gioca ${cardName(card)}`);
    setEvent(g, { type: 'discard', seat, cardId: card.id, card: { r: card.r, s: card.s } });
  }
  const done = g.players.every((x) => !x.hand.length);
  if (done && !g.stock.length) return endHand(g);
  if (done) { deal(g); addLog(g, 'Si danno altre tre carte'); }
  g.turn = (g.turn + 1) % g.n;
}

function endHand(g) {
  g.phase = 'handEnd';
  const sizes = g.teams.map((t) => t.taken.length);
  const max = Math.max(...sizes);
  const winners = sizes.filter((x) => x === max).length === 1 ? [sizes.indexOf(max)] : [];
  const results = g.teams.map((t, i) => ({
    members: t.members.slice(), names: t.members.map((x) => g.players[x].name),
    meldPts: 0, burraco: [], bonusPts: 0, handPts: 0, closePts: 0, pozPts: 0, total: winners.includes(i) ? 1 : 0, cards: sizes[i],
  }));
  for (const r of results) for (const s of r.members) g.scores[s] += r.total;
  const rows = [
    { label: 'Carte nel mazzetto', values: sizes, notes: sizes.map(() => ''), plain: true },
    { label: 'Smazzata vinta', values: results.map((r) => r.total), notes: sizes.map(() => '') },
  ];
  g.handResult = { reason: winners.length ? 'end' : 'tie', closer: null, rows, teams: results, scores: g.scores.slice(), hands: null };
  g.history.push({ handNo: g.handNo, teams: results.map((r) => ({ members: r.members, total: r.total })) });
  g.lastReplay = g.replay ? { handNo: g.handNo, ...g.replay } : null;
  g.replay = null;
  addLog(g, winners.length ? `Smazzata a ${g.players[winners[0]].name} con ${max} carte.` : `Smazzata pari: ${max} carte.`);
  const top = Math.max(...g.scores);
  if (top >= g.cfg.target && g.scores.filter((x) => x === top).length === 1) {
    g.over = true;
    g.winners = [g.scores.indexOf(top)];
    addLog(g, `Partita finita! Vince ${g.players[g.winners[0]].name}`);
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
    if (action.type !== 'play') fail('Azione sconosciuta');
    play(g, seat, action.cardId, action.steal);
  } catch (e) {
    const restored = JSON.parse(backup);
    for (const k of Object.keys(g)) delete g[k];
    Object.assign(g, restored);
    throw e;
  }
}
function isLegal(g, seat, action) { const copy = JSON.parse(JSON.stringify(g)); try { apply(copy, seat, action); return copy; } catch (e) { return null; } }

function viewFor(g, seat) {
  return {
    game: 'rubamazzetto', presa: true,
    cfg: { game: 'rubamazzetto', rules: g.cfg.rules, target: g.cfg.target, pile: 'top', pozzettoName: '', burracoName: '' },
    n: g.n, you: seat, handNo: g.handNo, dealer: g.dealer,
    players: g.players.map((p) => ({ seat: p.seat, name: p.name, isBot: p.isBot, team: p.team, handCount: p.hand.length })),
    hand: seat >= 0 && g.players[seat] ? g.players[seat].hand : [],
    teams: g.teams.map((t) => ({ id: t.id, members: t.members, melds: [], taken: t.taken.length, top: t.taken.length ? t.taken[t.taken.length - 1] : null, pozzettoTaken: false, closed: false, canClose: false })),
    table: g.table, lastTake: g.lastTake,
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
