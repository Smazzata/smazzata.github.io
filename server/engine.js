'use strict';
/*
 * Motore di gioco del Burraco. Lo stato è un oggetto JSON puro (clonabile),
 * tutte le azioni sono validate qui: il client è solo una vista.
 */
const Rules = require('../shared/rules');

const SUITS = ['S', 'H', 'D', 'C'];
const SUIT_NAMES = { S: '♠', H: '♥', D: '♦', C: '♣', J: '★' };
const RANK_NAMES = { 0: 'Jolly', 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

class GameError extends Error {}
const fail = (msg) => { throw new GameError(msg); };

/* ---------------- Carte ---------------- */

function buildDeck(jokers) {
  const deck = [];
  let id = 0;
  for (let k = 0; k < 2; k++) for (const s of SUITS) for (let r = 1; r <= 13; r++) deck.push({ id: id++, r, s });
  for (let j = 0; j < jokers; j++) deck.push({ id: id++, r: 0, s: 'J' });
  return deck;
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const { isJoker, isTwo, isWild, analyzeSequence, analyzeSet, analyzeMeld } = require('../shared/melds');

function cardValue(c, v) {
  if (isJoker(c)) return v.joker;
  if (c.r === 2) return v.two;
  if (c.r === 1) return v.ace;
  if (c.r >= 8) return v.high;
  return v.low;
}

function cardName(c) {
  if (isJoker(c)) return 'Jolly';
  return (RANK_NAMES[c.r] || String(c.r)) + SUIT_NAMES[c.s];
}


/** Classifica una combinazione: restituisce {kind, bonus, label} */
function meldKind(m, cfg) {
  if (m.length < 7) return { kind: null, bonus: 0, label: '' };
  const B = cfg.bonus;
  const bn = cfg.burracoName === 'canastra' ? 'Canastra' : 'Burraco';
  if (m.wildCount === 0) {
    if (m.type === 'seq' && m.length >= 14 && B.seq14) return { kind: 'real14', bonus: B.seq14, label: cfg.burracoName === 'canastra' ? 'Real (A-A)' : 'Scala reale A-A' };
    if (m.type === 'seq' && m.length >= 13 && B.seq13) return { kind: 'real13', bonus: B.seq13, label: cfg.burracoName === 'canastra' ? 'Meia real' : 'Scala completa' };
    return { kind: 'clean', bonus: B.clean, label: bn + (cfg.burracoName === 'canastra' ? ' limpa' : ' pulito') };
  }
  if (B.semi && m.length >= 8 && m.naturalRun >= 7) {
    return { kind: 'semi', bonus: B.semi, label: bn + ' semipulito' };
  }
  return { kind: 'dirty', bonus: B.dirty, label: bn + (cfg.burracoName === 'canastra' ? ' suja' : ' sporco') };
}

/* ---------------- Creazione partita ---------------- */

/** Converte le regole scelte dall'utente (vedi shared/rules.js) nella configurazione interna */
function buildCfg(input) {
  const r = Rules.normalize(input);
  const br = r.terms === 'br';
  return {
    rules: r,
    jokers: r.jokers, handSize: 11,
    pozzetti: { 2: [11, 11], 3: [18, 11], 4: [11, 11] },
    pozzettoName: br ? 'morto' : 'pozzetto', burracoName: br ? 'canastra' : 'burraco',
    allowSets: r.allowSets, noDuplicateSets: r.noDuplicateSets, maxWild: r.maxWild, aceBothEnds: r.aceBothEnds,
    pile: r.pile, initialDiscard: r.initialDiscard,
    values: { joker: r.valJoker, two: r.valTwo, ace: 15, high: 10, low: 5 },
    bonus: {
      clean: r.bonusClean, dirty: r.bonusDirty, semi: r.bonusSemi, seq13: r.bonusSeq13, seq14: r.bonusSeq14,
      close: r.bonusClose, noPozzetto: r.penaltyPozzetto,
    },
    noPenaltyIfNoneTaken: r.noPenaltyIfNoneTaken, closeNeeds: r.closeNeeds,
    closeWildForbidden: r.closeWildForbidden, stockEnd: r.stockEnd,
    vulnerability: r.vulnerability ? { ratio: 0.5, min: 75 } : null,
    target: r.target,
  };
}

function createGame({ rules, players }) {
  const n = players.length;
  if (![2, 3, 4].includes(n)) fail('Si gioca in 2, 3 o 4');
  const g = {
    cfg: buildCfg({ ...rules, players: n }), n,
    players: players.map((p, i) => ({ seat: i, name: p.name, isBot: !!p.isBot, hand: [], team: 0 })),
    scores: Array(n).fill(0),
    handNo: 0, dealer: Math.floor(Math.random() * n),
    history: [], over: false, winners: null, log: [],
  };
  startHand(g);
  return g;
}

/** Ultimo evento di gioco, numerato perché il client possa animarlo una sola volta */
function setEvent(g, ev) {
  g.eventSeq = (g.eventSeq || 0) + 1;
  g.lastEvent = { ...ev, n: g.eventSeq };
}

function addLog(g, text) {
  g.log.push(text);
  if (g.log.length > 60) g.log.splice(0, g.log.length - 60);
}

function startHand(g) {
  const cfg = g.cfg, n = g.n;
  g.handNo++;
  g.dealer = (g.dealer + 1) % n;
  const deck = shuffle(buildDeck(cfg.jokers));
  let teamDefs;
  if (n === 4) teamDefs = [[0, 2], [1, 3]];
  else if (n === 2) teamDefs = [[0], [1]];
  else teamDefs = [[0], [1], [2]];
  g.teams = teamDefs.map((members, id) => ({ id, members, melds: [], pozzettoTaken: false, closed: false }));
  for (const t of g.teams) for (const s of t.members) g.players[s].team = t.id;
  for (const p of g.players) p.hand = deck.splice(0, cfg.handSize);
  g.pozzetti = cfg.pozzetti[n].map((size) => deck.splice(0, size));
  g.discard = cfg.initialDiscard ? [deck.pop()] : [];
  g.stock = deck;
  g.turn = (g.dealer + 1) % n;
  g.phase = 'draw';
  g.lastTurn = false;
  g.pileTakeStreak = 0;
  g.turnInfo = null;
  g.snapshot = null;
  g.handResult = null;
  g.meldSeq = 0;
  g.partnershipFormed = n !== 3;
  g.lastEvent = null;
  addLog(g, `— Smazzata ${g.handNo}: distribuisce ${g.players[g.dealer].name}`);
}

/* ---------------- Utility di stato ---------------- */

const teamOf = (g, seat) => g.teams.find((t) => t.members.includes(seat));

function canTakePozzetto(g, team) {
  return !team.pozzettoTaken && g.pozzetti.length > 0;
}

function hasBurraco(g, team, need) {
  return team.melds.some((m) => m.length >= 7 && (need !== 'clean' || m.wildCount === 0));
}

function canClose(g, team) {
  return team.pozzettoTaken && hasBurraco(g, team, g.cfg.closeNeeds);
}

function teamScore(g, team) {
  return Math.max(...team.members.map((s) => g.scores[s]));
}

function takeFromHand(player, ids) {
  if (!Array.isArray(ids) || !ids.length) fail('Seleziona delle carte');
  if (new Set(ids).size !== ids.length) fail('Carte duplicate');
  const cards = ids.map((id) => {
    const c = player.hand.find((x) => x.id === id);
    if (!c) fail('Carta non presente in mano');
    return c;
  });
  return cards;
}

function removeFromHand(player, cards) {
  const ids = new Set(cards.map((c) => c.id));
  player.hand = player.hand.filter((c) => !ids.has(c.id));
}

function storeAnalysis(m, an) {
  m.type = an.type; m.cards = an.cards; m.wild = an.wild; m.wildCount = an.wildCount;
  m.length = an.length; m.naturalRun = an.naturalRun;
  if (an.type === 'seq') m.suit = an.suit; else m.rank = an.rank;
}

function takeSnapshot(g) {
  g.snapshot = JSON.stringify({
    players: g.players, teams: g.teams, discard: g.discard, pozzetti: g.pozzetti,
    turnInfo: g.turnInfo, partnershipFormed: g.partnershipFormed, meldSeq: g.meldSeq,
    phase: g.phase, pileTakeStreak: g.pileTakeStreak, lastEvent: g.lastEvent,
  });
}

function beginPlay(g, seat) {
  const team = teamOf(g, seat);
  g.phase = 'play';
  g.turnInfo = { startHadMelds: team.melds.length > 0, newMeldPts: 0, singlePickId: null };
}

/* ---------------- Azioni ---------------- */

function assertTurn(g, seat, phase) {
  if (g.phase === 'handEnd' || g.over) fail('La smazzata è terminata');
  if (g.turn !== seat) fail('Non è il tuo turno');
  if (phase && g.phase !== phase) fail(phase === 'draw' ? 'Hai già pescato' : 'Prima devi pescare o raccogliere gli scarti');
}

function draw(g, seat) {
  assertTurn(g, seat, 'draw');
  const p = g.players[seat];
  if (g.stock.length === 0) {
    if (g.cfg.stockEnd === 'mortoToStock' && g.pozzetti.length) {
      g.stock = g.pozzetti.shift();
      addLog(g, `Il tallone è finito: un ${g.cfg.pozzettoName} diventa il nuovo tallone`);
    } else {
      return endHand(g, 'stock');
    }
  }
  const c = g.stock.pop();
  p.hand.push(c);
  g.pileTakeStreak = 0;
  addLog(g, `${p.name} pesca dal tallone`);
  setEvent(g, { type: 'draw', seat });
  if (g.cfg.stockEnd === 'twoLeft' && g.stock.length <= 2) {
    g.lastTurn = true;
    addLog(g, 'Nel tallone restano 2 carte: ultimo turno!');
  }
  if (g.cfg.stockEnd === 'mortoToStock' && g.stock.length === 0) {
    if (g.pozzetti.length) {
      g.stock = g.pozzetti.shift();
      addLog(g, `Il tallone è finito: un ${g.cfg.pozzettoName} diventa il nuovo tallone`);
    } else {
      g.lastTurn = true;
      addLog(g, 'Tallone esaurito: ultimo turno!');
    }
  }
  beginPlay(g, seat);
  takeSnapshot(g);
}

function takePile(g, seat, { cardIds = [], meldId = null } = {}) {
  assertTurn(g, seat, 'draw');
  if (!g.discard.length) fail('Il monte degli scarti è vuoto');
  if (g.pileTakeStreak >= 4 && g.stock.length) fail('Dopo 4 raccolte consecutive bisogna pescare dal tallone');
  const p = g.players[seat];
  const team = teamOf(g, seat);
  const pile = g.discard;
  const top = pile[pile.length - 1];

  if (g.cfg.pile === 'closed') {
    if (!cardIds.length && meldId == null) fail('Seleziona le carte da combinare con la carta in cima allo scarto, oppure una tua combinazione');
    const hand = cardIds.length ? takeFromHand(p, cardIds) : [];
    // Verifica preventiva della giocata con la carta in cima
    if (meldId != null) {
      if (isWild(top)) fail('Una matta in cima allo scarto si può usare solo in una nuova combinazione');
      const m = team.melds.find((x) => x.id === meldId);
      if (!m) fail('Combinazione non trovata');
      if (!analyzeMeld(m.cards.concat([top], hand), g.cfg, m.type)) fail('La carta in cima non si può attaccare a quella combinazione');
    } else {
      if (!analyzeMeld([top, ...hand], g.cfg)) fail('Con la carta in cima non formi una combinazione valida');
    }
    // Da vulnerabili senza giochi, "Annulla" deve poter tornare a prima della raccolta
    const vul = g.cfg.vulnerability;
    const preSnap = vul && !team.melds.length && teamScore(g, team) >= g.cfg.target * vul.ratio;
    if (preSnap) takeSnapshot(g);
    g.discard = [];
    p.hand.push(...pile);
    g.pileTakeStreak++;
    addLog(g, `${p.name} raccoglie gli scarti (${pile.length} carte)`);
    beginPlay(g, seat);
    g.turnInfo.pileCount = pile.length;
    const ids = [top.id, ...hand.map((c) => c.id)];
    if (meldId != null) addToMeld(g, seat, meldId, ids); else meld(g, seat, ids);
    if (!preSnap) takeSnapshot(g);
    return;
  }

  g.discard = [];
  p.hand.push(...pile);
  g.pileTakeStreak++;
  addLog(g, `${p.name} raccoglie gli scarti (${pile.length} ${pile.length === 1 ? 'carta' : 'carte'})`);
  setEvent(g, { type: 'pile', seat, count: pile.length });
  beginPlay(g, seat);
  if (pile.length === 1) g.turnInfo.singlePickId = top.id;
  takeSnapshot(g);
}

function meld(g, seat, cardIds) {
  assertTurn(g, seat, 'play');
  const p = g.players[seat];
  const team = teamOf(g, seat);
  const cards = takeFromHand(p, cardIds);
  const an = analyzeMeld(cards, g.cfg);
  if (!an) fail(g.cfg.allowSets ? 'Combinazione non valida (serve una scala o un tris di almeno 3 carte, max 1 matta)' : 'Combinazione non valida (servono scale di almeno 3 carte dello stesso seme, max 1 matta)');
  if (an.type === 'set' && g.cfg.noDuplicateSets && team.melds.some((m) => m.type === 'set' && m.rank === an.rank)) {
    fail('La tua squadra ha già un tris di quel valore: attacca le carte a quello');
  }
  removeFromHand(p, cards);
  const m = { id: ++g.meldSeq };
  storeAnalysis(m, an);
  team.melds.push(m);
  if (!g.turnInfo.startHadMelds) g.turnInfo.newMeldPts += cards.reduce((s, c) => s + cardValue(c, g.cfg.values), 0);
  addLog(g, `${p.name} cala ${cards.map(cardName).join(' ')}`);
  setEvent(g, { type: 'meld', seat, meldId: m.id });
  postMeldCheck(g, seat);
}

function addToMeld(g, seat, meldId, cardIds) {
  assertTurn(g, seat, 'play');
  const p = g.players[seat];
  const team = teamOf(g, seat);
  const m = team.melds.find((x) => x.id === meldId);
  if (!m) fail('Puoi attaccare solo alle combinazioni della tua squadra');
  const cards = takeFromHand(p, cardIds);
  const an = analyzeMeld(m.cards.concat(cards), g.cfg, m.type);
  if (!an) fail('Quelle carte non si possono attaccare a questa combinazione');
  const wasBurraco = m.length >= 7;
  removeFromHand(p, cards);
  storeAnalysis(m, an);
  if (!g.turnInfo.startHadMelds) g.turnInfo.newMeldPts += cards.reduce((s, c) => s + cardValue(c, g.cfg.values), 0);
  addLog(g, `${p.name} attacca ${cards.map(cardName).join(' ')}`);
  if (!wasBurraco && m.length >= 7) addLog(g, `★ ${meldKind(m, g.cfg).label}!`);
  setEvent(g, { type: 'add', seat, meldId: m.id });
  postMeldCheck(g, seat);
}

function checkVulnerability(g, seat) {
  const vul = g.cfg.vulnerability;
  if (!vul || !g.turnInfo || g.turnInfo.startHadMelds || g.turnInfo.newMeldPts === 0) return;
  const team = teamOf(g, seat);
  if (teamScore(g, team) < g.cfg.target * vul.ratio) return;
  if (g.turnInfo.newMeldPts < vul.min) {
    fail(`Siete vulnerabili: la prima calata deve valere almeno ${vul.min} punti (ora ${g.turnInfo.newMeldPts}). Cala altro o premi Annulla.`);
  }
}

function postMeldCheck(g, seat) {
  const p = g.players[seat];
  const team = teamOf(g, seat);
  if (p.hand.length === 0) {
    if (canTakePozzetto(g, team)) {
      checkVulnerability(g, seat);
      takePozzetto(g, seat, 'direct');
      takeSnapshot(g);
      return;
    }
    fail('Non puoi restare senza carte: per chiudere devi scartare l\'ultima carta');
  }
  if (p.hand.length === 1) {
    if (p.hand[0].id === g.turnInfo.singlePickId) fail('Non puoi scartare la carta appena raccolta: tieni almeno un\'altra carta');
    if (canTakePozzetto(g, team)) return;
    if (canClose(g, team)) {
      if (g.cfg.closeWildForbidden && isWild(p.hand[0])) fail('Non si può chiudere scartando una matta');
      return;
    }
    const why = !team.pozzettoTaken ? `il ${g.cfg.pozzettoName} non è disponibile` :
      (g.cfg.closeNeeds === 'clean' ? `serve una ${g.cfg.burracoName} pulita per chiudere` : `serve almeno un ${g.cfg.burracoName} per chiudere`);
    fail(`Devi tenere almeno 2 carte in mano: ${why}`);
  }
}

function takePozzetto(g, seat, mode) {
  const p = g.players[seat];
  const team = teamOf(g, seat);
  const size = g.pozzetti[0].length;
  p.hand = g.pozzetti.shift();
  team.pozzettoTaken = true;
  addLog(g, `${p.name} prende il ${g.cfg.pozzettoName} (${size} carte, ${mode === 'direct' ? 'presa diretta' : 'con lo scarto'})`);
  setEvent(g, { type: 'pozzetto', seat });
  if (g.n === 3 && !g.partnershipFormed) {
    const others = g.teams.filter((t) => t !== team);
    const [a, b] = others;
    a.members.push(...b.members);
    a.melds.push(...b.melds);
    a.pozzettoTaken = a.pozzettoTaken || b.pozzettoTaken;
    g.teams = g.teams.filter((t) => t !== b);
    for (const s of a.members) g.players[s].team = a.id;
    g.partnershipFormed = true;
    addLog(g, `${p.name} ora gioca da solo; ${a.members.map((s) => g.players[s].name).join(' e ')} diventano coppia`);
  }
}

function discard(g, seat, cardId) {
  assertTurn(g, seat, 'play');
  const p = g.players[seat];
  const team = teamOf(g, seat);
  const c = p.hand.find((x) => x.id === cardId);
  if (!c) fail('Carta non presente in mano');
  if (g.turnInfo.singlePickId === cardId) fail('Non puoi riscartare l\'unica carta appena raccolta');
  checkVulnerability(g, seat);

  if (p.hand.length === 1) {
    if (canTakePozzetto(g, team)) {
      removeFromHand(p, [c]);
      g.discard.push(c);
      addLog(g, `${p.name} scarta ${cardName(c)}`);
      takePozzetto(g, seat, 'indirect');
      if (g.lastTurn) return endHand(g, 'stock');
      return nextTurn(g);
    }
    if (canClose(g, team)) {
      if (g.cfg.closeWildForbidden && isWild(c)) fail('Non si può chiudere scartando una matta');
      removeFromHand(p, [c]);
      g.discard.push(c);
      team.closed = true;
      addLog(g, `${p.name} scarta ${cardName(c)} e CHIUDE!`);
      return endHand(g, 'close', seat);
    }
    fail('Non puoi ancora chiudere');
  }
  removeFromHand(p, [c]);
  g.discard.push(c);
  addLog(g, `${p.name} scarta ${cardName(c)}`);
  setEvent(g, { type: 'discard', seat, cardId });
  if (g.lastTurn) return endHand(g, 'stock');
  nextTurn(g);
}

function nextTurn(g) {
  g.turn = (g.turn + 1) % g.n;
  g.phase = 'draw';
  g.snapshot = null;
  g.turnInfo = null;
}

function undo(g, seat) {
  assertTurn(g, seat, 'play');
  if (!g.snapshot) fail('Niente da annullare');
  const snap = JSON.parse(g.snapshot);
  Object.assign(g, snap);
  if (snap.phase === 'draw') { g.snapshot = null; g.turnInfo = null; }
  addLog(g, `${g.players[seat].name} annulla le giocate del turno`);
}

/* ---------------- Fine smazzata ---------------- */

function endHand(g, reason, closerSeat = null) {
  const cfg = g.cfg;
  const noneTaken = g.teams.every((t) => !t.pozzettoTaken);
  const results = g.teams.map((t) => {
    const meldPts = t.melds.reduce((s, m) => s + m.cards.reduce((a, c) => a + cardValue(c, cfg.values), 0), 0);
    const burraco = t.melds.map((m) => meldKind(m, cfg)).filter((k) => k.kind);
    const bonusPts = burraco.reduce((s, k) => s + k.bonus, 0);
    const handPts = t.members.reduce((s, seat) => s + g.players[seat].hand.reduce((a, c) => a + cardValue(c, cfg.values), 0), 0);
    const closePts = t.closed ? cfg.bonus.close : 0;
    const pozPts = !t.pozzettoTaken && !(cfg.noPenaltyIfNoneTaken && noneTaken) ? cfg.bonus.noPozzetto : 0;
    const total = meldPts + bonusPts - handPts + closePts + pozPts;
    return {
      members: t.members.slice(), names: t.members.map((s) => g.players[s].name),
      meldPts, burraco: burraco.map((k) => ({ label: k.label, bonus: k.bonus })), bonusPts,
      handPts: -handPts, closePts, pozPts, total,
    };
  });
  for (const r of results) for (const s of r.members) g.scores[s] += r.total;
  g.phase = 'handEnd';
  g.snapshot = null;
  g.handResult = {
    reason, closer: closerSeat, teams: results, scores: g.scores.slice(),
    hands: g.players.map((p) => p.hand),
  };
  g.history.push({ handNo: g.handNo, teams: results.map((r) => ({ members: r.members, total: r.total })) });
  addLog(g, reason === 'close' ? 'Smazzata chiusa.' : 'Smazzata terminata (tallone esaurito).');
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

/* ---------------- Dispatcher transazionale ---------------- */

function apply(g, seat, action) {
  const backup = JSON.stringify(g);
  try {
    switch (action.type) {
      case 'draw': draw(g, seat); break;
      case 'takePile': takePile(g, seat, action); break;
      case 'meld': meld(g, seat, action.cardIds); break;
      case 'add': addToMeld(g, seat, action.meldId, action.cardIds); break;
      case 'discard': discard(g, seat, action.cardId); break;
      case 'undo': undo(g, seat); break;
      default: fail('Azione sconosciuta');
    }
  } catch (e) {
    const restored = JSON.parse(backup);
    for (const k of Object.keys(g)) delete g[k];
    Object.assign(g, restored);
    throw e;
  }
}

/** Prova un'azione su una copia: true se legale */
function isLegal(g, seat, action) {
  const copy = JSON.parse(JSON.stringify(g));
  try { apply(copy, seat, action); return copy; } catch (e) { return null; }
}

/* ---------------- Vista per giocatore ---------------- */

function viewFor(g, seat) {
  const cfg = g.cfg;
  const pileVisible = cfg.pile === 'open' ? g.discard : g.discard.slice(-1);
  return {
    cfg: {
      rules: cfg.rules, pile: cfg.pile, pozzettoName: cfg.pozzettoName, burracoName: cfg.burracoName,
      target: cfg.target, allowSets: cfg.allowSets, values: cfg.values,
      closeNeeds: cfg.closeNeeds, vulnerability: cfg.vulnerability,
    },
    n: g.n, you: seat, handNo: g.handNo, dealer: g.dealer,
    players: g.players.map((p) => ({ seat: p.seat, name: p.name, isBot: p.isBot, team: p.team, handCount: p.hand.length })),
    hand: seat >= 0 && g.players[seat] ? g.players[seat].hand : [],
    teams: g.teams.map((t) => ({
      id: t.id, members: t.members, pozzettoTaken: t.pozzettoTaken, closed: t.closed,
      canClose: canClose(g, t),
      melds: t.melds.map((m) => ({ id: m.id, type: m.type, cards: m.cards, wild: m.wild, length: m.length, ...meldKind(m, cfg) })),
    })),
    stockCount: g.stock.length,
    discard: pileVisible, discardCount: g.discard.length,
    pozzetti: g.pozzetti.map((p) => p.length),
    turn: g.turn, phase: g.phase, lastTurn: g.lastTurn,
    mustDraw: g.pileTakeStreak >= 4 && g.stock.length > 0,
    canUndo: !!g.snapshot && g.turn === seat && g.phase === 'play',
    singlePickId: g.turnInfo ? g.turnInfo.singlePickId : null,
    scores: g.scores, history: g.history,
    handResult: g.handResult, over: g.over, winners: g.winners,
    partnershipFormed: g.partnershipFormed,
    log: g.log.slice(-25), lastEvent: g.lastEvent,
  };
}

module.exports = {
  GameError, createGame, apply, isLegal, viewFor, nextHand,
  analyzeMeld, analyzeSequence, analyzeSet, meldKind, cardValue, cardName,
  isWild, isJoker, teamOf, canClose, canTakePozzetto, buildCfg,
};
