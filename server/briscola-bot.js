'use strict';
/*
 * Computer per la Briscola. Se apre il giro gioca una carta "liscia" (senza punti, non briscola);
 * se risponde: prende quando conviene (con la carta più economica), carica se prende il compagno,
 * altrimenti "liscia". Le briscole si usano solo per prese che valgono.
 * Difficile/esperto ricordano le carte uscite: aprono con carichi "sicuri" (le carte più alte del seme
 * sono già passate) e scelgono la carta "guardando avanti": distribuiscono a caso le carte che non hanno
 * ancora visto e giocano molte volte la smazzata fino in fondo, tenendo la carta che vince più spesso.
 */
const BR = require('../shared/briscola');
const { thinkMs } = require('./bot');

const strong = (level) => level === 'difficile' || level === 'esperto';
const cost = (c, trump) => BR.points(c) * 2 + BR.strength(c) + (c.s === trump ? 30 : 0);

/** carte uscite (prese delle squadre e presa in corso): informazione pubblica */
function seenCards(g) {
  const seen = [];
  for (const t of g.teams) seen.push(...t.taken);
  for (const x of g.trick) seen.push(x.card);
  return seen;
}

/** una carta "non può essere battuta" nel suo seme se le più forti di quel seme sono già uscite (o sono mie) */
function topOfSuit(card, g, seat) {
  const out = new Set(seenCards(g).map((c) => `${c.r}${c.s}`));
  for (const c of g.players[seat].hand) out.add(`${c.r}${c.s}`);
  for (let r = 1; r <= 10; r++) {
    const c = { r, s: card.s };
    if (BR.strength(c) > BR.strength(card) && !out.has(`${r}${card.s}`)) return false;
  }
  return true;
}

/** giocata "di istinto" (livelli facile/normale, e partite simulate) */
function heuristic(g, seat, level) {
  const hand = g.players[seat].hand.slice();
  const trump = g.trump.s;
  const cheapest = (cards) => cards.slice().sort((a, b) => cost(a, trump) - cost(b, trump))[0];
  if (level === 'facile' && Math.random() < 0.3) return { type: 'play', cardId: hand[Math.floor(Math.random() * hand.length)].id };
  const smart = strong(level);
  const trumpsOut = smart ? 10 - seenCards(g).filter((c) => c.s === trump).length - hand.filter((c) => c.s === trump).length - (g.stock.length ? 1 : 0) : 5;

  if (!g.trick.length) {
    if (smart) {
      // aprire con un carico "sicuro": Asso/Tre che nessuno può battere nel seme, quando le briscole in giro sono poche
      const safe = hand.filter((c) => c.s !== trump && BR.points(c) >= 10 && topOfSuit(c, g, seat));
      if (safe.length && trumpsOut <= 2) return { type: 'play', cardId: safe[0].id };
      // a mazzo finito: si apre con la briscola più alta se è imbattibile, per fare il punto
      if (!g.stock.length) {
        const topTrump = hand.filter((c) => c.s === trump && topOfSuit(c, g, seat)).sort((a, b) => BR.strength(b) - BR.strength(a))[0];
        if (topTrump && hand.some((c) => BR.points(c) >= 10 && c.s !== trump)) return { type: 'play', cardId: topTrump.id };
      }
    }
    return { type: 'play', cardId: cheapest(hand).id };
  }
  const trick = g.trick.map((x) => x.card);
  const curWin = g.trick[BR.winner(trick, trump)].seat;
  const partnerWins = g.n === 4 && (curWin + 2) % 4 === seat;
  const worth = trick.reduce((s, c) => s + BR.points(c), 0);
  const last = g.trick.length === g.n - 1;
  if (partnerWins && (last || (smart && topOfSuit(trick[BR.winner(trick, trump)], g, seat)))) {
    // il compagno prende: si "carica" (la carta con più punti che non sia una briscola)
    const loads = hand.filter((c) => c.s !== trump).sort((a, b) => BR.points(b) - BR.points(a));
    return { type: 'play', cardId: (loads[0] || cheapest(hand)).id };
  }
  // carte che vincerebbero la presa
  const winning = hand.filter((c) => BR.winner(trick.concat([c]), trump) === trick.length);
  if (winning.length && !partnerWins) {
    const w = cheapest(winning);
    const useTrump = w.s === trump;
    const threshold = smart && !g.stock.length && g.players[seat].hand.length <= 2 ? 2 : 10; // a mazzo finito ogni punto conta
    if (!useTrump || worth + BR.points(w) >= threshold || (last && worth >= 4)) return { type: 'play', cardId: w.id };
  }
  return { type: 'play', cardId: cheapest(hand).id };
}

