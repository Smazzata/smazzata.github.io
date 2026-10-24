'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('./chests'),A=require('../shared/avatars');
const DAY=Date.parse('2026-10-24T10:00:00Z');
const noop=()=>{};
function players(){return new Map(['a','b'].map(t=>[t,{nick:t}]));}
function game(id,extra={}){return {chestGameId:id,seats:['a','b'].map(token=>({token})),progressEligible:true,game:{over:true,handResult:{reason:'close'}},...extra};}
function earn(sessions,n,now=DAY,random=max=>0){for(let i=0;i<n;i++)C.recordGame(game('game-'+i),sessions,noop,now,random);}
function profile(type='common'){
 const sessions=players();earn(sessions,3);const s=sessions.get('a');s.chests.items[0].type=type;return s;
}
function roll(value){let first=true;return max=>{if(first){first=false;return value;}return 0;};}

test('Tre partite umane, due chest al giorno e nessun accredito ripetuto dopo riavvio',()=>{
 const p=players();let saves=0;const r=game('unique');
 C.recordGame(r,p,()=>saves++,DAY);C.recordGame(JSON.parse(JSON.stringify(r)),p,()=>saves++,DAY);
 assert.equal(saves,1);assert.equal(C.view(p.get('a'),DAY).progress,1);
 earn(p,8);assert.equal(C.view(p.get('a'),DAY).pending.length,2);assert.equal(C.view(p.get('a'),DAY).progress,0);
 assert.equal(C.view(p.get('a'),DAY).earnedToday,2);
 const next=DAY+86400000;earn(p,2,next);assert.equal(C.view(p.get('a'),next).progress,2);
 earn(p,1,next);assert.equal(C.view(p.get('a'),next).pending.length,3);
 assert.equal(C.dayOf(Date.parse('2026-10-24T22:05:00Z')),'2026-10-25');
});
test('Niente chest da bot, tutorial, offline, abbandoni, vecchie partite o identità duplicate',()=>{
 for(const extra of [{tutorial:true},{localGame:true},{onDevice:true},{offline:true},{daily:true},{progressEligible:false},{chestGameId:null},
   {game:{over:false}},{game:{over:true,handResult:{reason:'surrender'}}},{rankedMatch:{abandoned:['a']}},
   {seats:[{token:'a'},{token:'b',isBot:true,leftToken:'b'}]},{seats:[{token:'a'},{token:'a'}]}]){
  const p=players();C.recordGame(game('bad',extra),p,()=>assert.fail('salvataggio inatteso'),DAY);assert(!p.get('a').chests);
 }
});
test('Le chest vengono assegnate al 75/20/4/1 e il tipo resta persistito',()=>{
 const expected={common:0,rare:0,epic:0,legendary:0};
 for(let roll=0;roll<100;roll++){
  const p=players();earn(p,3,DAY,()=>roll*100);const s=JSON.parse(JSON.stringify(p.get('a')));
  expected[C.view(s,DAY).pending[0].type]++;
 }
 assert.deepEqual(expected,C.RULES.chestRates);
});
test('Ogni tipo usa la sua tabella avatar; la leggendaria garantisce un leggendario',()=>{
 for(const type of Object.keys(C.RULES.types)){
  const counts={common:0,rare:0,epic:0,legendary:0};
  for(let i=0;i<200;i++){
   const s=profile(type),r=C.open(s,'1',noop,roll(i*50),DAY).reward;
   counts[r.rarity]++;assert.equal(A.resolve(r.avatarId).rarity,r.rarity);assert(!A.STARTER_IDS.includes(r.avatarId));
  }
  assert.deepEqual(Object.fromEntries(Object.entries(counts).map(([k,n])=>[k,n/2])),C.RULES.types[type].rates);
 }
});
test('Garanzie globali a 20 e 50 aperture, probabilità effettive mostrate prima di aprire',()=>{
 const s=profile('rare');s.chests.epicMisses=19;s.chests.legendaryMisses=49;
 assert.deepEqual(C.view(s).odds,{common:0,rare:0,epic:0,legendary:100});
 assert.equal(C.open(s,'1',noop,roll(0)).reward.rarity,'legendary');
 assert.equal(s.chests.epicMisses,0);assert.equal(s.chests.legendaryMisses,0);
 const e=profile('rare');e.chests.epicMisses=19;
 assert.equal(C.view(e).odds.epic,98.5);assert.equal(C.open(e,'1',noop,roll(0)).reward.rarity,'epic');
});

