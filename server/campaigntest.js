'use strict';
const assert = require('assert');
const C = require('../shared/campaign');
const engines = { burraco: require('./engine'), scala40: require('./scala40'), ramino: require('./scala40') };
let tested = 0;
const all = g => g.players.flatMap(p => p.hand).concat(g.stock, g.discard, ...g.pozzetti, ...g.teams.flatMap(t => t.melds.map(m => m.cards)));
for (const path of C.paths) {
  assert.strictEqual(path.levels.length, 50);
  assert.strictEqual(new Set(path.levels.map(l => l.id)).size, 50);
  assert.strictEqual(new Set(path.levels.map(l => l.title)).size, 50);
  assert.deepStrictEqual(path.levels.filter(l => l.boss).map(l => l.number), [25,50]);
  for (const l of path.levels) {
    const E = engines[path.id], s = C.start(path,l,E);
    assert.deepStrictEqual(s,C.start(path,l,E),'ripartenza deterministica');
    const ids = all(s.g).map(c => c.id).sort((a,b) => a-b);
    assert.strictEqual(ids.length,108); assert.strictEqual(new Set(ids).size,108);
    let n = 0;
    while (s.status === 'playing' && n++ < 100) {
      const before=JSON.stringify(s);
      assert(!C.act(s,l,E,{type:'undo'}));
      assert.strictEqual(JSON.stringify(s),before,'mossa illegale transazionale');
      const action=C.expected(s,l,E);
      assert(action,`${path.id}/${l.number}: suggerimento assente`);
      if(action.cardIds){assert(!C.act(s,l,E,{...action,cardIds:action.cardIds.concat(action.cardIds)}));assert.strictEqual(JSON.stringify(s),before);}
      assert(E.isLegal(s.g,s.g.turn,action),`${path.id}/${l.number}: mossa illegale`);
      assert(C.act(s,l,E,action));
      assert.deepStrictEqual(all(s.g).map(c=>c.id).sort((a,b)=>a-b),ids,'conservazione delle 108 carte');
      tested++;
    }
    assert.strictEqual(s.status,'won',`${path.id}/${l.number}: obiettivo irraggiungibile`);
    assert(C.goalState(s,l).every(x=>x.done));
    assert(!C.act(s,l,E,{type:'draw'}));
    if(l.goal.close)assert.strictEqual(s.g.handResult.closer,0,'chiusura reale del giocatore');
    // Un tentativo ricostruito dal salvataggio mantiene stato e risultato.
    assert.strictEqual(JSON.stringify(JSON.parse(JSON.stringify(s))),JSON.stringify(s));
  }
  const l=path.levels[5],E=engines[path.id],s=C.start(path,l,E);
  assert(C.act(s,l,E,{type:'draw'}));
  const natural=s.g.players[0].hand.find(c=>c.r>2&&E.isLegal(s.g,0,{type:'discard',cardId:c.id}));
  assert(C.act(s,l,E,{type:'discard',cardId:natural.id}),'dopo le lezioni si accettano anche mosse valide fuori dal copione');
}
const p=C.paths[0],first=p.levels[0],second=p.levels[1];
assert.strictEqual(C.progress({burraco:{[first.id]:1}}).burraco[first.id],0);
assert.strictEqual(C.progress({burraco:{[second.id]:second.steps.length}}).burraco[second.id],0);
const progress=C.progress({burraco:{[first.id]:first.steps.length,[second.id]:second.steps.length}});
assert.strictEqual(progress.burraco[second.id],second.steps.length);assert.deepStrictEqual(C.progress(progress),progress);
const t=1000,w=C.wallet(null,t);assert.strictEqual(w.lives,5);assert.strictEqual(w.coins,120);
const one=C.loseLife(w,t);assert.strictEqual(one.lives,4);assert.strictEqual(one.nextLife,t+C.LIFE_MS);
const two=C.loseLife(one,t+100);assert.strictEqual(two.lives,3);assert.strictEqual(two.nextLife,one.nextLife);
assert.strictEqual(C.wallet(two,t+C.LIFE_MS).lives,4);
assert.strictEqual(C.wallet(two,t+2*C.LIFE_MS).lives,5);
assert.strictEqual(C.wallet(two,t+10*C.LIFE_MS).nextLife,0);
assert.strictEqual(C.wallet({lives:-5,coins:'bad'},t).lives,5);
const reward=C.reward(w,p,first,t);assert.strictEqual(reward.coins,135);
assert.deepStrictEqual(C.reward(reward,p,first,t),reward,'niente ricompense ripetute rigiocando');
assert.strictEqual(C.reward(reward,p,p.levels[24],t).coins,235);
console.log(`Campagna: 150 livelli, ${tested} mosse, obiettivi reali, alternative legali, salvataggi, vite e ricompense OK.`);
