'use strict';
// Le immagini raccontano l'apertura; il risultato è già salvato dal server.
function cacheChestState(data) {
  if(data)store.set('bur_chest_cache',{owner:S.token,data});
}
function chestRequest() {
  const r=store.get('bur_chest_request',null);
  return r?.owner===S.token?r:null;
}
async function chestsModal() {
  const owner=S.token;let data,online=false;
  if(!OFFLINE && S.connected){const r=await emit('chests');if(r.ok){data=r.chests;online=true;cacheChestState(data);}}
  if(!data){const cached=store.get('bur_chest_cache',null);if(cached?.owner===S.token)data=cached.data;}
  if(owner!==S.token)return;
  if(!data){toast(t('Collegati per consultare le tue chest'),true);return;}
  S.chestState=data;S.chestReadOnly=!online;
  const rules=data.rules,request=chestRequest(),disabled=!online||!!request;
  const rarities=window.SmazzataAvatars.RARITIES,type=data.pending[0]?.type || 'common';
  openModal('chests',`<section class="chest-room"><button class="btn small" data-act="profile">${t('Torna al profilo')}</button><h2>${t('Le tue chest')}</h2>
    ${!online?`<p class="chest-notice" role="status">${t('Copia offline: collegati per aprire o scambiare.')}</p>`:''}
    <div class="chest-hero" data-chest-type="${type}"><div class="chest-sprite" role="img" aria-label="${t(rules.types[type].name)}"></div><div><h3>${t(rules.types[type].name)}</h3><p>${t('Chest disponibili')}: <b>${data.pending.length}</b></p><p>${t('Frammenti')}: <b>${data.fragments}</b></p></div></div>
    <h3>${t('Probabilità di questa apertura')}</h3><div class="chest-odds">${rarities.map(r=>`<div data-rarity="${r.id}"><b>${t(r.name)}</b><span>${data.odds[r.id]}%</span></div>`).join('')}</div>
    <p class="muted small">${t('Le probabilità mostrate includono le garanzie attive. Le aperture seguono l’ordine di ottenimento.')}</p>
    ${request?`<p role="status">${t('Un risultato è in attesa di conferma. Recuperalo prima di continuare.')}</p><button class="btn primary" data-act="chestRetry" ${!online?'disabled':''}>${t('Recupera risultato')}</button>`:
      `<button class="btn primary chest-open-button" data-act="chestOpen" data-id="${esc(data.pending[0]?.id || '')}" ${disabled||!data.pending.length?'disabled':''}>${t('Apri una chest')}</button>`}
    <div class="chest-guarantees"><p>${t('Epico o leggendario entro')}: <b>${data.epicIn}</b> ${t('aperture')}</p><p>${t('Leggendario entro')}: <b>${data.legendaryIn}</b> ${t('aperture')}</p></div>
    <p>${t('Una chest ogni 3 partite online completate con avversari umani. Massimo 2 al giorno.')}</p><progress class="chest-progress" value="${data.progress}" max="3" aria-label="${t('Progressi verso la prossima chest')}"></progress><p class="muted small">${data.progress}/3 · ${t('Chest ottenute oggi')}: ${data.earnedToday}/2</p>
    <p class="muted small">${t('Allenamento, partite annullate e abbandoni non contano. Il limite si rinnova a mezzanotte, ora italiana.')}</p>
    ${data.earnedToday>=2?`<p class="chest-notice">${t('Limite giornaliero raggiunto. Riprendi domani; le tue chest non scadono.')}</p>`:''}
    <details class="chest-rules"><summary>${t('Quale chest puoi trovare')}</summary><div class="chest-types">${rarities.map(r=>`<div data-chest-type="${r.id}"><div class="chest-sprite" aria-hidden="true"></div><b>${t(rules.types[r.id].name)}</b><span>${rules.chestRates[r.id]}%</span><small>${t('Disponibili')}: ${data.pending.filter(x=>x.type===r.id).length}</small><p>${rarities.map(a=>t(a.name)+' '+rules.types[r.id].rates[a.id]+'%').join(' · ')}</p></div>`).join('')}</div>
    <p class="muted small">${t('Una chest contiene un solo oggetto. La chest leggendaria contiene sempre un oggetto leggendario.')}</p>
    <p class="muted small">${t('Prima si estrae la rarità, poi un oggetto con la stessa probabilità degli altri di quella rarità. I quattro avatar iniziali sono esclusi. I doppioni diventano frammenti.')}</p>
    ${data.pools?`<table class="cx-pool-table"><caption>${t('Oggetti disponibili per tipo e rarità')}</caption><thead><tr><th>${t('Tipo di oggetto')}</th>${rarities.map(r=>`<th scope="col">${t(r.name)}</th>`).join('')}</tr></thead><tbody>${[{id:'avatar',name:'Avatar'},...window.SmazzataCosmetics.KINDS].map(k=>`<tr><th scope="row">${t(k.name)}</th>${rarities.map(r=>`<td>${data.pools[r.id][k.id]}</td>`).join('')}</tr>`).join('')}</tbody></table><p class="muted small">${t('Le probabilità dei tipi sono proporzionali al numero di oggetti nella rarità estratta, anche se li possiedi già.')}</p>`:''}
    </details>
    <h3>${t('Scambia frammenti')}</h3><p class="muted small">${t('Ricevi un oggetto casuale non posseduto della rarità scelta. Lo scambio non modifica le garanzie delle chest.')}</p>
    <div class="chest-exchanges">${rarities.map(r=>`<div><span><b>${t(r.name)}</b><small>${t('Doppione')}: +${rules.fragments[r.id]} ${t('frammenti')}</small></span><button class="btn small" data-act="chestExchange" data-rarity="${r.id}" ${disabled||!data.missing[r.id]||data.fragments<rules.costs[r.id]?'disabled':''}>${!data.missing[r.id]?t('Tutti ottenuti'):t('Scambia')+' · '+rules.costs[r.id]}</button></div>`).join('')}</div>
    ${data.recent.length?`<h3>${t('Ultime aperture')}</h3><div class="chest-history">${data.recent.map(x=>{const a=chestPrize(x);return `<div>${a.html}<span>${esc(t(a.name))}<small>${x.duplicate?'+'+x.fragments+' '+t('frammenti'):t('Nuovo oggetto')}</small></span></div>`;}).join('')}</div>`:''}
  </section>`);
  $('#modal .modal-box').scrollTop=0;
}
function chestReveal(reward) {
  const a=chestPrize(reward),rarity=window.SmazzataAvatars.RARITIES.find(r=>r.id===reward.rarity);
  const reduce=S.prefs.anim===false || matchMedia('(prefers-reduced-motion: reduce)').matches;
  clearTimeout(S.chestRevealTimer);
  openModal('chestReward',`<section class="chest-reveal ${reduce?'':'is-opening'}" data-rarity="${rarity.id}">
    <h2>${t('Il tuo premio')}</h2><div class="chest-stage" data-chest-type="${reward.chestType || reward.rarity}" aria-hidden="true"><div class="chest-burst"></div><div class="chest-sprite"></div>${Array.from({length:8},(_,i)=>`<i class="chest-spark" style="--spark:${i}"></i>`).join('')}</div>
    <button class="btn small chest-skip" data-act="chestSkip">${t('Salta animazione')}</button>
    <div class="chest-prize" hidden role="status"><div class="chest-prize-art">${a.html}</div><span class="avatar-rarity" data-rarity="${rarity.id}">${t(rarity.name)}</span><h3>${esc(t(a.name))}</h3><p>${reward.duplicate?t('Doppione')+' · +'+reward.fragments+' '+t('frammenti'):t('Nuovo oggetto nella tua collezione')}</p><div class="row"><button class="btn primary" data-act="chestEquip" data-kind="${a.kind}" data-item-id="${a.id}">${a.kind==='avatar'?t('Usa avatar'):t('Usa questo stile')}</button><button class="btn" data-act="chests">${t('Continua')}</button></div></div></section>`);
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
  chestOpen(el){return chestSubmit({type:'open',id:el.dataset.id});},
  chestExchange(el){
    const requestId=crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
    return chestSubmit({type:'exchange',rarity:el.dataset.rarity,requestId});
  },
  chestRetry(){const r=chestRequest();if(r)return chestSubmit(r);},
  chestSkip(){
    clearTimeout(S.chestRevealTimer);const root=$('#modal .chest-reveal');if(!root)return;
    root.classList.remove('is-opening');root.classList.add('is-revealed');
    root.querySelector('.chest-prize').hidden=false;root.querySelector('.chest-skip').hidden=true;
    root.querySelector('.chest-prize [data-act=chestEquip]')?.focus({preventScroll:true});
  },
  async chestEquip(el){
    if(el.dataset.kind!=='avatar'){if(await equipCosmetic(el.dataset.kind,el.dataset.itemId)){S.cosmeticOnline=true;await cosmeticsModal(el.dataset.kind);}return;}
    const p=await emit('profile');if(!p.ok)return;
    const r=await emit('setAvatar',{id:el.dataset.itemId,c:p.avatar?.c||p.colors[0]});
    if(r.ok)await profileModal();
  }
});
socket.on('chests',data=>{
  cacheChestState(data);
  if(data.justEarned)toast(t('Hai ottenuto una chest gratuita!'));
  const count=$('#modal .chest-entry small');if(count)count.textContent=t('Chest disponibili')+': '+data.pending.length;
  if(S.modalKind==='chests'&&!S.chestBusy)chestsModal();
});
