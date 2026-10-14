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
const { partitionMelds } = require('../shared/melds');

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

/**
 * Da vulnerabili (senza giochi calati) la prima calata deve valere almeno il minimo:
 * cerca fino a 3 combinazioni separate che insieme ci arrivino e le cala in un colpo solo.
 */
function vulnerableOpening(g, seat, hand) {
  const vul = g.cfg.vulnerability;
  const team = E.teamOf(g, seat);
  if (!vul || team.melds.length) return null;
  if (Math.max(...team.members.map((x) => g.scores[x])) < g.cfg.target * vul.ratio) return null;
  const byId = new Map(hand.map((c) => [c.id, c]));
  const value = (ids) => ids.reduce((sum, id) => sum + E.cardValue(byId.get(id), g.cfg.values), 0);
  const cands = [...naturalMeldCandidates(g, hand), ...wildMeldCandidates(g, hand)]
    .map((ids) => ({ ids, v: value(ids) }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 14);
  const disjoint = (...lists) => new Set(lists.flat()).size === lists.reduce((n, l) => n + l.length, 0);
  const options = [];
  for (let i = 0; i < cands.length; i++) {
    options.push([cands[i]]);
    for (let j = i + 1; j < cands.length; j++) {
      if (!disjoint(cands[i].ids, cands[j].ids)) continue;
      options.push([cands[i], cands[j]]);
      for (let k = j + 1; k < cands.length; k++) {
        if (disjoint(cands[i].ids, cands[j].ids, cands[k].ids)) options.push([cands[i], cands[j], cands[k]]);
      }
    }
  }
  const good = options
    .map((o) => ({ ids: o.flatMap((x) => x.ids), v: o.reduce((n, x) => n + x.v, 0) }))
    .filter((o) => o.v >= vul.min)
    .sort((a, b) => a.ids.length - b.ids.length || b.v - a.v); // meno carte possibile: si tengono le altre per dopo
  for (const o of good.slice(0, 40)) {
    const a = { type: 'meld', cardIds: o.ids };
    if (E.isLegal(g, seat, a)) return a;
  }
  return null;
}

/**
 * Pianificatore di chiusura: se la squadra può chiudere (o prendere il pozzetto),
 * cerca una carta da scartare tale che tutte le altre si possano attaccare ai giochi
 * o calare insieme. Restituisce la prima mossa del piano, oppure null.
 */
function closingAction(g, seat, hand) {
  const team = E.teamOf(g, seat);
  const pozzetto = E.canTakePozzetto(g, team);
  if (!(pozzetto || E.canClose(g, team)) || hand.length < 2 || hand.length > 12) return null;
  const forbidWild = !pozzetto && g.cfg.closeWildForbidden;
  const discards = hand.filter((c) => !(forbidWild && E.isWild(c)))
    .sort((a, b) => keepScore(g, seat, a) - keepScore(g, seat, b))
    .slice(0, 5);
  for (const d of discards) {
    // simulazione leggera: solo le carte dei giochi, senza copiare la partita
    const melds = team.melds.map((m) => ({ id: m.id, type: m.type, cards: m.cards.slice() }));
    let rest = hand.filter((c) => c.id !== d.id);
    let first = null;
    let progress = true;
    while (progress && rest.length) {
      progress = false;
      for (const c of rest.slice().sort((a, b) => E.isWild(a) - E.isWild(b))) {
        const m = melds.find((mm) => E.analyzeMeld(mm.cards.concat([c]), g.cfg, mm.type));
        if (!m) continue;
        m.cards.push(c);
        first = first || { type: 'add', meldId: m.id, cardIds: [c.id] };
        rest = rest.filter((x) => x.id !== c.id);
        progress = true;
        break;
      }
    }
    let plan = null;
    if (!rest.length) plan = first;
    else if (rest.length >= 3 && partitionMelds(rest, g.cfg)) plan = first || { type: 'meld', cardIds: rest.map((c) => c.id) };
    // solo la prima mossa del piano passa dal motore (con tutte le regole)
    if (plan && E.isLegal(g, seat, plan)) return plan;
  }
  return null;
}

function tryActions(g, seat, actions) {
  for (const a of actions) if (E.isLegal(g, seat, a)) return a;
  return null;
}

const strongLevel = (level) => level === 'difficile' || level === 'esperto';

/** Carte che un giocatore ha raccolto dagli scarti e ha ancora in mano (informazione pubblica: tutti le hanno viste) */
function knownCards(g, seat) {
  const ids = new Set((g.known && g.known[seat]) || []);
  return g.players[seat].hand.filter((c) => ids.has(c.id));
}

/** Il giocatore avversario con meno carte in mano (per capire se sta per chiudere) */
function minOpponentCards(g, seat) {
  const mine = E.teamOf(g, seat);
  return Math.min(...g.players.filter((p) => E.teamOf(g, p.seat) !== mine).map((p) => p.hand.length));
}

function keepScore(g, seat, card, level = 'normale') {
  const hand = g.players[seat].hand;
  const cfg = g.cfg;
  if (E.isWild(card)) return 1000;
  let s = 0;
  if (strongLevel(level)) {
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
  // esperto: ricorda le carte raccolte dagli avversari e non scarta quelle che ci si legano
  if (level === 'esperto') {
    const mine = E.teamOf(g, seat);
    for (const p of g.players) {
      if (E.teamOf(g, p.seat) === mine) continue;
      for (const o of knownCards(g, p.seat)) {
        if (E.isWild(o)) continue;
        if (cfg.allowSets && o.r === card.r) s += 14;
        if (o.s === card.s) { const d = Math.abs(o.r - card.r); if (d === 1) s += 14; else if (d === 2) s += 7; }
      }
    }
    // un avversario sta per chiudere: via le carte che pesano di più
    if (minOpponentCards(g, seat) <= 4) s -= E.cardValue(card, cfg.values) / 2.5;
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
  if (strongLevel(level) && pile.length >= 4) return true;
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

  // fase di gioco: 0) da vulnerabili, apertura da almeno 75 punti con più combinazioni
  const opening = vulnerableOpening(g, seat, hand);
  if (opening) return opening;

  // 0b) se si può chiudere o prendere il pozzetto, segue il piano per arrivarci
  if (level !== 'facile') {
    const closing = closingAction(g, seat, hand);
    if (closing) return closing;
  }

  // 1) attacchi naturali
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
    if (strongLevel(level)) hurry = hurry || E.canClose(g, team) || (!team.pozzettoTaken && hand.length <= 7);
    // esperto: se un avversario sta per chiudere cala le matte per non restare con punti in mano
    if (level === 'esperto') hurry = hurry || minOpponentCards(g, seat) <= 3;
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

/** Tempo "di riflessione" del computer: rapido sulle mosse ovvie, più lento su quelle impegnative */
function thinkMs(g, seat, a, base) {
  const r = (lo, hi) => base * (lo + Math.random() * (hi - lo));
  const handN = g.players[seat].hand.length;
  switch (a.type) {
    case 'draw': return r(0.55, 0.9);
    case 'takePile': return r(0.9, 1.4) + Math.min(g.discard.length, 10) * base * 0.04;
    case 'meld': return r(0.8, 1.2) + (a.cardIds ? a.cardIds.length : 3) * base * 0.12;
    case 'add': return r(0.45, 0.8);
    case 'discard': return handN <= 2 ? r(0.6, 1.0) : r(0.8, 1.5) + (handN >= 10 ? base * 0.2 : 0);
    default: return r(0.8, 1.2);
  }
}

module.exports = { nextAction, thinkMs };
