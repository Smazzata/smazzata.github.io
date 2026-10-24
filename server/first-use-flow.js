'use strict';
// Percorsi mediante click sulle etichette visibili, senza chiamare gli handler interni.
module.exports=async(cdp,shot)=>{
 let clicks=0;
 const wait=async expression=>cdp.run(`for(let i=0;i<120;i++){if(${expression})return;await new Promise(r=>setTimeout(r,50));}throw Error('Attesa percorso: '+${JSON.stringify(expression)});`);
 const click=async selector=>{
  await wait(`document.querySelector(${JSON.stringify(selector)})&&!document.querySelector(${JSON.stringify(selector)}).disabled`);
  const pos=await cdp.run(`const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();if(!r.width||!r.height)throw Error('Controllo non visibile');return {x:r.x+r.width/2,y:r.y+r.height/2};`);
  await cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',...pos,button:'left',clickCount:1});
  await cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',...pos,button:'left',clickCount:1});
  clicks++;
 };
 await wait(`!document.querySelector('#intro')||getComputedStyle(document.querySelector('#intro')).display==='none'||document.querySelector('#intro').classList.contains('out')`);
 await click('#app [data-act=collection]');await wait(`document.querySelector('.collection-card')`);
 await cdp.run(`if(document.querySelector('.collection-filters').open)throw Error('Filtri avanzati aperti');if(document.querySelectorAll('.collection-categories>button').length!==6)throw Error('Categorie mancanti');`);
 await click('.collection-card[data-id="dama-fiori"]');await click('[data-act=collectionEquip]');
 await wait(`document.querySelector('.equip-confirmation')?.textContent.includes('Dama di fiori')`);
 await shot('primo-uso-equipaggiato');
 await click('.collection-mainnav [data-act=chests]');await wait(`document.querySelector('.chest-open-button')`);
 await cdp.run(`if(document.querySelector('.modal-content').textContent.includes('%'))throw Error('Percentuali nel percorso semplice');if([...document.querySelectorAll('.loot-secondary')].some(x=>x.open))throw Error('Dettagli aperti');`);
 await click('.chest-open-button');await wait(`document.querySelector('[data-act=firstChestOpen]')`);await click('[data-act=firstChestOpen]');
 await wait(`document.querySelector('.chest-prize')&&!document.querySelector('.chest-prize').hidden`);
 await click('[data-act=chestEquip]');await wait(`document.querySelector('.simple-loot')&&document.querySelector('.equip-confirmation')`);
 await shot('primo-uso-bottino');
 await cdp.run(`const peer=io({forceNew:true});try{await new Promise(r=>{peer.once('welcome',r);peer.on('connect',()=>peer.emit('hello',{token:S.token,name:S.name}));});const call=(ev,data={})=>new Promise(r=>peer.emit(ev,data,r));const before=await call('chests');const id=before.chests.pending[0].id;const reward=await call('openChest',{id});if(!reward.ok)throw Error('apertura altro dispositivo fallita');}finally{peer.disconnect();}`);
 await wait(`document.querySelector('.collection-mainnav [data-act=chests] b')?.textContent==='2'`);

 // Interrompi il trasporto vero: la pagina deve aspettare lo stato, non solo il socket.
 await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await cdp.run(`window.dispatchEvent(new Event('offline'));`);
 await wait(`document.querySelector('.offline')?.textContent.includes('Ti stiamo ricollegando')`);
 await shot('primo-uso-riconnessione');
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await cdp.run(`window.dispatchEvent(new Event('online'));`);
 await wait(`!document.querySelector('.offline')&&document.querySelector('.simple-loot')`);
 await cdp.run(`if(document.querySelectorAll('.inventory-chest').length<1)throw Error('Inventario non ripristinato');`);
 await click('.modal-close');await wait(`document.querySelector('#modal').classList.contains('hidden')`);
 await click('#app [data-act=playBots]');await wait(`document.querySelector('[data-act=createBots]')`);await click('[data-act=createBots]');await wait(`document.querySelector('#hand .card')`);
 await shot('primo-uso-partita');
 console.log('Percorsi UI OK: Collezione → usa avatar → Bottino → prima chest → usa premio → riconnessione → avvio partita; click sui controlli visibili. Non è una prova con persone reali.');
 console.log(JSON.stringify({visibleClicks:clicks,viewport:await cdp.run('return innerWidth;')}));
};
