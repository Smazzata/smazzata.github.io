'use strict';
/*
 * Motore della Canasta classica. Stato JSON puro, azioni validate qui; stessa "forma" dei motori
 * di Burraco e Scala 40 (players, teams con i giochi, stock, discard, scores, handResult, events, replay…).
 * In 4 si gioca a coppie (0-2 contro 1-3), in 2 e in 3 ognuno per sé.
 */
const C = require('../shared/canasta');
const { GameError } = require('./engine');

const fail = (msg) => { throw new GameError(msg); };
const SUITS = ['S', 'H', 'D', 'C'];
const SUIT_NAMES = { S: '♠', H: '♥', D: '♦', C: '♣', J: '★' };
const RANK_NAMES = { 0: 'Jolly', 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const cardName = (c) => (C.isJoker(c) ? 'Jolly' : (RANK_NAMES[c.r] || String(c.r)) + SUIT_NAMES[c.s]);

function rand(g) {
  if (!g || g.rng == null) return Math.random();
  let t = (g.rng = (g.rng + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(a, g) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(g) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function buildDeck() {
  const deck = [];
  let id = 0;
  for (let k = 0; k < 2; k++) for (const s of SUITS) for (let r = 1; r <= 13; r++) deck.push({ id: id++, r, s });
  for (let j = 0; j < 4; j++) deck.push({ id: id++, r: 0, s: 'J' });
  return deck;
}

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
const teamScore = (g, t) => g.scores[t.members[0]];

function buildCfg(rules) {
  const r = C.normalize(rules);
  return { game: 'canasta', rules: r, maxWild: r.maxWild, target: r.target, goOut: r.goOut };
}

function createGame({ rules, players, seed }) {
  const n = players.length;
  if (n < 2 || n > 4) fail('Si gioca da 2 a 4');
  const g = {
    game: 'canasta', cfg: buildCfg({ ...rules, players: n }), n,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, hand: [], team: 0 })),
    scores: Array(n).fill(0), handNo: 0, dealer: 0, history: [], over: false, winners: null, log: [],
    rng: seed == null ? null : seed >>> 0,
  };
  g.dealer = Math.floor(rand(g) * n);
  startHand(g);
  return g;
}

function replayStart(g) {
  const { replay, lastReplay, history, log, events, handResult, ...rest } = g;
  return JSON.parse(JSON.stringify(rest));
}

/** Tre rossi in mano: vanno in tavola e si pesca un'altra carta */
function layRedThrees(g, seat) {
  const p = g.players[seat];
  const team = teamOf(g, seat);
  let reds = p.hand.filter(C.isRed3);
  while (reds.length) {
    for (const c of reds) { p.hand = p.hand.filter((x) => x.id !== c.id); team.red3.push(c); }
    addLog(g, `${p.name} mette in tavola ${reds.length === 1 ? 'un tre rosso' : `${reds.length} tre rossi`}`);
    const more = [];
    for (let i = 0; i < reds.length && g.stock.length; i++) more.push(g.stock.pop());
    p.hand.push(...more);
    reds = more.filter(C.isRed3);
  }
}

function startHand(g) {
  g.handNo++;
  g.dealer = (g.dealer + 1) % g.n;
  const deck = shuffle(buildDeck(), g);
  const defs = g.n === 4 ? [[0, 2], [1, 3]] : Array.from({ length: g.n }, (_, i) => [i]);
  g.teams = defs.map((members, id) => ({ id, members, melds: [], red3: [], hadMelds: false }));
  for (const t of g.teams) for (const s of t.members) g.players[s].team = t.id;
  const size = g.n === 4 ? 11 : g.n === 3 ? 13 : 15;
  for (const p of g.players) p.hand = deck.splice(0, size);
  g.stock = deck;
  g.discard = [];
  // carta scoperta: se è una matta o un tre rosso se ne scopre un'altra (e il monte è congelato)
  do { g.discard.push(g.stock.pop()); } while (C.isWild(g.discard[g.discard.length - 1]) || C.isRed3(g.discard[g.discard.length - 1]));
  g.pozzetti = [];
  for (const p of g.players) layRedThrees(g, p.seat);
  g.turn = (g.dealer + 1) % g.n;
  g.phase = 'draw';
  g.turnInfo = null;
  g.events = [];
  g.known = g.players.map(() => []);
  g.handResult = null;
  g.meldSeq = 0;
  g.lastEvent = null;
  addLog(g, `— Smazzata ${g.handNo}: distribuisce ${g.players[g.dealer].name}`);
  g.replay = { start: replayStart(g), actions: [] };
}

function assertTurn(g, seat, phase) {
  if (g.phase === 'handEnd' || g.over) fail('La smazzata è terminata');
  if (g.turn !== seat) fail('Non è il tuo turno');
  if (phase && g.phase !== phase) fail(phase === 'draw' ? 'Hai già pescato' : 'Prima devi pescare');
}
function takeFromHand(p, ids) {
  const cards = ids.map((id) => p.hand.find((c) => c.id === id));
  if (cards.some((c) => !c) || new Set(ids).size !== ids.length) fail('Carte non valide');
  return cards;
}
function removeFromHand(p, cards) { const ids = new Set(cards.map((c) => c.id)); p.hand = p.hand.filter((c) => !ids.has(c.id)); }
function storeAnalysis(m, an) { Object.assign(m, { type: 'set', rank: an.rank, cards: an.cards, wild: an.wild, wildCount: an.wildCount, length: an.length }); }
const hasCanasta = (t) => t.melds.some((m) => m.length >= 7);
/** il monte è congelato per la squadra: prima di aprire o se contiene una matta (o un tre rosso) */
const pileFrozen = (g, team) => !team.melds.length || g.discard.some((c) => C.isWild(c) || C.isRed3(c));

function beginPlay(g, seat) {
  g.phase = 'play';
  g.turnInfo = { startHadMelds: teamOf(g, seat).melds.length > 0 };
}

function draw(g, seat) {
  assertTurn(g, seat, 'draw');
  if (!g.stock.length) return endHand(g, 'stock', null);
  const p = g.players[seat];
  const before = p.hand.length;
  p.hand.push(g.stock.pop());
  layRedThrees(g, seat);
  // un tre rosso pescato con l'ultima carta del tallone non si può sostituire: il tallone è finito
  if (p.hand.length === before) return endHand(g, 'stock', null);
  addLog(g, `${p.name} pesca dal tallone`);
  setEvent(g, { type: 'draw', seat });
  beginPlay(g, seat);
}

/** Il monte si prende tutto; la carta in cima va calata subito (cardIds = carte dalla mano, oppure meldId) */
function takePile(g, seat, { cardIds = [], meldId = null }) {
  assertTurn(g, seat, 'draw');
  const top = g.discard[g.discard.length - 1];
  if (!top) fail('Il monte degli scarti è vuoto');
  if (C.isWild(top) || C.isBlack3(top)) fail('Il monte è bloccato: in cima c\'è una matta o un tre nero');
  const p = g.players[seat];
  const team = teamOf(g, seat);
  const frozen = pileFrozen(g, team);
  if (meldId != null) {
    if (frozen) fail('Il monte è congelato: servono due carte naturali uguali a quella in cima');
    const m = team.melds.find((x) => x.id === meldId);
    if (!m || m.rank !== top.r) fail('La carta in cima non va con questa combinazione');
  } else {
    const hand = takeFromHand(p, cardIds);
    const naturals = hand.filter((c) => !C.isWild(c) && c.r === top.r).length;
    if (frozen && naturals < 2) fail('Il monte è congelato: servono due carte naturali uguali a quella in cima');
    const an = C.analyzeMeld([top, ...hand], g.cfg);
    if (!an || an.rank !== top.r) fail('Con la carta in cima non formi una combinazione valida');
    if (!team.melds.length && an.points < C.minimum(teamScore(g, team))) fail(`Per aprire servono almeno ${C.minimum(teamScore(g, team))} punti (ne hai ${an.points})`);
  }
  const pile = g.discard;
  g.discard = [];
  p.hand.push(...pile);
  g.known[seat].push(...pile.map((c) => c.id));
  addLog(g, `${p.name} prende il monte degli scarti (${pile.length} ${pile.length === 1 ? 'carta' : 'carte'})`);
  setEvent(g, { type: 'pile', seat, count: pile.length });
  beginPlay(g, seat);
  if (meldId != null) addToMeld(g, seat, meldId, [top.id]);
  else meld(g, seat, [top.id, ...cardIds]);
}

/** Dopo una giocata: mano vuota = chiusura (serve una canasta) */
function checkOut(g, seat) {
  if (g.players[seat].hand.length) return;
  endHand(g, 'close', seat);
}

function meld(g, seat, cardIds) {
  assertTurn(g, seat, 'play');
  const p = g.players[seat];
  const team = teamOf(g, seat);
  const cards = takeFromHand(p, cardIds);
  const groups = C.partitionMelds(cards, g.cfg);
  if (!groups) fail(`Combinazione non valida: carte dello stesso valore, almeno 2 naturali e al massimo ${g.cfg.maxWild} matte (niente 3)`);
  if (!team.melds.length) {
    const pts = groups.reduce((s, an) => s + an.points, 0);
    const need = C.minimum(teamScore(g, team));
    if (pts < need) fail(`Per aprire servono almeno ${need} punti in una volta (ne hai ${pts})`);
  }
  // si può avere una sola combinazione per valore: le carte dello stesso valore si attaccano a quella
  for (const an of groups) if (team.melds.some((m) => m.rank === an.rank)) fail('Hai già una combinazione di quel valore: attacca le carte a quella');
  const canastaAfter = hasCanasta(team) || groups.some((an) => an.length >= 7);
  if (p.hand.length - cards.length <= 1 && !canastaAfter) fail('Per restare con una carta sola (o chiudere) serve almeno una canasta');
  removeFromHand(p, cards);
  const meldIds = [];
  for (const an of groups) { const m = { id: ++g.meldSeq }; storeAnalysis(m, an); team.melds.push(m); meldIds.push(m.id); }
  addLog(g, `${p.name} cala ${groups.map((an) => an.cards.map(cardName).join(' ')).join(' · ')}`);
  setEvent(g, { type: 'meld', seat, meldId: meldIds[meldIds.length - 1], meldIds, cardIds: cards.map((c) => c.id) });
  checkOut(g, seat);
}

function addToMeld(g, seat, meldId, cardIds) {
  assertTurn(g, seat, 'play');
  const p = g.players[seat];
  const team = teamOf(g, seat);
  const m = team.melds.find((x) => x.id === meldId);
  if (!m) fail('Puoi attaccare solo alle combinazioni della tua squadra');
  const cards = takeFromHand(p, cardIds);
  const an = C.analyzeMeld(m.cards.concat(cards), g.cfg);
  if (!an) fail(`Quelle carte non si possono attaccare (al massimo ${g.cfg.maxWild} matte, almeno 2 naturali)`);
  if (p.hand.length - cards.length <= 1 && !hasCanasta(team) && an.length < 7) fail('Per restare con una carta sola (o chiudere) serve almeno una canasta');
  const was = m.length;
  removeFromHand(p, cards);
  storeAnalysis(m, an);
  addLog(g, `${p.name} attacca ${cards.map(cardName).join(' ')}`);
  if (was < 7 && m.length >= 7) addLog(g, `★ Canasta ${m.wildCount ? 'sporca' : 'pulita'}!`);
  setEvent(g, { type: 'add', seat, meldId, cardIds: cards.map((c) => c.id) });
  checkOut(g, seat);
}

function discard(g, seat, cardId) {
  assertTurn(g, seat, 'play');
  const p = g.players[seat];
  const [c] = takeFromHand(p, [cardId]);
  if (p.hand.length === 1 && !hasCanasta(teamOf(g, seat))) fail('Per chiudere serve almeno una canasta: tieni la carta o cala ancora');
  removeFromHand(p, [c]);
  g.discard.push(c);
  addLog(g, `${p.name} scarta ${cardName(c)}${p.hand.length ? '' : ' e CHIUDE!'}`);
  setEvent(g, { type: 'discard', seat, cardId, card: { r: c.r, s: c.s } });
  if (!p.hand.length) return endHand(g, 'close', seat);
  g.turn = (g.turn + 1) % g.n;
  g.phase = 'draw';
  g.turnInfo = null;
}

/** Punti sul tavolo di una squadra (carte calate, canaste, tre rossi): a fine smazzata e come punteggio provvisorio */
function meldScore(t) {
  const meldPts = t.melds.reduce((s, m) => s + m.cards.reduce((a, c) => a + C.value(c), 0), 0);
  const canastas = t.melds.filter((m) => m.length >= 7).map((m) => (m.wildCount
    ? { kind: 'dirty', label: 'Canasta sporca', bonus: 300 } : { kind: 'clean', label: 'Canasta pulita', bonus: 500 }));
  const bonusPts = canastas.reduce((s, k) => s + k.bonus, 0);
  const reds = t.red3.length ? (t.red3.length === 4 ? 800 : t.red3.length * 100) * (t.melds.length ? 1 : -1) : 0;
  return { meldPts, canastas, bonusPts, reds };
}

function endHand(g, reason, closer) {
  g.phase = 'handEnd';
  const cfg = g.cfg;
  const closerTeam = closer == null ? null : teamOf(g, closer);
  const concealed = closerTeam && g.turnInfo && !g.turnInfo.startHadMelds;
  const results = g.teams.map((t) => {
    const { meldPts, canastas, bonusPts, reds } = meldScore(t);
    const handPts = t.members.reduce((s, x) => s + g.players[x].hand.reduce((a, c) => a + C.value(c), 0), 0);
    const closePts = t === closerTeam ? cfg.goOut * (concealed ? 2 : 1) : 0;
    const total = meldPts + bonusPts + reds - handPts + closePts;
    return { members: t.members.slice(), names: t.members.map((x) => g.players[x].name), meldPts, burraco: canastas, bonusPts, handPts: -handPts, closePts, pozPts: reds, total };
  });
  for (const r of results) for (const s of r.members) g.scores[s] += r.total;
  g.handResult = { reason, closer, concealed: !!concealed, teams: results, scores: g.scores.slice(), hands: g.players.map((p) => p.hand) };
  g.history.push({ handNo: g.handNo, teams: results.map((r) => ({ members: r.members, total: r.total })) });
  g.lastReplay = g.replay ? { handNo: g.handNo, ...g.replay } : null;
  g.replay = null;
  addLog(g, reason === 'close' ? `Smazzata chiusa${concealed ? ' in mano' : ''}.` : 'Il tallone è finito: smazzata terminata.');
  const max = Math.max(...g.scores);
  if (max >= cfg.target) {
    g.over = true;
    g.winners = g.scores.map((s, i) => (s === max ? i : -1)).filter((i) => i >= 0);
    addLog(g, `Partita finita! Vince ${g.winners.map((s) => g.players[s].name).join(' e ')}`);
  }
}

function nextHand(g) {
  if (g.phase !== 'handEnd') fail('La smazzata non è finita');
  if (g.over) fail('La partita è finita');
  startHand(g);
}

function surrender(g, seat) {
  if (g.over) fail('La partita è già finita');
  const team = teamOf(g, seat);
  const open = g.phase !== 'handEnd';
  g.phase = 'handEnd';
  g.turnInfo = null;
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
    switch (action.type) {
      case 'draw': draw(g, seat); break;
      case 'takePile': takePile(g, seat, action); break;
      case 'meld': meld(g, seat, action.cardIds || []); break;
      case 'add': addToMeld(g, seat, action.meldId, action.cardIds || []); break;
      case 'discard': discard(g, seat, action.cardId); break;
      default: fail('Azione sconosciuta');
    }
  } catch (e) {
    const restored = JSON.parse(backup);
    for (const k of Object.keys(g)) delete g[k];
    Object.assign(g, restored);
    throw e;
  }
}

