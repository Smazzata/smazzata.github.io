'use strict';
/*
 * Computer per il Tressette. Sceglie sempre tra le carte giocabili (si risponde al seme).
 * Di istinto: apre dal seme più lungo con una carta che vale poco, prende quando la presa vale qualcosa
 * (con la carta più economica che vince), "carica" Asso o figure quando prende il compagno, altrimenti lascia la più bassa.
 * Difficile/esperto guardano avanti: distribuiscono a caso le carte non viste e giocano la smazzata fino in fondo
 * molte volte, scegliendo la carta che porta più punti alla propria squadra.
 */
const TR = require('../shared/tressette');
const { thinkMs } = require('./bot');

const strong = (level) => level === 'difficile' || level === 'esperto';
const cost = (c) => TR.thirds(c) * 10 + TR.strength(c);
const cheapest = (cards) => cards.slice().sort((a, b) => cost(a) - cost(b))[0];

/** giocata "di istinto" */
function heuristic(g, seat, level) {
  const hand = g.players[seat].hand;
  const trick = g.trick.map((x) => x.card);
  const legal = TR.legal(hand, trick);
  if (level === 'facile' && Math.random() < 0.35) return { type: 'play', cardId: legal[Math.floor(Math.random() * legal.length)].id };
  if (!trick.length) {
    // apertura: dal seme più lungo, una carta senza punti (si tengono Tre, Due e Assi)
    const bySuit = {};
    for (const c of hand) (bySuit[c.s] = bySuit[c.s] || []).push(c);
    const suits = Object.keys(bySuit).sort((a, b) => bySuit[b].length - bySuit[a].length);
    for (const s of suits) {
      const low = bySuit[s].filter((c) => TR.thirds(c) === 0);
      if (low.length) return { type: 'play', cardId: low.sort((a, b) => TR.strength(a) - TR.strength(b))[0].id };
    }
    // solo carte di valore: il Tre (imbattibile) prima, poi la più economica
    const three = hand.find((c) => c.r === 3);
    return { type: 'play', cardId: (three || cheapest(hand)).id };
  }
  const bestIdx = TR.winner(trick);
  const curWin = g.trick[bestIdx].seat;
  const partnerWins = g.n === 4 && (curWin + 2) % 4 === seat;
  const last = g.trick.length === g.n - 1;
  const lead = trick[0].s;
  const following = legal[0].s === lead && legal.every((c) => c.s === lead);
  if (partnerWins && (last || TR.strength(trick[bestIdx]) >= 9)) {
    // il compagno prende: si carica la carta che vale di più senza buttare un Tre o un Due che possono vincere da soli
    const loads = legal.filter((c) => c.r !== 3 && c.r !== 2).sort((a, b) => TR.thirds(b) - TR.thirds(a) || TR.strength(a) - TR.strength(b));
    return { type: 'play', cardId: (loads[0] || cheapest(legal)).id };
  }
  if (following) {
    const winning = legal.filter((c) => TR.strength(c) > TR.strength(trick[bestIdx]));
    const worth = trick.reduce((s, c) => s + TR.thirds(c), 0);
    if (winning.length && !partnerWins && (worth >= 1 || last || g.players[seat].hand.length <= 2)) return { type: 'play', cardId: cheapest(winning).id };
    return { type: 'play', cardId: cheapest(legal).id };
  }
  // non ho il seme: scarto la carta che vale meno
  return { type: 'play', cardId: cheapest(legal).id };
}

