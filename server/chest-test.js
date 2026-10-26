'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('./chests'),A=require('../shared/avatars');
const DAY=Date.parse('2026-10-24T10:00:00Z'),noop=()=>{},players=()=>new Map(['a','b'].map(t=>[t,{nick:t}]));
function game(id,extra={}){return {chestGameId:id,seats:['a','b'].map(token=>({token})),progressEligible:true,game:{over:true,handResult:{reason:'close'}},...extra};}
function earn(p,n,now=DAY){for(let i=0;i<n;i++)C.recordGame(game('game-'+i),p,noop,now,()=>0);}
function profile(type='common',version=4){const s={nick:'Prova'};s.chests=C.inventory(s);s.chests.items=[{id:'1',type,version,at:DAY}];s.chests.issued=1;return s;}
function roll(value){let first=true;return max=>{if(first){first=false;return value;}return 0;};}
test('Giornaliero: una chest dopo due partite, cinque monete per le prime tre, reset e retry',()=>{
 const p=players(),r=game('once');let saves=0;C.recordGame(r,p,()=>saves++,DAY);C.recordGame(r,p,()=>assert.fail(),DAY);assert.equal(saves,1);assert.equal(C.view(p.get('a'),DAY).coins,5);
 earn(p,8);let v=C.view(p.get('a'),DAY);assert.equal(v.earnedToday,1);assert.equal(v.coinGames,3);assert.equal(v.progress,0);assert.equal(v.pending.filter(x=>x.source==='game').length,1);
 const before=v.coins;earn(p,1,DAY+86400000);v=C.view(p.get('a'),DAY+86400000);assert.equal(v.coinGames,1);assert.equal(v.progress,1);assert(v.coins>=before+5);
});
test('Esclusioni: bot, offline, resa, classificata abbandonata e identità duplicate non danno valuta',()=>{
 for(const extra of [{onDevice:true},{offline:true},{localGame:true},{tutorial:true},{daily:true},{progressEligible:false},{chestGameId:null},{game:{over:false}},{game:{over:true,handResult:{reason:'surrender'}}},{rankedMatch:{abandoned:['a']}},{seats:[{token:'a'},{token:'b',isBot:true}]},{seats:[{token:'a'},{token:'a'}]}]){const p=players();C.recordGame(game('bad',extra),p,()=>assert.fail(),DAY);assert(!p.get('a').chests);}
});
test('Tabelle assolute: tutti i 10000 esiti di ogni chest, un solo premio',()=>{
 for(const [type,rule] of Object.entries(C.RULES.types)){const counts={coins:0,common:0,rare:0,epic:0,legendary:0};for(let i=0;i<10000;i++){const s=profile(type),r=C.open(s,'1',noop,roll(i),DAY).reward;counts[r.kind==='coins'?'coins':r.rarity]++;if(r.kind==='coins'){assert.equal(r.coins,C.RULES.coinAmounts[type]);assert(!r.itemId);assert.equal(s.chests.coins,r.coins);}else{assert(C.POOL.some(x=>x.id===r.itemId));assert(!A.STARTER_IDS.includes(r.itemId));}}for(const [key,value]of Object.entries(rule.rates))assert.equal(counts[key],value*100);}
});
test('Garanzie: anche le monete contano, epico entro 20 e leggendario entro 50',()=>{
 const s=profile();for(let i=0;i<50;i++){s.chests.items[0].reward=undefined;const r=C.open(s,'1',noop,()=>0).reward;if(i===19||i===39)assert.equal(r.rarity,'epic');if(i===49)assert.equal(r.rarity,'legendary');assert(s.chests.epicMisses<20);assert(s.chests.legendaryMisses<50);}
 for(const[type,n]of[['common',9950],['rare',9850],['epic',9700]])assert.equal(C.open(profile(type),'1',noop,roll(n)).reward.rarity,'legendary');
});
test('Chest già possedute mantengono un oggetto; frammenti rimossi senza conversione',()=>{
 const s=profile('common',1);s.chests.version=3;s.chests.fragments=9999;delete s.chests.coins;s.chests.exchanges={};const v=C.view(s);assert.equal(v.coins,0);assert(!('fragments'in v));assert.equal(v.pending[0].version,3);assert.equal(C.open(s,'1',noop,()=>0).reward.kind,'avatar');assert(!('fragments'in s.chests));assert(!('exchanges'in s.chests));assert.equal(s.chests.coins,0);
});
test('Aperture idempotenti e doppioni danno solo il credito previsto',()=>{
 const s=profile('legendary');s.avatarOwned=A.LIST.map(x=>x.id);s.avatarInventoryVersion=1;let saves=0;const first=C.open(s,'1',()=>saves++,()=>0).reward;assert(first.duplicate);assert.equal(s.chests.coins,900);assert.deepEqual(C.open(s,'1',()=>assert.fail(),()=>assert.fail()).reward,first);assert.equal(saves,1);assert.equal(s.chests.coins,900);assert.throws(()=>C.open({nick:'Altro'},'1',noop));
});
test('Acquisti diretti: prezzo server, nessun doppio addebito, id riutilizzato e possesso',()=>{
 const s=profile(),id='request-1234567890',item=C.POOL.find(x=>x.rarity==='legendary');s.chests.coins=24000;s.chests.epicMisses=17;s.chests.legendaryMisses=48;const before=[s.chests.epicMisses,s.chests.legendaryMisses];const r=C.buy(s,item.id,id,noop).reward;assert.equal(r.itemId,item.id);assert.equal(r.cost,18000);assert.equal(s.chests.coins,6000);assert.deepEqual(C.buy(s,item.id,id,()=>assert.fail()).reward,r);assert.equal(s.chests.coins,6000);assert.deepEqual([s.chests.epicMisses,s.chests.legendaryMisses],before);assert.throws(()=>C.buy(s,C.POOL.find(x=>x.rarity==='common').id,id,noop));assert.throws(()=>C.buy(s,item.id,'request-0987654321',noop));assert.throws(()=>C.buy(s,'inesistente','request-1234567891',noop));assert.throws(()=>C.buy(profile(),item.id,'request-1234567892',noop),/Monete insufficienti/);
});
test('Rollback: saldo, oggetto, ricevuta, aperture e ricompense di tutti i profili',()=>{
 const s=profile(),fail=()=>{throw Error('disco pieno');},before=structuredClone(s);assert.throws(()=>C.open(s,'1',fail,()=>0));assert.deepEqual(s,before);s.chests.coins=18000;const previous=structuredClone(s);assert.throws(()=>C.buy(s,C.POOL[0].id,'request-1234567890',fail));assert.deepEqual(s,previous);const p=players(),r=game('rollback');assert.throws(()=>C.recordGame(r,p,fail,DAY));assert(!p.get('a').chests);assert(!r.chestRecordedGame);C.recordGame(r,p,noop,DAY);assert.equal(p.get('a').chests.coins,5);
});
test('Ricompense monetarie: settimana 350, mese 750 e quattro chest mensili',()=>{
 const p=players();for(let i=0;i<30;i++)C.recordGame(game('month-'+i,{rules:{game:i%2?'scala40':'burraco'}}),p,noop,DAY+i%2*86400000,()=>0);const s=p.get('a'),v=C.view(s,DAY);assert.equal(s.chests.items.filter(x=>x.source==='monthly').length,4);assert(v.coins>=1115);assert.equal(v.journey.month.steps.filter(x=>x.coins).length,6);assert(v.weekly.missions.filter(x=>x.id!=='friends').every(x=>x.awarded));
});
test('Mezzanotte italiana e nessun credito retroattivo su vecchie tappe',()=>{
 assert.equal(C.dayOf(Date.parse('2026-10-25T23:00:00Z')),'2026-10-26');const s=profile();s.chests.version=3;s.chests.journey={matches:0,games:[],wins:[],memories:{},month:{id:'2026-10',matches:3,awarded:1}};const v=C.view(s,DAY);assert.equal(v.journey.month.steps[0].type,'common');assert.equal(v.journey.month.steps[0].coins,0);assert.equal(v.coins,0);
});
