'use strict';
const fs=require('fs'),path=require('path');
module.exports=async(cdp,shot)=>{
 const cycles=Number(process.env.DAILY_UI_CYCLES||100),report={cycles:0,clicks:0,openings:0,gameStarts:0,offlineVisits:0,errors:[]};
 if(!Number.isInteger(cycles)||cycles<1||cycles>120)throw Error('DAILY_UI_CYCLES deve essere fra 1 e 120');
 const click=async selector=>{const p=await cdp.run(`const el=document.querySelector(${JSON.stringify(selector)});if(!el||el.disabled)throw Error('Controllo assente o disabilitato: '+${JSON.stringify(selector)});el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight+1)throw Error('Controllo non raggiungibile');return {x:r.x+r.width/2,y:r.y+r.height/2};`);await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});report.clicks++;await cdp.run(`await new Promise(r=>setTimeout(r,25));`);};
 await cdp.run(`hideIntro();closeModal();S.prefs.anim=false;S.prefs.sound=false;applyPrefs();window.__dailyErrors=[];addEventListener('error',e=>__dailyErrors.push(e.message));addEventListener('unhandledrejection',e=>__dailyErrors.push(String(e.reason)));`);await new Promise(r=>setTimeout(r,900));
 for(let i=0;i<cycles;i++){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:[320,375,414][i%3],height:812,deviceScaleFactor:1,mobile:true});
  await cdp.run(`S.prefs.theme='${i%2?'scuro':'chiaro'}';S.prefs.text='${i%4?'normale':'enorme'}';applyPrefs();closeModal();S.screen='home';render();`);
  await click('.home-navigation [data-act=more]');await click('[data-act=settings]');await click('[data-act=settingsSection][data-section=audio]');await click('[data-act=pref][data-key=sound][data-val=false]');
  await cdp.run(`closeModal();await collectionModal('avatar');handlers.collectionOwnership({dataset:{owned:'true'}});`);
  await click('.collection-card');await click('[data-act=collectionBack]');await click('.collection-mainnav [data-act=chests]');
  const before=await cdp.run(`return S.chestState.pending.length;`);await click('.inventory-chest');
  await cdp.run(`for(let n=0;n<100&&S.modalKind!=='chestReward';n++)await new Promise(r=>setTimeout(r,20));if(S.modalKind!=='chestReward'||document.querySelector('.chest-prize').hidden)throw Error('Premio non rivelato');if((await emit('chests')).chests.pending.length!==${before-1})throw Error('Consumo chest errato');`);report.openings++;
  await click('.chest-prize [data-act=chests]');
  if(i%10===0){
   await cdp.run(`S.connected=false;await chestsModal();if([...document.querySelectorAll('.inventory-chest')].some(x=>!x.disabled))throw Error('Chest disponibile offline');S.connected=true;await chestsModal();`);report.offlineVisits++;
   await cdp.run(`closeModal();store.set('smazzata_home_game','${['burraco','scala40','ramino','canasta'][Math.floor(i/10)%4]}');applyHomeGame();handlers.playBots();await handlers.createBots();if(!document.querySelector('#hand .card'))throw Error('Partita locale senza carte');tableMenuModal();`);await click('[data-act=closeModal]');
   await cdp.run(`handlers.leaveNow();await new Promise(r=>setTimeout(r,60));if(S.screen!=='home')throw Error('Uscita partita non torna alla home');`);report.gameStarts++;
  }
  report.cycles++;if((i+1)%20===0){console.log(JSON.stringify({...report,errors:undefined}));await shot('quotidiano-'+(i+1));}
 }
 report.errors=await cdp.run(`return __dailyErrors;`);if(report.errors.length)throw Error(report.errors.join('\n'));
 fs.writeFileSync(path.resolve('test-output/daily-ui-report.json'),JSON.stringify(report,null,2));console.log('Uso quotidiano browser OK: '+JSON.stringify(report));
};