function isLegal(g, seat, action) {
  const copy = JSON.parse(JSON.stringify(g));
  try { apply(copy, seat, action); return copy; } catch (e) { return null; }
}

function meldKind(m) {
  const k = C.kindOf(m);
  return k ? { kind: k, bonus: k === 'clean' ? 500 : 300, label: k === 'clean' ? 'Canasta pulita' : 'Canasta sporca' } : { kind: null, bonus: 0, label: '' };
}

function viewFor(g, seat) {
  const me = seat >= 0 ? teamOf(g, seat) : null;
  return {
    game: 'canasta',
    cfg: { game: 'canasta', rules: g.cfg.rules, target: g.cfg.target, pile: 'closed', pozzettoName: 'tre rossi', burracoName: 'canasta', allowSets: true },
    n: g.n, you: seat, handNo: g.handNo, dealer: g.dealer,
    players: g.players.map((p) => ({ seat: p.seat, name: p.name, isBot: p.isBot, team: p.team, handCount: p.hand.length })),
    hand: seat >= 0 && g.players[seat] ? g.players[seat].hand : [],
    teams: g.teams.map((t) => ({
      id: t.id, members: t.members, red3: t.red3.length, minimum: C.minimum(teamScore(g, t)), opened: t.melds.length > 0,
      pozzettoTaken: false, closed: false, canClose: hasCanasta(t),
      live: (({ meldPts, bonusPts, reds }) => meldPts + bonusPts + reds)(meldScore(t)),
      melds: t.melds.map((m) => ({ id: m.id, type: 'set', rank: m.rank, cards: m.cards, wild: m.wild, length: m.length, ...meldKind(m) })),
    })),
    stockCount: g.stock.length, discard: g.discard.slice(-1), discardCount: g.discard.length, pozzetti: [],
    pileFrozen: me ? pileFrozen(g, me) : false,
    pileBlocked: !!(g.discard.length && (C.isWild(g.discard[g.discard.length - 1]) || C.isBlack3(g.discard[g.discard.length - 1]))),
    turn: g.turn, phase: g.phase, lastTurn: false, mustDraw: false, canUndo: false, singlePickId: null,
    scores: g.scores, history: g.history.slice(-30), handResult: g.handResult, over: g.over, winners: g.winners,
    partnershipFormed: true, log: g.log.slice(-25), lastEvent: g.lastEvent, events: g.events || [], hasReplay: !!g.lastReplay,
  };
}

module.exports = {
  GameError, note, createGame, apply, isLegal, viewFor, nextHand, surrender, teamOf, cardName, buildCfg, meldKind,
  isWild: C.isWild, analyzeMeld: (cards, cfg) => C.analyzeMeld(cards, cfg), cardValue: C.value, canClose: hasCanasta, pileFrozen,
};
