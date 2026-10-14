'use strict';
/*
 * Motore della Briscola (mazzo italiano da 40). Stato JSON puro, azioni validate qui.
 * Stessa "forma" degli altri motori; al posto dei giochi ci sono la presa in corso (g.trick),
 * la briscola (g.trump) e le prese delle squadre (team.taken). Azione: { type: 'play', cardId }.
 * I punti della partita (scores) sono le smazzate vinte.
 */
const BR = require('../shared/briscola');
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
function buildCfg(rules) { const r = BR.normalize(rules); return { game: 'briscola', rules: r, target: r.target }; }

function createGame({ rules, players, seed }) {
  const n = players.length;
  if (n !== 2 && n !== 4) fail('La Briscola si gioca in 2 o in 4');
  const g = {
    game: 'briscola', cfg: buildCfg({ ...rules, players: n }), n,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, hand: [], team: 0 })),
    scores: Array(n).fill(0), handNo: 0, dealer: 0, history: [], over: false, winners: null, log: [],
    rng: seed == null ? null : seed >>> 0,
  };
  g.dealer = Math.floor(rand(g) * n);
  startHand(g);
  return g;
}
function replayStart(g) { const { replay, lastReplay, history, log, events, handResult, ...rest } = g; return JSON.parse(JSON.stringify(rest)); }

function startHand(g) {
  g.handNo++;
  g.dealer = (g.dealer + 1) % g.n;
  const deck = shuffle(buildDeck(), g);
  const defs = g.n === 4 ? [[0, 2], [1, 3]] : [[0], [1]];
  g.teams = defs.map((members, id) => ({ id, members, melds: [], taken: [] }));
  for (const t of g.teams) for (const s of t.members) g.players[s].team = t.id;
  for (const p of g.players) p.hand = deck.splice(-3);
  // la briscola: la carta successiva, scoperta, va in fondo al mazzo (è l'ultima a essere pescata)
  g.trump = deck.pop();
  deck.unshift(g.trump);
  g.stock = deck;
  g.trick = [];
  g.lastTrick = null;
  g.discard = [];
  g.pozzetti = [];
  g.turn = (g.dealer + 1) % g.n;
  g.leader = g.turn;
  g.phase = 'play';
  g.turnInfo = null;
  g.events = [];
  g.handResult = null;
  g.lastEvent = null;
  addLog(g, `— Smazzata ${g.handNo}: briscola ${cardName(g.trump)}`);
  g.replay = { start: replayStart(g), actions: [] };
}

function play(g, seat, cardId) {
  if (g.phase === 'handEnd' || g.over) fail('La smazzata è terminata');
  if (g.turn !== seat) fail('Non è il tuo turno');
  const p = g.players[seat];
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) fail('Carta non presente in mano');
  p.hand = p.hand.filter((c) => c.id !== card.id);
  g.trick.push({ seat, card });
  addLog(g, `${p.name} gioca ${cardName(card)}`);
  setEvent(g, { type: 'discard', seat, cardId: card.id, card: { r: card.r, s: card.s } });
  if (g.trick.length < g.n) { g.turn = (g.turn + 1) % g.n; return; }
  // presa completa
  const w = g.trick[BR.winner(g.trick.map((x) => x.card), g.trump.s)];
  const team = teamOf(g, w.seat);
  team.taken.push(...g.trick.map((x) => x.card));
  const pts = g.trick.reduce((s, x) => s + BR.points(x.card), 0);
  g.lastTrick = { cards: g.trick.map((x) => ({ seat: x.seat, card: x.card })), winner: w.seat, points: pts };
  addLog(g, `Prende ${g.players[w.seat].name}${pts ? ` (${pts} punti)` : ''}`);
  setEvent(g, { type: 'take', seat: w.seat, cardIds: g.trick.map((x) => x.card.id), points: pts });
  g.trick = [];
  // si pesca: prima chi ha preso, poi gli altri in ordine
  if (g.stock.length) for (let k = 0; k < g.n && g.stock.length; k++) g.players[(w.seat + k) % g.n].hand.push(g.stock.pop());
  if (g.players.every((x) => !x.hand.length)) return endHand(g);
  g.turn = w.seat;
  g.leader = w.seat;
}

