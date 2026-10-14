'use strict';
/*
 * Computer per la Scala 40. Decide un'azione alla volta (come il computer del Burraco):
 *   pesca → (apre / cala / attacca / recupera jolly) → scarta.
 * Livelli: facile sbaglia ogni tanto lo scarto; gli altri giocano al meglio delle euristiche.
 */
const E = require('./scala40');
const S40 = require('../shared/scala40');
const { thinkMs } = require('./bot');

const isJ = S40.isJoker;

/** Combinazioni naturali possibili in mano: tris/poker (semi diversi) e scale massime per seme */
function naturalCandidates(hand) {
  const out = [];
  const byRank = new Map();
  for (const c of hand) if (!isJ(c)) { if (!byRank.has(c.r)) byRank.set(c.r, new Map()); const m = byRank.get(c.r); if (!m.has(c.s)) m.set(c.s, c); }
  for (const m of byRank.values()) if (m.size >= 3) out.push([...m.values()].slice(0, 4));
  for (const s of ['S', 'H', 'D', 'C']) {
    const slot = new Map();
    for (const c of hand) if (!isJ(c) && c.s === s) for (const p of c.r === 1 ? [1, 14] : [c.r]) if (!slot.has(p)) slot.set(p, c);
    let run = [];
    for (let p = 1; p <= 15; p++) {
      if (slot.has(p) && !(p === 14 && run.length && run[0] === slot.get(14))) run.push(slot.get(p));
      else { if (run.length >= 3) out.push(run.slice(0, 13)); run = []; }
    }
  }
  return out;
}

/** Combinazioni con un jolly: coppie di semi diversi + jolly, due carte vicine dello stesso seme + jolly */
function jokerCandidates(hand) {
  const jokers = hand.filter(isJ);
  if (!jokers.length) return [];
  const j = jokers[0];
  const nat = hand.filter((c) => !isJ(c));
  const out = [];
  for (let a = 0; a < nat.length; a++) {
    for (let b = a + 1; b < nat.length; b++) {
      const x = nat[a], y = nat[b];
      if (x.r === y.r && x.s !== y.s) out.push([x, y, j]);
      if (x.s === y.s) {
        const d = Math.abs(x.r - y.r);
        if (d === 1 || d === 2 || (x.r === 1 && y.r >= 12) || (y.r === 1 && x.r >= 12)) out.push([x, y, j]);
      }
    }
  }
  return out;
}

/** Sceglie giochi disgiunti con il massimo dei punti; restituisce { cards, pts } */
function bestOpening(cfg, hand, mustInclude = null) {
  const cands = naturalCandidates(hand).concat(jokerCandidates(hand))
    .map((cards) => ({ cards, an: S40.analyzeMeld(cards, cfg) })).filter((x) => x.an)
    .sort((a, b) => b.an.points - a.an.points);
  let best = null;
  const n = Math.min(cands.length, 12);
  // ricerca limitata: combinazioni di al massimo 4 giochi tra i migliori 12
  const rec = (start, used, picked, pts) => {
    if (picked.length && (!best || pts > best.pts)) {
      const ids = picked.flatMap((x) => x.cards.map((c) => c.id));
      if (ids.length < hand.length && (!mustInclude || ids.includes(mustInclude))) best = { cards: picked.flatMap((x) => x.cards), pts };
    }
    if (picked.length >= 4) return;
    for (let i = start; i < n; i++) {
      const c = cands[i];
      if (c.cards.some((x) => used.has(x.id))) continue;
      const u = new Set(used); for (const x of c.cards) u.add(x.id);
      rec(i + 1, u, picked.concat([c]), pts + c.an.points);
    }
  };
  rec(0, new Set(), [], 0);
  return best;
}

function tryActions(g, seat, actions) { for (const a of actions) if (E.isLegal(g, seat, a)) return a; return null; }

function allMelds(g) { return g.teams.flatMap((t) => t.melds); }

