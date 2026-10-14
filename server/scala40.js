'use strict';
/*
 * Motore della Scala 40. Stato JSON puro, azioni validate qui (il client è solo una vista).
 * Ha la stessa "forma" del motore del Burraco (players, teams con i giochi, stock, discard, scores,
 * handResult, events, replay…) così il server e l'interfaccia lo trattano allo stesso modo.
 * Ognuno gioca per sé: ogni giocatore è una "squadra" da solo.
 * Punteggi: le penalità si contano in negativo (chi ha più punti sta meglio, come nel Burraco);
 * chi arriva a -target è eliminato, vince l'ultimo rimasto.
 */
const S40 = require('../shared/scala40');
const { GameError } = require('./engine');

const fail = (msg) => { throw new GameError(msg); };
const SUITS = ['S', 'H', 'D', 'C'];
const SUIT_NAMES = { S: '♠', H: '♥', D: '♦', C: '♣', J: '★' };
const RANK_NAMES = { 0: 'Jolly', 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const cardName = (c) => (S40.isJoker(c) ? 'Jolly' : (RANK_NAMES[c.r] || String(c.r)) + SUIT_NAMES[c.s]);
const isWild = S40.isJoker;

function rand(g) {
  if (!g || g.rng == null) return Math.random();
  let t = (g.rng = (g.rng + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(a, g) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(g) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function buildDeck() {
  const deck = [];
  let id = 0;
  for (let k = 0; k < 2; k++) for (const s of SUITS) for (let r = 1; r <= 13; r++) deck.push({ id: id++, r, s });
  for (let j = 0; j < 4; j++) deck.push({ id: id++, r: 0, s: 'J' });
  return deck;
}

function addLog(g, text) { g.log.push(text); if (g.log.length > 60) g.log.splice(0, g.log.length - 60); }
function note(g, text) { addLog(g, text); }
function setEvent(g, ev) {
  g.eventSeq = (g.eventSeq || 0) + 1;
  g.lastEvent = { ...ev, n: g.eventSeq };
  if (!g.events) g.events = [];
  g.events.push(g.lastEvent);
  if (g.events.length > 30) g.events.splice(0, g.events.length - 30);
}

const teamOf = (g, seat) => g.teams.find((t) => t.members.includes(seat));
const alive = (g) => g.players.filter((p) => !p.out).map((p) => p.seat);

function buildCfg(rules) {
  const r = S40.normalize(rules);
  return { game: 'scala40', rules: r, maxJokers: r.maxJokers, opening: r.opening, target: r.target, swapJoker: r.swapJoker, pileNeedsOpen: r.pileNeedsOpen, jokerUseNow: r.jokerUseNow, closeInHandDouble: r.closeInHandDouble };
}

function createGame({ rules, players, seed }) {
  const n = players.length;
  if (n < 2 || n > 4) fail('Si gioca da 2 a 4');
  const g = {
    game: 'scala40', cfg: buildCfg({ ...rules, players: n }), n,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, hand: [], team: i, out: false })),
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

function startHand(g) {
  g.handNo++;
  const live = alive(g);
  do { g.dealer = (g.dealer + 1) % g.n; } while (g.players[g.dealer].out);
  const deck = shuffle(buildDeck(), g);
  g.teams = g.players.map((p) => ({ id: p.seat, members: [p.seat], melds: [], opened: false }));
  for (const p of g.players) p.hand = p.out ? [] : deck.splice(0, 13);
  g.discard = [deck.pop()];
  g.stock = deck;
  g.pozzetti = [];
  g.turn = g.dealer;
  do { g.turn = (g.turn + 1) % g.n; } while (g.players[g.turn].out);
  g.phase = 'draw';
  g.turnInfo = null;
  g.events = [];
  g.known = g.players.map(() => []);
  g.handResult = null;
  g.meldSeq = 0;
  g.lastEvent = null;
  g.closedInHand = false;
  g.reshuffles = 0;
  addLog(g, `— Smazzata ${g.handNo}: distribuisce ${g.players[g.dealer].name} (${live.length} in gioco)`);
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
function storeAnalysis(m, an) { Object.assign(m, { type: an.type, cards: an.cards, wild: an.wild, reps: an.reps || null, rank: an.rank || null, length: an.length, wildCount: an.wildCount }); }

function beginPlay(g, seat, tookId = null) {
  g.phase = 'play';
  g.turnInfo = { tookId, openedNow: false, swapped: [] };
}

function draw(g, seat) {
  assertTurn(g, seat, 'draw');
  if (!g.stock.length) {
    // tallone finito: si rimescolano gli scarti (tranne quello in cima); dopo 3 volte la smazzata finisce
    if ((g.reshuffles || 0) >= 3) return endHand(g, 'stock', null);
    g.reshuffles = (g.reshuffles || 0) + 1;
    const top = g.discard.pop();
    g.stock = shuffle(g.discard, g);
    g.discard = top ? [top] : [];
    addLog(g, 'Il tallone è finito: si rimescolano gli scarti');
    if (!g.stock.length) return endHand(g, 'stock', null);
  }
  const c = g.stock.pop();
  g.players[seat].hand.push(c);
  addLog(g, `${g.players[seat].name} pesca dal tallone`);
  setEvent(g, { type: 'draw', seat });
  beginPlay(g, seat);
}

/** Scarto in cima: chi non ha ancora aperto deve aprire subito usandolo (cardIds = carte dalla mano da calare con esso) */
function takePile(g, seat, { cardIds }) {
  assertTurn(g, seat, 'draw');
  const top = g.discard[g.discard.length - 1];
  if (!top) fail('Non ci sono scarti');
  const team = teamOf(g, seat);
  const p = g.players[seat];
  if (!team.opened && g.cfg.pileNeedsOpen) {
    if (!cardIds || !cardIds.length) fail(`Per prendere lo scarto senza aver aperto devi calare subito almeno ${g.cfg.opening} punti usandolo`);
    const hand = takeFromHand(p, cardIds);
    g.discard.pop();
    p.hand.push(top);
    addLog(g, `${p.name} prende ${cardName(top)} dagli scarti`);
    setEvent(g, { type: 'pile', seat, count: 1, cardId: top.id });
    beginPlay(g, seat, top.id);
    meld(g, seat, [top.id, ...hand.map((c) => c.id)]);
    return;
  }
  g.discard.pop();
  p.hand.push(top);
  g.known[seat].push(top.id);
  addLog(g, `${p.name} prende ${cardName(top)} dagli scarti`);
  setEvent(g, { type: 'pile', seat, count: 1, cardId: top.id });
  beginPlay(g, seat, top.id);
}

function meld(g, seat, cardIds) {
  assertTurn(g, seat, 'play');
  const p = g.players[seat];
  const team = teamOf(g, seat);
  const cards = takeFromHand(p, cardIds);
  if (cards.length >= p.hand.length) fail('Devi tenere almeno una carta da scartare');
  const groups = S40.partitionMelds(cards, g.cfg);
  if (!groups) fail(`Combinazione non valida (scale dello stesso seme o tris di semi diversi, max ${g.cfg.maxJokers} jolly)`);
  if (!team.opened) {
    const pts = groups.reduce((s, an) => s + an.points, 0);
    if (pts < g.cfg.opening) fail(`Per aprire servono almeno ${g.cfg.opening} punti in una volta (ne hai ${pts})`);
  }
  removeFromHand(p, cards);
  const meldIds = [];
  for (const an of groups) {
    const m = { id: ++g.meldSeq };
    storeAnalysis(m, an);
    team.melds.push(m);
    meldIds.push(m.id);
  }
  if (!team.opened) { team.opened = true; g.turnInfo.openedNow = true; addLog(g, `${p.name} apre!`); }
  addLog(g, `${p.name} cala ${groups.map((an) => an.cards.map(cardName).join(' ')).join(' · ')}`);
  setEvent(g, { type: 'meld', seat, meldId: meldIds[meldIds.length - 1], meldIds, cardIds: cards.map((c) => c.id) });
}

function findMeld(g, meldId) {
  for (const t of g.teams) { const m = t.melds.find((x) => x.id === meldId); if (m) return { team: t, m }; }
  return null;
}

function addToMeld(g, seat, meldId, cardIds) {
  assertTurn(g, seat, 'play');
  const p = g.players[seat];
  if (!teamOf(g, seat).opened) fail(`Prima devi aprire (almeno ${g.cfg.opening} punti)`);
  const f = findMeld(g, meldId);
  if (!f) fail('Combinazione non trovata');
  const cards = takeFromHand(p, cardIds);
  if (cards.length >= p.hand.length) fail('Devi tenere almeno una carta da scartare');
  const an = S40.analyzeMeld(f.m.cards.concat(cards), g.cfg, f.m.type);
  if (!an) fail('Quelle carte non si possono attaccare a questa combinazione');
  removeFromHand(p, cards);
  storeAnalysis(f.m, an);
  addLog(g, `${p.name} attacca ${cards.map(cardName).join(' ')}`);
  setEvent(g, { type: 'add', seat, meldId, cardIds: cards.map((c) => c.id) });
}

/** Prende un jolly dal tavolo mettendo al suo posto la carta naturale che rappresenta */
function swapJoker(g, seat, meldId, cardId) {
  assertTurn(g, seat, 'play');
  if (!g.cfg.swapJoker) fail('In questa partita i jolly sul tavolo non si possono prendere');
  const p = g.players[seat];
  if (!teamOf(g, seat).opened) fail('Prima devi aprire');
  const f = findMeld(g, meldId);
  if (!f) fail('Combinazione non trovata');
  const [card] = takeFromHand(p, [cardId]);
  if (isWild(card)) fail('Serve una carta naturale');
  const m = f.m;
  const jIdx = m.cards.findIndex((c, i) => m.wild[i] && (m.type === 'seq'
    ? card.s === m.cards.find((x) => !isWild(x)).s && (m.reps[i] === card.r || (card.r === 1 && m.reps[i] === 14))
    : card.r === m.rank && !m.cards.some((x) => !isWild(x) && x.s === card.s)));
  if (jIdx < 0) fail('Quella carta non sostituisce nessun jolly di questa combinazione');
  const joker = m.cards[jIdx];
  const an = S40.analyzeMeld(m.cards.map((c, i) => (i === jIdx ? card : c)), g.cfg, m.type);
  if (!an) fail('Sostituzione non valida');
  if (g.cfg.jokerUseNow) {
    const handAfter = p.hand.filter((c) => c.id !== card.id);
    const melds = g.teams.flatMap((t) => t.melds).map((x) => (x === m ? { ...x, cards: an.cards, type: an.type } : x));
    const usable = melds.some((x) => S40.analyzeMeld(x.cards.concat([joker]), g.cfg, x.type))
      || handAfter.some((a, i) => handAfter.some((b, k) => k > i && S40.analyzeMeld([a, b, joker], g.cfg)));
    if (!usable || handAfter.length < 3) fail('Il jolly preso dal tavolo va usato subito, ma ora non avresti dove metterlo');
  }
  removeFromHand(p, [card]);
  p.hand.push(joker);
  if (g.turnInfo) g.turnInfo.swapped.push(joker.id);
  storeAnalysis(m, an);
  addLog(g, `${p.name} mette ${cardName(card)} al posto del jolly e lo prende`);
  setEvent(g, { type: 'add', seat, meldId, cardIds: [card.id] });
}

function discard(g, seat, cardId) {
  assertTurn(g, seat, 'play');
  const p = g.players[seat];
  const [c] = takeFromHand(p, [cardId]);
  if (g.turnInfo.tookId === cardId && p.hand.length > 1) fail('Non puoi riscartare la carta appena presa dagli scarti');
  if (g.cfg.jokerUseNow && (g.turnInfo.swapped || []).some((id) => p.hand.some((c) => c.id === id))) fail('Prima usa il jolly che hai preso dal tavolo (calalo o attaccalo)');
  removeFromHand(p, [c]);
  g.discard.push(c);
  addLog(g, `${p.name} scarta ${cardName(c)}${p.hand.length ? '' : ' e CHIUDE!'}`);
  setEvent(g, { type: 'discard', seat, cardId, card: { r: c.r, s: c.s } });
  if (!p.hand.length) {
    g.closedInHand = !!g.turnInfo.openedNow;
    return endHand(g, 'close', seat);
  }
  do { g.turn = (g.turn + 1) % g.n; } while (g.players[g.turn].out);
  g.phase = 'draw';
  g.turnInfo = null;
}

function endHand(g, reason, closer) {
  g.phase = 'handEnd';
  const results = g.teams.map((t) => {
    const seat = t.members[0];
    const base = g.players[seat].out ? 0 : g.players[seat].hand.reduce((s, c) => s + S40.handValue(c), 0);
    // chiusura in mano: penalità doppie (se la regola è attiva)
    const pen = reason === 'close' && g.closedInHand && g.cfg.closeInHandDouble ? base * 2 : base;
    return {
      members: t.members.slice(), names: [g.players[seat].name], meldPts: 0, burraco: [], bonusPts: 0,
      handPts: -pen, closePts: 0, pozPts: 0, total: -pen, out: g.players[seat].out,
    };
  });
  for (const r of results) g.scores[r.members[0]] += r.total;
  g.handResult = { reason, closer, inHand: reason === 'close' && !!g.closedInHand, teams: results.filter((r) => !r.out), scores: g.scores.slice(), hands: g.players.map((p) => p.hand) };
  if (g.handResult.inHand) addLog(g, `Chiusura in mano!${g.cfg.closeInHandDouble ? ' Penalità doppie.' : ''}`);
  g.history.push({ handNo: g.handNo, teams: results.filter((r) => !r.out).map((r) => ({ members: r.members, total: r.total })) });
  g.lastReplay = g.replay ? { handNo: g.handNo, ...g.replay } : null;
  g.replay = null;
  addLog(g, reason === 'close' ? 'Smazzata chiusa.' : 'Smazzata terminata.');
  // eliminati: chi è arrivato al limite
  for (const p of g.players) {
    if (!p.out && -g.scores[p.seat] >= g.cfg.target) { p.out = true; addLog(g, `${p.name} arriva a ${-g.scores[p.seat]} punti ed è eliminato`); }
  }
  const live = alive(g);
  if (live.length <= 1) {
    g.over = true;
    const best = Math.max(...g.scores);
    g.winners = live.length ? live : g.scores.map((s, i) => (s === best ? i : -1)).filter((i) => i >= 0);
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
  const open = g.phase !== 'handEnd';
  g.phase = 'handEnd';
  g.turnInfo = null;
  g.handResult = {
    reason: 'surrender', closer: null, surrendered: [seat], scores: g.scores.slice(), hands: null,
    teams: g.teams.filter((t) => !g.players[t.members[0]].out).map((t) => ({ members: t.members.slice(), names: [g.players[t.members[0]].name], meldPts: 0, burraco: [], bonusPts: 0, handPts: 0, closePts: 0, pozPts: 0, total: 0 })),
  };
  g.replay = null;
  if (open) g.lastReplay = null;
  g.players[seat].out = true;
  const live = alive(g);
  if (live.length <= 1) {
    g.over = true;
    g.winners = live;
    addLog(g, `${g.players[seat].name} si arrende: vince ${live.map((s) => g.players[s].name).join(' e ')}`);
  } else {
    // con più avversari la partita continua senza di lui (alla prossima smazzata)
    addLog(g, `${g.players[seat].name} si arrende ed esce dalla partita`);
  }
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
      case 'swap': swapJoker(g, seat, action.meldId, action.cardId); break;
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

function meldView(m) {
  return { id: m.id, type: m.type, cards: m.cards, wild: m.wild, length: m.length, kind: null, label: m.type === 'seq' ? 'Scala' : m.length === 4 ? 'Poker' : 'Tris' };
}

function viewFor(g, seat) {
  return {
    game: 'scala40',
    cfg: { game: 'scala40', rules: g.cfg.rules, target: g.cfg.target, opening: g.cfg.opening, pile: 'top', pozzettoName: '', burracoName: '', allowSets: true },
    n: g.n, you: seat, handNo: g.handNo, dealer: g.dealer,
    players: g.players.map((p) => ({ seat: p.seat, name: p.name, isBot: p.isBot, team: p.team, handCount: p.hand.length, out: p.out })),
    hand: seat >= 0 && g.players[seat] ? g.players[seat].hand : [],
    teams: g.teams.map((t) => ({ id: t.id, members: t.members, opened: t.opened, pozzettoTaken: false, closed: false, canClose: false, melds: t.melds.map(meldView) })),
    stockCount: g.stock.length, discard: g.discard.slice(-1), discardCount: g.discard.length, pozzetti: [],
    turn: g.turn, phase: g.phase, lastTurn: false, mustDraw: false, canUndo: false,
    singlePickId: g.turnInfo ? g.turnInfo.tookId : null,
    scores: g.scores, history: g.history.slice(-30), handResult: g.handResult, over: g.over, winners: g.winners,
    partnershipFormed: true, log: g.log.slice(-25), lastEvent: g.lastEvent, events: g.events || [], hasReplay: !!g.lastReplay,
  };
}

module.exports = {
  GameError, note, createGame, apply, isLegal, viewFor, nextHand, surrender, teamOf, cardName, isWild, buildCfg,
  analyzeMeld: (cards, cfg, type) => S40.analyzeMeld(cards, cfg, type), meldKind: () => ({ kind: null, bonus: 0, label: '' }),
  cardValue: (c) => S40.handValue(c), canClose: () => false,
};
