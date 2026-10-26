'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('./chests');
const historical=require('../scripts/fixtures/economy-calendar-v3.json');
function random(seed){let s=seed>>>0;return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
test('Economia attiva uguale alla variante simulata: tabelle, prezzi e calendari a 30/90/180 giorni',()=>{
 const report=require('../store/SIMULAZIONE-ECONOMIA-2026-10-25.json'),model=report.models.find(x=>x.id==='duratura'),tiers=['common','rare','epic','legendary'];
 assert.deepEqual(tiers.map(x=>C.RULES.costs[x]),model.cost);assert.deepEqual(tiers.map(x=>C.RULES.duplicateCoins[x]),model.dup);assert.deepEqual(tiers.map(x=>C.RULES.coinAmounts[x]),model.coins);
 for(const type of tiers)assert.deepEqual(['coins',...tiers].map(x=>C.RULES.types[type].rates[x]),report.proposed[type]);
 for(const [pi,p]of report.profiles.entries()){
  const r=random(820+pi),s={nick:'Profilo simulato'},peer={nick:'Compagno simulato'},sessions=new Map([['a',s],['b',peer]]);let matches=0,expectedCoins=0;
  for(const day of historical[p.id]){
   for(let k=0;k<day.matches;k++){const friends=r()<p.friend;s.friends=friends?['b']:[];peer.friends=friends?['a']:[];const game=['burraco','scala40','ramino','canasta'][matches%4],won=r()<.5;
    C.recordGame({chestGameId:'simulation-'+(day.day-1)+'-'+k,seats:[{token:'a'},{token:'b'}],rules:{game},progressEligible:true,game:{over:true,winners:won?[0]:[1],handResult:{reason:'close'}}},sessions,()=>{},Date.parse('2026-11-01T12:00:00Z')+(day.day-1)*86400000,limit=>Math.floor(r()*limit));matches++;
   }
   expectedCoins+=5*Math.min(3,day.matches);
   for(const a of day.awards){if(a.source==='weekly')expectedCoins+=({matches:100,days:100,games:150})[a.mission]||0;if(a.source==='monthly')expectedCoins+=({1:50,3:100,4:100,6:150,7:150,9:200})[Number(a.mission.split('-').at(-1))]||0;}
   assert.equal(s.chests?.coins||0,expectedCoins,p.id+' saldo giorno '+day.day);
   if([30,90,180].includes(day.day)){const sample=report.scenarios.find(x=>x.profile===p.id&&x.model==='duratura'&&x.strategy==='economico_prima'&&x.days===day.day);assert.equal(s.chests.items.length,sample.chests.mean,p.id+' chest giorno '+day.day);}
  }
 }
});
test('Credito rifiutato se il saldo supera gli interi sicuri, rollback per tutti i profili',()=>{
 const a={nick:'Uno',chests:C.inventory({})},b={nick:'Due'};a.chests.coins=Number.MAX_SAFE_INTEGER;const before=structuredClone(a),sessions=new Map([['a',a],['b',b]]),room={chestGameId:'overflow',seats:[{token:'a'},{token:'b'}],progressEligible:true,game:{over:true,handResult:{reason:'close'}}};
 assert.throws(()=>C.recordGame(room,sessions,()=>assert.fail('persistenza non valida')),/Saldo non valido/);assert.deepEqual(a,before);assert(!b.chests);assert(!room.chestRecordedGame);
});
