'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Riconnessione: conferma solo dopo lo stato, inventario riletto e locale indipendente',()=>{
 const callbacks={},events=[],S={connected:false,syncPending:true,lostConnection:true,prefs:{},modalKind:'chests'};
 const c=vm.createContext({S,OFFLINE:false,LANG:'it',pendingRequests:new Set(),socket:{on:(e,f)=>callbacks[e]=f,emit:e=>events.push(e)},toast:m=>events.push(m),render:()=>events.push('render'),onState:()=>events.push('stato'),hideIntro:()=>{},t:x=>x,chestsModal:()=>events.push('chests'),collectionModal:()=>events.push('collection')});
 const s=fs.readFileSync(require.resolve('../public/js/connessione.js'),'utf8');
 vm.runInContext(s.slice(s.indexOf("  socket.on('connect'"),s.indexOf('  // Tornando')),c);
 vm.runInContext(s.slice(s.indexOf("  socket.on('state'"),s.indexOf('  /* ---------- Intro')),c);
 callbacks.connect();assert.equal(S.connected,true);assert.equal(S.syncPending,true);assert.equal(S.lostConnection,true);assert.deepEqual(events,['hello']);
 callbacks.state({room:null,game:null});assert.equal(S.syncPending,false);assert.equal(S.lostConnection,false);assert.deepEqual(events,['hello','stato','Sei di nuovo collegato.','chests']);
 callbacks.disconnect();callbacks.connect();S.modalKind='cosmetics';callbacks.state({room:null,game:null});assert.equal(events.at(-1),'collection');
 S.localGame=true;S.syncPending=true;S.lostConnection=true;callbacks.state({room:null,game:null});assert.equal(S.syncPending,true);assert.equal(S.lostConnection,true);
});
test('Equipaggiamento: conferma dopo il salvataggio, mai su rifiuto o cambio profilo',async()=>{
 const item={id:'dama-fiori',kind:'avatar',name:'Dama di fiori'},S={token:'a',collectionOnline:true,collectionData:{profile:{avatar:{},colors:['#fff']}}},confirmations=[];let resolve;
 const c=vm.createContext({S,collectionItems:()=>[item],collectionOwned:()=>new Set([item.id]),emit:()=>new Promise(r=>resolve=r),renderCollection:()=>{},confirmEquipped:x=>confirmations.push(x.id)});
 const source=fs.readFileSync(require.resolve('../public/js/collection.js'),'utf8'),start=source.indexOf('  async collectionEquip(el)'),end=source.indexOf('  async collectionReset',start);
 vm.runInContext('globalThis.equip=({'+source.slice(start,end)+'}).collectionEquip;',c);
 const button={dataset:{id:item.id},disabled:false};let pending=c.equip(button);assert.equal(confirmations.length,0);resolve({ok:false});await pending;assert.equal(confirmations.length,0);assert.equal(button.disabled,false);
 pending=c.equip(button);resolve({ok:true,avatar:{id:item.id}});await pending;assert.deepEqual(confirmations,[item.id]);
 pending=c.equip(button);S.token='b';resolve({ok:true,avatar:{id:item.id}});await pending;assert.equal(confirmations.length,1);
});
test('Avatar: errore disco annulla la modifica e gli avvisi restano privati',()=>{
 const ctx=require('./contesto'),oldSave=ctx.saveNow,handlers={},events=[];
 const owner={data:{token:'x'},handshake:{address:'prova'},on:(e,f)=>handlers[e]=f,emit:(e)=>events.push(['owner',e])};
 const peer={data:{token:'x'},emit:e=>events.push(['peer',e])},stranger={data:{token:'y'},emit:e=>events.push(['stranger',e])};
 const s={nick:'Prova',friends:[],reqIn:[],reqOut:[],blocked:[]};
 const social=require('./social')({io:{sockets:{sockets:new Map([['owner',owner],['peer',peer],['stranger',stranger]])}},sessions:new Map([['x',s]]),isConnected:()=>true,roomOfToken:()=>null,renamePlayer:()=>{},onDelete:()=>{},onDeleted:()=>{}});
 social.register(owner,f=>f);
 try{
  ctx.saveNow=()=>{throw Error('disco pieno');};assert.throws(()=>handlers.setAvatar({id:'dama-fiori',c:'#64b5f6'}));assert.equal(s.avatar,undefined);assert.equal(s.avatarOwned,undefined);assert.equal(s.avatarInventoryVersion,undefined);assert.equal(events.length,0);
  ctx.saveNow=()=>{};assert.equal(handlers.setAvatar({id:'dama-fiori',c:'#64b5f6'}).avatar.id,'dama-fiori');
  assert(events.some(([who,e])=>who==='peer'&&e==='inventoryChanged'));assert(!events.some(([who])=>who==='stranger'));
 }finally{ctx.saveNow=oldSave;}
});
test('Un aggiornamento tardivo non riapre il bottino chiuso dall’utente',async()=>{
 let resolve,opened=0;const S={token:'a',connected:true,modalKind:'chests'};
 const c=vm.createContext({S,OFFLINE:false,emit:()=>new Promise(r=>resolve=r),cacheChestState:()=>{},openModal:()=>opened++,store:{get:()=>null}});
 const s=fs.readFileSync(require.resolve('../public/js/chests.js'),'utf8');vm.runInContext(s.slice(s.indexOf('async function chestsModal'),s.indexOf('function chestReveal')),c);
 const pending=c.chestsModal(true);S.modalKind=null;resolve({ok:true,chests:{}});await pending;assert.equal(opened,0);
});
