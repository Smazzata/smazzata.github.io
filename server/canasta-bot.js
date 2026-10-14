'use strict';
/*
 * Computer per la Canasta. Un'azione alla volta: pesca (o prende il monte) → apre / cala / attacca → scarta.
 */
const E = require('./canasta');
const C = require('../shared/canasta');
const { thinkMs } = require('./bot');

const tryActions = (g, seat, list) => { for (const a of list) if (E.isLegal(g, seat, a)) return a; return null; };

/** Gruppi di carte naturali dello stesso valore (niente 3) */
function groupsByRank(hand) {
  const m = new Map();
  for (const c of hand) if (!C.isWild(c) && c.r !== 3) { if (!m.has(c.r)) m.set(c.r, []); m.get(c.r).push(c); }
  return m;
}

/** Apertura: gruppi da 2+ naturali, con le matte per arrivare al minimo; restituisce gli id o null */
function opening(g, seat, hand, need, mustInclude = null) {
  const groups = [...groupsByRank(hand).values()].filter((x) => x.length >= 2).sort((a, b) => C.value(b[0]) * b.length - C.value(a[0]) * a.length);
  const wilds = hand.filter(C.isWild).sort((a, b) => C.value(a) - C.value(b));
  const picked = [];
  let pts = 0, w = 0;
  for (const gr of groups) {
    const cards = gr.slice();
    if (cards.length < 3) { if (w >= wilds.length) continue; cards.push(wilds[w++]); }
    picked.push(...cards);
    pts += cards.reduce((s, c) => s + C.value(c), 0);
  }
  while (pts < need && w < wilds.length && picked.length) {
    // altre matte sui gruppi (al massimo maxWild per gruppo: ci pensa il motore a rifiutare se troppe)
    picked.push(wilds[w]); pts += C.value(wilds[w]); w++;
  }
  if (pts < need || picked.length >= hand.length) return null;
  if (mustInclude && !picked.some((c) => c.id === mustInclude)) return null;
  return picked.map((c) => c.id);
}

function keepScore(g, seat, card) {
  if (C.isWild(card)) return 1000;
  if (C.isBlack3(card)) return -60; // il tre nero blocca il monte: ottimo scarto
  const hand = g.players[seat].hand;
  let s = hand.filter((o) => o.id !== card.id && !C.isWild(o) && o.r === card.r).length * 14;
  const mine = E.teamOf(g, seat);
  if (mine.melds.some((m) => m.rank === card.r)) s += 12;
  // non dare agli avversari carte dei valori che hanno già calato
  for (const t of g.teams) if (t !== mine && t.melds.some((m) => m.rank === card.r)) s += 25;
  return s - C.value(card) / 5;
}

function nextAction(g, seat) {
  const p = g.players[seat];
  const team = E.teamOf(g, seat);
  const top = g.discard[g.discard.length - 1];
  const need = C.minimum(g.scores[team.members[0]]);

  if (g.phase === 'draw') {
    if (top && !C.isWild(top) && !C.isBlack3(top) && top.r !== 3) {
      const opts = [];
      const nat = p.hand.filter((c) => !C.isWild(c) && c.r === top.r);
      const m = team.melds.find((x) => x.rank === top.r);
      if (m) opts.push({ type: 'takePile', meldId: m.id });
      if (nat.length >= 2) opts.push({ type: 'takePile', cardIds: nat.map((c) => c.id) });
      if (!team.melds.length) {
        const op = opening(g, seat, p.hand.concat([top]), need, top.id);
        if (op) opts.push({ type: 'takePile', cardIds: op.filter((id) => id !== top.id).filter((id) => p.hand.some((c) => c.id === id && (C.isWild(c) || c.r === top.r))) });
      }
      const wild = p.hand.find(C.isWild);
      if (nat.length === 1 && wild && g.discard.length >= 3) opts.push({ type: 'takePile', cardIds: [nat[0].id, wild.id] });
      const a = tryActions(g, seat, opts);
      if (a) return a;
    }
    return { type: 'draw' };
  }

  if (!team.melds.length) {
    const op = opening(g, seat, p.hand, need);
    if (op) { const a = tryActions(g, seat, [{ type: 'meld', cardIds: op }]); if (a) return a; }
  } else {
    // 1) attacchi naturali ai giochi della squadra
    const adds = [];
    for (const c of p.hand) if (!C.isWild(c)) for (const m of team.melds) if (m.rank === c.r) adds.push({ type: 'add', meldId: m.id, cardIds: [c.id] });
    let a = tryActions(g, seat, adds);
    if (a) return a;
    // 2) nuovi giochi naturali (3+ carte uguali)
    a = tryActions(g, seat, [...groupsByRank(p.hand).values()].filter((x) => x.length >= 3 && !team.melds.some((m) => m.rank === x[0].r)).map((x) => ({ type: 'meld', cardIds: x.map((c) => c.id) })));
    if (a) return a;
    // 3) matte: completano una canasta, o si usano se la mano è corta
    const wild = p.hand.find(C.isWild);
    if (wild) {
      const near = team.melds.filter((m) => m.length === 6);
      a = tryActions(g, seat, near.map((m) => ({ type: 'add', meldId: m.id, cardIds: [wild.id] })));
      if (a) return a;
      if (p.hand.length <= 5) {
        const pairs = [...groupsByRank(p.hand).values()].filter((x) => x.length === 2 && !team.melds.some((m) => m.rank === x[0].r));
        a = tryActions(g, seat, pairs.map((x) => ({ type: 'meld', cardIds: [...x.map((c) => c.id), wild.id] })));
        if (a) return a;
        a = tryActions(g, seat, team.melds.map((m) => ({ type: 'add', meldId: m.id, cardIds: [wild.id] })));
        if (a) return a;
      }
    }
  }
  const order = p.hand.slice().sort((x, y) => keepScore(g, seat, x) - keepScore(g, seat, y));
  const a = tryActions(g, seat, order.map((c) => ({ type: 'discard', cardId: c.id })));
  if (a) return a;
  // nessuno scarto possibile (ultima carta senza canasta): si attacca dove si può
  const any = [];
  for (const c of p.hand) for (const m of team.melds) any.push({ type: 'add', meldId: m.id, cardIds: [c.id] });
  return tryActions(g, seat, any) || { type: 'discard', cardId: order[0].id };
}

module.exports = { nextAction, thinkMs };
