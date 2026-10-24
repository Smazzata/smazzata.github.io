'use strict';
// Le immagini raccontano l'apertura; il risultato è già salvato dal server.
function cacheChestState(data) {
  if(data)store.set('bur_chest_cache',{owner:S.token,data});
}
function chestRequest() {
  const r=store.get('bur_chest_request',null);
  return r?.owner===S.token?r:null;
}
async function chestsModal(refreshOnly=false) {
  const owner=S.token;let data,online=false;
  if(!OFFLINE&&S.connected){const r=await emit('chests');if(owner!==S.token)return;if(r.ok){data=r.chests;online=true;cacheChestState(data);}}
  if(!data){const cached=store.get('bur_chest_cache',null);if(cached?.owner===S.token)data=cached.data;}
  if(owner!==S.token)return;
  if(refreshOnly===true&&S.modalKind!=='chests')return;
  if(!data){toast(t('Collegati per consultare le tue chest'),true);return;}
  S.chestState=data;S.chestReadOnly=!online;
  const rules=data.rules,request=chestRequest(),disabled=!online||!!request,rarities=window.SmazzataAvatars.RARITIES;
  const selected=data.pending.find(x=>x.id===S.selectedChestId)||data.pending[0],type=selected?.type||'common';
  openModal('chests',collectionShell('loot',`<section class="chest-room simple-loot"><h2>${t('Le tue chest')}</h2><p>${t('Apri una chest e scopri il tuo premio.')}</p>
    ${!online?`<p class="chest-notice" role="status">${t('Copia offline: collegati per aprire o scambiare.')}</p>`:''}
    ${data.pending.length?`<div class="inventory-chests">${rarities.filter(r=>data.pending.some(x=>x.type===r.id)).map(r=>{const items=data.pending.filter(x=>x.type===r.id);return `<button class="inventory-chest" data-act="chestSelect" data-id="${esc(items[0].id)}" data-chest-type="${r.id}" aria-pressed="${type===r.id}"><span class="chest-sprite" aria-hidden="true"></span><b>${t(rules.types[r.id].name)}</b><small>×${items.length}</small></button>`;}).join('')}</div>`:`<p class="chest-notice">${t('Nessuna chest da aprire. Le prossime ti aspettano qui.')}</p>`}
    ${request?`<p role="status">${t('Un risultato è in attesa di conferma. Recuperalo prima di continuare.')}</p><button class="btn primary" data-act="chestRetry" ${!online?'disabled':''}>${t('Recupera risultato')}</button>`:`<button class="btn primary chest-open-button" data-act="chestOpen" data-id="${esc(selected?.id||'')}" ${disabled||!selected?'disabled':''}>${selected?t('Apri')+' · '+t(rules.types[type].name):t('Apri una chest')}</button>`}
    <div class="loot-next"><p>${t('Prossima chest')}: <b>${data.progress}/3 ${t('partite')}</b></p><progress class="chest-progress" value="${data.progress}" max="3" aria-label="${t('Progressi verso la prossima chest')}"></progress>${data.earnedToday>=2?`<p class="muted small">${t('Limite giornaliero raggiunto. Riprendi domani; le tue chest non scadono.')}</p>`:''}</div>
    ${data.weekly?`<details class="loot-secondary weekly-goals"><summary>${t('Come ottenere altre chest')}</summary><p>${t('Una chest ogni 3 partite online completate con avversari umani. Massimo 2 al giorno.')}</p>${data.weekly.missions.map(m=>`<div class="weekly-goal ${m.awarded?'is-complete':''}"><span><b>${t(m.name)}</b><small>${m.progress}/${m.goal}${m.awarded?' · '+t('Premio consegnato'):''}</small></span><progress value="${m.progress}" max="${m.goal}" aria-label="${t(m.name)}"></progress></div>`).join('')}</details>`:''}
    <details class="loot-secondary collection-loot-details"><summary>${t('Usa frammenti')} · ${data.fragments}</summary><p>${t('I doppioni diventano frammenti. Usali qui per ottenere un oggetto che ti manca.')}</p><div class="chest-exchanges">${rarities.map(r=>`<div><span><b>${t(r.name)}</b><small>${rules.costs[r.id]} ${t('frammenti')}</small></span><button class="btn small" data-act="chestExchange" data-rarity="${r.id}" ${disabled||!data.missing[r.id]||data.fragments<rules.costs[r.id]?'disabled':''}>${t(!data.missing[r.id]?'Tutti ottenuti':'Scambia')}</button></div>`).join('')}</div></details>
    ${data.recent.length?`<details class="loot-secondary"><summary>${t('Ultime aperture')}</summary><div class="chest-history">${data.recent.map(x=>{const a=chestPrize(x);return `<div>${a.html}<span>${esc(t(a.name))}<small>${x.duplicate?'+'+x.fragments+' '+t('frammenti'):t('Nuovo oggetto')}</small></span></div>`;}).join('')}</div></details>`:''}
  </section>`));
  $('#modal .modal-box').scrollTop=0;
}
function chestReveal(reward) {
  const a=chestPrize(reward),rarity=window.SmazzataAvatars.RARITIES.find(r=>r.id===reward.rarity);
  const reduce=S.prefs.anim===false || matchMedia('(prefers-reduced-motion: reduce)').matches;
  clearTimeout(S.chestRevealTimer);
  openModal('chestReward',collectionShell('loot',`<section class="chest-reveal ${reduce?'':'is-opening'}" data-rarity="${rarity.id}">
    <h2>${t('Il tuo premio')}</h2><div class="chest-stage" data-chest-type="${reward.chestType || reward.rarity}" aria-hidden="true"><div class="chest-burst"></div><div class="chest-sprite"></div>${Array.from({length:8},(_,i)=>`<i class="chest-spark" style="--spark:${i}"></i>`).join('')}</div>
    <button class="btn small chest-skip" data-act="chestSkip">${t('Salta animazione')}</button>
    <div class="chest-prize" hidden role="status"><div class="chest-prize-art">${a.html}</div><span class="avatar-rarity" data-rarity="${rarity.id}">${t(rarity.name)}</span><h3>${esc(t(a.name))}</h3><p>${reward.duplicate?t('Doppione')+' · +'+reward.fragments+' '+t('frammenti'):t('Nuovo oggetto nella tua collezione')}</p><div class="row"><button class="btn primary" data-act="chestEquip" data-kind="${a.kind}" data-item-id="${a.id}">${a.kind==='avatar'?t('Usa avatar'):t('Usa questo stile')}</button><button class="btn" data-act="chests">${t('Continua')}</button></div></div></section>`));
  $('#modal .modal-box').scrollTop=0;
  if(reduce)handlers.chestSkip();else S.chestRevealTimer=setTimeout(()=>{if(S.modalKind==='chestReward')handlers.chestSkip();},1900);
}
async function chestSubmit(request) {
  if(S.chestBusy || OFFLINE || !S.connected || S.chestReadOnly)return;
  S.chestBusy=true;
  const owner=S.token;
  store.set('bur_chest_request',{...request,owner:S.token});
  for(const el of $$('#modal .modal-content button'))el.disabled=true;
  try {
    const payload=request.type==='open'?{id:request.id}:{rarity:request.rarity,requestId:request.requestId};
    const r=await emit(request.type==='open'?'openChest':'exchangeChestFragments',payload);
    if(owner!==S.token)return;
    if(r.ok){store.set('bur_chest_request',null);cacheChestState(r.chests);S.chestState=r.chests;chestReveal(r.reward);}
    else {if(!r.timeout&&!r.disconnected)store.set('bur_chest_request',null);await chestsModal();}
  } finally {S.chestBusy=false;}
}
Object.assign(handlers,{
  chests:chestsModal,
  async chestSelect(el){S.selectedChestId=el.dataset.id;await chestsModal();const button=$('#modal .chest-open-button');button?.scrollIntoView({block:'center'});button?.focus({preventScroll:true});},
  chestOpen(el){
    if(!S.chestState?.recent.length){
      S.firstChestId=el.dataset.id;
      openModal('firstChest',collectionShell('loot',`<section class="first-chest-guide"><h2>${t('La tua prima chest')}</h2><p>${t('Dentro trovi un oggetto per personalizzare il tuo gioco.')}</p><p>${t('Se lo possiedi già, ricevi frammenti da usare più avanti.')}</p><div class="row"><button class="btn primary" data-act="firstChestOpen">${t('Apri la prima chest')}</button><button class="btn" data-act="chests">${t('Torna al bottino')}</button></div></section>`));
      return;
    }
    return chestSubmit({type:'open',id:el.dataset.id});
  },
  firstChestOpen(){return chestSubmit({type:'open',id:S.firstChestId});},
  chestExchange(el){
    const requestId=crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
    return chestSubmit({type:'exchange',rarity:el.dataset.rarity,requestId});
  },
  async chestShowItem(el){await collectionModal(el.dataset.kind);if(collectionOwned().has(el.dataset.id))await handlers.collectionSelect(el);},
  chestRetry(){const r=chestRequest();if(r)return chestSubmit(r);},
  chestSkip(){
    clearTimeout(S.chestRevealTimer);const root=$('#modal .chest-reveal');if(!root)return;
    root.classList.remove('is-opening');root.classList.add('is-revealed');
    root.querySelector('.chest-prize').hidden=false;root.querySelector('.chest-skip').hidden=true;
    root.querySelector('.chest-prize [data-act=chestEquip]')?.focus({preventScroll:true});
  },
  async chestEquip(el){
    const owner=S.token,item=collectionItems().find(x=>x.id===el.dataset.itemId);
    if(el.dataset.kind!=='avatar'){if(await equipCosmetic(el.dataset.kind,el.dataset.itemId)&&owner===S.token){confirmEquipped(item);await chestsModal();}return;}
    const p=await emit('profile');if(owner!==S.token||!p.ok)return;
    const r=await emit('setAvatar',{id:el.dataset.itemId,c:p.avatar?.c||p.colors[0]});
    if(owner===S.token&&r.ok){confirmEquipped(item);await chestsModal();}
  }
});
socket.on('chests',data=>{
  cacheChestState(data);
  S.chestState=data;
  if(data.roomCode){S.chestMatch={owner:S.token,...data};if(S.modalKind==='result')showResult();}
  if(data.justEarned)toast(t('Hai ottenuto una chest gratuita!'));
  if(data.weeklyEarned)toast(t('Hai completato un obiettivo settimanale: il premio è nel bottino.'));
  const count=$('#modal .chest-entry small');if(count)count.textContent=t('Chest disponibili')+': '+data.pending.length;
  if(S.modalKind==='chests'&&!S.chestBusy)chestsModal();
  if(S.modalKind==='cosmetics'&&!S.collectionBusy)collectionModal();
});

