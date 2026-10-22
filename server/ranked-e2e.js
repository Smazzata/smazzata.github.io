'use strict';
// Socket reali + processo server riavviato brutalmente, dati esclusivamente temporanei.
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const R = require('./ranked-rules');
const { empty } = require('./ranked');
const { exportData } = require('./store');
const wait = ms => new Promise(r=>setTimeout(r,ms));
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ranked-e2e-')), port=3994;
const keys=Array.from({length:5},()=>crypto.randomBytes(18).toString('hex'));
const state=empty(), key='burraco:4:duo';
for(let i=0;i<5;i++) state.players['p'+i]={[key]:{...R.fresh(Date.now()),games:20,tier:2,division:3,lp:100,promo:{results:[1],target:3}}};
fs.writeFileSync(path.join(dir,'stato.json'),JSON.stringify({accountsEpoch:3,progressEpoch:require('./progress-reset').PROGRESS_EPOCH,savedAt:Date.now(),ranked:state,
  sessions:keys.map((key,i)=>['p'+i,{nick:'Ranked'+i,name:'Ranked'+i,code:'CODE'+i,devices:[{h:crypto.createHash('sha256').update(key).digest('hex'),at:Date.now()}],friends:keys.map((_,j)=>'p'+j).filter(t=>t!=='p'+i)}])}));
let server, clients=[];
async function start() {
  server=spawn(process.execPath,[path.join(__dirname,'index.js')],{env:{...process.env,PORT:String(port),DATA_DIR:dir},stdio:['ignore','pipe','pipe']});
  server.stderr.on('data',d=>process.stderr.write(d));
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server timeout')),10000);server.stdout.on('data',d=>{if(String(d).includes('ascolto')){clearTimeout(timer);resolve();}});server.once('exit',c=>{clearTimeout(timer);reject(Error('server exit '+c));});});
}
async function stop() { const done=new Promise(r=>server.once('exit',r));server.kill('SIGKILL');await done; }
async function connectAll() {
  clients=keys.map((key,i)=>{const socket=io('http://localhost:'+port,{transports:['websocket'],reconnection:false});const p={socket,index:i,state:null,invites:[],results:[]};socket.on('state',s=>p.state=s);socket.on('rankedInvite',r=>p.invites.push(r));socket.on('rankedResult',r=>p.results.push(r));p.call=(event,data={})=>new Promise((resolve,reject)=>socket.timeout(5000).emit(event,data,(err,r)=>err?reject(err):resolve(r)));return p;});
  await Promise.all(clients.map((p,i)=>new Promise(resolve=>{p.socket.once('welcome',resolve);p.socket.emit('hello',{token:keys[i]});})));
}
async function until(fn) {for(let i=0;i<100;i++){if(fn())return;await wait(50);}throw Error('attesa stato scaduta');}
(async()=>{
  try {
    await start();await connectAll();const [a,b,c,d,out]=clients;
    assert.ok((await a.call('rankedJoin',{game:'burraco',n:4,queue:'duo',friend:'Ranked1'})).invited);
    await until(()=>b.invites.length);assert.equal(a.state.room,null);
    assert.equal((await out.call('rankedAccept',{id:b.invites[0].id})).ok,false);
    assert.ok((await b.call('rankedAccept',{id:b.invites[0].id})).ok);
    assert.ok((await c.call('rankedJoin',{game:'burraco',n:4,queue:'duo',friend:'Ranked3'})).ok);
    await until(()=>d.invites.length);assert.ok((await d.call('rankedAccept',{id:d.invites[0].id})).ok);
    await until(()=>clients.slice(0,4).every(p=>p.state.game));
    assert.deepEqual(a.state.room.seats.map(s=>s.name),['Ranked0','Ranked2','Ranked1','Ranked3']);
    assert.equal((await out.call('joinRoom',{code:a.state.room.code})).ok,false);
    for(const event of ['endGame','closeTable','addBot'])assert.equal((await a.call(event)).ok,false,event);
    assert.ok((await c.call('surrender')).ok);assert.ok((await d.call('surrender')).done);
    await until(()=>a.results.length&&b.results.length);
    assert.equal(a.results[0].after.league,'Platino');assert.equal(a.results[0].after.division,'IV');assert.equal(a.results[0].after.lp,0);
    assert.equal((await a.call('rankedProfile')).ranks[key].games,21);
    const disk=exportData(dir);assert.equal(disk.ranked.players.p0[key].games,21);assert.equal(Object.keys(disk.ranked.matches).length,1);
    clients.forEach(p=>p.socket.disconnect());await stop();await start();await connectAll();
    const persisted=(await clients[0].call('rankedProfile')).ranks[key];
    assert.equal(persisted.games,21);assert.equal(persisted.league,'Platino');assert.equal(persisted.promo,null);
    assert.equal((await clients[0].call('ready')).ok,false);
    assert.equal((await clients[0].call('rankedProfile')).ranks[key].games,21);
    // Un invio client di risultati offline non modifica Ranked.
    await clients[0].call('localResult',{game:'burraco',won:true,ranked:true});
    assert.equal((await clients[0].call('rankedProfile')).ranks[key].games,21);
    // Vecchi client possono ancora usare quickPlay, ma entrano sempre nella Solo.
    await clients[0].call('leaveRoom'); await clients[1].call('leaveRoom');
    assert.ok((await clients[0].call('quickPlay',{game:'scopa',n:2,mode:'ranked'})).ok);
    assert.ok((await clients[1].call('quickPlay',{game:'scopa',n:2,mode:'ranked'})).ok);
    await until(()=>clients[0].state.room?.rankedFormat?.key==='scopa:2:solo');
    assert.ok((await clients[0].call('leaveRoom',{abandon:true})).ok);
    await until(()=>clients[1].state.game?.over);
    assert.equal((await clients[0].call('rankedProfile')).ranks['scopa:2:solo'].losses,1);
    assert.equal((await clients[0].call('rankedJoin',{game:'briscola',n:2})).ok,false);
    console.log('Ranked E2E OK: Duo 2v2, doppio consenso, accessi negati, promo reale, crash/riavvio, replay, localResult e abbandono');
  } finally {clients.forEach(p=>p.socket.disconnect());if(server&&server.exitCode===null)await stop();}
})().catch(e=>{console.error(e);process.exitCode=1;});
