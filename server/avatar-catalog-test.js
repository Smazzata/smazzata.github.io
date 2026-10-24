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
  assert.deepEqual(A.ownedIds(),['fante-quadri','dama-fiori','giardiniere-fiori','pasticciera-vaniglia']);
  for(const a of A.LIST) assert.equal(A.isSelectable(a.id),A.STARTER_IDS.includes(a.id));
  for(const nick of ['Alice','Bob','Carlo','']) assert(A.STARTER_IDS.includes(A.resolve(undefined,nick).id));
  for(const [old,id] of Object.entries(A.aliases)){assert.equal(A.resolve(old).id,id);assert(A.LIST.some(a=>a.id===id));}
  const saved={avatar:{id:'drago-imperatore'},avatarOwned:['inventato','regina-picche']};
  const owned=A.ownedIds(saved);assert(owned.includes('drago-imperatore'));assert(owned.includes('regina-picche'));assert(!owned.includes('inventato'));assert(!owned.includes('fenice'));
  assert.deepEqual(A.ownedIds({avatar:{id:'drago-imperatore'},ownedAvatarIds:['fenice']}),A.ownedIds({avatar:{id:'drago-imperatore'}}));
});

test('Il profilo nasconde avatar non posseduti e titoli non sbloccati',async()=>{
  const vm=require('node:vm');
  const catalog=require('../public/js/avatars');
  let html='';
  const context={S:{progress:{unlocks:['t_principiante','f_nessuna']},avatarScope:'all',avatarFilter:'legendary'},window:{SmazzataAvatars:catalog,BurracoPremi:require('../shared/premi')},
    emit:async()=>({ok:true,nick:'Alice',code:'TEST',colors:['#64b5f6'],ownedAvatarIds:A.ownedIds()}),
    openModal:(_,content)=>{html=content;},esc:s=>String(s??''),t:s=>s,uiIcon:()=>'',avatarHTML:()=>'',location:{hostname:'localhost',origin:'http://localhost'}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/js/profilo.js'),'utf8'),context);
  await vm.runInContext('profileModal()',context);
  assert.equal((html.match(/class="avopt /g)||[]).length,4);
  for(const id of A.STARTER_IDS)assert(html.includes('data-avatar-id="'+id+'"'));
  assert(!html.includes('data-act="avatarScope"'));
  assert(!html.includes('data-act="avatarFilter"'));
  assert(!html.includes('data-id="t_maestro"'));
  context.S.progress.unlocks.push('t_maestro');
  assert(vm.runInContext('lookHTML({})',context).includes('data-id="t_maestro"'));
});
