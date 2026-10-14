'use strict';
// Simula partite complete tra bot per ogni variante e verifica gli invarianti.
const assert = require('assert');
const E = require('./engine');
const Bot = require('./bot');
const Rules = require('../shared/rules');

function countCards(g) {
  let n = g.stock.length + g.discard.length;
  for (const p of g.players) n += p.hand.length;
  for (const pz of g.pozzetti) n += pz.length;
  for (const t of g.teams) for (const m of t.melds) n += m.cards.length;
  return n;
}

function unitTests() {
  const cfg = E.buildCfg({ bonusSemi: 150 });
  const c = (r, s, id) => ({ id, r, s });
  assert(E.analyzeMeld([c(3, 'H', 1), c(4, 'H', 2), c(5, 'H', 3)], cfg), 'scala semplice');
  assert(E.analyzeMeld([c(1, 'H', 1), c(2, 'H', 2), c(3, 'H', 3)], cfg).wildCount === 0, 'A-2-3 con pinella naturale');
  assert(E.analyzeMeld([c(12, 'H', 1), c(13, 'H', 2), c(1, 'H', 3)], cfg), 'Q-K-A');
  assert(E.analyzeMeld([c(3, 'H', 1), c(0, 'J', 2), c(5, 'H', 3)], cfg).wildCount === 1, 'buco con jolly');
  assert(!E.analyzeMeld([c(3, 'H', 1), c(0, 'J', 2), c(2, 'S', 3)], cfg), 'due matte vietate');
  assert(E.analyzeMeld([c(2, 'H', 1), c(3, 'H', 2), c(0, 'J', 3)], cfg), 'pinella naturale + jolly');
  assert(E.analyzeMeld([c(7, 'H', 1), c(7, 'S', 2), c(2, 'C', 3)], cfg).type === 'set', 'tris con pinella');
  assert(!E.analyzeMeld([c(7, 'H', 1), c(8, 'S', 2), c(9, 'C', 3)], cfg), 'semi diversi');
  assert.strictEqual(E.analyzeMeld([c(13, 'H', 1), c(1, 'H', 2), c(2, 'H', 3)], cfg).wildCount, 1, 'K-A-2: il 2 fa da matta (Q)');
  const reale = E.buildCfg(Rules.PRESETS.find((p) => p.id === 'reale').rules);
  assert(!E.analyzeMeld([c(7, 'H', 1), c(7, 'S', 2), c(7, 'C', 3)], reale), 'niente tris nel Reale');
  const full = [];
  for (let r = 1; r <= 13; r++) full.push(c(r, 'S', r));
  full.push(c(1, 'S', 99));
  const an = E.analyzeMeld(full, reale);
  assert(an && an.length === 14 && E.meldKind(an, reale).bonus === 1000, 'scala A-A nel Reale');
  assert(!E.analyzeMeld(full, cfg), 'A-A non ammessa nel classico senza matta');
  const semi = [c(3, 'H', 1), c(4, 'H', 2), c(5, 'H', 3), c(6, 'H', 4), c(7, 'H', 5), c(8, 'H', 6), c(9, 'H', 7), c(0, 'J', 8)];
  assert.strictEqual(E.meldKind(E.analyzeMeld(semi, cfg), cfg).kind, 'semi', 'semipulito');
  // più combinazioni calate insieme
  const M = require('../shared/melds');
  const two = M.partitionMelds([c(7, 'H', 1), c(3, 'S', 2), c(7, 'S', 3), c(4, 'S', 4), c(7, 'C', 5), c(5, 'S', 6)], cfg);
  assert(two && two.length === 2, 'tris + scala selezionati insieme');
  assert(!M.partitionMelds([c(7, 'H', 1), c(3, 'S', 2), c(9, 'D', 3), c(4, 'S', 4), c(7, 'C', 5), c(5, 'S', 6)], cfg), 'divisione impossibile');

  // vulnerabilità: una calata sotto i 75 punti viene rifiutata invece di bloccare il turno
  const br = Rules.PRESETS.find((p) => p.id === 'aberto').rules;
  const g = E.createGame({ rules: { ...br, players: 2 }, players: [{ name: 'A' }, { name: 'B', isBot: true }] });
  g.scores = [2000, 0];
  g.turn = 0; g.phase = 'draw';
  g.players[0].hand = [c(3, 'H', 501), c(4, 'H', 502), c(5, 'H', 503), c(8, 'S', 504), c(9, 'S', 505), c(10, 'S', 506), c(11, 'S', 507), c(12, 'S', 508), c(13, 'S', 509), c(1, 'S', 510), c(6, 'D', 511)];
  E.apply(g, 0, { type: 'draw' });
  assert.throws(() => E.apply(g, 0, { type: 'meld', cardIds: [501, 502, 503] }), /vulnerabili/, 'calata da 15 punti rifiutata');
  E.apply(g, 0, { type: 'meld', cardIds: [504, 505, 506, 507, 508, 509, 510] });
  assert.strictEqual(g.teams[0].melds.length, 1, 'calata da 75 punti accettata');
  console.log('Test unitari OK');
}

