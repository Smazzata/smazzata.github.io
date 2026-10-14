'use strict';
/*
 * Motore della Scopa (mazzo italiano da 40). Stato JSON puro, azioni validate qui.
 * Stessa "forma" degli altri motori (players, teams, scores, handResult, events, replay…): i "giochi"
 * delle squadre sono vuoti; al loro posto ci sono le carte in tavola (g.table) e le prese (team.taken).
 * In 2 ognuno per sé, in 4 a coppie (0-2 contro 1-3). Unica azione: { type: 'play', cardId, take?: [id…] }.
 */
const SC = require('../shared/scopa');
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

function buildCfg(rules) { const r = SC.normalize(rules); return { game: 'scopa', rules: r, target: r.target, aceTakesAll: r.aceTakesAll }; }

function createGame({ rules, players, seed }) {
  const n = players.length;
  if (n !== 2 && n !== 4) fail('La Scopa si gioca in 2 o in 4');
  const g = {
    game: 'scopa', cfg: buildCfg({ ...rules, players: n }), n,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, hand: [], team: 0 })),
    scores: Array(n).fill(0), handNo: 0, dealer: 0, history: [], over: false, winners: null, log: [],
    rng: seed == null ? null : seed >>> 0,
  };
  g.dealer = Math.floor(rand(g) * n);
  startHand(g);
  return g;
}

function replayStart(g) { const { replay, lastReplay, history, log, events, handResult, ...rest } = g; return JSON.parse(JSON.stringify(rest)); }

function deal(g) { for (let k = 0; k < g.n; k++) { const p = g.players[(g.dealer + 1 + k) % g.n]; p.hand.push(...g.stock.splice(-3)); } }

