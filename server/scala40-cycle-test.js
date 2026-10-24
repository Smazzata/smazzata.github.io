'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('./scala40'),Bot=require('./scala40-bot'),fixture=require('./fixtures/scala40-jolly-loop.json');
test('Scala 40: mani di soli jolly non si scambiano gli scarti senza avanzare',()=>{
 const g=structuredClone(fixture);assert.equal(g.phase,'draw');assert(g.players.every(p=>p.hand.every(c=>c.s==='J')));
 assert.deepEqual(Bot.nextAction(g,g.turn),{type:'draw'});
 let actions=0,draws=0;
 while(g.phase!=='handEnd'&&actions<1000){const action=Bot.nextAction(g,g.turn);if(action.type==='draw')draws++;E.apply(g,g.turn,action);actions++;}
 assert(draws>0);assert.equal(g.phase,'handEnd');assert(actions<1000);
 console.log(JSON.stringify({jollyCycleActions:actions,draws}));
});
