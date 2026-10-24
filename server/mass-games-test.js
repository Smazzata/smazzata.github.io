'use strict';
// Partite intere fino al vincitore, con seme registrato: nessun risultato fittizio.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {GAMES}=require('./games');
const count=Number(process.argv[2]||320),base=Number(process.argv[3]||241026);
if(!Number.isInteger(count)||count<4||count>5000||!Number.isSafeInteger(base))throw Error('Uso: node server/mass-games-test.js [4..5000 partite] [seme intero]');
const report={seed:base,botRandomSeeded:true,matches:0,hands:0,actions:0,restores:0,games:{},failures:[]},started=Date.now();
const out=path.resolve(__dirname,'../test-output');fs.mkdirSync(out,{recursive:true});
for(let i=0;i<count;i++){
 const id=['burraco','scala40','ramino','canasta'][i%4],seed=(base+Math.imul(i+1,2654435761))>>>0;
 const {E,Bot,normalize}=GAMES[id],rules=normalize({game:id,players:id==='canasta'?(i%3?4:2):[2,3,4][i%3]});
 const players=Array.from({length:rules.players},(_,n)=>({name:'Bot'+n,isBot:true}));
 const originalRandom=Math.random;let botSeed=(seed^0xa531c7)>>>0;
 Math.random=()=>{botSeed=(Math.imul(botSeed,1664525)+1013904223)>>>0;return botSeed/4294967296;};
 let g=E.createGame({rules,players,seed}),steps=0,hands=0;
 const memories=players.map((_,n)=>({level:['facile','normale','difficile','esperto'][(Math.floor(i/4)+n)%4]}));
 try{
  while(!g.over){
   if(g.phase==='handEnd'){hands++;assert(g.handResult);E.nextHand(g);continue;}
   assert(++steps<50000,'limite di sicurezza: partita non conclusa');
   if(steps%137===0){g=JSON.parse(JSON.stringify(g));report.restores++;}
   E.apply(g,g.turn,Bot.nextAction(g,g.turn,memories[g.turn]));report.actions++;
   const cards=[...g.stock,...g.discard,...g.players.flatMap(p=>p.hand),...(g.pozzetti||[]).flat(),...g.teams.flatMap(t=>[...(t.red3||[]),...t.melds.flatMap(m=>m.cards)])];
   assert.equal(cards.length,108,'carte conservate');assert.equal(new Set(cards.map(c=>c.id)).size,108,'identificativi unici');
   if(steps%53===0){const seat=i%players.length,v=E.viewFor(g,seat);assert.deepEqual(v.hand,g.players[seat].hand);assert(v.players.every(p=>!p.hand));assert.equal(E.viewFor(g,-1).hand.length,0);}
  }
  hands++;assert(g.winners.length>0);assert(g.winners.every(s=>s>=0&&s<players.length));assert(g.scores.every(Number.isFinite));
  report.matches++;report.hands+=hands;
  const entry=report.games[id]||={matches:0,hands:0,maxActions:0};entry.matches++;entry.hands+=hands;entry.maxActions=Math.max(entry.maxActions,steps);
 }catch(e){report.failures.push({game:id,index:i,seed,phase:g.phase,turn:g.turn,steps,message:e.message});fs.writeFileSync(path.join(out,'mass-games-failure.json'),JSON.stringify({report,state:g},null,2));throw e;}
 finally{Math.random=originalRandom;}
 if((i+1)%20===0)console.log(JSON.stringify({completed:i+1,total:count,hands:report.hands,actions:report.actions,seconds:Math.round((Date.now()-started)/1000)}));
}
report.seconds=Math.round((Date.now()-started)/1000);fs.writeFileSync(path.join(out,'mass-games-'+base+'-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
