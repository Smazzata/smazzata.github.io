'use strict';
/*
 * Computer per la Scopa: valuta ogni carta (e ogni presa possibile) e sceglie la giocata migliore.
 * Premia scope, settebello, denari, sette (primiera) e numero di carte; se non prende, evita di
 * lasciare in tavola somme facili per l'avversario.
 */
const SC = require('../shared/scopa');
const { thinkMs } = require('./bot');

function scoreTake(card, take, tableAfter, level) {
  let s = 10 + take.length * 3;
  const all = [card, ...take];
  if (!tableAfter.length) s += 120; // scopa
  for (const c of all) {
    if (c.s === 'd') s += 6;
    if (c.s === 'd' && c.r === 7) s += 60; // settebello
    if (c.r === 7) s += 12; else if (c.r === 6) s += 6; else if (c.r === 1) s += 5;
  }
  if (level !== 'facile') s -= danger(tableAfter);
  return s;
}

/** quanto è facile per l'avversario fare scopa (o prendere bene) con la tavola che lascio */
function danger(table) {
  if (!table.length) return 0;
  const sum = table.reduce((a, c) => a + c.r, 0);
  let d = 0;
  if (sum <= 10) d += 40; // con una carta sola si pulisce il tavolo
  if (table.some((c) => c.s === 'd' && c.r === 7)) d += 15;
  return d;
}

function nextAction(g, seat, memo = {}) {
  const level = memo.level || 'normale';
  const hand = g.players[seat].hand;
  let best = null;
  for (const card of hand) {
    const opts = SC.captures(card, g.table, g.cfg);
    if (opts.length) {
      for (const take of opts) {
        const ids = new Set(take.map((c) => c.id));
        const after = g.table.filter((c) => !ids.has(c.id));
        const s = scoreTake(card, take, after, level) + (level === 'facile' ? Math.random() * 30 : 0);
        if (!best || s > best.s) best = { s, a: { type: 'play', cardId: card.id, take: take.map((c) => c.id) } };
      }
    } else {
      // carta lasciata in tavola: meglio una carta che non regala niente
      const after = g.table.concat([card]);
      let s = -danger(after) - (card.s === 'd' ? 8 : 0) - (card.r === 7 ? 15 : 0) - (card.s === 'd' && card.r === 7 ? 80 : 0) + (level === 'facile' ? Math.random() * 30 : 0);
      s -= card.r === 1 ? 4 : 0;
      if (!best || s > best.s) best = { s, a: { type: 'play', cardId: card.id } };
    }
  }
  return best.a;
}

module.exports = { nextAction, thinkMs };
