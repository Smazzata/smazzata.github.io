'use strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async(cdp,shot)=>{
 const ready=()=>cdp.run(`for(let i=0;i<150&&(!S.connected||S.syncPending||!S.social?.nick);i++)await new Promise(r=>setTimeout(r,100));if(!S.connected||S.syncPending||!S.social?.nick)throw Error('Rientro non completato');`);
 const reload=async()=>{await cdp.send('Page.reload',{ignoreCache:true});await wait(1000);await ready();};
 await ready();
 await cdp.run(`hideIntro();S.prefs.anim=false;applyPrefs();window.__before=(await emit('chests')).chests;`);
 // Il server salva davvero il premio; la conferma viene persa prima della logica client.
 // La chiusura del socket cancella le richieste pendenti: non si falsifica il saldo.
 const lose=event=>cdp.run(`
  window.__savedEmit=socket.emit;
  socket.emit=function(event,...args){
   if(event===${JSON.stringify(event)}){const acknowledge=args.pop();args.push(result=>{window.__savedReceipt=result;socket.disconnect();window.dispatchEvent(new Event('offline'));});}
   return __savedEmit.call(this,event,...args);
  };
 `);
 const restore=async()=>{
  await cdp.run(`socket.emit=__savedEmit;window.dispatchEvent(new Event('online'));`);
  await ready();
 };
 for(const type of ['common','rare']){
  await cdp.run(`await chestsModal();window.__chest=S.chestState.pending.find(x=>x.type==='${type}');if(!__chest)throw Error('Chest di prova mancante');`);
  await lose('openChest');
  const receipt=await cdp.run(`await handlers.chestOpen({dataset:{id:__chest.id}});if(S.connected||!chestRequest()||!document.querySelector('[data-act=chestRetry]')?.disabled)throw Error('Apertura interrotta non conservata');if(!__savedReceipt?.ok)throw Error('Salvataggio server non confermato dalla prova');return {id:__chest.id,reward:__savedReceipt.reward,coins:__savedReceipt.chests.coins,pending:__savedReceipt.chests.pending.length};`);
  await restore();await reload();
  await cdp.run(`if(chestRequest()?.id!==${JSON.stringify(receipt.id)})throw Error('Richiesta persa al riavvio della pagina');await chestsModal();await handlers.chestRetry();const live=(await emit('chests')).chests;if(chestRequest()||live.coins!==${receipt.coins}||live.pending.length!==${receipt.pending}||JSON.stringify(S.chestReward)!==${JSON.stringify(JSON.stringify(receipt.reward))})throw Error('Premio duplicato o cambiato dopo riconnessione');`);
 }
 for(const rarity of ['common','rare']){
  await cdp.run(`await collectionModal('avatar');S.collectionOnlyOwned=false;renderCollection();window.__buy=collectionItems().find(x=>x.kind==='avatar'&&x.rarity==='${rarity}'&&!collectionOwned().has(x.id));if(!__buy)throw Error('Oggetto di prova mancante');await handlers.collectionBuy({dataset:{id:__buy.id}});`);
  await lose('buyCollectionItem');
  const receipt=await cdp.run(`await handlers.buyConfirm({dataset:{id:__buy.id}});if(S.connected||!chestRequest()||!__savedReceipt?.ok)throw Error('Acquisto interrotto non conservato');return {itemId:__buy.id,requestId:chestRequest().requestId,coins:__savedReceipt.chests.coins,reward:__savedReceipt.reward};`);
  await restore();await reload();
  await cdp.run(`if(chestRequest()?.requestId!==${JSON.stringify(receipt.requestId)})throw Error('Identificativo acquisto cambiato al reload');await chestsModal();await Promise.all([handlers.chestRetry(),handlers.chestRetry()]);const live=await emit('profile');if(chestRequest()||live.chests.coins!==${receipt.coins}||!live.ownedAvatarIds.includes(${JSON.stringify(receipt.itemId)}))throw Error('Acquisto perso o doppio addebito');`);
 }
 await shot('interruzioni-premi-recuperati');
 // Perdita di rete prima dell'invio: nessuna operazione accodata da eseguire al rientro.
 await cdp.run(`await chestsModal();window.__offlineBefore=(await emit('chests')).chests;socket.disconnect();window.dispatchEvent(new Event('offline'));await handlers.chestOpen({dataset:{id:__offlineBefore.pending[0].id}});if(chestRequest())throw Error('Operazione offline accodata');window.dispatchEvent(new Event('online'));`);
 await ready();
 await cdp.run(`const live=(await emit('chests')).chests;if(live.coins!==__offlineBefore.coins||live.pending.length!==__offlineBefore.pending.length)throw Error('Invio offline ha cambiato inventario');closeModal();for(const [event,data] of [['createRoom',{rules:{players:2,target:505}}],['addBot',{}],['start',{}]]){const r=await emit(event,data);if(!r.ok)throw Error('Preparazione tavolo: '+event+' '+JSON.stringify(r));}for(let i=0;i<300&&(!S.game||S.game.turn!==S.game.you||S.game.phase!=='draw');i++)await new Promise(r=>setTimeout(r,100));if(!S.game||S.game.phase!=='draw'||S.game.turn!==S.game.you)throw Error('Turno umano assente');window.__moveBefore={stock:S.game.stockCount,hand:S.game.hand.length};`);
 await lose('action');
 const move=await cdp.run(`await act('draw');if(!__savedReceipt?.ok||S.connected)throw Error('Pesca interrotta non applicata sul server');if(S.game.stockCount!==__moveBefore.stock-1||S.game.hand.length!==__moveBefore.hand+1)throw Error('Pesca non ricevuta nello stato');return {hand:S.game.hand.map(c=>c.id).sort((a,b)=>a-b),stock:S.game.stockCount};`);
 await restore();await reload();
 await cdp.run(`if(JSON.stringify(S.game.hand.map(c=>c.id).sort((a,b)=>a-b))!==${JSON.stringify(JSON.stringify(move.hand))}||S.game.stockCount!==${move.stock}||S.game.phase!=='play')throw Error('Mossa ripetuta o persa dopo rientro');if(S.actionPending||S.syncPending)throw Error('Comandi bloccati dopo ripresa');`);
 await shot('interruzione-pesca-recuperata');
 console.log('Interruzioni UI OK: 2 aperture e 2 acquisti salvati senza conferma, socket chiuso, reload, recupero idempotente e doppio tocco; invio offline bloccato; pesca reale conservata dopo riconnessione e reload.');
};