function startHand(g) {
  g.handNo++;
  g.dealer = (g.dealer + 1) % g.n;
  const deck = shuffle(buildDeck(), g);
  const defs = g.n === 4 ? [[0, 2], [1, 3]] : [[0], [1]];
  g.teams = defs.map((members, id) => ({ id, members, melds: [], taken: [], scope: 0 }));
  for (const t of g.teams) for (const s of t.members) g.players[s].team = t.id;
  for (const p of g.players) p.hand = [];
  g.stock = deck;
  g.table = g.stock.splice(-4);
  deal(g);
  g.discard = [];
  g.pozzetti = [];
  g.lastTaker = null;
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

function play(g, seat, cardId, take) {
  if (g.phase === 'handEnd' || g.over) fail('La smazzata è terminata');
  if (g.turn !== seat) fail('Non è il tuo turno');
  const p = g.players[seat];
  const card = p.hand.find((c) => c.id === cardId);
  if (!card) fail('Carta non presente in mano');
  const opts = SC.captures(card, g.table, g.cfg);
  let chosen = null;
  if (opts.length) {
    if (take && take.length) {
      const want = [...take].sort((a, b) => a - b).join(',');
      chosen = opts.find((o) => o.map((c) => c.id).sort((a, b) => a - b).join(',') === want);
      if (!chosen) fail('Con questa carta non puoi prendere quelle carte');
    } else if (opts.length === 1) chosen = opts[0];
    else fail('Scegli quali carte prendere');
  } else if (take && take.length) fail('Con questa carta non puoi prendere nulla');
  p.hand = p.hand.filter((c) => c.id !== card.id);
  const team = teamOf(g, seat);
  const lastPlay = !g.stock.length && g.players.every((x) => !x.hand.length);
  g.lastTake = null;
  if (chosen) {
    const ids = new Set(chosen.map((c) => c.id));
    g.table = g.table.filter((c) => !ids.has(c.id));
    team.taken.push(card, ...chosen);
    g.lastTaker = team.id;
    const scopa = !g.table.length && !lastPlay;
    if (scopa) team.scope++;
    g.lastTake = { seat, cardIds: chosen.map((c) => c.id), scopa };
    addLog(g, `${p.name} gioca ${cardName(card)} e prende ${chosen.map(cardName).join(', ')}${scopa ? ' — SCOPA!' : ''}`);
    setEvent(g, { type: 'take', seat, cardId: card.id, card: { r: card.r, s: card.s }, cardIds: chosen.map((c) => c.id), scopa });
  } else {
    g.table.push(card);
    addLog(g, `${p.name} gioca ${cardName(card)}`);
    setEvent(g, { type: 'discard', seat, cardId: card.id, card: { r: card.r, s: card.s } });
  }
  if (lastPlay) return endHand(g);
  // mani vuote: altre 3 carte a testa
  if (g.players.every((x) => !x.hand.length) && g.stock.length) { deal(g); addLog(g, 'Si danno altre tre carte'); }
  g.turn = (g.turn + 1) % g.n;
}

function endHand(g) {
  // le carte rimaste in tavola vanno a chi ha preso per ultimo
  if (g.table.length && g.lastTaker != null) {
    g.teams[g.lastTaker].taken.push(...g.table);
    addLog(g, `Le carte rimaste in tavola vanno a ${g.teams[g.lastTaker].members.map((s) => g.players[s].name).join(' e ')}`);
    g.table = [];
  }
  g.phase = 'handEnd';
  const pts = SC.handPoints(g.teams.map((t) => t.taken), g.teams.map((t) => t.scope));
  const results = g.teams.map((t, i) => ({
    members: t.members.slice(), names: t.members.map((x) => g.players[x].name),
    meldPts: 0, burraco: [], bonusPts: 0, handPts: 0, closePts: 0, pozPts: 0, total: pts[i].total, detail: pts[i],
    cards: t.taken.length, coins: t.taken.filter((c) => c.s === 'd').length, prim: SC.primiera(t.taken),
  }));
  for (const r of results) for (const s of r.members) g.scores[s] += r.total;
  // righe del resoconto (le mostra l'interfaccia al posto di quelle del Burraco)
  const rows = [
    ['Carte', (r) => r.detail.carte, (r) => `${r.cards}`],
    ['Denari', (r) => r.detail.denari, (r) => `${r.coins}`],
    ['Settebello', (r) => r.detail.settebello, () => ''],
    ['Primiera', (r) => r.detail.primiera, (r) => (r.prim ? `${r.prim}` : '—')],
    ['Scope', (r) => r.detail.scope, () => ''],
  ].map(([label, v, sub]) => ({ label, values: results.map(v), notes: results.map(sub) }));
  g.handResult = { reason: 'end', closer: null, rows, teams: results, scores: g.scores.slice(), hands: null };
  g.history.push({ handNo: g.handNo, teams: results.map((r) => ({ members: r.members, total: r.total })) });
  g.lastReplay = g.replay ? { handNo: g.handNo, ...g.replay } : null;
  g.replay = null;
  addLog(g, 'Smazzata terminata.');
  const max = Math.max(...g.scores);
  const leaders = g.teams.filter((t) => g.scores[t.members[0]] === max);
  if (max >= g.cfg.target && leaders.length === 1) {
    g.over = true;
    g.winners = leaders[0].members.slice();
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
    play(g, seat, action.cardId, action.take);
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
    game: 'scopa', presa: true,
    cfg: { game: 'scopa', rules: g.cfg.rules, target: g.cfg.target, pile: 'top', pozzettoName: '', burracoName: '' },
    n: g.n, you: seat, handNo: g.handNo, dealer: g.dealer,
    players: g.players.map((p) => ({ seat: p.seat, name: p.name, isBot: p.isBot, team: p.team, handCount: p.hand.length })),
    hand: seat >= 0 && g.players[seat] ? g.players[seat].hand : [],
    teams: g.teams.map((t) => ({ id: t.id, members: t.members, melds: [], taken: t.taken.length, scope: t.scope, pozzettoTaken: false, closed: false, canClose: false })),
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
