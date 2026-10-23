'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const A=require('../shared/avatars');
test('Cinquanta ritratti distinti e tre soli leggendari con tre pose',()=>{
  assert.equal(A.LIST.length,50);assert.equal(new Set(A.LIST.map(a=>a.art)).size,50);
  for(const [r,n] of Object.entries({common:24,rare:15,epic:8,legendary:3}))assert.equal(A.LIST.filter(a=>a.rarity===r).length,n);
  for(const a of A.LIST){
    const b=fs.readFileSync(path.join(__dirname,'../public',a.art));
    assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');
    assert.equal(a.frames,a.rarity==='legendary'?3:1);
    for(const [sw,prefix] of [['public/sw.js',''],['launcher/sw.js','gioca/']])assert(fs.readFileSync(path.join(__dirname,'..',sw),'utf8').includes("'"+prefix+a.art+"'"));
  }
});
test('Possesso persistente, compatibilità degli ID ritirati e nessuno sblocco implicito',()=>{
  assert.equal(A.ownedIds().length,24);
  for(const [old,id] of Object.entries(A.aliases)){assert.equal(A.resolve(old).id,id);assert(A.LIST.some(a=>a.id===id));}
  const saved={avatar:{id:'drago-imperatore'},avatarOwned:['inventato','regina-picche']};
  const owned=A.ownedIds(saved);assert(owned.includes('drago-imperatore'));assert(owned.includes('regina-picche'));assert(!owned.includes('inventato'));assert(!owned.includes('fenice'));
  assert.deepEqual(A.ownedIds({avatar:{id:'drago-imperatore'},ownedAvatarIds:['fenice']}),A.ownedIds({avatar:{id:'drago-imperatore'}}));
});
