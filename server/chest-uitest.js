'use strict';
// Inventario dimostrativo solo nel DATA_DIR temporaneo: nessuna API di assegnazione nel gioco.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {spawn}=require('node:child_process'),assert=require('node:assert/strict');
const {findBrowser,connect}=require('./cdp'),C=require('./chests'),Cosmetics=require('../shared/cosmetics');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'smazzata-chest-ui-')),dir=path.join(root,'data');fs.mkdirSync(dir);
 const key=crypto.randomBytes(18).toString('hex'),s={nick:'Collezionista',name:'Collezionista',cosmeticOwned:Cosmetics.LIST.map(x=>x.id),devices:[{h:crypto.createHash('sha256').update(key).digest('hex'),at:Date.now()}]};
 const p=new Map([['demo',s],['other',{nick:'Altro'}]]);
 for(let i=0;i<3;i++)C.recordGame({chestGameId:String(i),seats:[{token:'demo'},{token:'other'}],progressEligible:true,game:{over:true,handResult:{reason:'close'}}},p,()=>{});
 s.chests.items=['common','rare','epic','legendary'].map((type,i)=>({id:String(i+1),type,version:1,at:Date.now()}));s.chests.issued=4;s.chests.fragments=2000;
 fs.writeFileSync(path.join(dir,'stato.json'),JSON.stringify({accountsEpoch:3,progressEpoch:1,sessions:[['demo',s]],leaderboard:[],rooms:[],leagues:[],tournaments:[],daily:[]}));
 const out=path.resolve(__dirname,'../test-output/chests');fs.mkdirSync(out,{recursive:true});
 const server=spawn(process.execPath,[path.join(__dirname,'index.js')],{env:{...process.env,DATA_DIR:dir,PORT:'3992'},stdio:['ignore','pipe','pipe']});
 let browser,cdp;const errors=[];
 try{
  await new Promise((res,rej)=>{const timer=setTimeout(()=>rej(Error('server non avviato')),15000);server.stdout.on('data',d=>{if(String(d).includes('ascolto')){clearTimeout(timer);res();}});server.once('exit',()=>rej(Error('server terminato')));});
  browser=spawn(findBrowser(),['--headless=new','--no-first-run','--no-sandbox','--remote-debugging-port=9336','--user-data-dir='+path.join(root,'browser'),'about:blank'],{stdio:'ignore'});
  let target;for(let i=0;i<60&&!target;i++){try{target=(await(await fetch('http://127.0.0.1:9336/json')).json()).find(t=>t.type==='page');}catch(_){}if(!target)await wait(100);}
  if(!target)throw Error('browser non avviato');cdp=await connect(target.webSocketDebuggerUrl);
  cdp.on(m=>{if(m.method==='Runtime.exceptionThrown'){const p=m.params;errors.push(p.exceptionDetails.exception?.description||p.exceptionDetails.text);}});
  await cdp.send('Runtime.enable');await cdp.send('Page.enable');
  await cdp.send('Page.addScriptToEvaluateOnNewDocument',{source:`localStorage.setItem('bur_token',${JSON.stringify(JSON.stringify(key))});localStorage.setItem('smazzata_intro_seen','true');localStorage.setItem('bur_prefs','{"anim":true,"lang":"it"}');`});
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
  await cdp.send('Page.navigate',{url:'http://localhost:3992'});await wait(1800);
  const shot=async name=>{await cdp.run('await document.fonts.ready;');const r=await cdp.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));};
  await cdp.run(`const originalEmit=socket.emit;socket.emit=function(...args){if(['openChest','exchangeChestFragments'].includes(args[0])&&('owner' in args[1]||'type' in args[1]))throw Error('campi locali inviati al server');return originalEmit.apply(this,args);};await profileModal();document.querySelector('[data-act=chests]').click();await new Promise(r=>setTimeout(r,300));if(document.querySelectorAll('.chest-types>div').length!==4)throw Error('quattro chest mancanti');
    await Promise.all(['opening','rare','epic','legendary'].map(id=>new Promise((res,rej)=>{const img=new Image();img.onload=()=>img.naturalWidth/img.naturalHeight===3?res():rej(Error('sprite deformato'));img.onerror=rej;img.src='art/chests/chest-'+id+'.webp';})));`);
  for(const width of [320,375,768]){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:812,deviceScaleFactor:1,mobile:true});
   for(const theme of ['chiaro','scuro']){
    await cdp.run(`S.prefs.theme='${theme}';applyPrefs();await chestsModal();const box=document.querySelector('.modal-box');if(box.scrollWidth>box.clientWidth+1)throw Error('chest fuori schermo');const last=document.querySelector('.chest-exchanges>div:last-child');last.scrollIntoView({block:'end'});if(last.getBoundingClientRect().bottom>box.getBoundingClientRect().bottom+1)throw Error('scambio tagliato');box.scrollTop=0;`);
    await shot('menu-'+width+'-'+theme);
   }
  }
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:320,height:812,deviceScaleFactor:1,mobile:true});
  await cdp.run(`S.prefs.text='enorme';applyPrefs();await chestsModal();const box=document.querySelector('.modal-box');if(box.scrollWidth>box.clientWidth+1)throw Error('chest con testo enorme fuori schermo');S.prefs.text='normale';S.prefs.theme='chiaro';applyPrefs();`);
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true});
  await cdp.run(`await chestsModal();document.querySelector('.chest-rules').open=true;document.querySelector('.chest-types').scrollIntoView({block:'center'});`);await shot('quattro-chest');
  await cdp.run(`S.prefs.theme='chiaro';S.prefs.anim=true;applyPrefs();await handlers.chestOpen({dataset:{id:'1'}});if(!document.querySelector('.is-opening'))throw Error('apertura non animata');`);
  const positions=[];
  for(const [i,time] of [0,500,950,1450].entries()){
   positions.push(await cdp.run(`const el=document.querySelector('.chest-stage .chest-sprite');for(const a of el.getAnimations())if(a.animationName==='chest-unlock'){a.pause();a.currentTime=${time};}return getComputedStyle(el).backgroundPosition;`));
   await shot('apertura-'+i);
  }
  assert.equal(new Set(positions).size,4);
  await cdp.run(`await new Promise(r=>setTimeout(r,2000));if(document.querySelector('.chest-prize').hidden)throw Error('premio non rivelato automaticamente');handlers.chestSkip();const p=await emit('profile'),a=S.chestState.recent[0];if(!(a.kind==='avatar'?p.ownedAvatarIds:p.cosmetics.ownedIds).includes(a.itemId))throw Error('premio non posseduto');await handlers.chestEquip({dataset:{kind:a.kind,itemId:a.itemId}});const equipped=await emit('profile');if((a.kind==='avatar'?equipped.avatar.id:equipped.cosmetics.loadout[a.kind])!==a.itemId)throw Error('premio non equipaggiato');`);
  for(const id of ['2','3','4']){
   await cdp.run(`await chestsModal();S.prefs.anim=false;applyPrefs();await handlers.chestOpen({dataset:{id:'${id}'}});if(!document.querySelector('.is-revealed')||document.querySelector('.chest-prize').hidden)throw Error('movimento ridotto');${id==='4'?"if(document.querySelector('.chest-reveal').dataset.rarity!=='legendary')throw Error('premio leggendario non garantito');":''}`);
   await shot('premio-'+id);
  }
  await cdp.run(`const requestId='ui-recovery-1234567890';const r=await emit('exchangeChestFragments',{rarity:'epic',requestId});if(!r.ok)throw Error('scambio fallito');store.set('bur_chest_request',{owner:S.token,type:'exchange',rarity:'epic',requestId});await chestsModal();if(!document.querySelector('[data-act=chestRetry]'))throw Error('recupero assente');await handlers.chestRetry();if(S.chestState.fragments!==r.chests.fragments)throw Error('doppio costo');await chestsModal();S.connected=false;await chestsModal();if(!document.querySelector('[data-act=chestOpen]').disabled)throw Error('apertura offline permessa');if([...document.querySelectorAll('[data-act=chestExchange]')].some(b=>!b.disabled))throw Error('scambio offline permesso');S.connected=true;`);
  await shot('offline');
  await cdp.run(`await profileModal();const last=document.querySelector('.avopt:last-child'),box=document.querySelector('.modal-box');last.scrollIntoView({block:'end'});if(last.getBoundingClientRect().bottom>box.getBoundingClientRect().bottom+1)throw Error('ultima riga avatar tagliata');`);
  for(const kind of Cosmetics.KINDS){
   for(const width of [320,375])for(const theme of ['chiaro','scuro']){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:812,deviceScaleFactor:1,mobile:true});
    await cdp.run(`S.prefs.theme='${theme}';S.prefs.text='enorme';applyPrefs();await cosmeticsModal('${kind.id}');if(document.querySelectorAll('.cx-item').length!==20)throw Error('inventario cosmetici incompleto');const box=document.querySelector('.modal-box');if(box.scrollWidth>box.clientWidth+1)throw Error('collezione fuori schermo');document.querySelector('.cx-item:last-child').scrollIntoView({block:'end'});if(document.querySelector('.cx-item:last-child').getBoundingClientRect().bottom>box.getBoundingClientRect().bottom+1)throw Error('ultima riga cosmetici tagliata');`);
    await shot('collezione-'+kind.id+'-'+width+'-'+theme);
   }
   await cdp.send('Emulation.setDeviceMetricsOverride',{width:1000,height:1300,deviceScaleFactor:1,mobile:false});
   await cdp.run(`S.prefs.text='normale';S.prefs.theme='chiaro';applyPrefs();await cosmeticsModal('${kind.id}');document.querySelector('.modal-box').style.maxWidth='940px';document.querySelector('.cx-grid').style.gridTemplateColumns='repeat(5,minmax(0,1fr))';await Promise.all([...document.images].map(img=>{img.loading='eager';return img.decode().catch(()=>{});}));`);await shot('catalogo-'+kind.id);
   await cdp.run(`document.querySelector('.modal-box').style.maxWidth='';`);
   const item=Cosmetics.LIST.find(x=>x.kind===kind.id&&x.rarity==='legendary');
   await cdp.run(`S.prefs.text='normale';applyPrefs();await cosmeticsModal('${kind.id}');await handlers.cosmeticEquip({dataset:{id:'${item.id}'}});if((await emit('cosmetics')).cosmetics.loadout['${kind.id}']!=='${item.id}')throw Error('stile non applicato');`);
  }
  await cdp.run(`const images=window.SmazzataCosmetics.LIST.filter(x=>x.art);await Promise.all(images.map(x=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve();img.onerror=()=>reject(Error('illustrazione mancante '+x.id));img.src=x.art;})));`);
  await cdp.run(`await profileModal();const p=await emit('profile');if(!avatarHTML(p.nick,0,false,p.avatar).includes('cx-frame'))throw Error('cornice non visibile');if(!document.body.classList.contains('cx-back')||!document.body.classList.contains('cx-felt'))throw Error('materiali non applicati');const ids=[...document.querySelectorAll('.cx-frame [id]')].map(e=>e.id);if(new Set(ids).size!==ids.length)throw Error('ID SVG duplicati');if(cosmeticReactions().length!==20)throw Error('reazioni mancanti');S.prefs.anim=true;const v=cosmeticState().loadout.victory;playCosmeticVictory(v);if(!document.querySelector('.cx-celebration'))throw Error('vittoria non animata');document.querySelector('.cx-celebration-skip').click();if(document.querySelector('.cx-celebration'))throw Error('animazione non interrompibile');S.prefs.anim=false;playCosmeticVictory(v);if(document.querySelector('.cx-celebration'))throw Error('animazione non ridotta');`);
  await cdp.run(`const avatar=document.querySelector('.avpreview .avatar'),frame=avatar.querySelector('.cx-frame'),a=avatar.getBoundingClientRect(),f=frame.getBoundingClientRect();if(f.width>a.width*1.6||Math.abs(f.x+f.width/2-a.x-a.width/2)>2)throw Error('cornice fuori dal ritratto');`);
  for(const item of Cosmetics.LIST.filter(x=>x.kind==='victory')){
   await cdp.run(`S.prefs.anim=true;applyPrefs();playCosmeticVictory('${item.id}');await new Promise(r=>setTimeout(r,100));const cv=document.querySelector('.cx-celebration');if(!cv||getComputedStyle(cv).display==='none'||!cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data.some((v,i)=>i%4===3&&v>0))throw Error('effetto vuoto ${item.id}');`);
   if([10,17,19].includes(item.index)){await wait(650);await shot('vittoria-'+item.index);}
   await cdp.run(`${item.index===19?"if(!document.querySelector('.cx-victory-phoenix'))throw Error('fenice leggendaria assente');":''}document.querySelector('.cx-celebration-skip').click();if(document.querySelector('.cx-victory-phoenix'))throw Error('fenice non rimossa');`);
  }
  await cdp.run(`const reaction=cosmeticReactions()[0],previous=S.game,target=document.createElement('div');target.className='handwrap';document.body.append(target);S.game={you:0};showSeatBubble(0,'👏',reaction.id);if(!document.querySelector('.reaction.cx-illustrated img'))throw Error('reazione illustrata non mostrata');target.remove();S.game=previous;`);
  await cdp.run(`S.connected=false;await cosmeticsModal('back');if(!document.querySelector('.chest-notice')||!document.querySelector('[data-act=cosmeticReset]').disabled)throw Error('stile modificabile offline');S.connected=true;`);
  await cdp.run(`S.connected=false;await handlers.pref({dataset:{key:'back',val:'rosso'}});if(document.body.classList.contains('cx-back'))throw Error('dorso base non disponibile offline');S.connected=true;cacheCosmetics((await emit('cosmetics')).cosmetics);`);
  await cdp.run(`const c=cosmeticState();store.set('bur_cosmetic_cache',{owner:'altro-profilo',data:c});applyCosmetics();if(cosmeticState().ownedIds.length||document.body.classList.contains('cx-back'))throw Error('inventario visibile ad altro profilo');cacheCosmetics(c);`);
  if(errors.length)throw Error(errors.join('\n'));
  console.log('Chest UI OK: quattro sprite, sei layout, testo enorme, quattro fotogrammi, premi, recupero, scambio, riduzione movimento e offline');
 }finally{if(cdp)cdp.ws.close();if(browser)browser.kill();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
