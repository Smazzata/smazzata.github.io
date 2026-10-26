'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('./chests'),W=require('./weekly-rewards'),D=require('./deliveries'),Welcome=require('./welcome-gifts'),Drafts=require('./delivery-drafts'),Cosmetics=require('../shared/cosmetics');
const monday=Date.parse('2026-10-19T12:00:00Z');
const players=()=>new Map([['a',{nick:'Anna'}],['b',{nick:'Bruno'}]]);
const room=(id,game='burraco')=>({chestGameId:id,progressEligible:true,rules:{game},seats:[{token:'a'},{token:'b'}],game:{over:true,handResult:{reason:'close'}}});
test('Obiettivo amici: reciprocità, limite, ripristino e nessun premio retroattivo',()=>{
 const p=players(),mission=(token,at=monday)=>C.view(p.get(token),at).weekly.missions.find(m=>m.id==='friends');
 p.get('a').friends=['b'];
 C.recordGame(room('one-way'),p,()=>{},monday);assert.equal(mission('a').progress,0);
 p.get('b').friends=['a'];
 for(let i=0;i<2;i++)C.recordGame(room('friend-'+i),p,()=>{},monday);
 assert.equal(mission('a').progress,2);assert.equal(mission('b').progress,2);
 const before=structuredClone(p),third=room('friend-final');
 assert.throws(()=>C.recordGame(third,p,()=>{throw Error('disco pieno');},monday));assert.deepEqual(p,before);
 C.recordGame(third,p,()=>{},monday);C.recordGame(third,p,()=>assert.fail('doppio salvataggio'),monday);
 for(let i=0;i<5;i++)C.recordGame(room('extra-'+i),p,()=>{},monday);
 for(const s of p.values()){const awards=s.chests.items.filter(x=>x.mission==='friends');assert.equal(awards.length,1);assert.equal(awards[0].type,'rare');}
 const restored=new Map(JSON.parse(JSON.stringify([...p])));C.recordGame(room('restored'),restored,()=>{},monday);
 assert.equal(restored.get('a').chests.items.filter(x=>x.mission==='friends').length,1);
 assert.equal(mission('a',monday+7*86400000).progress,0);
 p.get('b').friends=[];C.recordGame(room('not-friends-anymore'),p,()=>{},monday+7*86400000);assert.equal(mission('a',monday+7*86400000).progress,0);
});
test('Settimana italiana: tre obiettivi, tre soli premi aggiuntivi e nessun doppio accredito',()=>{
 const p=players();let saves=0;
 for(let i=0;i<3;i++){const r=room('weekly-'+i,i===1?'scala40':'burraco');C.recordGame(r,p,()=>saves++,monday+i*86400000);C.recordGame(r,p,()=>assert.fail('salvataggio duplicato'),monday+i*86400000);}
 for(const s of p.values()){
  const b=C.view(s,monday+2*86400000),weekly=b.pending.filter(x=>x.source==='weekly');
  assert.equal(weekly.length,0);assert(b.coins>=365);
  assert(b.weekly.missions.filter(x=>x.id!=='friends').every(x=>x.awarded));assert.equal(b.progress,1);assert.equal(b.pending.filter(x=>x.source==='game').length,0);
 }
 assert.equal(saves,3);
 for(let i=3;i<12;i++)C.recordGame(room('weekly-'+i),p,()=>{},monday+2*86400000);
 assert.equal(C.view(p.get('a'),monday+2*86400000).pending.filter(x=>x.source==='weekly').length,0);
 assert.equal(W.weekOf('2026-10-25'),'2026-10-19');assert.equal(W.weekOf('2026-10-26'),'2026-10-26');
 const newWeek=C.view(p.get('a'),monday+7*86400000);assert(newWeek.weekly.missions.every(x=>x.progress===0&&!x.awarded));assert.equal(newWeek.pending.filter(x=>x.source==='weekly').length,0);
});
test('Premi settimanali: esclusioni, rollback e ripartenza nella nuova settimana',()=>{
 const p=players();for(const extra of [{onDevice:true},{tutorial:true},{offline:true},{progressEligible:false},{seats:[{token:'a'},{isBot:true}]}])C.recordGame({...room('bad'),...extra},p,()=>assert.fail('non deve salvare'),monday);
 assert(!p.get('a').chests);
 C.recordGame(room('first'),p,()=>{},monday);C.recordGame(room('second'),p,()=>{},monday);
 const before=structuredClone(p),third=room('third');assert.throws(()=>C.recordGame(third,p,()=>{throw Error('disco pieno');},monday));assert.deepEqual(p,before);assert.equal(third.chestRecordedGame,undefined);
 C.recordGame(third,p,()=>{},monday);assert.equal(p.get('a').chests.items.filter(x=>x.source==='weekly').length,0);
 for(let i=0;i<3;i++)C.recordGame(room('next-'+i),p,()=>{},monday+7*86400000);
 assert.equal(p.get('a').chests.items.filter(x=>x.source==='weekly').length,0);
});
test('Novità della collezione: date reali, lettura persistente, possesso e rollback',()=>{
 const s={nick:'Anna'},ctx={sessions:new Map([['a',s]])},item=Cosmetics.LIST.find(x=>x.kind==='felt');
 D.deliver(ctx,'new-collection-item-0001',D.normalize({title:'Premio',body:'Il tuo tappetino',mode:'all',gift:item.id}),['a'],()=>{},monday);
 assert(C.collection(s).meta.newIds.includes(item.id));assert.equal(C.collection(s).meta.acquiredAt[item.id],monday);
 assert.throws(()=>C.seeItem(s,item.id,()=>{throw Error('disco pieno');}));assert(C.collection(s).meta.newIds.includes(item.id));
 C.seeItem(s,item.id,()=>{});assert(!C.collection(s).meta.newIds.includes(item.id));C.seeItem(s,item.id,()=>assert.fail('lettura doppia'));
 D.deliver(ctx,'new-collection-item-0002',D.normalize({title:'Premio',body:'Doppione',mode:'all',gift:item.id}),['a'],()=>{},monday+1);
 assert(!C.collection(s).meta.newIds.includes(item.id));assert.equal(C.collection(s).meta.acquiredAt[item.id],monday);
 assert.throws(()=>C.seeItem(s,'cx-felt-inventato',()=>{}));
});
test('Campagne distinte dall’invio: un omaggio per profilo, anche dopo riavvio e anteprime sovrapposte',()=>{
 const ctx={sessions:players()},p=D.normalize({title:'Benvenuto',body:'Un regalo',mode:'all',gift:'rare',campaignKey:'benvenuto-2026'});
 D.deliver(ctx,'campaign-delivery-0001',p,['a'],()=>{});assert.equal(D.recipients(ctx.sessions,p).length,1);
 const r=D.deliver(ctx,'campaign-delivery-0002',p,['a','b'],()=>{});assert.equal(r.count,1);assert.equal(r.skipped,1);
 for(const s of ctx.sessions.values())assert.equal(s.chests.items.length,1);
 const restored=JSON.parse(JSON.stringify({sessions:[...ctx.sessions],deliveries:ctx.deliveries}));restored.sessions=new Map(restored.sessions);
 assert.equal(D.deliver(restored,'campaign-delivery-0003',p,['a','b'],()=>{}).count,0);
 assert.throws(()=>D.deliver(ctx,'campaign-delivery-0004',{...p,gift:'epic'},['a'],()=>{}),/regalo diverso/);
 const s={nick:'Nuovo'};ctx.sessions.set('c',s);assert.throws(()=>D.deliver(ctx,'campaign-delivery-0005',p,['c'],()=>{throw Error('disco pieno');}));assert(!s.campaignReceipts&&!s.chests);
});
test('Benvenuto automatico configurabile: soltanto nuove iscrizioni, una volta, disattivazione e salvataggio',()=>{
 const ctx={sessions:new Map([['old',{nick:'Vecchio',terms:monday-1}],['new',{nick:'Nuovo',terms:monday+1}]])};
 const p={title:'Benvenuto',body:'Il tuo omaggio',mode:'all',gift:'common',campaignKey:'benvenuto-2026'};
 assert.equal(Welcome.grant(ctx,'new',()=>{},monday),null);
 Welcome.configure(ctx,p,()=>{},monday);assert.equal(Welcome.grant(ctx,'old',()=>{},monday+2),null);
 assert.equal(Welcome.grant(ctx,'new',()=>{},monday+2).count,1);assert.equal(Welcome.grant(ctx,'new',()=>assert.fail(),monday+3),null);
 Welcome.disable(ctx,()=>{});ctx.sessions.set('later',{nick:'Dopo',terms:monday+4});assert.equal(Welcome.grant(ctx,'later',()=>{},monday+5),null);
 assert.throws(()=>Welcome.configure(ctx,{...p,campaignKey:'altra-campagna'},()=>{throw Error('disco pieno');},monday+6));assert.equal(ctx.welcomeCampaign.enabled,false);
 Welcome.configure(ctx,p,()=>{},monday+6);assert.equal(Welcome.grant(ctx,'later',()=>{},monday+7),null);
 ctx.sessions.set('last',{nick:'Ultimo',terms:monday+7});assert.equal(Welcome.grant(ctx,'last',()=>{},monday+8).count,1);
});
test('Bozze incomplete e configurazione benvenuto conservate nell’archivio, con rollback',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{openStore}=require('./store');
 const ctx={sessions:new Map()},dir=fs.mkdtempSync(path.join(os.tmpdir(),'smazzata-drafts-')),db=openStore(dir);
 const id=Drafts.save(ctx,{title:'Da completare',mode:'selected'},()=>{});Drafts.save(ctx,{draftId:id,title:'Aggiornata',body:'Testo'},()=>{});assert.equal(ctx.deliveryDrafts.length,1);
 assert.throws(()=>Drafts.remove(ctx,id,()=>{throw Error('disco pieno');}));assert.equal(ctx.deliveryDrafts.length,1);
 Welcome.configure(ctx,{title:'Benvenuto',body:'Testo',gift:'rare',campaignKey:'benvenuto-test'},()=>{},monday);
 db.save({sessions:[],deliveryDrafts:ctx.deliveryDrafts,welcomeCampaign:ctx.welcomeCampaign});const data=db.load();assert.equal(data.deliveryDrafts[0].fields.title,'Aggiornata');assert.equal(data.welcomeCampaign.campaignKey,'benvenuto-test');
 Drafts.remove(ctx,id,()=>{});assert.equal(ctx.deliveryDrafts.length,0);
});