async function inboxModal(offset=0) {
  if(OFFLINE||!S.connected){toast(t('Collegati per leggere la posta personale'),true);return;}
  const owner=S.token,r=await emit('inbox',{offset});if(owner!==S.token||!r.ok)return;
  const box=r.inbox;
  openModal('inbox',collectionShell('mail',`<section class="personal-inbox"><button class="btn small" data-act="chests">${t('Inventario personale')}</button><h2>${t('Posta personale')}</h2><p>${t('Messaggi e regali da Smazzata')}</p>
    ${box.messages.length?box.messages.map(m=>`<article class="personal-letter ${m.read?'':'unread'}"><small>${esc(new Date(m.at).toLocaleString())} · ${t(m.read?'Letto':'Da leggere')}</small><h3>${esc(m.title)}</h3><p class="letter-body">${esc(m.body)}</p>
    ${m.gift?`<div class="letter-gift">${m.gift.kind==='chest'?`<div data-chest-type="${esc(m.gift.type)}"><div class="chest-sprite" aria-hidden="true"></div></div><b>${t(({common:'Chest comune',rare:'Chest rara',epic:'Chest epica',legendary:'Chest leggendaria'})[m.gift.type])}</b>`:`${chestPrize(m.gift).html}<b>${esc(t(chestPrize(m.gift).name))}</b>`}<p>${m.gift.duplicate?'+'+m.gift.fragments+' '+t('frammenti'):t('Regalo consegnato al tuo inventario')}</p><button class="btn small" data-act="chests">${t('Inventario personale')}</button></div>`:''}
    ${!m.read?`<button class="btn small" data-act="readMail" data-id="${esc(m.id)}" data-offset="${box.offset}">${t('Segna come letto')}</button>`:''}</article>`).join(''):`<p class="chest-notice">${t('Non hai ancora ricevuto messaggi.')}</p>`}
    <nav class="inventory-nav">${box.offset?`<button class="btn small" data-act="inbox" data-offset="${Math.max(0,box.offset-20)}">${t('Più recenti')}</button>`:''}${box.offset+box.messages.length<box.total?`<button class="btn small" data-act="inbox" data-offset="${box.offset+20}">${t('Più vecchi')}</button>`:''}</nav></section>`));
}
Object.assign(handlers,{
  inbox:el=>inboxModal(Number(el?.dataset?.offset)||0),
  async readMail(el){const owner=S.token,r=await emit('readMail',{id:el.dataset.id});if(owner===S.token&&r.ok)return inboxModal(Number(el.dataset.offset)||0);}
});
socket.on('inboxUpdated',()=>{
  toast(t('Hai ricevuto posta da Smazzata'));
  if(S.modalKind==='inbox')inboxModal();
});

