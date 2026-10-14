'use strict';
/*
 * Computer per il Rubamazzetto: valuta ogni carta. Rubare un mazzetto alto vale più di tutto; poi prendere dal tavolo.
 * Ogni presa mette in cima al mio mazzetto la carta giocata: se quel valore è ancora "in giro" un avversario può
 * rubarmi tutto, quindi conviene lasciare in cima un valore le cui carte sono già uscite.
 * Normale: conta solo le carte che vede adesso (tavolo, carte in cima, la sua mano);
 * difficile/esperto: ricordano anche tutte le carte finite nei mazzetti (sono passate sul tavolo, le hanno viste tutti).
 */
const RM = require('../shared/rubamazzetto');
const { thinkMs } = require('./bot');

/** quante carte di ogni valore possono ancora essere in mano agli altri o nel mazzo */
function outstanding(g, seat, memory) {
  const left = {};
  for (let r = 1; r <= 10; r++) left[r] = 4;
  const seen = [...g.table, ...g.players[seat].hand];
  for (const t of g.teams) {
    if (memory) seen.push(...t.taken);
    else if (t.taken.length) seen.push(t.taken[t.taken.length - 1]);
  }
  for (const c of seen) left[c.r]--;
  return left;
}

function nextAction(g, seat, memo = {}) {
  const level = memo.level || 'normale';
  const hand = g.players[seat].hand;
  if (level === 'facile' && Math.random() < 0.4) return { type: 'play', cardId: hand[Math.floor(Math.random() * hand.length)].id };
  const left = outstanding(g, seat, level === 'difficile' || level === 'esperto');
  const unseen = Math.max(1, Object.values(left).reduce((a, b) => a + Math.max(0, b), 0));
  const othersCards = g.players.filter((p) => p.seat !== seat).reduce((a, p) => a + p.hand.length, 0) || 3;
  // probabilità (circa) che qualcuno abbia in mano una carta di quel valore
  const risk = (r) => 1 - Math.pow(1 - Math.max(0, left[r]) / unseen, othersCards);
  const piles = g.teams.map((t) => t.taken);
  let best = null;
  for (const card of hand) {
    const opts = RM.moves(card, g.table, piles, seat);
    const steal = opts.filter((o) => o.kind === 'steal').sort((a, b) => b.gain - a.gain)[0];
    const move = steal || opts.find((o) => o.kind === 'table');
    let s;
    if (move) {
      const after = piles[seat].length + move.gain;
      s = move.gain * 10 - after * risk(card.r) * 8;
    } else {
      // carta lasciata in tavola: meglio un valore che gli altri difficilmente hanno (non la prendono)
      s = -4 - risk(card.r) * 6;
      // tenere in mano le carte uguali alla cima dei mazzetti altrui (serviranno per rubare)
      if (piles.some((p, i) => i !== seat && p.length && p[p.length - 1].r === card.r)) s -= 20;
    }
    if (level === 'facile') s += Math.random() * 15;
    if (!best || s > best.s) best = { s, a: { type: 'play', cardId: card.id, ...(steal ? { steal: steal.from } : {}) } };
  }
  return best.a;
}

module.exports = { nextAction, thinkMs };
