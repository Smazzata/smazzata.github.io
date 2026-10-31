'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ctx=require('./contesto');
const events=[];
ctx.io={sockets:{sockets:new Map(['a','b'].map(token=>[token,{data:{token},emit:(event,payload)=>events.push({token,event,payload})}]))}};
ctx.markPlayed=()=>{};ctx.streakOf=()=>({streak:1});ctx.League={recordGame:()=>[]};
require('./statistiche');
const E=require('./engine'),Levels=require('./levels');
function room(extra={}){
 const rules=require('../shared/rules').normalize({players:2});
 const seats=[{name:'Ada',token:'a',isBot:false},{name:'Bruno',token:'b',isBot:false}];
 const game=E.createGame({rules,players:seats});E.surrender(game,0);
 return {code:'TEST',gameSeq:7,game,rules,seats,progressEligible:true,queueMode:'casual',...extra};
}
test('Il riepilogo usa XP e trofei realmente registrati, senza duplicarli',()=>{
 ctx.leaderboard.clear();events.length=0;
 const r=room();ctx.recordLeaderboard(r);
 const progress=events.filter(e=>e.event==='progress');assert.equal(progress.length,2);
 for(const e of progress){
  const stats=ctx.leaderboard.get(e.token),earned=e.payload.earned;
  assert.deepEqual([earned.roomCode,earned.gameSeq,earned.handNo],['TEST',7,r.game.handNo]);
  assert.equal(earned.xp,Levels.xpOf(stats));assert(earned.xp>0);
  for(const trophy of earned.trophies)assert(stats.trophies[trophy.id]);
 }
 const xp=Levels.xpOf(ctx.leaderboard.get('a'));ctx.recordLeaderboard(r);
 assert.equal(events.filter(e=>e.event==='progress').length,2);assert.equal(Levels.xpOf(ctx.leaderboard.get('a')),xp);
});
test('Allenamento, tutorial e tavoli con bot non assegnano progressi',()=>{
 for(const extra of [{practice:true},{tutorial:true},{progressEligible:false},{seats:[{name:'Ada',token:'a'},{name:'CPU',isBot:true}]}]){
  ctx.leaderboard.clear();events.length=0;ctx.recordLeaderboard(room(extra));
  assert.equal(ctx.leaderboard.size,0);assert.equal(events.length,0);
 }
});

test('La fine naturale di tre partite accredita la chest senza duplicarla',()=>{
 ctx.sessions.clear();ctx.leaderboard.clear();events.length=0;
 for(const token of ['a','b'])ctx.sessions.set(token,{nick:token});
 const previousSave=ctx.saveNow;let saves=0;ctx.saveNow=()=>saves++;
 try{
  for(let i=0;i<3;i++){
   const r=room({chestGameId:'chest-integration-'+i});r.game.handResult.reason='close';
   ctx.recordLeaderboard(r);ctx.recordLeaderboard(r);
  }
  assert.equal(saves,3);
  for(const token of ['a','b']){assert.equal(ctx.sessions.get(token).chests.items.filter(x=>!x.source).length,1);assert.equal(ctx.sessions.get(token).chests.items.filter(x=>x.source==='weekly').length,0);}
  assert.equal(events.filter(e=>e.event==='chests').length,6);
  for(const e of events.filter(e=>e.event==='chests'))assert.deepEqual([e.payload.roomCode,e.payload.gameSeq],['TEST',7]);
  assert.equal(events.filter(e=>e.event==='chests'&&e.payload.justEarned).length,2);
 }finally{ctx.saveNow=previousSave;ctx.sessions.clear();}
});
