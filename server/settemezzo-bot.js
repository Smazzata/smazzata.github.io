'use strict';
/*
 * Computer per il Sette e mezzo.
 * Facile/normale chiedono carta finché sono sotto una soglia (4 o 5 punti).
 * Difficile/esperto contano le carte che non vedono: chiedono carta se il rischio di sballare è basso;
 * da banco confrontano "mi fermo" con "chiedo un'altra carta" stimando le carte coperte degli altri.
 */
const SM = require('../shared/settemezzo');
const { thinkMs } = require('./bot');

/** carte che questo giocatore non vede (mazzo + carte coperte degli altri) */
function unseen(g, seat) {
  const vis = new Set(g.players[seat].hand.map((c) => c.id));
  for (const p of g.players) if (p.seat !== seat) p.hand.forEach((c, i) => { if (i > 0 || p.status === 'bust') vis.add(c.id); });
  const pool = [];
  for (const s of ['d', 'c', 's', 'b']) for (let r = 1; r <= 10; r++) {
    const id = ['d', 'c', 's', 'b'].indexOf(s) * 10 + (r - 1);
    if (!vis.has(id)) pool.push({ id, r, s });
  }
  return pool;
}

const bustChance = (hand, pool, cfg) => pool.filter((c) => SM.total(hand.concat([c]), cfg) > 7.5).length / Math.max(1, pool.length);

/** guadagno atteso del banco se si ferma con il punteggio bt (le carte coperte degli altri sono sconosciute) */
function bankerValue(g, bt, pool) {
  let v = 0;
  for (const p of g.players) {
    if (p.seat === g.banker || p.status === 'bust') continue;
    const visible = p.hand.slice(1);
    let ev = 0, n = 0;
    // chi si ferma di solito ha almeno 4 e mezzo: le carte coperte che darebbero meno sono poco probabili
    const plausible = pool.filter((c) => { const t = SM.total([c, ...visible], g.cfg); return t <= 7.5 && t >= 4.5; });
    for (const c of plausible.length ? plausible : pool) {
      const t = SM.total([c, ...visible], g.cfg);
      if (t > 7.5) continue; // carta coperta impossibile: chi si è fermato non ha sballato
      n++;
      if (bt > 7.5) ev -= SM.reale([c, ...visible], g.cfg) ? 2 : 1;
      else if (t > bt) ev -= SM.reale([c, ...visible], g.cfg) ? 2 : 1;
      else ev += 1;
    }
    v += ev / Math.max(1, n);
  }
  return v;
}

function nextAction(g, seat, memo = {}) {
  const level = memo.level || 'normale';
  const me = g.players[seat];
  const t = SM.total(me.hand, g.cfg);
  const pool = unseen(g, seat);
  const banker = seat === g.banker;
  if (level === 'facile' || level === 'normale') {
    const limit = level === 'facile' ? 3.5 + Math.random() * 2 : 5;
    // da banco anche il normale guarda le carte scoperte: se qualcuno lo batte sicuramente, rischia
    const beaten = banker && g.players.some((p) => p.seat !== seat && p.status === 'stand' && SM.total(p.hand.slice(1), g.cfg) > t);
    return { type: (t < limit || (beaten && t < 7)) ? 'draw' : 'stand' };
  }
  if (!banker) {
    const risk = bustChance(me.hand, pool, g.cfg);
    return { type: t <= 4 || (t < 6.5 && risk <= (level === 'esperto' ? 0.38 : 0.34)) ? 'draw' : 'stand' };
  }
  // banco: confronto tra fermarsi e chiedere una carta (e poi fermarsi)
  const stay = bankerValue(g, t, pool);
  let draw = 0;
  for (const c of pool) draw += bankerValue(g, SM.total(me.hand.concat([c]), g.cfg), pool.filter((x) => x !== c));
  draw /= Math.max(1, pool.length);
  return { type: draw > stay ? 'draw' : 'stand' };
}

module.exports = { nextAction, thinkMs };