/** Quanto conviene tenere una carta (più alto = tenere) */
function keepScore(g, seat, card, level) {
  if (isJ(card)) return 1000;
  const hand = g.players[seat].hand;
  let s = 0;
  for (const o of hand) {
    if (o.id === card.id || isJ(o)) continue;
    if (o.r === card.r && o.s !== card.s) s += 10;
    if (o.s === card.s) { const d = Math.abs(o.r - card.r); if (d === 1) s += 10; else if (d === 2) s += 5; }
  }
  // non passare al giocatore successivo una carta che attacca ai giochi sul tavolo
  let next = (seat + 1) % g.n;
  while (g.players[next].out && next !== seat) next = (next + 1) % g.n;
  if (E.teamOf(g, next).opened && allMelds(g).some((m) => S40.analyzeMeld(m.cards.concat([card]), g.cfg, m.type))) s += level === 'facile' ? 0 : 15;
  // un avversario sta per chiudere: via le carte pesanti
  const minOpp = Math.min(...g.players.filter((p) => p.seat !== seat && !p.out).map((p) => p.hand.length));
  s -= S40.handValue(card) / (minOpp <= 3 ? 1.5 : 5);
  return s;
}

function nextAction(g, seat, memo = {}) {
  const level = memo.level || 'normale';
  const p = g.players[seat];
  const team = E.teamOf(g, seat);
  const cfg = g.cfg;
  const top = g.discard[g.discard.length - 1];

  if (g.phase === 'draw') {
    if (top) {
      if (!team.opened && cfg.pileNeedsOpen) {
        const op = bestOpening(cfg, p.hand.concat([top]), top.id);
        if (op && op.pts >= cfg.opening) {
          const a = { type: 'takePile', cardIds: op.cards.filter((c) => c.id !== top.id).map((c) => c.id) };
          if (E.isLegal(g, seat, a)) return a;
        }
      } else if (!isJ(top) || team.opened) {
        const useful = isJ(top)
          || (team.opened && allMelds(g).some((m) => S40.analyzeMeld(m.cards.concat([top]), cfg, m.type)))
          || naturalCandidates(p.hand.concat([top])).some((cs) => cs.some((c) => c.id === top.id));
        if (useful && E.isLegal(g, seat, { type: 'takePile' })) return { type: 'takePile' };
      }
    }
    return { type: 'draw' };
  }

  // fase di gioco
  if (!team.opened) {
    const op = bestOpening(cfg, p.hand);
    if (op && op.pts >= cfg.opening) {
      const a = { type: 'meld', cardIds: op.cards.map((c) => c.id) };
      if (E.isLegal(g, seat, a)) return a;
    }
  } else {
    // 1) nuovi giochi naturali, poi con il jolly se la mano è corta
    let a = tryActions(g, seat, naturalCandidates(p.hand).map((cs) => ({ type: 'meld', cardIds: cs.map((c) => c.id) })));
    if (a) return a;
    // 2) recupero dei jolly dal tavolo
    if (cfg.swapJoker) {
      const swaps = [];
      for (const m of allMelds(g)) if (m.wild.some(Boolean)) for (const c of p.hand) if (!isJ(c)) swaps.push({ type: 'swap', meldId: m.id, cardId: c.id });
      a = tryActions(g, seat, swaps);
      if (a) return a;
    }
    // 3) attacchi a qualsiasi gioco sul tavolo
    const adds = [];
    for (const c of p.hand.filter((x) => !isJ(x))) for (const m of allMelds(g)) adds.push({ type: 'add', meldId: m.id, cardIds: [c.id] });
    a = tryActions(g, seat, adds);
    if (a) return a;
    if (p.hand.length <= 6 || level !== 'facile') {
      a = tryActions(g, seat, jokerCandidates(p.hand).map((cs) => ({ type: 'meld', cardIds: cs.map((c) => c.id) })));
      if (a) return a;
      const jokers = p.hand.filter(isJ);
      if (jokers.length && p.hand.length <= 4) {
        a = tryActions(g, seat, allMelds(g).map((m) => ({ type: 'add', meldId: m.id, cardIds: [jokers[0].id] })));
        if (a) return a;
      }
    }
  }

  // scarto
  let order = p.hand.slice().sort((x, y) => keepScore(g, seat, x, level) - keepScore(g, seat, y, level));
  if (level === 'facile' && order.length > 2 && Math.random() < 0.4) order = [order[1], order[0], ...order.slice(2)];
  const a = tryActions(g, seat, order.map((c) => ({ type: 'discard', cardId: c.id })));
  return a || { type: 'discard', cardId: order[0].id };
}

module.exports = { nextAction, thinkMs };