function resultLootHTML() {
  const d=S.chestMatch;
  if(!d||d.owner!==S.token||d.roomCode!==S.room?.code||d.gameSeq!==S.room?.gameSeq||!S.game?.over||S.game.you<0||S.room.onDevice||S.room.offline||S.room.tutorial||S.room.progressEligible===false)return '';
  const count=(d.justEarned?1:0)+(d.weeklyEarned||0),next=d.weekly?.missions.find(m=>!m.awarded);
  return `<section class="result-progress result-loot"><h3>${t('Le tue ricompense')}</h3><p>${count?t('Chest ottenute')+': <b>'+count+'</b>':d.earnedToday>=2?t('Limite giornaliero raggiunto. Riprendi domani; le tue chest non scadono.'):t('Progressi salvati per la prossima chest')}</p><progress max="3" value="${d.progress}" aria-label="${t('Progressi verso la prossima chest')}"></progress><p>${d.progress}/3 · ${t('Chest ottenute oggi')}: ${d.earnedToday}/2</p>${next?`<p>${t('Prossimo obiettivo')}: ${t(next.name)} · ${next.progress}/${next.goal}</p>`:`<p>${t('Obiettivi settimanali completati')}</p>`}<button class="btn" data-act="chests">${t('Vai al bottino')}</button></section>`;
}
