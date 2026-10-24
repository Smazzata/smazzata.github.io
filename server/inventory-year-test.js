'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{io}=require('socket.io-client'),C=require('./chests'),A=require('../shared/avatars'),Cos=require('../shared/cosmetics');
test('Un anno di inventario: accumulo, due dispositivi, ricevute e riavvio',{timeout:180000},async()=>{
 let seed=41711;const random=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*max);};
 const keys=[crypto.randomBytes(18).toString('hex'),crypto.randomBytes(18).toString('hex')],start=Date.parse('2025-10-24T12:00:00Z');
 const s={nick:'Inventario_Anno',name:'Inventario_Anno',friends:['peer'],devices:keys.map(k=>({h:crypto.createHash('sha256').update(k).digest('hex'),at:Date.now()}))},peer={nick:'Compagno',friends:['year']};
 const sessions=new Map([['year',s],['peer',peer]]);let opened=0;
 for(let day=0;day<365;day++){
  const now=start+day*86400000;
  for(let n=0;n<6;n++)C.recordGame({chestGameId:`year-${day}-${n}`,progressEligible:true,rules:{game:['burraco','scala40','ramino','canasta'][n%4]},seats:[{token:'year'},{token:'peer'}],game:{over:true,handResult:{reason:'close'}}},sessions,()=>{},now,random);
  const pending=C.view(s,now).pending;if(day%2===0&&pending.length){C.open(s,pending[0].id,()=>{},random,now);opened++;}
  if(day%30===0){const restored=JSON.parse(JSON.stringify(s));assert.deepEqual(C.view(restored,now),C.view(s,now));assert.deepEqual(C.collection(restored),C.collection(s));}
 }
 const yearView=C.view(s),owned=[...A.ownedIds(s),...Cos.ownedIds(s)],receipts=s.chests.items.filter(x=>x.reward).map(x=>[x.id,x.reward]);
 assert(yearView.pending.length>500);assert.equal(receipts.length,opened);assert.equal(new Set(s.chests.items.map(x=>x.id)).size,s.chests.items.length);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'smazzata-year-'));
 fs.writeFileSync(path.join(dir,'stato.json'),JSON.stringify({accountsEpoch:3,progressEpoch:1,sessions:[...sessions],leaderboard:[],rooms:[],leagues:[],tournaments:[],daily:[]}));
 let proc;const sockets=[];
 const startServer=()=>new Promise((resolve,reject)=>{proc=spawn(process.execPath,[path.join(__dirname,'index.js')],{env:{...process.env,PORT:'3987',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('avvio server lento')),15000);proc.once('error',reject);proc.stdout.on('data',d=>{if(String(d).includes('ascolto')){clearTimeout(timer);resolve();}});});
 const stop=async()=>{for(const sock of sockets)sock.disconnect();if(proc&&proc.exitCode===null){const ended=new Promise(r=>proc.once('exit',r));proc.kill();await ended;}};
 const client=async key=>{const sock=io('http://127.0.0.1:3987',{transports:['websocket'],forceNew:true,reconnection:false});sockets.push(sock);await new Promise((r,j)=>{sock.once('connect',r);sock.once('connect_error',j);});await new Promise(r=>{sock.once('welcome',r);sock.emit('hello',{token:key,name:'Prova'});});return {sock,call:(event,data={})=>new Promise((r,j)=>sock.timeout(8000).emit(event,data,(e,a)=>e?j(e):r(a)))};};
 try{
  await startServer();const a=await client(keys[0]),b=await client(keys[1]);
  assert.deepEqual((await a.call('chests')).chests,(await b.call('chests')).chests);
  const one=yearView.pending[0].id,[r1,r2]=await Promise.all([a.call('openChest',{id:one}),b.call('openChest',{id:one})]);assert(r1.ok&&r2.ok);assert.deepEqual(r1.reward,r2.reward);
  let view=(await b.call('chests')).chests;assert.equal(view.pending.length,yearView.pending.length-1);
  const oldFragments=view.fragments,ids=view.pending.slice(0,2).map(x=>x.id),results=await Promise.all([a.call('openChest',{id:ids[0]}),b.call('openChest',{id:ids[1]})]);assert(results.every(x=>x.ok));
  view=(await a.call('chests')).chests;assert.equal(view.fragments,oldFragments+results.reduce((n,r)=>n+r.reward.fragments,0));
  const rarity=Object.keys(view.missing).find(r=>view.missing[r]>0&&view.fragments>=C.RULES.costs[r]);let exchange;
  if(rarity){const requestId=crypto.randomUUID(),both=await Promise.all([a.call('exchangeChestFragments',{rarity,requestId}),b.call('exchangeChestFragments',{rarity,requestId})]);assert(both.every(x=>x.ok));assert.deepEqual(both[0].reward,both[1].reward);assert.equal((await b.call('chests')).chests.fragments,view.fragments-C.RULES.costs[rarity]);exchange={rarity,requestId,reward:both[0].reward};}
  // Il primo dispositivo perde la conferma, il secondo verifica il salvataggio.
  const lostId=(await a.call('chests')).chests.pending[0].id;a.sock.emit('openChest',{id:lostId});
  let saved;for(let n=0;n<30&&!saved;n++){const state=(await b.call('chests')).chests;if(!state.pending.some(x=>x.id===lostId))saved=state;else await new Promise(r=>setTimeout(r,20));}assert(saved);a.sock.disconnect();
  const recovered=await b.call('openChest',{id:lostId});assert(recovered.ok);assert.equal(recovered.chests.pending.length,saved.pending.length);
  const profile=(await b.call('profile')),newOwned=new Set([...profile.ownedAvatarIds,...profile.cosmetics.ownedIds]);assert(owned.every(id=>newOwned.has(id)));
  for(const [id,reward] of receipts){assert.deepEqual((await b.call('openChest',{id})).reward,reward);}
  const before=(await b.call('chests')).chests;await stop();await startServer();const restored=await client(keys[0]);assert.deepEqual((await restored.call('chests')).chests,before);assert.deepEqual((await restored.call('openChest',{id:one})).reward,r1.reward);assert.deepEqual((await restored.call('openChest',{id:lostId})).reward,recovered.reward);
  if(exchange)assert.deepEqual((await restored.call('exchangeChestFragments',exchange)).reward,exchange.reward);
  const guest=await client();assert.equal((await guest.call('openChest',{id:one})).ok,false);
  console.log(JSON.stringify({days:365,matches:2190,issued:s.chests.items.length,opened,unopened:yearView.pending.length,receiptsReplayed:receipts.length,devices:2}));
 }finally{await stop();}
});