/* ---------- Guardare avanti ---------- */
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function determinize(g, seat) {
  const key = (c) => c.r + c.s;
  const seen = new Set([...g.players[seat].hand, ...g.teams.flatMap((t) => t.taken), ...g.trick.map((x) => x.card)].map(key));
  // semi che un giocatore non ha più (non ha risposto al seme): le carte di quel seme non vanno a lui
  const void_ = g.players.map(() => new Set());
  if (g.trick.length) for (const x of g.trick.slice(1)) if (x.card.s !== g.trick[0].card.s) void_[x.seat].add(g.trick[0].card.s);
  if (g.lastTrick) for (const x of g.lastTrick.cards.slice(1)) if (x.card.s !== g.lastTrick.cards[0].card.s) void_[x.seat].add(g.lastTrick.cards[0].card.s);
  const pool = [];
  for (const s of ['d', 'c', 's', 'b']) for (let r = 1; r <= 10; r++) if (!seen.has(r + s)) pool.push({ id: 1000 + pool.length, r, s });
  for (let tries = 0; tries < 20; tries++) {
    const cards = shuffle(pool.slice());
    const hands = g.players.map((p, i) => (i === seat ? p.hand.slice() : []));
    let ok = true;
    for (let i = 0; i < g.n && ok; i++) {
      if (i === seat) continue;
      for (let k = 0; k < g.players[i].hand.length; k++) {
        const idx = cards.findIndex((c) => !void_[i].has(c.s));
        if (idx < 0) { ok = false; break; }
        hands[i].push(cards.splice(idx, 1)[0]);
      }
    }
    if (ok) {
      return {
        n: g.n, turn: g.turn, players: hands.map((h) => ({ hand: h })), trick: g.trick.slice(), stock: cards,
        teams: g.teams.map((t) => ({ members: t.members, thirds: t.thirds })),
      };
    }
  }
  return null;
}

function simPlay(sim, cardId) {
  const p = sim.players[sim.turn];
  const card = p.hand.find((c) => c.id === cardId);
  p.hand = p.hand.filter((c) => c !== card);
  sim.trick.push({ seat: sim.turn, card });
  if (sim.trick.length < sim.n) { sim.turn = (sim.turn + 1) % sim.n; return; }
  const w = sim.trick[TR.winner(sim.trick.map((x) => x.card))].seat;
  const last = sim.players.every((x) => !x.hand.length) && !sim.stock.length;
  sim.teams.find((t) => t.members.includes(w)).thirds += sim.trick.reduce((a, x) => a + TR.thirds(x.card), 0) + (last ? 3 : 0);
  sim.trick = [];
  for (let k = 0; k < sim.n && sim.stock.length; k++) sim.players[(w + k) % sim.n].hand.push(sim.stock.pop());
  sim.turn = w;
}

function lookahead(g, seat, samples) {
  const legal = TR.legal(g.players[seat].hand, g.trick.map((x) => x.card));
  if (legal.length === 1) return { type: 'play', cardId: legal[0].id };
  const total = new Map(legal.map((c) => [c.id, 0]));
  for (let k = 0; k < samples; k++) {
    const base = determinize(g, seat);
    if (!base) break;
    for (const c of legal) {
      const sim = { ...base, players: base.players.map((p) => ({ hand: p.hand.slice() })), trick: base.trick.slice(), stock: base.stock.slice(), teams: base.teams.map((t) => ({ ...t })) };
      simPlay(sim, c.id);
      while (sim.players.some((p) => p.hand.length)) simPlay(sim, heuristic(sim, sim.turn, 'normale').cardId);
      const mine = sim.teams.find((t) => t.members.includes(seat)).thirds;
      const theirs = sim.teams.filter((t) => !t.members.includes(seat)).reduce((a, t) => a + t.thirds, 0);
      total.set(c.id, total.get(c.id) + mine - theirs);
    }
  }
  let best = legal[0].id;
  for (const c of legal) if (total.get(c.id) > total.get(best)) best = c.id;
  return { type: 'play', cardId: best };
}

function nextAction(g, seat, memo = {}) {
  const level = memo.level || 'normale';
  if (strong(level)) return lookahead(g, seat, level === 'esperto' ? 50 : 25);
  return heuristic(g, seat, level);
}

module.exports = { nextAction, thinkMs };
