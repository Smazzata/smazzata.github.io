'use strict';
// Percorsi reali su un profilo temporaneo: layout stretto, rete lenta e pressioni ripetute.
module.exports=async(cdp,shot)=>{
 for(const width of [320,375]){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:568,deviceScaleFactor:1,mobile:true});
  for(const text of ['normale','enorme']){
   await cdp.run(`hideIntro();S.prefs.anim=false;S.prefs.text='${text}';applyPrefs();await collectionModal('avatar');`);
   for(const kind of ['avatar','back','frame','felt','reaction','victory']){
    await cdp.run(`handlers.collectionCategory({dataset:{kind:'${kind}'}});const box=document.querySelector('#modal .modal-box');if(box.scrollWidth>box.clientWidth+1)throw Error('Collezione fuori schermo: ${kind}/${text}/${width}');const last=document.querySelector('.collection-card:last-child');if(last){last.scrollIntoView({block:'end'});if(last.getBoundingClientRect().bottom>box.getBoundingClientRect().bottom+2)throw Error('Ultima riga tagliata');}const close=document.querySelector('.modal-close');if(close.getBoundingClientRect().width<44)throw Error('Chiusura troppo piccola');`);
   }
   await cdp.run(`await collectionModal('avatar');await handlers.collectionSelect(document.querySelector('.collection-card'));const box=document.querySelector('.modal-box'),button=document.querySelector('[data-act=collectionEquip]');button.scrollIntoView({block:'end'});const r=button.getBoundingClientRect();if(r.left<0||r.right>innerWidth+1||r.bottom>box.getBoundingClientRect().bottom+2)throw Error('Comando equipaggiamento tagliato');`);
   await shot('rifiniture-anteprima-'+width+'-'+text);
  }
 }
 await cdp.run(`S.prefs.text='normale';applyPrefs();await chestsModal();window.__finishEmit=emit;window.__openCount=0;emit=async function(ev,...args){if(ev==='openChest'){__openCount++;await new Promise(r=>setTimeout(r,250));}return __finishEmit(ev,...args);};const tile=document.querySelector('[data-act=chestOpen]');window.__opening=handlers.chestOpen(tile);handlers.chestOpen(tile);if(tile.getAttribute('aria-busy')!=='true'||!tile.textContent.includes(t('Apertura in corso…')))throw Error('Nessun riscontro apertura');await __opening;emit=__finishEmit;if(__openCount!==1||S.modalKind!=='chestReward')throw Error('Apertura ripetuta');if(document.activeElement!==document.querySelector('.chest-continue'))throw Error('Focus non sul proseguimento');if(document.querySelectorAll('.chest-prize .primary').length!==1)throw Error('Gerarchia premio ambigua');`);
 await shot('rifiniture-premio-compatto');
 await cdp.run(`window.__equipCount=0;emit=async function(ev,...args){if(ev==='profile'||ev==='setCosmetic'){__equipCount++;await new Promise(r=>setTimeout(r,250));}return __finishEmit(ev,...args);};const button=document.querySelector('[data-act=chestEquip]');window.__equipFirst=handlers.chestEquip(button);await handlers.chestEquip(button);await __equipFirst;emit=__finishEmit;if(__equipCount!==1||S.chestEquipBusy)throw Error('Equipaggiamento duplicato o bloccato');`);
 await cdp.run(`chestReveal(S.chestReward);emit=async()=>{throw Error('Errore di rete simulato');};const button=document.querySelector('[data-act=chestEquip]');let failed=false;try{await handlers.chestEquip(button);}catch{failed=true;}finally{emit=__finishEmit;}if(!failed||S.chestEquipBusy||button.disabled||button.hasAttribute('aria-busy'))throw Error('Equipaggiamento bloccato dopo errore');S.prefs.contrast=true;applyPrefs();await collectionModal('avatar');const label=document.querySelector('.collection-card-label');if(getComputedStyle(label).color!=='rgb(255, 255, 255)')throw Error('Testo senza alto contrasto');S.prefs.contrast=false;applyPrefs();`);
 await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await cdp.run(`S.prefs.anim=true;applyPrefs();chestReveal({kind:'coins',coins:30,rarity:'common',chestType:'common'});if(document.querySelector('.chest-prize').hidden||getComputedStyle(document.querySelector('.chest-prize')).animationName!=='none')throw Error('Movimento ridotto ignorato');const b=document.querySelector('.chest-continue');b.scrollIntoView({block:'end'});if(b.getBoundingClientRect().bottom>innerHeight+1)throw Error('Continua non raggiungibile');`);
 await shot('rifiniture-movimento-ridotto');
 console.log('Rifiniture OK: 24 viste categoria a 320/375 px e testo normale/enorme, anteprime, apertura lenta senza duplicati, equipaggiamento unico, premio e movimento ridotto.');
};
