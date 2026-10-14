'use strict';
/*
 * Giocatore artificiale: valuta le mosse provandole su una copia dello stato
 * (engine.isLegal) e sceglie con euristiche. Tre livelli (memo.level):
 *  - facile: raccoglie solo scarti utili subito, usa poco le matte, scarta in modo approssimativo
 *  - normale: euristiche di base
 *  - difficile: raccoglie volentieri, tiene le matte per i burraco, accelera verso pozzetto
 *    e chiusura, scarta evitando di alimentare il monte per gli avversari
 * nextAction restituisce UNA azione alla volta, così il server può animarle.
 */
const E = require('./engine');

function teamMelds(g, seat) {
  return E.teamOf(g, seat).melds;
}

function opponentMelds(g, seat) {
  const mine = E.teamOf(g, seat);
  return g.teams.filter((t) => t !== mine).flatMap((t) => t.melds);
}

/** Possibili nuove combinazioni naturali in mano (tris e scale) */
function naturalMeldCandidates(g, hand) {
  const cfg = g.cfg;
  const out = [];
  const nat = hand.filter((c) => !E.isWild(c));
  if (cfg.allowSets) {
    const byRank = new Map();
    for (const c of nat) {
      if (!byRank.has(c.r)) byRank.set(c.r, []);
      byRank.get(c.r).push(c);
    }
    for (const cards of byRank.values()) if (cards.length >= 3) out.push(cards.map((c) => c.id));
  }
  for (const s of ['S', 'H', 'D', 'C']) {
    const bySlot = new Map();
    for (const c of nat.filter((x) => x.s === s)) {
      const slots = c.r === 1 ? [1, 14] : [c.r];
      for (const p of slots) if (!bySlot.has(p)) bySlot.set(p, c);
    }
    // naturali 2 del seme come carta naturale
    const two = hand.find((c) => c.r === 2 && c.s === s);
    if (two && !bySlot.has(2)) bySlot.set(2, two);
    let run = [];
    for (let p = 1; p <= 15; p++) {
      const c = bySlot.get(p);
      if (c && !run.some((x) => x.id === c.id)) run.push(c);
      else {
        if (run.length >= 3) out.push(run.map((x) => x.id));
        run = c ? [c] : [];
      }
    }
  }
  return out.sort((a, b) => b.length - a.length);
}

/** Combinazioni con una matta: coppie / quasi-scale + matta */
function wildMeldCandidates(g, hand) {
  const cfg = g.cfg;
  const wilds = hand.filter(E.isWild).sort((a, b) => (E.isJoker(a) ? 1 : 0) - (E.isJoker(b) ? 1 : 0));
  if (!wilds.length) return [];
  const w = wilds[0];
  const nat = hand.filter((c) => !E.isWild(c));
  const out = [];
  for (let i = 0; i < nat.length; i++) {
    for (let j = i + 1; j < nat.length; j++) {
      const a = nat[i], b = nat[j];
      if (a.id === b.id) continue;
      const ids = [a.id, b.id, w.id];
      const cards = [a, b, w];
      if (E.analyzeMeld(cards, cfg)) out.push(ids);
    }
  }
  return out;
}

function tryActions(g, seat, actions) {
  for (const a of actions) if (E.isLegal(g, seat, a)) return a;
  return null;
}

function keepScore(g, seat, card, level = 'normale') {
  const hand = g.players[seat].hand;
  const cfg = g.cfg;
  if (E.isWild(card)) return 1000;
  let s = 0;
  if (level === 'difficile') {
    // il monte va all'avversario successivo: non dargli carte che legano con quelle già scartate
    for (const o of g.discard) {
      if (E.isWild(o)) continue;
      if (cfg.allowSets && o.r === card.r) s += 6;
      if (o.s === card.s && Math.abs(o.r - card.r) === 1) s += 6;
    }
    // più carte nel monte = scarto più pericoloso: meglio liberarsi di carte "morte"
    if (g.discard.length >= 5) s += 4;
  }
  for (const o of hand) {
    if (o.id === card.id || E.isWild(o)) continue;
    if (cfg.allowSets && o.r === card.r) s += 12;
    if (o.s === card.s) {
      const d = Math.abs(o.r - card.r);
      const d2 = card.r === 1 || o.r === 1 ? Math.min(d, Math.abs((o.r === 1 ? 14 : o.r) - (card.r === 1 ? 14 : card.r))) : d;
      if (d2 === 1) s += 10; else if (d2 === 2) s += 5;
    }
  }
  // non regalare carte che servono agli avversari (raccoglierebbero lo scarto)
  for (const m of opponentMelds(g, seat)) {
    if (E.analyzeMeld(m.cards.concat([card]), cfg, m.type)) s += 25;
  }
  // carte che servono ai nostri giochi: meglio tenerle (non attaccate solo per vincoli)
  for (const m of teamMelds(g, seat)) {
    if (E.analyzeMeld(m.cards.concat([card]), cfg, m.type)) s += 8;
  }
  // a parità, meglio liberarsi delle carte di valore alto
  s -= E.cardValue(card, cfg.values) / 5;
  return s;
}

