'use strict';
// Carico solo locale: archivio e profili fittizi, mai il server degli utenti.
const assert=require('node:assert/strict'),os=require('node:os'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{io}=require('socket.io-client');
const ROOMS=Number(process.argv[2]||10),SECONDS=Number(process.argv[3]||40);
if(!Number.isInteger(ROOMS)||ROOMS<1||ROOMS>200||!Number.isInteger(SECONDS)||SECONDS<5||SECONDS>600)throw Error('Uso: npm run load -- [1..200 tavoli] [5..600 secondi]');
const PORT=3998,URL=`http://127.0.0.1:${PORT}`,dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'burraco-load-'));
const wait=ms=>new Promise(r=>setTimeout(r,ms)),key=crypto.randomBytes(24).toString('hex'),keys=Array.from({length:ROOMS*2},()=>crypto.randomBytes(18).toString('hex'));
fs.writeFileSync(path.join(dataDir,'stato.json'),JSON.stringify({accountsEpoch:3,progressEpoch:1,sessions:keys.map((k,i)=>['load'+i,{nick:'Carico_'+i,name:'Carico_'+i,devices:[{h:crypto.createHash('sha256').update(k).digest('hex'),at:Date.now()}]}]),leaderboard:[],rooms:[],leagues:[],tournaments:[],daily:[]}));
const server=spawn(process.execPath,[path.join(__dirname,'index.js')],{env:{...process.env,PORT:String(PORT),DATA_DIR:dataDir,ADMIN_KEY:key,MAIL_TEST:'1',IP_LIMIT:'10000'},stdio:['ignore','pipe','pipe']});
const latencies=[],stats=[],clients=[],errorKinds={};let errors=0,actions=0,until=0,serverErrors='',measuring=false;
server.stderr.on('data',d=>serverErrors=(serverErrors+String(d)).slice(-2000));
const pct=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?Math.round(s[Math.min(s.length-1,Math.floor(p*s.length))]*10)/10:0;};
const report={rooms:ROOMS,seconds:SECONDS,connectedProfiles:ROOMS*2,serverBots:ROOMS*2,environment:{platform:process.platform,node:process.version,cpu:os.cpus()[0]?.model,logicalCores:os.cpus().length},source:'server isolato sul PC, non misura il telefono',failures:[]};
async function client(token){
 const sock=io(URL,{transports:['websocket'],forceNew:true,reconnection:false}),c={sock,state:null};clients.push(c);sock.on('state',s=>c.state=s);
 await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Connessione scaduta')),10000);sock.once('connect',()=>{clearTimeout(timer);r();});sock.once('connect_error',j);});
 await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Accesso scaduto')),10000);sock.once('welcome',()=>{clearTimeout(timer);r();});sock.emit('hello',{token,name:'Carico'});});
 c.call=(event,data={})=>new Promise((r,j)=>{const t=performance.now();sock.timeout(12000).emit(event,data,(err,result)=>{if(err)return j(Error(event+': risposta scaduta'));if(event==='action'&&measuring){latencies.push(performance.now()-t);actions++;if(!result.ok){errors++;errorKinds[result.error]=(errorKinds[result.error]||0)+1;}}r(result);});});
 c.loop=async()=>{while(Date.now()<until){const g=c.state?.game;if(g){if(g.turn===g.you&&g.phase==='draw'){await wait(300);if(Date.now()<until)await c.call('action',{type:'draw'});}else if(g.turn===g.you&&g.phase==='play'){await wait(500);if(Date.now()<until)await c.call('action',{type:'discard',cardId:g.hand.at(-1).id});}else if(g.phase==='handEnd'&&!c.state.room.ready.includes(g.you)&&Date.now()<until)await c.call('ready');}await wait(50);}};
 return c;
}
async function sample(){const r=await fetch(`${URL}/stato.json?k=${key}`,{signal:AbortSignal.timeout(8000)});assert(r.ok,'Diagnostica non disponibile');const s=await r.json();stats.push({rssMB:s.memoria_mb,cpuPercent:s.cpu_percento,eventLoopP99Ms:s.ritardo_ms.p99,profiles:s.profili,connected:s.connessi,rooms:s.tavoli.length});}
(async()=>{try{
 await new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Avvio server scaduto')),15000);server.once('error',j);server.once('exit',code=>{clearTimeout(timer);j(Error('Server terminato '+code));});server.stdout.on('data',d=>{if(String(d).includes('ascolto')){clearTimeout(timer);r();}});});
 for(let i=0;i<ROOMS;i++){const a=await client(keys[i*2]),b=await client(keys[i*2+1]);assert((await a.call('createRoom',{rules:{players:4}})).ok,'Creazione tavolo');for(let n=0;n<100&&!a.state?.room;n++)await wait(10);assert(a.state?.room,'Stato sala assente');assert((await b.call('joinRoom',{code:a.state.room.code})).ok,'Ingresso tavolo');assert((await a.call('addBot',{})).ok,'Computer');assert((await a.call('start')).ok,'Avvio partita');}
 await sample();assert.equal(stats[0].rooms,ROOMS);assert.equal(stats[0].connected,ROOMS*2);
 console.log(`${ROOMS} tavoli attivi: ${clients.length} profili e ${ROOMS*2} computer; misuro per ${SECONDS} secondi.`);
 measuring=true;until=Date.now()+SECONDS*1000;
 const monitor=(async()=>{while(Date.now()<until){await wait(1000);await sample();}})();await Promise.all([...clients.map(c=>c.loop()),monitor]);measuring=false;
 assert(actions>=ROOMS,'Mosse insufficienti: carico non realmente esercitato');
 report.actions=actions;report.rejected=errors;report.errorKinds=errorKinds;report.responseMs={median:pct(latencies,.5),p95:pct(latencies,.95),max:pct(latencies,1)};
 report.server={peakRssMB:Math.max(...stats.map(s=>s.rssMB)),startRssMB:stats[0].rssMB,endRssMB:stats.at(-1).rssMB,peakCpuPercent:Math.max(...stats.map(s=>s.cpuPercent)),maxEventLoopP99Ms:Math.max(...stats.map(s=>s.eventLoopP99Ms)),samples:stats.length};
 report.withinPcBudget=errors===0&&report.responseMs.p95<=250&&report.server.maxEventLoopP99Ms<=100;
 assert.equal(errors,0,'Mosse rifiutate durante il carico');
 }catch(e){report.failures.push(e.message);process.exitCode=1;console.error(e.message);if(serverErrors)console.error(serverErrors);}
 finally{until=0;measuring=false;clients.forEach(c=>c.sock.close());if(server.exitCode===null)await new Promise(r=>{server.once('exit',r);server.kill();});if(!report.failures.length){const target=path.resolve(dataDir);assert.equal(path.dirname(target),path.resolve(os.tmpdir()));assert(path.basename(target).startsWith('burraco-load-'));fs.rmSync(target,{recursive:true,force:true,maxRetries:10,retryDelay:100});}fs.mkdirSync(path.resolve('test-output'),{recursive:true});fs.writeFileSync(path.resolve(`test-output/load-${ROOMS}-${SECONDS}-report.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();
