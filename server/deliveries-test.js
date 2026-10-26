'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('./deliveries'),C=require('./chests'),Cosmetics=require('../shared/cosmetics');
const base={title:'Benvenuto',body:'Ecco un regalo',mode:'all',gift:'rare'};
const context=()=>({sessions:new Map([['a',{nick:'Anna',terms:Date.parse('2026-10-23T22:30:00Z')}],['b',{nick:'Beppe',registeredAt:Date.parse('2026-10-01T12:00:00Z')}],['c',{nick:'Carlo'}],['guest',{}]])});
test('Destinatari: nickname esatti, date italiane, estremi e date sconosciute',()=>{
 const ctx=context();
 assert.deepEqual(D.recipients(ctx.sessions,D.normalize({...base,mode:'dates',before:'2026-10-24'})).map(x=>x.nick),['Beppe']);
 assert.deepEqual(D.recipients(ctx.sessions,D.normalize({...base,mode:'dates',from:'2026-10-24'})).map(x=>x.nick),['Anna']);
 assert.equal(D.recipients(ctx.sessions,D.normalize(base)).length,3);
 assert.deepEqual(D.recipients(ctx.sessions,D.normalize({...base,mode:'selected',nicks:'anna, ANNA; Carlo'})).map(x=>x.nick),['Anna','Carlo']);
 assert.throws(()=>D.recipients(ctx.sessions,D.normalize({...base,mode:'selected',nicks:'Nessuno'})));
 for(const bad of [{gift:'inventato'},{mode:'dates'},{mode:'dates',before:'2026-02-30'},{title:'x'.repeat(101)},{body:''},{mode:'other'}])assert.throws(()=>D.normalize({...base,...bad}));
});
test('Regali: una chest chiusa, limite giornaliero invariato, retry e apertura idempotenti',()=>{
 const ctx=context(),s=ctx.sessions.get('a'),p=D.normalize(base),id='test-delivery-000001';
 const r=D.deliver(ctx,id,p,['a','a'],()=>{});assert.equal(r.count,1);assert.equal(s.inbox.length,1);
 assert.equal(C.view(s).pending[0].type,'rare');assert.equal(C.view(s).earnedToday,0);assert.equal(C.view(s).progress,0);
 D.deliver(ctx,id,p,['a'],()=>{throw Error('non deve salvare');});assert.equal(C.view(s).pending.length,1);
 const first=C.open(s,'1',()=>{});assert.deepEqual(C.open(s,'1',()=>{}).reward,first.reward);
 assert.equal(D.read(s,id,()=>{}).unread,0);assert.equal(s.inbox.length,1);
 assert.throws(()=>D.read(ctx.sessions.get('b'),id,()=>{}));
});
test('Oggetti specifici, doppioni, rollback atomico e messaggi senza regalo',()=>{
 const ctx=context(),item=Cosmetics.LIST.find(x=>x.rarity==='legendary'),p=D.normalize({...base,gift:item.id});
 D.deliver(ctx,'test-delivery-000002',p,['a'],()=>{});assert(ctx.sessions.get('a').cosmeticOwned.includes(item.id));
 D.deliver(ctx,'test-delivery-000003',p,['a'],()=>{});assert.equal(C.view(ctx.sessions.get('a')).coins,900);
 const old=structuredClone(ctx);
 assert.throws(()=>D.deliver(ctx,'test-delivery-000004',p,['a','b'],()=>{throw Error('disco pieno');}));assert.deepEqual(ctx,old);
 D.deliver(ctx,'test-delivery-000005',D.normalize({...base,gift:''}),['b'],()=>{});assert.equal(ctx.sessions.get('b').inbox[0].gift,null);assert.equal(C.view(ctx.sessions.get('b')).pending.length,0);
 assert.throws(()=>D.read(ctx.sessions.get('b'),'test-delivery-000005',()=>{throw Error('disco pieno');}));assert.equal(D.inbox(ctx.sessions.get('b')).unread,1);
});
test('Posta paginata e storico consegne sopravvivono a salvataggio e riavvio',()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{openStore}=require('./store');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'smazzata-deliveries-store-')),ctx=context(),db=openStore(dir);
 for(let i=0;i<25;i++)D.deliver(ctx,'test-delivery-'+String(i).padStart(8,'0'),D.normalize({...base,gift:''}),['a'],()=>{});
 db.save({sessions:[...ctx.sessions],deliveries:ctx.deliveries,accountsEpoch:3});
 const data=db.load(),restored={sessions:new Map(data.sessions),deliveries:data.deliveries};
 assert.equal(restored.deliveries.length,25);assert.equal(D.inbox(restored.sessions.get('a')).messages.length,20);assert.equal(D.inbox(restored.sessions.get('a'),20).messages.length,5);
 assert(D.deliver(restored,'test-delivery-00000000',D.normalize(base),['a'],()=>{}).replayed);
 assert.equal(C.view(restored.sessions.get('a')).pending.length,0);
});

