'use strict';
// Uso quotidiano su profili fittizi: server e archivio esclusivamente temporanei.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{io}=require('socket.io-client'),C=require('./chests'),Cos=require('../shared/cosmetics');
const profiles=Number(process.argv[2]||240),days=Number(process.argv[3]||14),port=3986;
if(!Number.isInteger(profiles)||profiles<4||profiles>1000||profiles%2||!Number.isInteger(days)||days<2||days>60)throw Error('Uso: node server/daily-use-test.js [profili pari 4..1000] [giorni 2..60]');
const wait=ms=>new Promise(r=>setTimeout(r,ms)),now=Date.now(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'smazzata-daily-'));
const report={profiles,days,completionEvents:0,excludedEvents:0,uniqueOpenings:0,replayedOpenings:0,purchases:0,equips:0,invalidEquipsRejected:0,reconnections:0,calls:0,maxSockets:0,restarts:0,failures:[],source:'server temporaneo sul PC; eventi di fine partita separati dalle partite intere del motore'};
const sessions=new Map(),keys=[],expected=[],sockets=new Set(),durations=[],started=Date.now();let proc,serverError='';
const pct=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?Math.round(s[Math.min(s.length-1,Math.floor(s.length*p))]*10)/10:0;};
const batch=async(items,work,width=12)=>{let next=0,aborted=false;await Promise.all(Array.from({length:Math.min(width,items.length)},async()=>{while(next<items.length&&!aborted){const i=next++;try{await work(items[i],i);}catch(e){aborted=true;throw e;}}}));};
const stop=async()=>{for(const sock of sockets)sock.disconnect();sockets.clear();if(proc&&proc.exitCode===null){await new Promise(r=>{proc.once('exit',r);proc.kill();});}};
const start=async()=>{proc=spawn(process.execPath,[path.join(__dirname,'index.js')],{env:{...process.env,PORT:String(port),DATA_DIR:dir,MAIL_TEST:'1',IP_LIMIT:'10000'},stdio:['ignore','pipe','pipe']});proc.stderr.on('data',d=>serverError=(serverError+String(d)).slice(-3000));await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Avvio server scaduto')),15000);proc.once('error',j);proc.once('exit',code=>{clearTimeout(timer);j(Error('Server terminato: '+code));});proc.stdout.on('data',d=>{if(String(d).includes('ascolto')){clearTimeout(timer);r();}});});};
const client=async key=>{const sock=io('http://127.0.0.1:'+port,{transports:['websocket'],forceNew:true,reconnection:false});sockets.add(sock);report.maxSockets=Math.max(report.maxSockets,sockets.size);await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Connessione scaduta')),10000);sock.once('connect',()=>{clearTimeout(timer);r();});sock.once('connect_error',j);});await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Accesso scaduto')),10000);sock.once('welcome',()=>{clearTimeout(timer);r();});sock.emit('hello',{token:key,name:'QA'});});return {sock,call:(ev,data={})=>new Promise((r,j)=>{const t=performance.now();sock.timeout(15000).emit(ev,data,(err,result)=>{report.calls++;durations.push(performance.now()-t);if(err)j(Error(ev+': risposta scaduta'));else r(result);});})};};
(async()=>{
 try{
  for(let i=0;i<profiles;i++){const device=[crypto.randomBytes(18).toString('hex'),crypto.randomBytes(18).toString('hex')];keys.push(device);sessions.set('qa'+i,{nick:'QA_'+String(i).padStart(4,'0'),name:'QA_'+i,friends:['qa'+(i%2?i-1:i+1)],devices:device.map(k=>({h:crypto.createHash('sha256').update(k).digest('hex'),at:now}))});}
  let seed=25102026;const random=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/4294967296*max);};
  for(let day=0;day<days;day++)for(let pair=0;pair<profiles;pair+=2){
   const at=Date.parse(C.dayOf(now)+'T12:00:00Z')-(days-1-day)*86400000;
   for(let round=0;round<4;round++){
    C.recordGame({chestGameId:`qa-${day}-${pair}-${round}`,progressEligible:true,rules:{game:['burraco','scala40','ramino','canasta'][round]},seats:[{token:'qa'+pair},{token:'qa'+(pair+1)}],game:{over:true,winners:[round%2],scores:[80,60],teams:[{members:[0]},{members:[1]}],handResult:{reason:'close'}}},sessions,()=>{},at,random);report.completionEvents++;
   }
  }
  for(const [id,s] of sessions){const n=Number(id.slice(2));assert.equal(s.chests.items.filter(x=>!x.source||x.source==='game').length,days);const before=JSON.stringify(s);C.recordGame({chestGameId:'excluded-'+id,onDevice:true,progressEligible:true,seats:[{token:id},{token:s.friends[0]}],game:{over:true,handResult:{reason:'close'}}},sessions,()=>assert.fail('premio da allenamento'),now,random);assert.equal(JSON.stringify(s),before);report.excludedEvents++;if(n%2===0)s.chests.coins=600;expected[n]={pending:C.view(s).pending.length,coins:s.chests.coins};}
  fs.writeFileSync(path.join(dir,'stato.json'),JSON.stringify({accountsEpoch:3,progressEpoch:1,sessions:[...sessions],leaderboard:[],rooms:[],leagues:[],tournaments:[],daily:[]}));
  console.log(JSON.stringify({stage:'profili preparati',profiles,completionEvents:report.completionEvents}));await start();
  await batch(keys,async(device,i)=>{
   const a=await client(device[0]),b=await client(device[1]);const first=await a.call('chests');assert(first.ok);assert.equal(first.chests.pending.length,expected[i].pending);assert.equal((await b.call('profile')).nick,'QA_'+String(i).padStart(4,'0'));assert((await a.call('myStats')).ok);assert((await a.call('inbox')).ok);
   const friend='QA_'+String(i%2?i-1:i+1).padStart(4,'0');assert((await a.call('favoriteFriend',{nick:friend,favorite:true})).ok);
   const id=first.chests.pending[0].id,[r1,r2]=await Promise.all([a.call('openChest',{id}),b.call('openChest',{id})]);assert(r1.ok&&r2.ok);assert.deepEqual(r1.reward,r2.reward);report.uniqueOpenings++;report.replayedOpenings++;
   const next=(await b.call('chests')).chests;assert.equal(next.pending.length,first.chests.pending.length-1);
   const pair=next.pending.slice(0,2);const more=await Promise.all([a.call('openChest',{id:pair[0].id}),b.call('openChest',{id:pair[1].id})]);assert(more.every(x=>x.ok));report.uniqueOpenings+=2;
   let view=(await a.call('chests')).chests;assert.equal(view.pending.length,expected[i].pending-3);assert.equal(view.coins,expected[i].coins+r1.reward.coins+more.reduce((n,x)=>n+x.reward.coins,0));
   const reward=r1.reward.kind==='coins'?{kind:'avatar',itemId:'fante-quadri'}:r1.reward;assert((await a.call(reward.kind==='avatar'?'setAvatar':'setCosmetic',reward.kind==='avatar'?{id:reward.itemId,c:'#f2c14e'}:{kind:reward.kind,id:reward.itemId})).ok);report.equips++;
   const profile=await b.call('profile'),forbidden=Cos.LIST.find(x=>!profile.cosmetics.ownedIds.includes(x.id));assert(forbidden);assert.equal((await b.call('setCosmetic',{kind:forbidden.kind,id:forbidden.id})).ok,false);report.invalidEquipsRejected++;
   if(i%2===0){const requestId=crypto.randomUUID(),before=view.coins,mine=new Set([...profile.ownedAvatarIds,...profile.cosmetics.ownedIds]),itemId=C.POOL.find(x=>x.rarity==='common'&&!mine.has(x.id)).id;const [x,y]=await Promise.all([a.call('buyCollectionItem',{itemId,requestId}),b.call('buyCollectionItem',{itemId,requestId})]);assert(x.ok&&y.ok);assert.deepEqual(x.reward,y.reward);assert.equal((await a.call('chests')).chests.coins,before-C.RULES.costs.common);report.purchases++;}
   a.sock.disconnect();sockets.delete(a.sock);const again=await client(device[0]);report.reconnections++;const replay=await again.call('openChest',{id});assert(replay.ok);assert.deepEqual(replay.reward,r1.reward);report.replayedOpenings++;
   const social=await again.call('social');assert.equal(social.social.friends.find(x=>x.nick===friend).favorite,true);
   expected[i]={chests:(await b.call('chests')).chests,id,reward:r1.reward};
  });
  report.confirmedLiveSockets=[...sockets].filter(s=>s.connected).length;assert.equal(report.confirmedLiveSockets,profiles*2,'Dispositivi scollegati durante la prova');
  console.log(JSON.stringify({stage:'operazioni completate',calls:report.calls,openings:report.uniqueOpenings,connections:report.maxSockets}));
  await stop();await start();report.restarts++;
  await batch(keys,async(device,i)=>{const a=await client(device[0]);assert.deepEqual((await a.call('chests')).chests,expected[i].chests);assert.deepEqual((await a.call('openChest',{id:expected[i].id})).reward,expected[i].reward);report.replayedOpenings++;a.sock.disconnect();sockets.delete(a.sock);});
  report.ms=Date.now()-started;report.responseMs={median:pct(durations,.5),p95:pct(durations,.95),max:pct(durations,1)};report.fixture='Profili e monete iniziali inseriti solo nell’archivio temporaneo; ricompense successive, aperture, scambi ed equipaggiamento verificati dalle API vere.';
  fs.mkdirSync(path.resolve('test-output'),{recursive:true});fs.writeFileSync(path.resolve('test-output/daily-use-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }catch(e){report.failures.push(e.message);fs.mkdirSync(path.resolve('test-output'),{recursive:true});fs.writeFileSync(path.resolve('test-output/daily-use-report.json'),JSON.stringify(report,null,2));console.error(e);if(serverError)console.error(serverError);process.exitCode=1;}
 finally{await stop();if(!report.failures.length){const target=path.resolve(dir);assert.equal(path.dirname(target),path.resolve(os.tmpdir()));assert(path.basename(target).startsWith('smazzata-daily-'));fs.rmSync(target,{recursive:true,force:true,maxRetries:10,retryDelay:100});}}
})();
