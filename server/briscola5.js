'use strict';
/*
 * Motore della Briscola in 5 (chiamata). Stato JSON puro, azioni validate qui.
 * Fasi: 'bid' (asta), 'call' (il chiamante sceglie la briscola), 'play' (8 prese), 'handEnd'.
 * Ognuno ha la sua "squadra" (team.taken = le sue prese); le alleanze (chiamante + socio) contano solo nel punteggio.
 * Il socio è nascosto agli altri finché non gioca la carta chiamata (g.partnerKnown).
 * Azioni: { type: 'bid', level } | { type: 'pass' } | { type: 'call', suit } | { type: 'play', cardId }.
 */
const B5 = require('../shared/briscola5');
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
function buildCfg(rules) { const r = B5.normalize(rules); return { game: 'briscola5', rules: r, target: r.target }; }

function createGame({ rules, players, seed }) {
  if (players.length !== 5) fail('La Briscola in 5 si gioca in cinque');
  const g = {
    game: 'briscola5', cfg: buildCfg(rules), n: 5,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, hand: [], team: i })),
    scores: Array(5).fill(0), handNo: 0, dealer: 0, history: [], over: false, winners: null, log: [],
    rng: seed == null ? null : seed >>> 0,
  };
  g.dealer = Math.floor(rand(g) * 5);
  startHand(g);
  return g;
}
function replayStart(g) { const { replay, lastReplay, history, log, events, handResult, ...rest } = g; return JSON.parse(JSON.stringify(rest)); }

function startHand(g) {
  g.handNo++;
  g.dealer = (g.dealer + 1) % 5;
  const deck = shuffle(buildDeck(), g);
  g.teams = g.players.map((p) => ({ id: p.seat, members: [p.seat], melds: [], taken: [] }));
  for (let k = 0; k < 5; k++) g.players[(g.dealer + 1 + k) % 5].hand = deck.splice(-8);
  g.stock = [];
  g.trick = [];
  g.lastTrick = null;
  g.discard = [];
  g.pozzetti = [];
  g.auction = { level: -1, bidder: null, passed: [false, false, false, false, false] };
  g.trump = null;
  g.called = null;
  g.caller = null;
  g.partner = null;
  g.partnerKnown = false;
  g.phase = 'bid';
  g.turn = (g.dealer + 1) % 5;
  g.leader = g.turn;
  g.turnInfo = null;
  g.events = [];
  g.handResult = null;
  g.lastEvent = null;
  addLog(g, `— Smazzata ${g.handNo}: distribuisce ${g.players[g.dealer].name}. Si apre l'asta.`);
  g.replay = { start: replayStart(g), actions: [] };
}

/** prossimo giocatore ancora in asta (dopo `from`) */
function nextBidder(g, from) {
  for (let k = 1; k <= 5; k++) { const s = (from + k) % 5; if (!g.auction.passed[s]) return s; }
  return null;
}

function closeAuction(g, winner) {
  if (g.auction.level < 0) g.auction.level = 0; // nessuno ha parlato: l'ultimo rimasto prende con l'Asso
  g.auction.bidder = winner;
  g.caller = winner;
  g.phase = 'call';
  g.turn = winner;
  addLog(g, `${g.players[winner].name} vince l'asta: ${B5.bidLabel(g.auction.level)}. Sceglie la briscola.`);
}

function bid(g, seat, level) {
  if (g.phase !== 'bid') fail("L'asta è chiusa");
  level = Number(level);
  if (!Number.isInteger(level) || level <= g.auction.level || level > B5.MAX_LEVEL) fail('Devi chiamare più in basso (o più punti)');
  g.auction.level = level;
  g.auction.bidder = seat;
  addLog(g, `${g.players[seat].name} chiama ${B5.bidLabel(level)}`);
  setEvent(g, { type: 'bid', seat, level });
  const still = g.auction.passed.filter((p) => !p).length;
  if (level === B5.MAX_LEVEL || still === 1) return closeAuction(g, seat);
  // chi ha appena rilanciato aspetta: il turno passa al prossimo ancora in asta
  g.turn = nextBidder(g, seat);
}

