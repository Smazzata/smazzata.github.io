'use strict';
/*
 * Computer per la Briscola. Se apre il giro gioca una carta "liscia" (senza punti, non briscola);
 * se risponde: prende quando conviene (con la carta più economica), carica se prende il compagno,
 * altrimenti "liscia". Le briscole si usano solo per prese che valgono.
 */
const BR = require('../shared/briscola');
const { thinkMs } = require('./bot');

const cost = (c, trump) => BR.points(c) * 2 + BR.strength(c) + (c.s === trump ? 30 : 0);

function nextAction(g, seat, memo = {}) {
  const level = memo.level || 'normale';
  const hand = g.players[seat].hand.slice();
  const trump = g.trump.s;
  const cheapest = (cards) => cards.slice().sort((a, b) => cost(a, trump) - cost(b, trump))[0];
  if (level === 'facile' && Math.random() < 0.3) return { type: 'play', cardId: hand[Math.floor(Math.random() * hand.length)].id };
  if (!g.trick.length) return { type: 'play', cardId: cheapest(hand).id };
  const trick = g.trick.map((x) => x.card);
  const curWin = g.trick[BR.winner(trick, trump)].seat;
  const partnerWins = g.n === 4 && (curWin + 2) % 4 === seat;
  const worth = trick.reduce((s, c) => s + BR.points(c), 0);
  const last = g.trick.length === g.n - 1;
  if (partnerWins && last) {
    // il compagno prende: si "carica" (la carta con più punti che non sia una briscola alta)
    const loads = hand.filter((c) => c.s !== trump).sort((a, b) => BR.points(b) - BR.points(a));
    return { type: 'play', cardId: (loads[0] || cheapest(hand)).id };
  }
  // carte che vincerebbero la presa
  const winning = hand.filter((c) => BR.winner(trick.concat([c]), trump) === trick.length);
  if (winning.length && !partnerWins) {
    const w = cheapest(winning);
    const useTrump = w.s === trump;
    if (!useTrump || worth + BR.points(w) >= 10 || (last && worth >= 4)) return { type: 'play', cardId: w.id };
  }
  return { type: 'play', cardId: cheapest(hand).id };
}

module.exports = { nextAction, thinkMs };
