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
  if(!OFFLINE && S.connected){const r=await emit('chests');if(owner!==S.token)return;if(r.ok){data=r.chests;online=true;cacheChestState(data);}}
  if(!data){const cached=store.get('bur_chest_cache',null);if(cached?.owner===S.token)data=cached.data;}
  if(owner!==S.token)return;
  if(!data){toast(t('Collegati per consultare le tue chest'),true);return;}
  S.chestState=data;S.chestReadOnly=!online;
  const guide=!data.recent.length;
  const rules=data.rules,request=chestRequest(),disabled=!online||!!request;
  const selected=data.pending.find(x=>x.id===S.selectedChestId)||data.pending[0];
  const rarities=window.SmazzataAvatars.RARITIES,type=selected?.type || 'common',openingOdds=selected?.odds||data.odds;
  openModal('chests',collectionShell('loot',`<section class="chest-room"><button class="btn small" data-act="profile">${t('Torna al profilo')}</button><h2>${t('Bottino')}</h2>
    <nav class="inventory-nav" aria-label="${t('Inventario personale')}"><button class="btn small" data-act="inbox">${t('Posta personale')}${S.social?.unreadMail?' · '+S.social.unreadMail:''}</button><button class="btn small" data-act="profile">${t('Avatar')}</button><button class="btn small" data-act="cosmetics">${t('Dorsi, cornici e altri stili')}</button></nav>
    <p>${t('Le chest ottenute giocando e quelle ricevute in regalo restano qui finché decidi di aprirle.')}</p>
    ${guide?`<aside class="first-chest-guide"><h3>${t('La tua prima chest')}</h3><p>${t('Ogni chest contiene un solo oggetto. Prima di aprirla puoi vedere le probabilità di ogni rarità.')}</p><p>${t('Un doppione diventa frammenti: accumulali per ottenere un oggetto che ti manca. Dopo l’apertura puoi equipaggiare subito il premio.')}</p></aside>`:''}
    <div class="inventory-chests">${rarities.map(r=>{const items=data.pending.filter(x=>x.type===r.id),first=items[0];return `<button class="inventory-chest" data-act="chestSelect" data-id="${esc(first?.id||'')}" data-chest-type="${r.id}" aria-pressed="${!!first&&type===r.id}" ${!first?'disabled':''}><span class="chest-sprite" aria-hidden="true"></span><b>${t(rules.types[r.id].name)}</b><small>${t('Disponibili')}: ${items.length}</small></button>`;}).join('')}</div>
    ${!data.pending.length?`<p class="chest-notice">${t('Nessuna chest da aprire. Le prossime ti aspettano qui.')}</p>`:''}
    ${!online?`<p class="chest-notice" role="status">${t('Copia offline: collegati per aprire o scambiare.')}</p>`:''}
    <div class="chest-hero" data-chest-type="${type}"><div class="chest-sprite" role="img" aria-label="${t(rules.types[type].name)}"></div><div><h3>${t(rules.types[type].name)}</h3><p>${t('Chest disponibili')}: <b>${data.pending.length}</b></p><p>${t('Frammenti')}: <b>${data.fragments}</b></p></div></div>
    <h3>${t('Probabilità di questa apertura')}</h3><div class="chest-odds">${rarities.map(r=>`<div data-rarity="${r.id}"><b>${t(r.name)}</b><span>${openingOdds[r.id]}%</span></div>`).join('')}</div>
    <p class="muted small">${t('Scegli la chest da aprire. Le probabilità mostrate includono le garanzie attive.')}</p>
    ${request?`<p role="status">${t('Un risultato è in attesa di conferma. Recuperalo prima di continuare.')}</p><button class="btn primary" data-act="chestRetry" ${!online?'disabled':''}>${t('Recupera risultato')}</button>`:
      `<button class="btn primary chest-open-button" data-act="chestOpen" data-id="${esc(selected?.id || '')}" ${disabled||!data.pending.length?'disabled':''}>${t('Apri una chest')}</button>`}
    ${data.weekly?`<section class="weekly-goals"><h3>${t('La tua settimana')}</h3><p class="muted small">${t('Con un amico: completate tre partite online dopo aver accettato l’amicizia, anche da avversari.')}</p><p>${t('Quattro obiettivi, fino a quattro chest aggiuntive. Si riparte ogni lunedì, ora italiana.')}</p>${data.weekly.missions.map(m=>`<div class="weekly-goal ${m.awarded?'is-complete':''}"><span><b>${t(m.name)}</b><small>${t(rules.types[m.type].name)} · ${m.progress}/${m.goal} ${m.awarded?' · '+t('Premio consegnato'):''}</small></span><progress value="${m.progress}" max="${m.goal}" aria-label="${t(m.name)}"></progress></div>`).join('')}</section>`:''}
    <details class="collection-loot-details"><summary>${t('Progressi, garanzie e frammenti')}</summary><div class="chest-guarantees"><p>${t('Epico o leggendario entro')}: <b>${data.epicIn}</b> ${t('aperture')}</p><p>${t('Leggendario entro')}: <b>${data.legendaryIn}</b> ${t('aperture')}</p></div>
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
    </details>
    ${data.recent.length?`<h3>${t('Ultime aperture')}</h3><div class="chest-history">${data.recent.map(x=>{const a=chestPrize(x);return `<div>${a.html}<span>${esc(t(a.name))}<small>${x.duplicate?'+'+x.fragments+' '+t('frammenti'):t('Nuovo oggetto')}</small></span></div>`;}).join('')}</div>`:''}
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
    <div class="chest-prize" hidden role="status"><div class="chest-prize-art">${a.html}</div><span class="avatar-rarity" data-rarity="${rarity.id}">${t(rarity.name)}</span><h3>${esc(t(a.name))}</h3><p>${reward.duplicate?t('Doppione')+' · +'+reward.fragments+' '+t('frammenti'):t('Nuovo oggetto nella tua collezione')}</p><div class="row"><button class="btn primary" data-act="chestEquip" data-kind="${a.kind}" data-item-id="${a.id}">${a.kind==='avatar'?t('Usa avatar'):t('Usa questo stile')}</button><button class="btn" data-act="chestShowItem" data-id="${a.id}" data-kind="${a.kind}">${t('Mostra nella collezione')}</button><button class="btn" data-act="chests">${t('Continua')}</button></div></div></section>`));
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
      openModal('firstChest',collectionShell('loot',`<section class="first-chest-guide"><h2>${t('La tua prima chest')}</h2><ol><li>${t('Ogni chest contiene un solo oggetto. Prima di aprirla puoi vedere le probabilità di ogni rarità.')}</li><li>${t('Un doppione diventa frammenti: accumulali per ottenere un oggetto che ti manca. Dopo l’apertura puoi equipaggiare subito il premio.')}</li><li>${t('Il premio viene salvato prima dell’animazione: resta tuo anche se perdi la connessione.')}</li></ol><div class="row"><button class="btn primary" data-act="firstChestOpen">${t('Apri la prima chest')}</button><button class="btn" data-act="chests">${t('Torna al bottino')}</button></div></section>`));
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
    if(el.dataset.kind!=='avatar'){if(await equipCosmetic(el.dataset.kind,el.dataset.itemId)){S.cosmeticOnline=true;await cosmeticsModal(el.dataset.kind);}return;}
    const p=await emit('profile');if(!p.ok)return;
    const r=await emit('setAvatar',{id:el.dataset.itemId,c:p.avatar?.c||p.colors[0]});
    if(r.ok)await profileModal();
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