function pass(g, seat) {
  if (g.phase !== 'bid') fail("L'asta è chiusa");
  g.auction.passed[seat] = true;
  addLog(g, `${g.players[seat].name} passa`);
  setEvent(g, { type: 'pass', seat });
  const left = [0, 1, 2, 3, 4].filter((s) => !g.auction.passed[s]);
  const b = g.auction.bidder;
  // resta solo chi ha l'offerta più alta: vince lui; se nessuno ha parlato, l'ultimo rimasto prende con l'Asso
  if (b != null && left.length === 1 && left[0] === b) return closeAuction(g, b);
  if (b == null && left.length === 1) return closeAuction(g, left[0]);
  g.turn = nextBidder(g, seat);
}

function call(g, seat, suit) {
  if (g.phase !== 'call') fail('Non è il momento di scegliere la briscola');
  if (!SUITS.includes(suit)) fail('Seme non valido');
  const b = B5.bidOf(g.auction.level);
  g.trump = suit;
  g.called = { r: b.rank, s: suit };
  g.target = b.points;
  g.partner = g.players.find((p) => p.hand.some((c) => c.r === b.rank && c.s === suit)).seat;
  g.partnerKnown = g.partner === g.caller; // chi chiama una carta che ha in mano gioca da solo (si sa subito)
  g.phase = 'play';
  g.turn = (g.dealer + 1) % 5;
  g.leader = g.turn;
  addLog(g, `Briscola ${SUIT_NAMES[suit]}: si chiama il ${cardName(g.called)}${g.target > 61 ? ` (bisogna fare ${g.target})` : ''}`);
  if (g.partnerKnown) addLog(g, `${g.players[seat].name} ha la carta chiamata: gioca da solo contro tutti!`);
  setEvent(g, { type: 'call', seat, suit });
}

function play(g, seat, cardId) {
  if (g.phase !== 'play') fail('Non si gioca ancora');
  const p = g.players[seat];
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) fail('Carta non presente in mano');
  p.hand = p.hand.filter((c) => c.id !== card.id);
  g.trick.push({ seat, card });
  addLog(g, `${p.name} gioca ${cardName(card)}`);
  if (g.called && card.r === g.called.r && card.s === g.called.s && !g.partnerKnown) {
    g.partnerKnown = true;
    addLog(g, `🤝 ${p.name} è il socio di ${g.players[g.caller].name}!`);
  }
  setEvent(g, { type: 'discard', seat, cardId: card.id, card: { r: card.r, s: card.s } });
  if (g.trick.length < 5) { g.turn = (g.turn + 1) % 5; return; }
  const w = g.trick[BR.winner(g.trick.map((x) => x.card), g.trump)];
  g.teams[w.seat].taken.push(...g.trick.map((x) => x.card));
  const pts = g.trick.reduce((s, x) => s + BR.points(x.card), 0);
  g.lastTrick = { cards: g.trick.map((x) => ({ seat: x.seat, card: x.card })), winner: w.seat, points: pts };
  addLog(g, `Prende ${g.players[w.seat].name}${pts ? ` (${pts} punti)` : ''}`);
  setEvent(g, { type: 'take', seat: w.seat, cardIds: g.trick.map((x) => x.card.id), points: pts });
  g.trick = [];
  if (g.players.every((x) => !x.hand.length)) return endHand(g);
  g.turn = w.seat;
  g.leader = w.seat;
}

