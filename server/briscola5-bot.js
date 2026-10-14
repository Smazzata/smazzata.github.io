'use strict';
/*
 * Computer per la Briscola in 5.
 * Asta: valuta la mano (carichi, carte forti e il seme più lungo come futura briscola) e rilancia finché la mano
 * "regge" quel livello. Chiamata: sceglie come briscola il seme migliore e, se possibile, una carta chiamata che
 * non ha (così ha un socio). Gioco: come nella Briscola, sapendo chi sono gli alleati (se si sa) e caricando
 * le prese degli alleati. Difficile/esperto ricordano le carte uscite e caricano solo quando la presa è sicura.
 */
const B5 = require('../shared/briscola5');
const BR = require('../shared/briscola');
const { thinkMs } = require('./bot');

const strong = (level) => level === 'difficile' || level === 'esperto';
const cost = (c, trump) => BR.points(c) * 2 + BR.strength(c) + (c.s === trump ? 30 : 0);

/** forza della mano con un certo seme di briscola */
function handValue(hand, suit) {
  let v = 0;
  for (const c of hand) {
    v += BR.points(c);
    if (c.s === suit) v += 6 + BR.strength(c);
  }
  return v;
}
const bestSuit = (hand) => ['d', 'c', 's', 'b'].map((s) => [s, handValue(hand, s)]).sort((a, b) => b[1] - a[1])[0];

/** fino a che livello d'asta si spinge una mano di questo valore */
function maxLevel(v, level) {
  const bold = level === 'facile' ? -6 : level === 'esperto' ? 4 : 0;
  const x = v + bold;
  if (x >= 95) return 14; // Due a 66
  if (x >= 85) return 9;  // Due
  if (x >= 75) return 7;  // Sei
  if (x >= 66) return 5;  // Sette
  if (x >= 58) return 3;  // Cavallo
  if (x >= 50) return 1;  // Tre
  if (x >= 44) return 0;  // Asso
  return -1;
}

function bidAction(g, seat, level) {
  const hand = g.players[seat].hand;
  const [, v] = bestSuit(hand);
  const next = g.auction.level + 1;
  // chi è rimasto da solo senza offerte deve prendere comunque (ci pensa il motore con il passo)
  if (next <= maxLevel(v, level) && next <= B5.MAX_LEVEL) return { type: 'bid', level: next };
  return { type: 'pass' };
}

function callAction(g, seat) {
  const hand = g.players[seat].hand;
  const rank = B5.bidOf(g.auction.level).rank;
  // tra i semi migliori si preferisce quello in cui la carta chiamata ce l'ha qualcun altro (così si ha un socio)
  const suits = ['d', 'c', 's', 'b'].sort((a, b) => handValue(hand, b) - handValue(hand, a));
  const withPartner = suits.find((s) => !hand.some((c) => c.r === rank && c.s === s) && handValue(hand, s) >= handValue(hand, suits[0]) - 25);
  return { type: 'call', suit: withPartner || suits[0] };
}

/** chi gioca con me: alleato certo (true), avversario certo (false), non si sa (null). Usa solo ciò che il giocatore sa. */
function sideOf(g, seat, other) {
  if (other === seat) return true;
  const caller = g.caller;
  const partner = g.partnerKnown || seat === g.partner ? g.partner : null; // il socio lo conosce solo lui, finché non si scopre
  if (seat === caller) return partner != null && partner !== caller ? other === partner : partner === caller ? false : null;
  if (partner === seat) return other === caller;
  if (other === caller) return false;
  if (partner != null) return other !== partner;
  return null;
}

function playAction(g, seat, level) {
  const hand = g.players[seat].hand;
  const trump = g.trump;
  const cheapest = (cards) => cards.slice().sort((a, b) => cost(a, trump) - cost(b, trump))[0];
  if (level === 'facile' && Math.random() < 0.3) return { type: 'play', cardId: hand[Math.floor(Math.random() * hand.length)].id };
  if (!g.trick.length) return { type: 'play', cardId: cheapest(hand).id };
  const trick = g.trick.map((x) => x.card);
  const wi = BR.winner(trick, trump);
  const curWin = g.trick[wi].seat;
  const allyWins = sideOf(g, seat, curWin) === true && curWin !== seat;
  const last = g.trick.length === 4;
  const worth = trick.reduce((s, c) => s + BR.points(c), 0);
  // dopo di me giocano ancora avversari certi o sconosciuti?
  const after = [];
  for (let k = g.trick.length + 1; k < 5; k++) after.push((g.trick[0].seat + k) % 5);
  const threat = after.some((s) => sideOf(g, seat, s) !== true);
  if (allyWins && (last || (strong(level) ? !threat : true))) {
    const loads = hand.filter((c) => c.s !== trump).sort((a, b) => BR.points(b) - BR.points(a));
    return { type: 'play', cardId: (loads[0] || cheapest(hand)).id };
  }
  const winning = hand.filter((c) => BR.winner(trick.concat([c]), trump) === trick.length);
  if (winning.length && !allyWins) {
    const w = cheapest(winning);
    if (w.s !== trump || worth + BR.points(w) >= 10 || (last && worth >= 4)) return { type: 'play', cardId: w.id };
  }
  return { type: 'play', cardId: cheapest(hand).id };
}

function nextAction(g, seat, memo = {}) {
  const level = memo.level || 'normale';
  if (g.phase === 'bid') return bidAction(g, seat, level);
  if (g.phase === 'call') return callAction(g, seat);
  return playAction(g, seat, level);
}

module.exports = { nextAction, thinkMs };
