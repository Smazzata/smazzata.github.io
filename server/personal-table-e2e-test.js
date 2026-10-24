'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),{io}=require('socket.io-client'),C=require('../shared/cosmetics');
test('Tappetini personali: quattro profili, stili pubblici verificati e aggiornamenti visibili a tutti',{timeout:30000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'smazzata-felts-')),felts=C.LIST.filter(x=>x.kind==='felt'),keys=Array.from({length:4},()=>crypto.randomBytes(18).toString('hex'));
 const sessions=keys.map((key,i)=>['user'+i,{nick:'Tavolo_'+i,name:'Tavolo_'+i,cosmeticOwned:[felts[i].id,felts[4].id],cosmeticLoadout:{felt:felts[i].id},devices:[{h:crypto.createHash('sha256').update(key).digest('hex'),at:Date.now()}]}]);
 fs.writeFileSync(path.join(dir,'stato.json'),JSON.stringify({accountsEpoch:3,progressEpoch:1,sessions,rooms:[]}));
 const server=spawn(process.execPath,[path.join(__dirname,'index.js')],{env:{...process.env,PORT:'3989',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});const clients=[];
 try{
  await new Promise((res,rej)=>{server.once('error',rej);server.stdout.on('data',d=>{if(String(d).includes('ascolto'))res();});});
  for(const key of keys){const socket=io('http://127.0.0.1:3989',{transports:['websocket'],forceNew:true});const c={socket,state:null,call:(ev,data={})=>new Promise((res,rej)=>socket.timeout(5000).emit(ev,data,(e,r)=>e?rej(e):res(r)))};clients.push(c);socket.on('state',s=>{c.state=s;});await new Promise((res,rej)=>{socket.once('connect',res);socket.once('connect_error',rej);});await new Promise(res=>{socket.once('welcome',res);socket.emit('hello',{token:key});});}
  assert((await clients[0].call('createRoom',{rules:{players:4}})).ok);const code=clients[0].state.room.code;
  for(const c of clients.slice(1))assert((await c.call('joinRoom',{code})).ok);
  const wait=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}assert.fail('stato non aggiornato');};
  await wait(()=>clients.every(c=>c.state?.room?.seats.filter(Boolean).length===4));
  for(const c of clients){assert.deepEqual(c.state.room.seats.map(s=>s.style.felt),felts.slice(0,4).map(x=>x.id));assert(!JSON.stringify(c.state.room).includes('cosmeticOwned'));assert(!JSON.stringify(c.state.room).includes('devices'));}
  assert((await clients[0].call('start')).ok);await wait(()=>clients.every(c=>c.state?.game));
  const turn=clients[0].state.game.turn;assert((await clients[turn].call('action',{type:'draw'})).ok);
  assert.equal((await clients[0].call('setCosmetic',{kind:'felt',id:felts[19].id})).ok,false);
  assert((await clients[0].call('setCosmetic',{kind:'felt',id:felts[4].id})).ok);
  await wait(()=>clients.every(c=>c.state.room.seats[0].style.felt===felts[4].id));
  assert((await clients[0].call('setCosmetic',{kind:'felt',id:null})).ok);await wait(()=>clients.every(c=>!c.state.room.seats[0].style.felt));
  for(const c of clients)assert.equal(c.state.room.seats[1].style.felt,felts[1].id);
  const socket=io('http://127.0.0.1:3989',{transports:['websocket'],forceNew:true}),watcher={socket,state:null,call:(ev,data={})=>new Promise((res,rej)=>socket.timeout(5000).emit(ev,data,(e,r)=>e?rej(e):res(r)))};clients.push(watcher);socket.on('state',s=>{watcher.state=s;});await new Promise(res=>socket.once('connect',res));await new Promise(res=>{socket.once('welcome',res);socket.emit('hello',{name:'Spettatore'});});assert((await watcher.call('joinRoom',{code})).ok);await wait(()=>watcher.state?.game);
  assert.equal(watcher.state.game.you,-1);assert.equal(watcher.state.game.hand.length,0);assert.equal(watcher.state.room.seats[1].style.felt,felts[1].id);assert.equal((await watcher.call('action',{type:'draw'})).ok,false);

 }finally{for(const c of clients)c.socket.disconnect();if(server.exitCode===null){const ended=new Promise(r=>server.once('exit',r));server.kill();await ended;}}
});
