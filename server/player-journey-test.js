'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('./chests');
const at=day=>Date.parse(day+'T12:00:00Z');
const players=()=>new Map([['a',{nick:'Anna'}],['b',{nick:'Bruno'}]]);
const room=(id,game='burraco',extra={})=>({chestGameId:id,progressEligible:true,rules:{game},seats:[{token:'a'},{token:'b'}],game:{over:true,handResult:{reason:'close'},winners:[0]},...extra});
test('Percorso mensile: dieci tappe, consegna automatica, limite e nuovo mese senza perdere premi',()=>{
 const p=players();for(let i=0;i<40;i++)C.recordGame(room('oct-'+i),p,()=>{},at('2026-10-24'));
 const s=p.get('a'),oct=C.view(s,at('2026-10-31')),rewards=s.chests.items.filter(x=>x.source==='monthly');
 assert.equal(oct.journey.month.matches,30);assert.equal(oct.journey.month.awarded,10);assert.equal(rewards.length,4);assert(oct.coins>=750);assert.equal(rewards.at(-1).type,'epic');assert.equal(oct.earnedToday,0);
 assert.equal(C.view(s,at('2026-11-01')).journey.month.matches,0);const oldIds=s.chests.items.map(x=>x.id);
 for(let i=0;i<3;i++)C.recordGame(room('nov-'+i),p,()=>{},at('2026-11-01'));
 assert.equal(C.view(s,at('2026-11-01')).journey.month.awarded,1);assert(oldIds.every(id=>s.chests.items.some(x=>x.id===id)));assert.equal(new Set(s.chests.items.map(x=>x.id)).size,s.chests.items.length);
 assert.equal(C.view(s,at('2026-11-01')).journey.album.find(x=>x.id==='first').at,at('2026-10-24'));
});
test('Weekend italiano: sabato/domenica, cambio ora, limite e ripartenza',()=>{
 const p=players();C.recordGame(room('fri'),p,()=>{},at('2026-10-23'));assert.equal(C.view(p.get('a'),at('2026-10-23')).journey.weekend.active,false);
 C.recordGame(room('sat'),p,()=>{},Date.parse('2026-10-23T22:01:00Z'));C.recordGame(room('sun1'),p,()=>{},Date.parse('2026-10-25T01:30:00Z'));C.recordGame(room('sun2'),p,()=>{},Date.parse('2026-10-25T22:59:00Z'));
 for(let i=0;i<6;i++)C.recordGame(room('extra-'+i),p,()=>{},at('2026-10-25'));
 const s=p.get('a');assert.equal(s.chests.items.filter(x=>x.source==='weekend').length,1);assert.equal(s.chests.items.find(x=>x.source==='weekend').type,'rare');assert.equal(C.view(s,at('2026-10-25')).journey.weekend.matches,3);
 assert.equal(C.view(s,Date.parse('2026-10-25T23:00:00Z')).journey.weekend.active,false);
 assert.equal(C.view(s,at('2026-10-31')).journey.weekend.matches,0);
});
test('Album: vittorie dei quattro giochi, cento partite, rimonta reale e ricordi permanenti',()=>{
 const p=players();p.get('a').friends=['b'];p.get('b').friends=['a'];
 for(let i=0;i<100;i++)C.recordGame(room('album-'+i,['burraco','scala40','ramino','canasta'][i%4]),p,()=>{},at('2026-10-24'));
 const r=room('comeback');Object.assign(r.game,{teams:[{members:[0]},{members:[1]}],history:[{teams:[{members:[0],total:0},{members:[1],total:600}]},{teams:[{members:[0],total:1000},{members:[1],total:0}]}]});C.recordGame(r,p,()=>{},at('2026-10-25'));
 const winner=C.view(p.get('a')).journey.album,loser=C.view(p.get('b')).journey.album;
 assert(winner.every(x=>x.at));assert(!loser.some(x=>x.id.startsWith('win-')&&x.at));assert(!loser.find(x=>x.id==='comeback').at);
 const counts=p.get('a').chests.items.filter(x=>x.source==='memory').map(x=>x.mission);assert.equal(counts.length,9);assert.equal(new Set(counts).size,counts.length);
 const restored=JSON.parse(JSON.stringify(p.get('a')));assert.deepEqual(C.view(restored).journey.album,winner);
});
test('Nuovi premi: rollback di entrambi i profili, idempotenza ed esclusioni',()=>{
 const p=players();C.recordGame(room('one'),p,()=>{},at('2026-10-24'));C.recordGame(room('two'),p,()=>{},at('2026-10-24'));
 const r=room('third'),before=structuredClone(p);assert.throws(()=>C.recordGame(r,p,()=>{throw Error('disco pieno');},at('2026-10-24')));assert.deepEqual(p,before);assert.equal(r.chestRecordedGame,undefined);
 C.recordGame(r,p,()=>{},at('2026-10-24'));const after=structuredClone(p);C.recordGame(r,p,()=>assert.fail('doppio salvataggio'),at('2026-10-24'));assert.deepEqual(p,after);
 for(const extra of [{localGame:true},{daily:true},{tutorial:true},{onDevice:true},{progressEligible:false},{rankedMatch:{abandoned:['a']}},{game:{over:true,handResult:{reason:'surrender'}}},{seats:[{token:'a'},{isBot:true,token:'b'}]}])C.recordGame(room('excluded','burraco',extra),p,()=>assert.fail('premio non valido'),at('2026-10-24'));
 assert.deepEqual(p,after);
});
test('Nessuna assegnazione retroattiva e mese bisestile in Europe/Rome',()=>{
 const p=players();p.get('a').games=500;assert.equal(C.view(p.get('a')).journey.matches,0);
 C.recordGame(room('leap'),p,()=>{},at('2028-02-29'));assert.equal(C.view(p.get('a'),Date.parse('2028-02-29T22:59:00Z')).journey.month.matches,1);assert.equal(C.view(p.get('a'),Date.parse('2028-02-29T23:00:00Z')).journey.month.matches,0);
 assert.equal(C.view(p.get('a'),at('2028-03-01')).journey.album.find(x=>x.id==='first').at,at('2028-02-29'));
});
test('Gruppo abituale: conferma reciproca, massimo otto, privacy e rollback',()=>{
 const ctx=require('./contesto'),oldSave=ctx.saveNow,handlers={},events=[];
 const s={nick:'Anna',friends:[],reqIn:[],reqOut:[],blocked:[]},sessions=new Map([['a',s]]);
 for(let i=0;i<10;i++){s.friends.push('b'+i);sessions.set('b'+i,{nick:'Amico'+i,friends:['a']});}
 const owner={data:{token:'a'},handshake:{address:'prova'},on:(e,f)=>handlers[e]=f,emit:e=>events.push(e)};
 const social=require('./social')({io:{sockets:{sockets:new Map([['a',owner]])}},sessions,isConnected:()=>true,roomOfToken:()=>null,renamePlayer:()=>{},onDelete:()=>{},onDeleted:()=>{}});social.rebuildIndexes();social.register(owner,f=>f);
 try{
  ctx.saveNow=()=>{throw Error('disco');};assert.throws(()=>handlers.favoriteFriend({nick:'Amico0',favorite:true}));assert.equal(s.favoriteFriends,undefined);assert.equal(events.length,0);
  ctx.saveNow=()=>{};for(let i=0;i<8;i++)handlers.favoriteFriend({nick:'Amico'+i,favorite:true});assert.equal(s.favoriteFriends.length,8);assert.throws(()=>handlers.favoriteFriend({nick:'Amico8',favorite:true}));
  handlers.favoriteFriend({nick:'Amico0',favorite:true});assert.equal(s.favoriteFriends.length,8);
  assert.equal(social.socialView('a').friends.filter(x=>x.favorite).length,8);assert(!social.socialView('b0').friends.some(x=>x.favorite));
  sessions.get('b8').friends=[];assert.throws(()=>handlers.favoriteFriend({nick:'Amico8',favorite:true}));handlers.favoriteFriend({nick:'Amico0',favorite:false});assert.equal(s.favoriteFriends.length,7);
 }finally{ctx.saveNow=oldSave;}
});