/* ---------- Guardare avanti: partite simulate ---------- */
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** uno stato "possibile": le carte che non vedo sono distribuite a caso tra le mani degli altri e il mazzo */
function determinize(g, seat) {
  const known = new Set(g.players[seat].hand.map((c) => c.id));
  for (const t of g.teams) for (const c of t.taken) known.add(c.id);
  for (const x of g.trick) known.add(x.card.id);
  if (g.stock.length) known.add(g.trump.id); // la briscola scoperta è in fondo al mazzo
  const pool = [];
  for (const s of ['d', 'c', 's', 'b']) for (let r = 1; r <= 10; r++) pool.push({ r, s });
  // gli id veri delle carte: li prendo dalle carte note, gli altri si inventano (servono solo per distinguerle)
  const all = [...g.players[seat].hand, ...g.teams.flatMap((t) => t.taken), ...g.trick.map((x) => x.card), g.trump];
  const key = (c) => c.r + c.s;
  const seenKeys = new Set(all.filter((c) => known.has(c.id)).map(key));
  const unseen = shuffle(pool.filter((c) => !seenKeys.has(key(c))).map((c, i) => ({ id: 1000 + i, ...c })));
  const sim = {
    n: g.n, trump: g.trump, turn: g.turn,
    players: g.players.map((p, i) => ({ hand: i === seat ? p.hand.slice() : unseen.splice(0, p.hand.length) })),
    trick: g.trick.slice(), stock: g.stock.length ? [g.trump, ...unseen] : [],
    teams: g.teams.map((t) => ({ members: t.members, taken: [], pts: t.taken.reduce((a, c) => a + BR.points(c), 0) })),
  };
  return sim;
}

function simPlay(sim, cardId) {
  const p = sim.players[sim.turn];
  const card = p.hand.find((c) => c.id === cardId);
  p.hand = p.hand.filter((c) => c !== card);
  sim.trick.push({ seat: sim.turn, card });
  if (sim.trick.length < sim.n) { sim.turn = (sim.turn + 1) % sim.n; return; }
  const w = sim.trick[BR.winner(sim.trick.map((x) => x.card), sim.trump.s)].seat;
  sim.teams.find((t) => t.members.includes(w)).pts += sim.trick.reduce((a, x) => a + BR.points(x.card), 0);
  sim.trick = [];
  for (let k = 0; k < sim.n && sim.stock.length; k++) sim.players[(w + k) % sim.n].hand.push(sim.stock.pop());
  sim.turn = w;
}

/** valore di una smazzata finita per la mia squadra: soprattutto vincerla, poi i punti di scarto */
function simValue(sim, seat) {
  const mine = sim.teams.find((t) => t.members.includes(seat)).pts;
  return (mine > 60 ? 1 : mine < 60 ? -1 : 0) + (mine - 60) / 200;
}

function lookahead(g, seat, samples) {
  const hand = g.players[seat].hand;
  if (hand.length === 1) return { type: 'play', cardId: hand[0].id };
  const total = new Map(hand.map((c) => [c.id, 0]));
  for (let k = 0; k < samples; k++) {
    const base = determinize(g, seat);
    for (const c of hand) {
      const sim = { ...base, players: base.players.map((p) => ({ hand: p.hand.slice() })), trick: base.trick.slice(), stock: base.stock.slice(), teams: base.teams.map((t) => ({ ...t })) };
      simPlay(sim, c.id);
      while (sim.players.some((p) => p.hand.length)) simPlay(sim, heuristic(sim, sim.turn, 'normale').cardId);
      total.set(c.id, total.get(c.id) + simValue(sim, seat));
    }
  }
  let best = hand[0].id;
  for (const c of hand) if (total.get(c.id) > total.get(best)) best = c.id;
  return { type: 'play', cardId: best };
}

function nextAction(g, seat, memo = {}) {
  const level = memo.level || 'normale';
  if (strong(level)) return lookahead(g, seat, level === 'esperto' ? 80 : 40);
  return heuristic(g, seat, level);
}

module.exports = { nextAction, thinkMs };
