'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process');const {io}=require('socket.io-client');
test('Chest via socket: concorrenza, isolamento, scambio e riavvio del server',{timeout:60000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'smazzata-chest-'));
 const key=crypto.randomBytes(18).toString('hex'),C=require('./chests');
 const s={nick:'Chest_Prova',name:'Chest_Prova',devices:[{h:crypto.createHash('sha256').update(key).digest('hex'),at:Date.now()}]};
 const profiles=new Map([['test',s],['other',{nick:'Altro'}]]);
 for(let i=0;i<3;i++)C.recordGame({chestGameId:String(i),seats:[{token:'test'},{token:'other'}],progressEligible:true,game:{over:true,handResult:{reason:'close'}}},profiles,()=>{});
 s.chests.items[0].type='legendary';s.chests.fragments=2000;
 fs.writeFileSync(path.join(dir,'stato.json'),JSON.stringify({accountsEpoch:3,progressEpoch:1,sessions:[['test',s]],leaderboard:[],rooms:[],leagues:[],tournaments:[],daily:[]}));
 let proc;const sockets=[];
 const start=()=>new Promise((resolve,reject)=>{
  proc=spawn(process.execPath,[path.join(__dirname,'index.js')],{env:{...process.env,PORT:'3994',DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
  proc.once('error',reject);proc.once('exit',code=>{if(code)reject(Error('server '+code));});
  proc.stdout.on('data',d=>{if(String(d).includes('ascolto'))resolve();});
 });
 const stop=async()=>{if(!proc||proc.exitCode!==null)return;const ended=new Promise(r=>proc.once('exit',r));proc.kill();await ended;};
 const client=async(token)=>{
  const sock=io('http://127.0.0.1:3994',{transports:['websocket'],forceNew:true});sockets.push(sock);
  await new Promise((res,rej)=>{sock.once('connect',res);sock.once('connect_error',rej);});
  await new Promise(res=>{sock.once('welcome',res);sock.emit('hello',{token,name:'Prova'});});
  return (event,data={})=>new Promise((res,rej)=>sock.timeout(5000).emit(event,data,(err,r)=>err?rej(err):res(r)));
 };
 try {
  await start();const a=await client(key),b=await client(key),guest=await client();
  assert.equal((await a('chests')).chests.pending[0].type,'legendary');
  assert.equal((await guest('openChest',{id:'1'})).ok,false);
  const [r1,r2]=await Promise.all([a('openChest',{id:'1',type:'common',avatarId:'fante-quadri',fragments:999999}),b('openChest',{id:'1'})]);
  assert(r1.ok&&r2.ok);assert.deepEqual(r1.reward,r2.reward);assert.equal(r1.reward.rarity,'legendary');
  assert.equal(r1.reward.chestType,'legendary');assert.equal(r1.chests.fragments,2000);
  assert.equal((await a('chests')).chests.pending.length,0);
  const requestId=crypto.randomUUID();
  const [e1,e2]=await Promise.all([a('exchangeChestFragments',{rarity:'epic',requestId}),b('exchangeChestFragments',{rarity:'epic',requestId})]);
  assert.deepEqual(e1.reward,e2.reward);assert.equal(e1.chests.fragments,1500);
  assert((await a('profile')).ownedAvatarIds.includes(e1.reward.avatarId));
  assert((await a('setAvatar',{id:e1.reward.avatarId,c:'#64b5f6'})).ok);
  for(const sock of sockets)sock.disconnect();await stop();await start();
  const again=await client(key);
  assert.deepEqual((await again('openChest',{id:'1'})).reward,r1.reward);
  assert.equal((await again('exchangeChestFragments',{rarity:'epic',requestId})).chests.fragments,1500);
  assert.equal((await again('openChest',{id:'not-owned'})).ok,false);
 }finally{for(const sock of sockets)sock.disconnect();await stop();}
});