function pileIsUseful(g, seat, level = 'normale') {
  const pile = g.discard;
  if (!pile.length) return false;
  const top = pile[pile.length - 1];
  const hand = g.players[seat].hand;
  const cfg = g.cfg;
  if (E.isWild(top)) return true;
  for (const m of teamMelds(g, seat)) if (E.analyzeMeld(m.cards.concat([top]), cfg, m.type)) return true;
  if (level === 'facile' && Math.random() < 0.5) return false;
  if (level === 'difficile' && pile.length >= 4) return true;
  const after = hand.concat(pile);
  const cands = naturalMeldCandidates(g, after);
  const pileIds = new Set(pile.map((c) => c.id));
  return cands.some((ids) => ids.some((id) => pileIds.has(id)) && ids.some((id) => !pileIds.has(id))) || pile.length >= 6;
}

function closedPileAction(g, seat) {
  const pile = g.discard;
  if (!pile.length) return null;
  const top = pile[pile.length - 1];
  const hand = g.players[seat].hand;
  const actions = [];
  if (!E.isWild(top)) {
    for (const m of teamMelds(g, seat)) actions.push({ type: 'takePile', meldId: m.id, cardIds: [] });
  }
  const nat = hand.filter((c) => !E.isWild(c));
  for (let i = 0; i < nat.length; i++) for (let j = i + 1; j < nat.length; j++) {
    if (E.analyzeMeld([top, nat[i], nat[j]], g.cfg)) actions.push({ type: 'takePile', cardIds: [nat[i].id, nat[j].id] });
  }
  return tryActions(g, seat, actions);
}

function nextAction(g, seat, memo = {}) {
  const p = g.players[seat];
  const cfg = g.cfg;
  const level = memo.level || 'normale';

  if (g.phase === 'draw') {
    const canPile = !memo.noMeld && g.discard.length && !(g.pileTakeStreak >= 4 && g.stock.length);
    if (canPile) {
      if (cfg.pile === 'closed') {
        const a = closedPileAction(g, seat);
        if (a && (g.discard.length >= 2 || Math.random() < 0.7)) return a;
      } else if (pileIsUseful(g, seat, level) && E.isLegal(g, seat, { type: 'takePile' })) {
        return { type: 'takePile' };
      }
    }
    return { type: 'draw' };
  }

  const hand = p.hand;
  if (memo.noMeld) return discardAction(g, seat, hand, memo);

  // fase di gioco: 1) attacchi naturali
  const melds = teamMelds(g, seat);
  const adds = [];
  for (const c of hand.filter((x) => !E.isWild(x))) for (const m of melds) adds.push({ type: 'add', meldId: m.id, cardIds: [c.id] });
  let a = tryActions(g, seat, adds);
  if (a) return a;

  // 2) nuove combinazioni naturali
  a = tryActions(g, seat, naturalMeldCandidates(g, hand).map((ids) => ({ type: 'meld', cardIds: ids })));
  if (a) return a;

  // 3) uso delle matte
  const wild = hand.filter(E.isWild).sort((x, y) => (E.isJoker(x) ? 1 : 0) - (E.isJoker(y) ? 1 : 0))[0];
  if (wild && !(level === 'facile' && hand.length > 6)) {
    const team = E.teamOf(g, seat);
    // completa un burraco
    const toBurraco = melds.filter((m) => m.length === 6 && m.wildCount === 0)
      .map((m) => ({ type: 'add', meldId: m.id, cardIds: [wild.id] }));
    a = tryActions(g, seat, toBurraco);
    if (a) return a;
    let hurry = hand.length <= 5 || (team.pozzettoTaken && !E.canClose(g, team) && hand.length <= 7);
    // difficile: corre verso il pozzetto e, se può chiudere, cala tutto
    if (level === 'difficile') hurry = hurry || E.canClose(g, team) || (!team.pozzettoTaken && hand.length <= 7);
    if (hurry) {
      a = tryActions(g, seat, wildMeldCandidates(g, hand).map((ids) => ({ type: 'meld', cardIds: ids })));
      if (a) return a;
      a = tryActions(g, seat, melds.filter((m) => m.wildCount === 0).map((m) => ({ type: 'add', meldId: m.id, cardIds: [wild.id] })));
      if (a) return a;
    }
  }

  return discardAction(g, seat, hand, memo);
}

function discardAction(g, seat, hand, memo = {}) {
  let a;
  const level = memo.level || 'normale';
  let order = hand.slice().sort((x, y) => keepScore(g, seat, x, level) - keepScore(g, seat, y, level));
  // facile: sceglie a caso tra le carte meno utili, a volte sbagliando
  if (level === 'facile' && order.length > 2) {
    const k = Math.random() < 0.5 ? 0 : Math.min(order.length - 1, 1 + Math.floor(Math.random() * 2));
    order = [order[k], ...order.filter((_, i) => i !== k)];
  }
  a = tryActions(g, seat, order.map((c) => ({ type: 'discard', cardId: c.id })));
  if (a) return a;
  // nessuno scarto legale (es. vulnerabilità): annulla e scarta subito
  if (!memo.noMeld && E.isLegal(g, seat, { type: 'undo' })) { memo.noMeld = true; return { type: 'undo' }; }
  return { type: 'discard', cardId: order[0].id };
}

module.exports = { nextAction };
