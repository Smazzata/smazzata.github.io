'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../shared/cosmetics'),Ch=require('./chests'),A=require('../shared/avatars');
const noop=()=>{};
function profile(rarity){return {nick:'Prova',chests:{version:3,progress:0,day:'',earnedToday:0,coins:24000,epicMisses:0,legendaryMisses:0,issued:1,items:[{id:'1',version:3,type:rarity}],exchanges:{}}};}
test('Cento cosmetici: ogni categoria ha 10 comuni, 6 rari, 3 epici e un leggendario',()=>{
 assert.equal(C.LIST.length,100);assert.equal(C.byId.size,100);
 for(const kind of C.KINDS)assert.deepEqual(C.RARITIES.map(r=>C.LIST.filter(x=>x.kind===kind.id&&x.rarity===r).length),[10,6,3,1]);
 const s={cosmeticOwned:[C.LIST[0].id,C.LIST[0].id,'invalido'],cosmeticLoadout:{back:C.LIST[0].id,frame:C.LIST[0].id,felt:'invalido'}};
 assert.deepEqual(C.ownedIds(s),[C.LIST[0].id]);assert.deepEqual(C.equipped(s),{back:C.LIST[0].id});
});
test('Un solo premio per chest: estrazione uniforme tra oggetti, proporzioni per categoria esatte',()=>{
 for(const [rarity,size,avatarCount] of [['common',70,20],['rare',45,15],['epic',23,8],['legendary',8,3]]){
  const pool=Ch.POOL.filter(x=>x.rarity===rarity),counts={};assert.equal(pool.length,size);
  // Forziamo soltanto il lancio della rarità, visitando poi tutti gli indici possibili.
  for(let i=0;i<size;i++){
   const s=profile('legendary');let call=0;
   if(rarity==='epic')s.chests.epicMisses=19;
   if(rarity!=='legendary')s.chests.items[0].type=rarity==='epic'?'epic':'common';
   const rarityRoll={common:0,rare:6650,epic:0,legendary:0}[rarity];
   const result=Ch.open(s,'1',noop,max=>{call++;assert.equal(max,call===1?10000:size);return call===1?rarityRoll:i;}).reward;
   assert.equal(result.itemId,pool[i].id);assert.equal(result.kind,pool[i].kind);assert.equal(result.rarity,rarity);assert.equal(call,2);
   assert(!('extra' in result));assert(!('rewards' in result));assert(!result.duplicate);
   counts[result.kind]=(counts[result.kind]||0)+1;
   assert.equal(A.ownedIds(s).length+C.ownedIds(s).length,5);
   const replay=Ch.open(s,'1',()=>assert.fail(),()=>assert.fail()).reward;assert.deepEqual(replay,result);
  }
  assert.equal(counts.avatar,avatarCount);for(const k of C.KINDS)assert.equal(counts[k.id],(size-avatarCount)/5);
 }
});
test('Cosmetici doppi in monete, scambio solo mancanti e salvataggio atomico',()=>{
 const s=profile('legendary'),id=C.LIST.find(x=>x.kind==='victory'&&x.rarity==='legendary').id;
 s.cosmeticOwned=[id];const r=Ch.open(s,'1',noop,max=>max===10000?0:7);
 assert.equal(r.reward.itemId,id);assert(r.reward.duplicate);assert.equal(s.chests.coins,24900);assert.equal(C.ownedIds(s).length,1);
 const all=profile('legendary');all.avatarOwned=A.LIST.map(x=>x.id);all.avatarInventoryVersion=1;all.cosmeticOwned=C.LIST.filter(x=>x.id!==id).map(x=>x.id);
 const before=JSON.stringify(all);assert.throws(()=>Ch.buy(all,id,'test-request-123456',()=>{throw Error('disco');},()=>0));assert.equal(JSON.stringify(all),before);
 const e=Ch.buy(all,id,'test-request-123456',noop);assert.equal(e.reward.itemId,id);assert(C.ownedIds(all).includes(id));assert.equal(all.chests.coins,6000);
 assert.deepEqual(Ch.buy(all,id,'test-request-123456',()=>assert.fail()).reward,e.reward);
 assert.throws(()=>Ch.buy(all,id,'test-request-789012',noop));
});
test('Le vecchie ricevute con solo avatarId non cambiano nella migrazione',()=>{
 const s=profile('common'),reward={avatarId:'volpe',rarity:'common',duplicate:false,coins:0,at:1};s.chests.version=2;s.chests.items[0]={id:'1',version:2,reward};
 assert.deepEqual(Ch.open(s,'1',()=>assert.fail(),()=>assert.fail()).reward,reward);
});
test('Ogni illustrazione è locale, distinta e disponibile anche nelle due cache offline',()=>{
 const hashes=new Set(),crypto=require('node:crypto');
 for(const x of C.LIST.filter(x=>x.art)){
  const b=fs.readFileSync(require('node:path').join(__dirname,'../public',x.art));assert.equal(b.toString('ascii',0,4),'RIFF');hashes.add(crypto.createHash('sha256').update(b).digest('hex'));
  for(const [sw,prefix] of [['public/sw.js',''],['launcher/sw.js','gioca/']])assert(fs.readFileSync(require('node:path').join(__dirname,'..',sw),'utf8').includes("'"+prefix+x.art+"'"));
 }
 assert.equal(hashes.size,60);
});
