'use strict';
// Iscrizioni complete e accessi: casella simulata MAIL_TEST, nessuna email reale.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),{io}=require('socket.io-client');
const count=Number(process.argv[2]||60);if(!Number.isInteger(count)||count<2||count>200)throw Error('Uso: node server/signup-burst-test.js [2..200 profili]');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'smazzata-signups-')),port=3985,sockets=new Set(),credentials=[],latencies=[];
const report={profiles:count,signups:0,logins:0,wrongPasswordsRejected:0,persistedProfiles:0,restarts:0,errors:[]};let proc;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const start=()=>new Promise((resolve,reject)=>{proc=spawn(process.execPath,[path.join(__dirname,'index.js')],{env:{...process.env,PORT:String(port),DATA_DIR:dir,MAIL_TEST:'1',IP_LIMIT:'10000'},stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('Server non pronto')),15000);proc.once('error',reject);proc.stdout.on('data',d=>{if(String(d).includes('ascolto')){clearTimeout(timer);resolve();}});});
const stop=async()=>{for(const sock of sockets)sock.close();sockets.clear();if(proc&&proc.exitCode===null)await new Promise(r=>{proc.once('exit',r);proc.kill();});};
const client=async()=>{const sock=io('http://127.0.0.1:'+port,{transports:['websocket'],forceNew:true,reconnection:false});sockets.add(sock);await new Promise((r,j)=>{sock.once('connect',r);sock.once('connect_error',j);});const hello=token=>new Promise((r,j)=>{const timer=setTimeout(()=>j(Error('Accesso non confermato')),10000);sock.once('welcome',()=>{clearTimeout(timer);r();});sock.emit('hello',{token,name:'QA'});});await hello();return {sock,hello,call:(event,data={})=>new Promise((r,j)=>{const t=performance.now();sock.timeout(15000).emit(event,data,(err,result)=>{latencies.push(performance.now()-t);err?j(Error(event+': attesa scaduta')):r(result);});})};};
const batch=async work=>{let n=0,aborted=false;await Promise.all(Array.from({length:8},async()=>{while(n<count&&!aborted){const i=n++;try{await work(i);}catch(e){aborted=true;throw e;}}}));};
(async()=>{try{
 await start();await batch(async i=>{
  const a=await client(),nick='QA_Reg_'+String(i).padStart(3,'0'),email='qa-'+i+'@example.test',password=crypto.randomBytes(12).toString('hex');
  assert((await a.call('startSignup',{nick,email,password,adult:true})).ok);
  let code;for(let n=0;n<100&&!code;n++){try{const lines=fs.readFileSync(path.join(dir,'posta-inviata.jsonl'),'utf8').trim().split('\n').map(JSON.parse),mail=lines.findLast(x=>x.to===email);code=mail?.subject.match(/\d{6}/)?.[0];}catch{}if(!code)await wait(20);}
  assert(code,'Codice email di prova mancante');assert((await a.call('finishSignup',{code})).ok);report.signups++;
  const b=await client();assert.equal((await b.call('login',{nick,password:'password-sbagliata-prova'})).ok,false);report.wrongPasswordsRejected++;
  const login=await b.call('login',{nick,password});assert(login.ok);await b.hello(login.token);assert.equal((await b.call('profile')).nick,nick);assert.equal((await a.call('profile')).nick,nick);report.logins++;credentials[i]={nick,password};
 });
 // Forza un salvataggio sincrono tramite una normale modifica di un profilo posseduto.
 const a=await client(),last=credentials[0],login=await a.call('login',last);assert(login.ok);await a.hello(login.token);const p=await a.call('profile');assert((await a.call('setAvatar',{id:p.avatar?.id||require('../shared/avatars').STARTER_IDS[0],c:p.avatar?.c||'#f2c14e'})).ok);
 await stop();await start();report.restarts++;
 await batch(async i=>{const a=await client(),c=credentials[i],login=await a.call('login',c);assert(login.ok);await a.hello(login.token);assert.equal((await a.call('profile')).nick,c.nick);report.persistedProfiles++;report.logins++;a.sock.close();sockets.delete(a.sock);});
 const sorted=latencies.sort((a,b)=>a-b);report.responseMs={median:Math.round(sorted[Math.floor(sorted.length*.5)]*10)/10,p95:Math.round(sorted[Math.floor(sorted.length*.95)]*10)/10,max:Math.round(sorted.at(-1)*10)/10};
 }catch(e){report.errors.push(e.message);console.error(e);process.exitCode=1;}
 finally{await stop();if(!report.errors.length){const target=path.resolve(dir);assert.equal(path.dirname(target),path.resolve(os.tmpdir()));assert(path.basename(target).startsWith('smazzata-signups-'));fs.rmSync(target,{recursive:true,force:true,maxRetries:10,retryDelay:100});}fs.mkdirSync(path.resolve('test-output'),{recursive:true});fs.writeFileSync(path.resolve('test-output/signup-burst-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
})();