function endHand(g) {
  g.phase = 'handEnd';
  const pts = g.teams.map((t) => t.taken.reduce((s, c) => s + BR.points(c), 0));
  const winner = pts[0] === pts[1] ? -1 : pts[0] > pts[1] ? 0 : 1;
  const results = g.teams.map((t, i) => ({
    members: t.members.slice(), names: t.members.map((x) => g.players[x].name),
    meldPts: 0, burraco: [], bonusPts: 0, handPts: 0, closePts: 0, pozPts: 0, total: i === winner ? 1 : 0, points: pts[i],
  }));
  for (const r of results) for (const s of r.members) g.scores[s] += r.total;
  const rows = [
    { label: 'Punti delle prese', values: pts, notes: pts.map(() => '') },
    { label: 'Carte prese', values: g.teams.map((t) => t.taken.length), notes: pts.map(() => ''), plain: true },
  ];
  g.handResult = { reason: winner < 0 ? 'tie' : 'end', closer: null, rows, teams: results, scores: g.scores.slice(), hands: null };
  g.history.push({ handNo: g.handNo, teams: results.map((r) => ({ members: r.members, total: r.total })) });
  g.lastReplay = g.replay ? { handNo: g.handNo, ...g.replay } : null;
  g.replay = null;
  addLog(g, winner < 0 ? 'Smazzata pari: 60 a 60.' : `Smazzata a ${results[winner].names.join(' e ')} con ${pts[winner]} punti.`);
  const max = Math.max(...g.scores);
  if (max >= g.cfg.target) {
    g.over = true;
    g.winners = g.teams.find((t) => g.scores[t.members[0]] === max).members.slice();
    addLog(g, `Partita finita! Vince ${g.winners.map((s) => g.players[s].name).join(' e ')}`);
  }
}

function nextHand(g) { if (g.phase !== 'handEnd') fail('La smazzata non è finita'); if (g.over) fail('La partita è finita'); startHand(g); }

function surrender(g, seat) {
  if (g.over) fail('La partita è già finita');
  const team = teamOf(g, seat);
  const open = g.phase !== 'handEnd';
  g.phase = 'handEnd';
  g.handResult = {
    reason: 'surrender', closer: null, surrendered: team.members.slice(), scores: g.scores.slice(), hands: null,
    teams: g.teams.map((t) => ({ members: t.members.slice(), names: t.members.map((x) => g.players[x].name), meldPts: 0, burraco: [], bonusPts: 0, handPts: 0, closePts: 0, pozPts: 0, total: 0 })),
  };
  g.replay = null;
  if (open) g.lastReplay = null;
  g.over = true;
  g.winners = g.players.map((p) => p.seat).filter((x) => !team.members.includes(x));
  addLog(g, `${team.members.map((x) => g.players[x].name).join(' e ')} si ${team.members.length > 1 ? 'arrendono' : 'arrende'}`);
}

function apply(g, seat, action) {
  const backup = JSON.stringify(g);
  try {
    if (g.replay) g.replay.actions.push({ s: seat, a: action });
    if (action.type !== 'play') fail('Azione sconosciuta');
    play(g, seat, action.cardId);
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
    game: 'briscola', presa: true,
    cfg: { game: 'briscola', rules: g.cfg.rules, target: g.cfg.target, pile: 'top', pozzettoName: '', burracoName: '' },
    n: g.n, you: seat, handNo: g.handNo, dealer: g.dealer,
    players: g.players.map((p) => ({ seat: p.seat, name: p.name, isBot: p.isBot, team: p.team, handCount: p.hand.length })),
    hand: seat >= 0 && g.players[seat] ? g.players[seat].hand : [],
    teams: g.teams.map((t) => ({ id: t.id, members: t.members, melds: [], taken: t.taken.length, pozzettoTaken: false, closed: false, canClose: false })),
    trump: g.trump, trick: g.trick, lastTrick: g.lastTrick,
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
