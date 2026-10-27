'use strict';
const fs=require('fs'),path=require('path');
module.exports=async(cdp,shot)=>{
 const results=[];
 for(const lang of ['it','en','es','pt']){
  await cdp.run(`closeModal();if(S.room)handlers.leaveNow();store.set('bur_prefs',{...S.prefs,lang:'${lang}',anim:false});`);
  await cdp.send('Page.reload',{ignoreCache:true});
  let loaded=false;
  for(let attempt=0;attempt<150&&!loaded;attempt++){
   try{loaded=await cdp.run(`return document.readyState==='complete'&&typeof S!=='undefined'&&S.connected&&!!S.social?.nick;`);}catch(error){if(!/context|navigat|destroyed/i.test(error.message))throw error;}
   if(!loaded)await new Promise(r=>setTimeout(r,100));
  }
  if(!loaded)throw Error('Pagina non pronta dopo il cambio lingua: '+lang);
  await cdp.run(`hideIntro();if(LANG!=='${lang}')throw Error('Lingua non applicata');`);
  const scenes=[];
  const scene=async(name,code)=>{
   await cdp.run(code+`;await new Promise(r=>setTimeout(r,80));`);
   scenes.push(await cdp.run(`const box=document.querySelector('#modal:not(.hidden) .modal-box');if(box&&box.scrollWidth>box.clientWidth+1)throw Error('Testi fuori schermo: '+${JSON.stringify(name)});return {name:${JSON.stringify(name)},text:(document.querySelector('#modal:not(.hidden) .modal-content')||document.querySelector('#app')).innerText};`));
  };
  await scene('home',`closeModal();S.screen='home';render()`);
  await scene('guida',`firstRunModal(0)`);
  await scene('modalita',`firstRunModal(1)`);await shot('lingua-'+lang+'-guida');
  await scene('menu',`closeModal();moreModal()`);
  await scene('audio',`settingsModal('audio')`);
  await scene('aspetto',`settingsModal('appearance')`);
  await scene('amici',`friendsModal()`);
  await scene('collezione',`await collectionModal('avatar')`);
  await scene('bottino',`await chestsModal()`);
  await scene('oggi',`await journeyModal()`);
  await scene('settimana',`handlers.journeyTab({dataset:{tab:'week'}})`);
  await scene('mese',`handlers.journeyTab({dataset:{tab:'month'}})`);
  await cdp.run(`closeModal();handlers.playBots();await handlers.createBots();for(let i=0;i<100&&!S.game;i++)await new Promise(r=>setTimeout(r,100));if(!S.game)throw Error('Allenamento assente');`);
  await scene('menu-partita',`tableMenuModal()`);
  await scene('uscita',`closeModal();handlers.leave()`);await shot('lingua-'+lang+'-uscita');
  await scene('uscita-online',`closeModal();window.__roomBefore=S.room;S.room={...S.room,onDevice:false,offline:false};handlers.leave();S.room=__roomBefore`);
  await scene('uscita-offline',`closeModal();window.__roomBefore=S.room;S.room={...S.room,onDevice:false,offline:true};handlers.leave();if(!document.querySelector('#modal').textContent.includes(t('L’allenamento viene chiuso.')))throw Error('Descrizione offline non coerente');S.room=__roomBefore`);
  const missing=await cdp.run(`const values=new Set([...I18N.exact.values()].map(I18N.norm));return [...I18N.missing].filter(s=>!values.has(I18N.norm(s)));`);
  results.push({lang,scenes,missing});
  await cdp.run(`closeModal();handlers.leaveNow();`);
 }
 fs.writeFileSync(path.resolve('test-output/localizzazione.json'),JSON.stringify(results,null,2));
 // Testi osservati nella prima prova Android: una traduzione assente deve far fallire la prova.
 const untranslated=['Allenamento','Amichevole online','Musica','Uscire dal tavolo?','Esci','vincono gli avversari','nessun vincitore, tutti in sala d’attesa','tutti alla schermata iniziale'];
 for(const r of results.filter(r=>r.lang!=='it'))for(const s of r.scenes){
  const lines=s.text.split('\n').map(x=>x.trim());
  const left=untranslated.filter(x=>lines.includes(x));if(/al tuo posto|puoi tornare quando vuoi|allenamento viene chiuso|riprendere l’allenamento/.test(s.text))left.push('frammento italiano nella descrizione di uscita');if(left.length)throw Error('Testi italiani in '+r.lang+'/'+s.name+': '+left.join(', '));
 }
 console.log('Localizzazione UI OK: 16 schermate in quattro lingue, guida, inventario, progressi e conferma uscita senza le etichette italiane rilevate su Android.');
};
