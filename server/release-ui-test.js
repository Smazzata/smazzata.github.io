'use strict';
// Controlli visivi senza rete: risposte social vuote di prova, motore e interfaccia reali.
// Non sostituisce e2e, prove del trasporto Socket.IO o una verifica su Android fisico.
const fs=require('fs'),path=require('path'),os=require('os');
const {spawn}=require('child_process');
const {pathToFileURL}=require('url');
const crypto=require('crypto');
const {findBrowser}=require('./cdp');
const root=path.resolve(__dirname,'..');
const out=path.join(root,process.argv.includes('--store')?'store/schermate-rilascio':'test-output/rilascio');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'smazzata-visual-'));
fs.mkdirSync(out,{recursive:true});
fs.cpSync(path.join(root,'public'),dir,{recursive:true});
fs.cpSync(path.join(root,'shared'),path.join(dir,'shared'),{recursive:true});
fs.writeFileSync(path.join(dir,'engine.js'),require('../scripts/bundle-engine').bundle());
const bootstrap=`
localStorage.clear();localStorage.setItem('bur_prefs',JSON.stringify({lang:'it',anim:false}));localStorage.setItem('smazzata_intro_seen','true');
window.io=()=>{
 const sock=LocalServer.createSocket({engineUrl:'engine.js',name:'Tu'}),original=sock.emit;
 const callbacks={},on=sock.on; sock.on=(ev,fn)=>{(callbacks[ev] ||= []).push(fn);return on.call(sock,ev,fn);};sock.listeners=ev=>callbacks[ev]||[];
 const profile={ok:true,nick:'Tu',avatar:{id:'fante-quadri',e:'🦊',c:'#81c784'},colors:['#81c784','#64b5f6','#f2c14e'],emoji:[],code:'DEMO-NON-VALIDO',hasPassword:true,mail:false};
 sock.emit=(ev,data,cb)=>{
  const fixtures={profile,cosmetics:{ok:true,cosmetics:{ownedIds:[],loadout:{}}}, tournaments:{ok:true,list:[]},leagues:{ok:true,list:[]},rankedProfile:{ok:true,ranks:{},currentSeason:0,ends:Date.now()+86400000*7}};
  if(ev==='setAvatar'){
   if(!SmazzataAvatars.isSelectable(data.id))return cb?.({ok:false,error:'Non ancora disponibile'});
   const a=SmazzataAvatars.resolve(data.id);profile.avatar={...profile.avatar,id:a.id,e:a.e,c:data.c};return cb?.({ok:true,avatar:profile.avatar});
  }
  if(fixtures[ev])return queueMicrotask(()=>cb?.(fixtures[ev]));
  return original.call(sock,ev,data,cb);
 };return sock;
};`;
let html=fs.readFileSync(path.join(dir,'index.html'),'utf8').replace('<script src="socket.io/socket.io.js"></script>','<script>'+bootstrap+'</script>');
fs.writeFileSync(path.join(dir,'index.html'),html);
// Il protocollo CDP può viaggiare su pipe: nessuna porta TCP locale necessaria.
const browser=spawn(findBrowser(),['--headless=new','--disable-gpu','--no-sandbox','--remote-debugging-pipe','--allow-file-access-from-files','--user-data-dir='+path.join(dir,'browser'),'--no-first-run','about:blank'],{stdio:['ignore','ignore','ignore','pipe','pipe']});
let buffer='',id=0,sessionId;const pending=new Map(),errors=[];
browser.stdio[4].on('data',data=>{buffer+=data.toString();let end;while((end=buffer.indexOf('\0'))>=0){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!raw)continue;const m=JSON.parse(raw);if(pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);}});
const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});browser.stdio[3].write(JSON.stringify({id:n,method,params,...(sessionId?{sessionId}:{})})+'\0');});
const run=async code=>{const r=await send('Runtime.evaluate',{expression:'(async()=>{'+code+'})()',awaitPromise:true,returnByValue:true,timeout:60000});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const sourceHashes=Object.fromEntries(['public/index.html','public/privacy.html','public/regole.html',...fs.readdirSync(path.join(root,'public/art/chests')).filter(f=>f.endsWith('.webp')).map(f=>'public/art/chests/'+f),'shared/cosmetics.js','public/cosmetics.css','public/collection.css',...require('../shared/cosmetics').LIST.filter(x=>x.art).map(x=>'public/'+x.art),'shared/avatars.js',...require('../shared/avatars').LIST.map(a=>'public/'+a.art),'public/style.css','public/sw.js','launcher/sw.js',...fs.readdirSync(path.join(root,'public/js')).filter(f=>f.endsWith('.js')).map(f=>'public/js/'+f),...['en','es','pt'].map(l=>'public/lingue/'+l+'.js')].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const shots=[];
const qaOut=path.join(root,'test-output/rilascio');fs.mkdirSync(qaOut,{recursive:true});
const E=require('./engine'),Bot=require('./bot'),rules=require('../shared/rules').normalize({players:2,target:505});
const demo=E.createGame({rules,players:[{name:'Tu'},{name:'Computer',isBot:true}]});
const memories=[{level:'esperto'},{level:'esperto'}];
for(let i=0;demo.phase!=='handEnd'&&i<30000;i++)E.apply(demo,demo.turn,Bot.nextAction(demo,demo.turn,memories[demo.turn]));
if(demo.phase!=='handEnd')throw Error('la smazzata dimostrativa non termina');
const demoRoom={code:'DEMO',onDevice:true,offline:false,tutorial:false,progressEligible:false,rules,n:2,ready:[],you:0,isHost:true,humans:1,seats:[{name:'Tu',isBot:false},{name:'Computer',isBot:true}],game:'burraco',aids:true,turnTime:0};
const shot=async name=>{await run(`await document.fonts.ready;await Promise.all([...document.images].map(i=>{i.loading='eager';return i.decode().catch(()=>{});}));`);await wait(300);const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(process.argv.includes('--store')&&!/^\d{2}-/.test(name)?qaOut:out,name+'.png'),Buffer.from(r.data,'base64'));shots.push(name);};
const size=async(width=375,height=812,dpr=1)=>send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:dpr,mobile:true});
(async()=>{try{
 const target=await send('Target.createTarget',{url:'about:blank'});({sessionId}=await send('Target.attachToTarget',{targetId:target.targetId,flatten:true}));
 await send('Runtime.enable');await send('Page.enable');await size();
 await send('Page.navigate',{url:pathToFileURL(path.join(dir,'index.html')).href});await wait(2000);
 await run(`if(!document.querySelector('[data-act=playBots]'))throw Error('home non caricata');document.querySelector('#intro')?.remove();S.social.hasPassword=true;S.prefs.anim=false;render();`);
 for(const width of [320,375,768]){
  await size(width);await run(`S.screen='home';closeModal();render();if(document.documentElement.scrollWidth>innerWidth+1)throw Error('home fuori schermo');friendsModal();if(!document.querySelector('.empty-state [data-act=focusField]'))throw Error('azione amici mancante');`);await shot('amici-'+width);
  await run(`document.querySelector('.empty-state button').click();if(document.activeElement.id!=='friendin')throw Error('focus aggiungi amico');document.querySelector('#friendin').value='Amico 🦊';friendsModal();if(document.querySelector('#friendin').value!=='Amico 🦊')throw Error('bozza amico persa');await tournamentsModal(null);if(document.querySelector('.modal-box').scrollWidth>document.querySelector('.modal-box').clientWidth+1)throw Error('tornei fuori schermo');`);await shot('tornei-'+width);
 }
 await size();await run(`firstRunModal();if(document.querySelectorAll('[data-act=introChoose]').length!==4)throw Error('giochi della guida');handlers.introChoose({dataset:{game:'scala40'}});if(homeGame()!=='scala40'||!document.querySelector('[data-act=introPractice]'))throw Error('scelta guida');`);await shot('guida');
 const feltCatalog=require('../shared/cosmetics').LIST.filter(x=>x.kind==='felt');
 for(const n of [2,3,4]){
  const tableRules=require('../shared/rules').normalize({players:n}),game=E.createGame({rules:tableRules,players:Array.from({length:n},(_,i)=>({name:'Giocatore '+(i+1)}))});
  const table={code:'TAPPETINI',rules:tableRules,n,ready:[],you:0,isHost:true,seats:Array.from({length:n},(_,i)=>({name:'Giocatore '+(i+1),isBot:false,connected:true,style:{felt:feltCatalog[[1,2,4,19][i]].id}})),game:'burraco',aids:true,turnTime:0};
  for(const you of [0,1]){
   await size();await run(`closeModal();S.room=${JSON.stringify(table)};S.game=${JSON.stringify(E.viewFor(game,you))};S.screen='game';syncHandOrder(S.game,false);render();const layers=[...document.querySelectorAll('.personal-felt')];if(layers.length!==${n})throw Error('settori mancanti');const mine=document.querySelector('.personal-felt.pos-bottom');if(mine.dataset.seat!=='${you}')throw Error('tappetino non ruotato con il posto');if(getComputedStyle(document.querySelector('.personal-felts')).pointerEvents!=='none')throw Error('tappetino intercetta le carte');if(document.documentElement.scrollWidth>innerWidth)throw Error('tappetino allarga il tavolo');`);await shot('tappetini-'+n+'-posto-'+you);
  }
  await run(`S.game=${JSON.stringify(E.viewFor(game,-1))};render();if(document.querySelectorAll('.personal-felt').length!==${n})throw Error('tappetini spettatore');S.prefs.contrast=true;applyPrefs();if(getComputedStyle(document.querySelector('.personal-felts')).display!=='none')throw Error('alto contrasto ignorato');S.prefs.contrast=false;applyPrefs();S.room=null;S.game=null;S.screen='home';render();`);
 }
 await run(`closeModal();render();await profileModal();if(document.querySelector('.avopt')||!document.querySelector('[data-act=collectionAvatar]'))throw Error('profilo duplicato');await collectionModal('avatar');if(document.querySelectorAll('.collection-card').length!==4)throw Error('avatar iniziali');await handlers.collectionSelect({dataset:{id:'pasticciera-vaniglia'}});await handlers.collectionEquip({dataset:{id:'pasticciera-vaniglia'}});if((await emit('profile')).avatar.id!=='pasticciera-vaniglia')throw Error('selezione avatar iniziale');`);await shot('avatar-iniziali');
 for(const theme of ['chiaro','scuro'])for(const text of ['normale','grande','enorme']){
  await size(320);await run(`S.prefs.theme='${theme}';S.prefs.text='${text}';applyPrefs();friendsModal();if(document.querySelector('.modal-box').scrollWidth>document.querySelector('.modal-box').clientWidth+1)throw Error('modal overflow ${theme}/${text}');`);await shot('mobile-'+theme+'-'+text);
 }
 await size(375,400);await run(`document.querySelector('#friendin').focus();mobileViewport();if(document.querySelector('.modal-box').getBoundingClientRect().bottom>visualViewport.height+2)throw Error('modale oltre tastiera');mobileBack();if(document.activeElement.matches('input'))throw Error('indietro non chiude tastiera');mobileBack();if(S.modalKind)throw Error('indietro non chiude modale');`);
 await run(`settingsModal();if(/\\p{Extended_Pictographic}/u.test(document.querySelector('#modal').textContent))throw Error('emoji decorative nelle impostazioni');closeModal();`);
 await run(`settingsModal('audio');const input=document.querySelector('#musicVolume');if(!input)throw Error('volume assente');input.value='35';input.dispatchEvent(new Event('input',{bubbles:true}));if(Music.volume()!==35||store.get('bur_prefs',{}).musicVolume!==35)throw Error('volume non persistente');input.scrollIntoView({block:'center'});`);await shot('volume-musica');await run(`closeModal();`);
 await size(405,720,1080/405);await run(`S.prefs.theme='chiaro';S.prefs.text='normale';applyPrefs();store.set('smazzata_home_game','burraco');applyHomeGame();S.screen='home';closeModal();render();`);await shot('01-home');
 await run(`handlers.playBots();`);await shot('02-allenamento');
 await run(`await handlers.createBots();await new Promise(r=>setTimeout(r,1300));if(!document.querySelector('#felt'))throw Error('tavolo allenamento assente');if(document.querySelector('.title').textContent.includes('🤖')||!document.querySelector('.title .ui-icon'))throw Error('intestazione allenamento senza icona personalizzata');`);await shot('03-burraco-tavolo');
 await run(`await emit('surrender');await new Promise(r=>setTimeout(r,1300));if(!document.querySelector('.result-mode-note')||document.querySelector('.result-progress'))throw Error('allenamento con progressi');if(!document.querySelector('.result-actions [data-act=ready]'))throw Error('gioca ancora mancante');`);await shot('04-fine-allenamento');
 await run(`const trainingRoom={...S.room};S.room={...S.room,onDevice:false,offline:false,tutorial:false,progressEligible:true,code:'PROVA',gameSeq:17};S.chestMatch={owner:S.token,roomCode:'PROVA',gameSeq:17,justEarned:true,weeklyEarned:1,progress:0,earnedToday:1,weekly:{missions:[{name:'Completa 3 partite con un amico',progress:2,goal:3,awarded:false}]}};S.handProgress={level:2,into:35,need:200,earned:{roomCode:'PROVA',gameSeq:17,handNo:S.game.handNo,xp:80,trophies:[]}};showResult();if(!document.querySelector('.result-progress')||!document.querySelector('.result-progress').textContent.includes('+80'))throw Error('XP confermati non mostrati');if(S.game.over&&!document.querySelector('.result-loot'))throw Error('riepilogo bottino assente');if(!S.game.over&&resultLootHTML())throw Error('bottino prima della fine partita');S.room.gameSeq++;showResult();if(document.querySelector('.result-progress'))throw Error('progressi di altra partita mostrati');S.room.rankedFormat={id:'classificata-prova',queue:'solo',key:'burraco:solo'};showResult();if(!document.querySelector('[data-act=rankedAgain]')||document.querySelector('[data-act=ready]'))throw Error('rivincita al posto di ricerca classificata');S.room=trainingRoom;showResult();`);
 await run(`handlers.leaveNow();await new Promise(r=>setTimeout(r,250));store.set('smazzata_home_game','scala40');applyHomeGame();handlers.playBots();handlers.createBots();await new Promise(r=>setTimeout(r,1000));`);await shot('05-scala40-tavolo');
 await run(`handlers.leaveNow();await new Promise(r=>setTimeout(r,250));await collectionModal('avatar');document.querySelector('.modal-box').scrollTop=0;`);await shot('06-collezione');
 await run(`closeModal();friendsModal();`);await shot('07-amici');
 await run(`S.room=${JSON.stringify(demoRoom)};S.game=${JSON.stringify(E.viewFor(demo,0))};S.screen='game';render();showResult();if(S.game.handResult.reason==='close'&&S.game.handResult.closer===S.game.you&&!document.querySelector('.result').textContent.includes('Hai chiuso la smazzata'))throw Error('risultato non rivolto al giocatore');`);await shot('08-risultato');
 await run(`S.room={...S.room,onDevice:false,offline:false,progressEligible:true,code:'RICOMPENSE',gameSeq:1};S.game={...S.game,over:true,winners:[0]};S.handProgress={level:2,into:35,need:200,earned:{roomCode:'RICOMPENSE',gameSeq:1,handNo:S.game.handNo,xp:80,trophies:[]}};S.chestMatch={owner:S.token,roomCode:'RICOMPENSE',gameSeq:1,justEarned:true,weeklyEarned:1,progress:0,earnedToday:1,weekly:{missions:[{name:'Completa 3 partite con un amico',progress:2,goal:3,awarded:false}]}};showResult();if(!document.querySelector('.result-loot')||!document.querySelector('.result-loot').textContent.includes('2'))throw Error('premi partita assenti');if(document.querySelector('.modal-box').scrollWidth>document.querySelector('.modal-box').clientWidth+1)throw Error('ricompense fuori schermo');`);await shot('ricompense-fine-partita');

 await run(`S.room=null;S.game=null;S.screen='rankedOverview';S.overviewData={ranks:{},currentSeason:0,ends:Date.now()+86400000};closeModal();render();if(!document.querySelector('.empty-state'))throw Error('classifica vuota senza azione');`);await shot('09-classifica');
 await run(`S.room=null;S.game=null;S.localGame=false;Local.attached=false;S.screen='home';const previousSocial=S.social;S.social=null;S.mailOn=false;closeModal();render();if(!document.querySelector('.guest-start')||document.querySelector('#profile-signup').open)throw Error('accesso ospite');handlers.playBots();if(S.screen!=='setup')throw Error('CPU richiede registrazione');await handlers.practice({dataset:{game:'scala40'}});await new Promise(r=>setTimeout(r,700));if(!S.game||!S.room.tutorial||!S.localGame)throw Error('tutorial ospite non locale');handlers.moveHelp();if(!document.querySelector('[data-act=gameRules]'))throw Error('aiuto contestuale assente');closeModal();handlers.report();const field=document.querySelector('#reportin');field.value='Bozza problema senza rete';field.dispatchEvent(new Event('input',{bubbles:true}));closeModal();handlers.report();if(document.querySelector('#reportin').value!=='Bozza problema senza rete')throw Error('bozza segnalazione persa');closeModal();S.social=previousSocial;`);await shot('aiuto-ospite');
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync(path.join(out,'VERIFICA.json'),JSON.stringify({at:new Date().toISOString(),method:'Chrome da file locali; risposte social vuote simulate, motore locale reale',checks:['320/375/768 px','tema chiaro/scuro','testo normale/grande/enorme','viewport ridotto e Indietro','guida e scelta gioco','quattro avatar iniziali e altri nascosti','bozza amico con emoji conservata','allenamento senza progressi'],sourceBase:require('child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()+' + sorgenti identificate dagli hash' ,sourceHashes,notVerified:['rete e riconnessione reali','background e blocco schermo su Android fisico','API social e classificate sul server','pubblicazione online'],storeSelection:shots.filter(n=>/^\d{2}-/.test(n)),shots},null,2));
 console.log('Verifiche visive locali OK: '+shots.length+' schermate in '+out);
 }catch(e){try{console.log(await run(`return {modal:S.modalKind,phase:S.game?.phase,room:S.room,};`));await shot('errore');console.log(errors);}catch(_){}throw e;}finally{browser.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
