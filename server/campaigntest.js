'use strict';
const assert = require('assert');
const C = require('../shared/campaign');
const engines = { burraco: require('./engine'), scala40: require('./scala40'), ramino: require('./scala40') };
let tested = 0;
for (const path of C.paths) {
  assert.strictEqual(path.levels.length, 5);
  for (const level of path.levels) {
    const E = engines[path.id], session = C.start(path, level, E);
    assert.deepStrictEqual(session, C.start(path, level, E), 'ripartenza deterministica');
    const all = (g) => g.players.flatMap((p) => p.hand).concat(g.stock, g.discard, ...g.pozzetti, ...g.teams.flatMap((t) => t.melds.map((m) => m.cards)));
    const initialIds = all(session.g).map((c) => c.id).sort((a, b) => a - b);
    assert.strictEqual(new Set(initialIds).size, 108);
    for (const step of level.steps) {
      assert.strictEqual(session.g.turn, step.seat, 'turno reale del giocatore atteso');
      const before = JSON.stringify(session);
      assert.strictEqual(C.act(session, level, E, { type: 'undo' }), false);
      assert.strictEqual(JSON.stringify(session), before, 'mosse fuori copione non mutano lo stato');
      const action = C.expected(session, level);
      if (action.cardIds) {
        assert.strictEqual(C.act(session, level, E, { ...action, cardIds: action.cardIds.concat(action.cardIds) }), false);
        assert.strictEqual(JSON.stringify(session), before);
      }
      assert(E.isLegal(session.g, step.seat, action), `${path.id}/${level.id}: ${JSON.stringify(action)} illegale`);
      assert(C.act(session, level, E, action));
      assert.deepStrictEqual(all(session.g).map((c) => c.id).sort((a, b) => a - b), initialIds, 'nessuna carta scompare o viene duplicata');
      tested++;
    }
    assert.strictEqual(session.index, level.steps.length);
    assert.strictEqual(session.g.turn, 1, 'il secondo scarto del giocatore termina lo spezzone');
    assert.strictEqual(session.g.teams[1].melds.length, 1, 'il bot ha realmente calato');
    assert.strictEqual(C.expected(session, level), null);
    assert(!C.act(session, level, E, { type: 'draw' }), 'nessuna mossa dopo la fine');
    if (level.add) assert.strictEqual(session.g.teams[0].melds[0].cards.length, path.id === 'scala40' ? 6 : 4);
  }
}
const p = C.paths[0], first = p.levels[0], second = p.levels[1];
assert.strictEqual(C.progress({ burraco: { [first.id]: 1 } }).burraco[first.id], 0, 'non salvare una partita parziale');
assert.strictEqual(C.progress({ burraco: { [second.id]: second.steps.length } }).burraco[second.id], 0, 'non saltare livelli');
const progress = C.progress({ burraco: { [first.id]: first.steps.length, [second.id]: second.steps.length } });
assert.strictEqual(progress.burraco[second.id], second.steps.length);
assert.deepStrictEqual(C.progress(progress), progress);
console.log(`Campagna: 15 partite guidate, ${tested} mosse legali, bot, conservazione carte e progressi OK.`);