test('Filtri inattivi ignorati, date impossibili rifiutate e data storica conservata',()=>{
 assert.equal(D.normalize({...base,before:'non-una-data'}).before,'');
 assert.equal(D.normalize({...base,mode:'selected',nicks:'Anna',from:'2026-99-99'}).from,'');
 for(const before of ['2026-99-99','2026-02-30','2026-04-31'])assert.throws(()=>D.normalize({...base,mode:'dates',before}),/Data non valida/);
 const terms=Date.parse('2026-01-01');assert.equal(D.date({registeredAt:1e30,terms}),terms);
 assert.equal(D.date({registeredAt:Infinity}),null);
});
test('Posta lunga: pagine stabili, estremi validi e nessuna modifica all’archivio',()=>{
 const s={inbox:Array.from({length:10003},(_,i)=>({id:String(i),read:i%2===0}))};
 const first=D.inbox(s),last=D.inbox(s,Number.MAX_SAFE_INTEGER);
 assert.equal(first.messages[0].id,'10002');assert.equal(first.messages.at(-1).id,'9983');
 assert.equal(last.offset,10000);assert.deepEqual(last.messages.map(x=>x.id),['2','1','0']);
 assert.equal(D.inbox(s,21).offset,20);assert.equal(D.inbox(s,-1).offset,0);assert.equal(D.inbox({},999).offset,0);
 assert.equal(first.unread,5001);assert.equal(s.inbox[0].id,'0');
});
test('Regalo avatar, destinatari rimossi e garanzie non consumate dalla consegna',()=>{
 const A=require('../shared/avatars'),ctx=context(),a=A.LIST.find(x=>x.rarity==='legendary'),s=ctx.sessions.get('a');
 s.chests=C.inventory(s);s.chests.epicMisses=17;s.chests.legendaryMisses=35;
 const p=D.normalize({...base,gift:a.id});ctx.sessions.delete('b');
 const result=D.deliver(ctx,'test-avatar-delivery-01',p,['a','b','guest'],()=>{});
 assert.equal(result.count,1);assert(A.ownedIds(s).includes(a.id));assert.equal(s.chests.epicMisses,17);assert.equal(s.chests.legendaryMisses,35);
 D.deliver(ctx,'test-avatar-delivery-02',p,['a'],()=>{});assert.equal(C.view(s).coins,900);
});
test('Invio a 1000 profili: un salvataggio, un regalo ciascuno e replay senza scritture',()=>{
 const ctx={sessions:new Map(Array.from({length:1000},(_,i)=>['user-'+i,{nick:'Utente_'+i}]))};
 const p=D.normalize(base),targets=D.recipients(ctx.sessions,p).map(x=>x.token);let saves=0;
 const r=D.deliver(ctx,'bulk-delivery-test-0001',p,targets,()=>{saves++;});
 assert.equal(r.count,1000);assert.equal(saves,1);
 for(const s of ctx.sessions.values()){assert.equal(s.inbox.length,1);assert.equal(s.chests.items.length,1);assert.equal(s.chests.items[0].type,'rare');}
 D.deliver(ctx,'bulk-delivery-test-0001',p,targets,()=>{saves++;});assert.equal(saves,1);
});
