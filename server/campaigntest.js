'use strict';
const assert = require('assert');
const C = require('../shared/campaign');
assert.deepStrictEqual(C.paths.map((p) => p.id), ['burraco', 'scala40', 'ramino']);
let tested = 0;
for (const path of C.paths) {
  assert.strictEqual(path.levels.length, 5);
  assert.strictEqual(new Set(path.levels.map((l) => l.id)).size, path.levels.length);
  for (const level of path.levels) for (const step of level.steps) {
    const answer = step.kind === 'choice' ? [step.answer] : step.answer;
    assert(C.check(path, step, answer), `${path.id}/${level.id}/${step.title}: soluzione non valida`);
    assert(!C.check(path, step, []), 'nessuna risposta non supera il livello');
    assert(!C.check(path, step, [-1]), 'indice negativo rifiutato');
    assert(!C.check(path, step, [999]), 'indice inesistente rifiutato');
    assert(!C.check(path, step, answer.concat(answer)), 'duplicati rifiutati');
    if (step.kind === 'choice') step.options.forEach((_, i) => assert.strictEqual(C.check(path, step, [i]), i === step.answer));
    else {
      const solutions = [];
      for (let mask = 1; mask < 2 ** step.hand.length; mask++) {
        const selected = step.hand.map((_, i) => i).filter((i) => mask & (1 << i));
        if (C.check(path, step, selected)) solutions.push(selected);
      }
      // Queste situazioni introduttive hanno una soluzione non ambigua.
      assert.deepStrictEqual(solutions, [answer], `${path.id}/${step.title}: soluzione ambigua`);
    }
    tested++;
  }
}
const raw = { burraco: { turno: 2, combinazioni: 1, matte: 2 }, scala40: { turno: -1 }, ramino: { turno: '2' } };
const p = C.progress(raw);
assert.strictEqual(p.burraco.combinazioni, 1, 'prova parziale conservata');
assert.strictEqual(p.burraco.matte, 0, 'non si saltano livelli incompleti');
assert.strictEqual(p.scala40.turno, 0);
assert.strictEqual(p.ramino.turno, 0);
assert.deepStrictEqual(C.progress(null), C.progress({}), 'memoria vuota accettata');
assert.deepStrictEqual(C.progress(p), p, 'normalizzazione stabile');
console.log(`Campagna: ${tested} prove verificate, combinazioni non ambigue e progressi indipendenti OK.`);
