'use strict';
// Scenari riproducibili e isolati: nessuna connessione al server degli utenti.
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('./chests'),A=require('../shared/avatars'),Cos=require('../shared/cosmetics'),W=require('./weekly-rewards');
function rng(seed){return max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*max);};}
test('Stress inventario: 1800 partite, retry, errori disco, riavvii, giorni e settimane',()=>{
 const random=rng(24102026),start=Date.parse('2026-10-23T20:00:00Z');
 let sessions=new Map(Array.from({length:12},(_,i)=>['p'+i,{nick:'Prova'+i,friends:Array.from({length:12},(_,j)=>'p'+j).filter(x=>x!=='p'+i)}]));
 let openings=0,rollbacks=0,exchanges=0;
 for(let i=0;i<1800;i++){
  const now=start+i*37*60000,ids=[...sessions.keys()],a=random(12),b=(a+1+random(11))%12;
  const room={chestGameId:'stress-'+i,progressEligible:true,rules:{game:['burraco','scala40','ramino','canasta'][random(4)]},seats:[{token:ids[a]},{token:ids[b]}],game:{over:true,handResult:{reason:'close'}}};
  if(i%7===0)room.onDevice=true;
  if(i%11===0)room.game.handResult.reason='surrender';
  if(i%13===0){const before=structuredClone(sessions);try{C.recordGame(room,sessions,()=>{throw Error('disco');},now,random);}catch(_){rollbacks++;}assert.deepEqual(sessions,before);assert.equal(room.chestRecordedGame,undefined);}
  C.recordGame(room,sessions,()=>{},now,random);
  const after=structuredClone(sessions);C.recordGame(room,sessions,()=>assert.fail('retry salvato due volte'),now,random);assert.deepEqual(sessions,after);
  const s=sessions.get(ids[a]),view=C.view(s,now),pending=view.pending;
  assert(view.earnedToday<=2);assert(view.progress>=0&&view.progress<3);
  if(pending.length){
   const id=pending[random(pending.length)].id,old=structuredClone(s),fragments=s.chests.fragments;
   if(i%5===0){assert.throws(()=>C.open(s,id,()=>{throw Error('disco');},random,now));assert.deepEqual(s,old);rollbacks++;}
   const r=C.open(s,id,()=>{},random,now),snapshot=structuredClone(s);openings++;
   assert.equal(s.chests.fragments,fragments+r.reward.fragments);
   assert(new Set([...A.ownedIds(s),...Cos.ownedIds(s)]).has(r.reward.itemId));
   assert.deepEqual(C.open(s,id,()=>assert.fail('retry apertura'),()=>assert.fail('nuova estrazione'),now).reward,r.reward);assert.deepEqual(s,snapshot);
  }
  const v=C.view(s,now),rarity=Object.keys(C.RULES.costs).find(r=>v.missing[r]&&v.fragments>=C.RULES.costs[r]);
  if(rarity&&i%3===0){const id='stress-exchange-'+i,before=s.chests.fragments,r=C.exchange(s,rarity,id,()=>{},random,now);exchanges++;assert(!r.reward.duplicate);assert.equal(s.chests.fragments,before-C.RULES.costs[rarity]);assert.deepEqual(C.exchange(s,rarity,id,()=>assert.fail('retry scambio'),random,now).reward,r.reward);}
  if(i%31===0)sessions=new Map(JSON.parse(JSON.stringify([...sessions])));
 }
 for(const s of sessions.values()){
  const ids=new Set(),weekly=new Set(),days=new Map();
  for(const item of s.chests?.items||[]){assert(!ids.has(item.id));ids.add(item.id);const day=C.dayOf(item.at);
   if(item.source==='weekly'){const key=W.weekOf(day)+':'+item.mission;assert(!weekly.has(key));weekly.add(key);}
   else if(!item.source||item.source==='game'){days.set(day,(days.get(day)||0)+1);assert(days.get(day)<=2);}
  }
 }
 assert(openings>300);assert(exchanges>0);console.log(JSON.stringify({matches:1800,openings,rollbacks,exchanges,profiles:12}));
});
test('Probabilità base: tutti i 10000 esiti per ciascuna delle quattro chest',()=>{
 const results={};
 for(const [type,rule] of Object.entries(C.RULES.types)){
  const s={nick:'Probabilità'},counts={common:0,rare:0,epic:0,legendary:0};
  s.chests=C.inventory(s);s.chests.items=[{id:'1',type,version:C.RULES.version,at:1}];
  for(let roll=0;roll<10000;roll++){
   const b=s.chests;b.items[0].reward=undefined;b.epicMisses=0;b.legendaryMisses=0;b.fragments=0;
   const r=C.open(s,'1',()=>{},max=>max===10000?roll:roll%max,1).reward;
   counts[r.rarity]++;assert(!A.STARTER_IDS.includes(r.itemId));assert.equal(C.POOL.find(x=>x.id===r.itemId).rarity,r.rarity);
  }
  for(const [rarity,percent] of Object.entries(rule.rates))assert.equal(counts[rarity],Math.round(percent*100),type+': '+rarity);
  results[type]=counts;
 }
 console.log(JSON.stringify({baseDraws:40000,results}));
});
test('Calendario italiano: mezzanotte, ora legale/solare e reset del lunedì',()=>{
 for(const iso of ['2026-03-29T00:59:00Z','2026-03-29T01:01:00Z','2026-10-25T00:59:00Z','2026-10-25T01:01:00Z']){
  const day=C.dayOf(Date.parse(iso));assert.equal(day,iso.slice(0,10));assert.equal(W.weekOf(day),day.startsWith('2026-03')?'2026-03-23':'2026-10-19');
 }
 assert.equal(C.dayOf(Date.parse('2026-10-25T22:59:59Z')),'2026-10-25');
 assert.equal(C.dayOf(Date.parse('2026-10-25T23:00:00Z')),'2026-10-26');
 assert.equal(W.weekOf(C.dayOf(Date.parse('2026-10-25T23:00:00Z'))),'2026-10-26');
});
test('Motori: 96 smazzate riproducibili con ripristini, mosse illegali e carte uniche',()=>{
 const registry=require('./games').GAMES;
 const original=Math.random,random=rng(39871);Math.random=()=>random(0x1000000)/0x1000000;
 let actions=0,restores=0;
 try{for(const id of ['burraco','scala40','ramino','canasta']){
  const {E,Bot,normalize}=registry[id];
  for(let sample=0;sample<24;sample++){
   const rules=normalize({game:id,players:sample%2?4:2}),players=Array.from({length:rules.players},(_,i)=>({name:'P'+i,isBot:true}));
   let g=E.createGame({rules,players});const memo=players.map(()=>({level:['facile','normale','difficile','esperto'][sample%4]}));
   for(let guard=0;g.phase!=='handEnd'&&guard<12000;guard++){
    if(guard%19===0){const before=structuredClone(g);assert.throws(()=>E.apply(g,-1,{type:'draw'}));assert.deepEqual(g,before);g=JSON.parse(JSON.stringify(g));restores++;}
    E.apply(g,g.turn,Bot.nextAction(g,g.turn,memo[g.turn]));actions++;
    const cards=[...g.stock,...g.discard,...g.players.flatMap(p=>p.hand),...(g.pozzetti||[]).flat(),...g.teams.flatMap(t=>[...(t.red3||[]),...t.melds.flatMap(m=>m.cards)])];
    assert.equal(cards.length,108,id+' conserva carte');assert.equal(new Set(cards.map(c=>c.id)).size,108,id+' nessuna carta duplicata');
    if(guard%29===0){const seat=random(players.length),v=E.viewFor(g,seat);assert.deepEqual(v.hand,g.players[seat].hand);assert(v.players.every(p=>!p.hand));const spectator=E.viewFor(g,-1);assert.equal(spectator.hand.length,0);}
   }
   assert.equal(g.phase,'handEnd',id+' termina');
  }
 }}finally{Math.random=original;}
 console.log(JSON.stringify({hands:96,actions,restores,seed:39871}));
});
