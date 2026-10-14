'use strict';
/*
 * Computer per la Scopa: valuta ogni carta (e ogni presa possibile) e sceglie la giocata migliore.
 * Premia scope, settebello, denari, sette (primiera) e numero di carte; se non prende, evita di
 * lasciare in tavola somme facili per l'avversario.
 * Difficile/esperto ricordano le carte uscite (prese e tavolo sono pubbliche): sanno se un valore
 * può ancora arrivare e quindi se una scopa avversaria è davvero possibile.
 */
const SC = require('../shared/scopa');
const { thinkMs } = require('./bot');

const strong = (level) => level === 'difficile' || level === 'esperto';

/** carte non ancora viste da questo giocatore, contate per valore (sono in mano agli altri o nel mazzo) */
function unseenByRank(g, seat) {
  const seen = new Set();
  for (const t of g.teams) for (const c of t.taken) seen.add(c.id);
  for (const c of g.table) seen.add(c.id);
  for (const c of g.players[seat].hand) seen.add(c.id);
  const cnt = {};
  for (let r = 1; r <= 10; r++) cnt[r] = 4;
  for (const t of g.teams) for (const c of t.taken) cnt[c.r]--;
  for (const c of g.table) cnt[c.r]--;
  for (const c of g.players[seat].hand) cnt[c.r]--;
  return cnt;
}

/** quanto rischio di regalare una scopa (o una bella presa) con la tavola che lascio */
function danger(table, ctx) {
  if (!table.length) return 0;
  const sum = table.reduce((a, c) => a + c.r, 0);
  let d = 0;
  if (sum <= 10) {
    // con la memoria: se tutte le carte di quel valore sono già uscite la scopa è impossibile
    if (!ctx.unseen || ctx.unseen[sum] > 0) d += ctx.unseen ? 25 + 6 * ctx.unseen[sum] : 40;
  }
  if (table.some((c) => c.s === 'd' && c.r === 7)) d += ctx.unseen ? (ctx.unseen[7] > 0 ? 25 : 0) : 15;
  return d;
}

function scoreTake(card, take, tableAfter, ctx) {
  let s = 10 + take.length * 3;
  const all = [card, ...take];
  if (!tableAfter.length) s += 120; // scopa
  for (const c of all) {
    if (c.s === 'd') s += 6;
    if (c.s === 'd' && c.r === 7) s += 60; // settebello
    if (c.r === 7) s += 12; else if (c.r === 6) s += 6; else if (c.r === 1) s += 5;
  }
  if (ctx.level !== 'facile') s -= danger(tableAfter, ctx);
  return s;
}

function nextAction(g, seat, memo = {}) {
  const level = memo.level || 'normale';
  const ctx = { level, unseen: strong(level) ? unseenByRank(g, seat) : null };
  const hand = g.players[seat].hand;
  if (level === 'facile' && Math.random() < 0.4) {
    // il principiante a volte gioca una carta a caso (prendendo la prima presa possibile)
    const card = hand[Math.floor(Math.random() * hand.length)];
    const opts = SC.captures(card, g.table, g.cfg);
    return opts.length ? { type: 'play', cardId: card.id, take: opts[0].map((c) => c.id) } : { type: 'play', cardId: card.id };
  }
  let best = null;
  for (const card of hand) {
    const opts = SC.captures(card, g.table, g.cfg);
    if (opts.length) {
      for (const take of opts) {
        const ids = new Set(take.map((c) => c.id));
        const after = g.table.filter((c) => !ids.has(c.id));
        const s = scoreTake(card, take, after, ctx) + (level === 'facile' ? Math.random() * 30 : 0);
        if (!best || s > best.s) best = { s, a: { type: 'play', cardId: card.id, take: take.map((c) => c.id) } };
      }
    } else {
      // carta lasciata in tavola: meglio una carta che non regala niente
      const after = g.table.concat([card]);
      let s = -danger(after, ctx) - (card.s === 'd' ? 8 : 0) - (card.r === 7 ? 15 : 0) - (card.s === 'd' && card.r === 7 ? 80 : 0) + (level === 'facile' ? Math.random() * 30 : 0);
      s -= card.r === 1 ? 4 : 0;
      // con la memoria: meglio lasciare un valore di cui l'avversario ha poche carte (non me la riprende)
      if (ctx.unseen) s -= ctx.unseen[card.r] * 2;
      if (!best || s > best.s) best = { s, a: { type: 'play', cardId: card.id } };
    }
  }
  return best.a;
}

module.exports = { nextAction, thinkMs };