test('Probabilità frazionarie precise e migrazione delle chest chiuse senza cambiare premi aperti',()=>{
 for(const [type,threshold] of [['common',9950],['rare',9850],['epic',9700]]){
  assert.notEqual(C.open(profile(type),'1',noop,roll(threshold-1)).reward.rarity,'legendary');
  assert.equal(C.open(profile(type),'1',noop,roll(threshold)).reward.rarity,'legendary');
 }
 const s=profile();s.chests.version=1;s.chests.items[0].version=1;
 assert.equal(C.view(s).version,2);assert.equal(C.view(s).pending[0].version,2);
 const reward=C.open(s,'1',noop,roll(0)).reward;
 assert.equal(s.chests.version,2);assert.equal(s.chests.items[0].version,2);
 s.chests.version=1;s.chests.items[0].version=1;
 assert.deepEqual(C.open(s,'1',()=>assert.fail(),()=>assert.fail()).reward,reward);
 assert.equal(s.chests.items[0].version,1);
});
test('Apertura idempotente, doppioni in frammenti e inventario autorevole',async()=>{
 const s=profile();s.avatarOwned=A.LIST.map(a=>a.id);s.avatarInventoryVersion=1;
 let saves=0;const first=C.open(s,'1',()=>saves++,roll(0));
 const reboot=JSON.parse(JSON.stringify(s));
 const second=C.open(reboot,'1',()=>assert.fail('secondo salvataggio'),()=>assert.fail('seconda estrazione'));
 assert.deepEqual(second.reward,first.reward);assert.equal(saves,1);assert.equal(s.chests.fragments,5);
 assert(first.reward.duplicate);assert.throws(()=>C.open({nick:'Altro'},'1',noop));
});
test('Scambio: costo corretto, solo avatar mancanti e stessa richiesta senza secondo addebito',()=>{
 const s=profile();s.chests.fragments=2000;
 const id='request-1234567890';const a=C.exchange(s,'legendary',id,noop,()=>0);
 assert.equal(s.chests.fragments,500);assert(A.ownedIds(s).includes(a.reward.avatarId));
 assert.equal(C.exchange(s,'legendary',id,()=>assert.fail()).reward.avatarId,a.reward.avatarId);
 assert.equal(s.chests.fragments,500);assert.equal(s.chests.legendaryMisses,0);
 assert.throws(()=>C.exchange(s,'legendary','request-0987654321',noop));
 assert.throws(()=>C.exchange(s,'epic',id,noop));
 s.avatarOwned=A.LIST.map(a=>a.id);s.avatarInventoryVersion=1;
 assert.throws(()=>C.exchange(s,'common','request-2345678901',noop));
});
test('Errore su disco: nessuna chest consumata, nessun premio o costo applicato',()=>{
 const s=profile(),before=JSON.stringify(s),error=()=>{throw Error('disco');};
 assert.throws(()=>C.open(s,'1',error,roll(99)));assert.equal(JSON.stringify(s),before);
 s.chests.fragments=2000;const prior=JSON.stringify(s);
 assert.throws(()=>C.exchange(s,'legendary','request-1234567890',error));assert.equal(JSON.stringify(s),prior);
 const p=players(),r=game('rollback');assert.throws(()=>C.recordGame(r,p,error));
 assert(!p.get('a').chests);assert(!r.chestRecordedGame);
  C.recordGame(r,p,noop);assert.equal(p.get('a').chests.progress,1);
});

test('I quattro sprite sono distinti e disponibili in entrambe le cache offline',()=>{
 const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');const hashes=[];
 for(const type of ['opening','rare','epic','legendary']){
  const file='art/chests/chest-'+type+'.webp',bytes=fs.readFileSync(path.join(__dirname,'../public',file));
  assert.equal(bytes.toString('ascii',0,4),'RIFF');hashes.push(crypto.createHash('sha256').update(bytes).digest('hex'));
  for(const [sw,prefix] of [['public/sw.js',''],['launcher/sw.js','gioca/']])assert(fs.readFileSync(path.join(__dirname,'..',sw),'utf8').includes("'"+prefix+file+"'"));
 }
 assert.equal(new Set(hashes).size,4);
});

test('Errore durante l’estrazione di una chest: accredito atomico per tutti i giocatori',()=>{
 const p=players();earn(p,2);const before=JSON.stringify([...p]);let calls=0;
 assert.throws(()=>C.recordGame(game('fault'),p,noop,DAY,()=>{if(++calls===2)throw Error('casualità non disponibile');return 0;}));
 assert.equal(JSON.stringify([...p]),before);
});
test('Simulazione delle frequenze e rispetto delle garanzie su 10000 aperture',()=>{
 let seed=937;const random=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*max);};
 const s=profile();const counts={common:0,rare:0,epic:0,legendary:0};
 for(let i=0;i<10000;i++){
  const r=s.chests.items[0];r.reward=undefined;r.type='common';
  const result=C.open(s,'1',noop,random).reward;counts[result.rarity]++;
  assert(s.chests.epicMisses<20);assert(s.chests.legendaryMisses<50);
  // Il test non accumula uno storico artificiale infinito.
 }
 assert(counts.legendary>=200);assert(counts.epic>700);
 console.log('Frequenze comuni con garanzie (10000):',JSON.stringify(counts));
});
