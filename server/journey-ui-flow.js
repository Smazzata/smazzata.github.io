'use strict';
const assert=require('node:assert/strict');
module.exports=async(cdp,shot)=>{
 await cdp.run(`hideIntro();await new Promise(r=>setTimeout(r,650));const button=document.querySelector('.home-journey');if(!button)throw Error('percorso assente dalla home');button.click();await new Promise(r=>setTimeout(r,200));if(document.querySelectorAll('.journey-steps li').length!==10)throw Error('dieci tappe mancanti');if(document.querySelector('.journey-album').open)throw Error('album aperto senza scelta');`);
 for(const width of [320,375,768])for(const theme of ['chiaro','scuro']){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:812,deviceScaleFactor:1,mobile:true});
  await cdp.run(`S.prefs.theme='${theme}';S.prefs.text='enorme';applyPrefs();await journeyModal();const box=document.querySelector('.modal-box');if(box.scrollWidth>box.clientWidth+1)throw Error('percorso fuori schermo');if(document.querySelector('.player-journey').textContent.includes('%'))throw Error('percentuali nel percorso');document.querySelector('.journey-steps li:last-child').scrollIntoView({block:'center'});`);
  await new Promise(r=>setTimeout(r,300));await shot('percorso-'+width+'-'+theme);
  await cdp.run(`document.querySelector('.journey-album').open=true;const last=document.querySelector('.memory-card:last-child');last.scrollIntoView({block:'end'});const box=document.querySelector('.modal-box');if(last.getBoundingClientRect().bottom>box.getBoundingClientRect().bottom+1)throw Error('album tagliato');`);
  await shot('album-'+width+'-'+theme);
 }
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:320,height:812,deviceScaleFactor:1,mobile:true});
 await cdp.run(`S.prefs.text='normale';S.prefs.theme='chiaro';applyPrefs();await journeyModal();document.querySelector('.modal-box').scrollTop=0;`);await new Promise(r=>setTimeout(r,300));await shot('percorso-ingresso');
 await cdp.run(`S.prefs.text='normale';S.prefs.theme='chiaro';applyPrefs();friendsModal();const button=document.querySelector('[data-act=favoriteFriend]');if(!button)throw Error('comando abituali assente');button.click();await new Promise(r=>setTimeout(r,200));if(!S.social.friends.find(x=>x.nick==='Altro').favorite)throw Error('abituale non salvato');if(!document.querySelector('[data-act=favoriteFriend][aria-pressed=true]'))throw Error('abituale non visibile');if(document.querySelector('.modal-box').scrollWidth>document.querySelector('.modal-box').clientWidth+1)throw Error('amici fuori schermo');`);
 await shot('gruppo-abituale');
 await cdp.run(`closeModal();friendsModal();if(!document.querySelector('[data-act=favoriteFriend][aria-pressed=true]'))throw Error('abituale perso tornando al menu');document.querySelector('[data-act=favoriteFriend]').click();await new Promise(r=>setTimeout(r,150));if(S.social.friends.some(x=>x.favorite))throw Error('rimozione abituale fallita');await chestsModal();if(!document.querySelector('[data-act=journey]'))throw Error('percorso assente dal bottino');if(!document.querySelector('.loot-next').textContent.includes('Ancora 3 partite'))throw Error('prossimo premio non chiaro');`);
 // Uno stato vecchio non deve riaprire il percorso chiuso nel frattempo.
 await cdp.run(`playerMenu('Altro');document.querySelector('[data-act=favoriteFriend]').click();await new Promise(r=>setTimeout(r,200));if(document.querySelector('[data-act=favoriteFriend]').dataset.favorite!=='false')throw Error('menu giocatore non aggiornato');document.querySelector('[data-act=favoriteFriend]').click();await new Promise(r=>setTimeout(r,200));if(S.social.friends.some(x=>x.favorite))throw Error('menu giocatore non rimuove abituale');`);
 assert(await cdp.run(`const originalEmit=emit;let release;emit=(event,...args)=>event==='chests'?new Promise(r=>release=r):originalEmit(event,...args);S.modalKind='journey';const pending=journeyModal(true);closeModal();release({ok:true,chests:S.chestState});await pending;emit=originalEmit;return S.modalKind!=='journey';`));
 console.log('Percorso UI OK: 10 tappe, album, 320/375/768, due temi, testo enorme, gruppo abituale persistente e prossimo premio');
};