function endHand(g) {
  g.phase = 'handEnd';
  g.partnerKnown = true;
  const pts = g.teams.map((t) => t.taken.reduce((s, c) => s + BR.points(c), 0));
  const alone = g.partner === g.caller;
  const allies = alone ? [g.caller] : [g.caller, g.partner];
  const made = allies.reduce((s, x) => s + pts[x], 0);
  const won = made >= g.target;
  const delta = g.players.map((p) => {
    if (p.seat === g.caller) return (won ? 1 : -1) * (alone ? 4 : 2);
    if (p.seat === g.partner) return won ? 1 : -1;
    return won ? -1 : 1;
  });
  for (let s = 0; s < 5; s++) g.scores[s] += delta[s];
  const results = g.teams.map((t, i) => ({
    members: [i], names: [g.players[i].name],
    meldPts: 0, burraco: [], bonusPts: 0, handPts: 0, closePts: 0, pozPts: 0, total: delta[i], points: pts[i],
    solo: alone && won && i === g.caller,
  }));
  const role = (s) => (s === g.caller ? (alone ? 'chiamante (da solo)' : 'chiamante') : s === g.partner ? 'socio' : '');
  const rows = [
    { label: 'Punti delle prese', values: pts, notes: g.players.map((p) => role(p.seat)) },
    { label: 'Punti della smazzata', values: delta, notes: delta.map(() => '') },
  ];
  g.handResult = { reason: 'end', closer: null, rows, teams: results, scores: g.scores.slice(), hands: null, made, target: g.target, won };
  g.history.push({ handNo: g.handNo, teams: results.map((r) => ({ members: r.members, total: r.total })) });
  g.lastReplay = g.replay ? { handNo: g.handNo, ...g.replay } : null;
  g.replay = null;
  addLog(g, `${allies.map((s) => g.players[s].name).join(' e ')} ${alone ? (won ? 'vince' : 'perde') : won ? 'vincono' : 'perdono'} con ${made} punti (ne servivano ${g.target}).`);
  if (g.handNo >= g.cfg.target) {
    g.over = true;
    const top = Math.max(...g.scores);
    g.winners = [0, 1, 2, 3, 4].filter((s) => g.scores[s] === top);
    addLog(g, `Partita finita! Vince ${g.winners.map((s) => g.players[s].name).join(' e ')}`);
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
  const others = [0, 1, 2, 3, 4].filter((x) => x !== seat);
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
    if (action.type === 'bid') bid(g, seat, action.level);
    else if (action.type === 'pass') pass(g, seat);
    else if (action.type === 'call') call(g, seat, action.suit);
    else if (action.type === 'play') play(g, seat, action.cardId);
    else fail('Azione sconosciuta');
  } catch (e) {
    const restored = JSON.parse(backup);
    for (const k of Object.keys(g)) delete g[k];
    Object.assign(g, restored);
    throw e;
  }
}
function isLegal(g, seat, action) { const copy = JSON.parse(JSON.stringify(g)); try { apply(copy, seat, action); return copy; } catch (e) { return null; } }

function viewFor(g, seat) {
  const reveal = g.partnerKnown || seat === g.partner;
  return {
    game: 'briscola5', presa: true,
    cfg: { game: 'briscola5', rules: g.cfg.rules, target: g.cfg.target, pile: 'top', pozzettoName: '', burracoName: '' },
    n: 5, you: seat, handNo: g.handNo, dealer: g.dealer,
    players: g.players.map((p) => ({ seat: p.seat, name: p.name, isBot: p.isBot, team: p.team, handCount: p.hand.length })),
    hand: seat >= 0 && g.players[seat] ? g.players[seat].hand : [],
    teams: g.teams.map((t) => ({ id: t.id, members: t.members, melds: [], taken: t.taken.length, pozzettoTaken: false, closed: false, canClose: false })),
    // asta e chiamata: il socio si vede solo quando si è scoperto (o se sei tu)
    b5: {
      auction: g.auction, caller: g.caller, called: g.called, trump: g.trump, target: g.target || 61,
      partner: reveal ? g.partner : null, partnerKnown: g.partnerKnown, iAmPartner: seat === g.partner && seat !== g.caller,
    },
    trick: g.trick, lastTrick: g.lastTrick,
    stockCount: 0, discard: [], discardCount: 0, pozzetti: [],
    turn: g.turn, phase: g.phase, lastTurn: false, mustDraw: false, canUndo: false, singlePickId: null,
    scores: g.scores, history: g.history.slice(-30), handResult: g.handResult, over: g.over, winners: g.winners,
    partnershipFormed: true, log: g.log.slice(-25), lastEvent: g.lastEvent, events: g.events || [], hasReplay: !!g.lastReplay,
  };
}

module.exports = {
  GameError, note, createGame, apply, isLegal, viewFor, nextHand, surrender, teamOf, cardName, buildCfg,
  isWild: () => false, meldKind: () => ({ kind: null, bonus: 0, label: '' }), canClose: () => false,
};