function simulate(label, rules, n, games = 3) {
  const variantId = label;
  const total = 104 + rules.jokers;
  let hands = 0, closes = 0, maxActions = 0;
  for (let k = 0; k < games; k++) {
    const players = Array.from({ length: n }, (_, i) => ({ name: 'Bot' + i, isBot: true }));
    const g = E.createGame({ rules, players });
    let guard = 0;
    while (!g.over && guard < 200000) {
      if (g.phase === 'handEnd') {
        hands++;
        if (g.handResult.reason === 'close') closes++;
        E.nextHand(g);
        continue;
      }
      const seat = g.turn;
      const memo = {};
      let steps = 0;
      while (g.turn === seat && g.phase !== 'handEnd' && steps < 300) {
        const a = Bot.nextAction(g, seat, memo);
        E.apply(g, seat, a);
        assert.strictEqual(countCards(g), total, `carte non conservate (${variantId})`);
        // cronaca degli eventi: le carte calate/attaccate sono davvero sul tavolo, gli eventi sono in ordine
        const ev = g.events[g.events.length - 1];
        if (ev && (ev.type === 'meld' || ev.type === 'add') && g.phase !== 'handEnd') {
          const onTable = new Set(g.teams.flatMap((t) => t.melds.flatMap((m) => m.cards.map((c) => c.id))));
          assert(ev.cardIds.length && ev.cardIds.every((id) => onTable.has(id)), `cronaca: carte non sul tavolo (${variantId})`);
        }
        assert(g.events.every((e, i) => i === 0 || e.n > g.events[i - 1].n), 'cronaca fuori ordine');
        steps++;
      }
      maxActions = Math.max(maxActions, steps);
      if (steps >= 300) throw new Error(`Bot bloccato in ${variantId}`);
      guard++;
    }
    if (!g.over) throw new Error(`Partita infinita in ${variantId}`);
  }
  console.log(`${variantId} (${n} giocatori): ${games} partite, ${hands} smazzate, ${closes} chiusure, max azioni/turno ${maxActions}`);
}

unitTests();
for (const p of Rules.PRESETS) for (const n of [4, 2, 3]) simulate(p.id, p.rules, n);
// configurazioni casuali
for (let i = 0; i < 12; i++) {
  const r = {};
  for (const f of Rules.SCHEMA) {
    if (f.type === 'bool') r[f.key] = Math.random() < 0.5;
    else if (f.type === 'number') r[f.key] = 1005;
    else r[f.key] = f.choices[Math.floor(Math.random() * f.choices.length)][0];
  }
  const nr = Rules.normalize(r);
  simulate('random#' + i + ' ' + JSON.stringify(nr).length, nr, nr.players, 1);
}
console.log('Tutto OK');
