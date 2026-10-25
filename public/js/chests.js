'use strict';
// Le immagini raccontano l'apertura; il risultato è già salvato dal server.
function cacheChestState(data) {
  if(data)store.set('bur_chest_cache',{owner:S.token,data});
}
function chestRequest() {
  const r=store.get('bur_chest_request',null);
  return r?.owner===S.token?r:null;
}
function nextChestText(data){return data.earnedToday>=1?t('Per oggi hai ottenuto la chest giornaliera.'):data.progress===1?t('Ancora una partita per la prossima chest'):t('Ancora {0} partite per la prossima chest').replace('{0}',String(2-data.progress));}
function journeySummaryHTML(data){
 if(!data.journey)return '';
 return `<button class="journey-entry loot-next" data-act="journey">${uiIcon('calendar')}<span><b>${t('I tuoi progressi')}</b><small>${t('Oggi')} · ${data.earnedToday>=1?t('Nel bottino'):data.progress+' / 2'}</small><progress max="2" value="${data.earnedToday>=1?2:data.progress}" aria-label="${t('Progressi verso la prossima chest')}"></progress></span><span aria-hidden="true">›</span></button>`;
}
function journeyRewardHTML(data,{name,type,progress,goal,awarded,label,prizeName}){
 const value=Math.min(goal,Math.max(0,progress));
 return `<article class="progress-reward ${awarded?'is-complete':''}"><div class="progress-prize" data-chest-type="${type}" aria-label="${t(data.rules.types[type].name)}"><span class="chest-sprite" aria-hidden="true"></span>${awarded?uiIcon('check'):''}</div><div class="progress-reward-copy"><h3>${esc(t(name))}</h3><div class="progress-count"><span>${esc(label||t('Partite'))}</span><b>${awarded?uiIcon('check'):value+' / '+goal}</b></div><progress value="${awarded?goal:value}" max="${goal}" aria-label="${esc(t(name))}"></progress><small>${t(awarded?'Nel bottino':prizeName||data.rules.types[type].name)}</small></div></article>`;
}
async function journeyModal(refreshOnly=false){
 const owner=S.token;let data,online=false;
 if(refreshOnly!==true){S.journeyTab='today';S.journeyMemoryPage=0;S.journeyStep=null;}
 if(!OFFLINE&&S.connected){const r=await emit('chests');if(owner!==S.token)return;if(r.ok){data=r.chests;online=true;cacheChestState(data);}}
 if(!data){const cached=store.get('bur_chest_cache',null);if(cached?.owner===owner)data=cached.data;}
 if(owner!==S.token||(refreshOnly===true&&S.modalKind!=='journey'))return;
 if(!data?.journey){toast(t('Collegati per consultare il tuo percorso'),true);return;}
 S.chestState=data;S.journeyOnline=online;renderJourney();
}
function renderJourney(){
 const data=S.chestState;if(!data?.journey)return;
 const j=data.journey,m=j.month,w=j.weekend,tab=S.journeyTab||'today';let body='';
 if(tab==='today'){
  body=journeyRewardHTML(data,{name:'2 partite online',type:'common',prizeName:'Chest',progress:data.progress,goal:2,awarded:data.earnedToday>=1})+
   (w.active?`<div class="progress-section-label">${t('Weekend')}</div>`+journeyRewardHTML(data,{name:'3 partite nel weekend',type:'rare',progress:w.matches,goal:3,awarded:w.awarded}):'')+
   `<p class="progress-reset">${uiIcon('clock')}${t('Si rinnova domani')}</p>`;
 }else if(tab==='week'){
  const labels={matches:'3 partite online',games:'2 giochi diversi',days:'2 giorni di gioco',friends:'3 partite con amici'},units={matches:'Partite',games:'Giochi',days:'Giorni',friends:'Partite'};
  body=(data.weekly?.missions||[]).map(x=>journeyRewardHTML(data,{...x,name:labels[x.id]||x.name,label:t(units[x.id]||'Partite')})).join('')+`<p class="progress-reset">${uiIcon('clock')}${t('Si rinnova lunedì')}</p>`;
 }else if(tab==='month'){
  const next=m.steps.find(x=>!x.awarded),step=m.steps.find(x=>x.step===S.journeyStep)||next||m.steps.at(-1);
  body=`<div class="progress-month-title"><b>${esc(new Date(m.id+'-01T12:00:00Z').toLocaleDateString(LOCALE,{month:'long',year:'numeric'}))}</b><span>${m.awarded} / ${m.steps.length} ${t('premi')}</span></div>`+
   journeyRewardHTML(data,{name:t('Tappa {0}').replace('{0}',String(step.step)),type:step.type,progress:m.matches,goal:step.goal,awarded:step.awarded,label:t('Partite del mese')})+
   `<ol class="progress-steps" aria-label="${t('Tappe del mese')}">${m.steps.map(x=>`<li><button data-act="journeyStep" data-step="${x.step}" data-chest-type="${x.type}" class="${x.awarded?'is-complete':''}" aria-pressed="${x.step===step.step}" ${x.step===next?.step?'aria-current="step"':''} aria-label="${t('Tappa {0}').replace('{0}',String(x.step))} · ${t(data.rules.types[x.type].name)} · ${x.awarded?t('Nel bottino'):x.goal+' '+t('partite')}"><span class="chest-sprite" aria-hidden="true"></span><b>${x.awarded?uiIcon('check'):x.step}</b></button></li>`).join('')}</ol><p class="progress-reset">${uiIcon('clock')}${t('Si rinnova il prossimo mese')}</p>`;
 }else{
  const page=Math.max(0,Math.min(Math.ceil(j.album.length/3)-1,S.journeyMemoryPage||0));S.journeyMemoryPage=page;
  body=`<div class="progress-memory-title"><h3 tabindex="-1">${t('Album dei ricordi')}</h3><b>${j.album.filter(x=>x.at).length} / ${j.album.length}</b></div><div class="progress-memories">${j.album.slice(page*3,page*3+3).map(x=>`<article class="progress-memory ${x.at?'is-complete':''}"><span class="memory-seal">${uiIcon(x.at?'check':x.id==='friend'?'friends':x.id.startsWith('win-')?'trophy':'cards')}</span><div><h3>${esc(t(x.name))}</h3><small>${esc(t(x.desc))}</small><progress max="${x.goal}" value="${x.progress}" aria-label="${esc(t(x.name))}"></progress><b>${x.at?t('Completato'):x.progress+' / '+x.goal}</b></div>${x.type?`<span class="progress-memory-prize" data-chest-type="${x.type}" aria-label="${t(data.rules.types[x.type].name)}"><span class="chest-sprite" aria-hidden="true"></span></span>`:''}</article>`).join('')}</div><nav class="progress-pages" aria-label="${t('Album dei ricordi')}"><button class="btn small" data-act="journeyPage" data-page="${page-1}" aria-label="${t('Pagina precedente')}" ${page===0?'disabled':''}>‹</button><span>${page+1} / ${Math.ceil(j.album.length/3)}</span><button class="btn small" data-act="journeyPage" data-page="${page+1}" aria-label="${t('Pagina successiva')}" ${(page+1)*3>=j.album.length?'disabled':''}>›</button></nav>`;
 }
 openModal('journey',collectionShell('loot',`<section class="player-journey compact-progress"><header><h2>${t('I tuoi progressi')}</h2><small>${t('Online · con persone')}</small></header>${!S.journeyOnline?`<p class="chest-notice" role="status">${t('Copia offline')}</p>`:''}<nav class="progress-tabs" aria-label="${t('I tuoi progressi')}">${[['today','Oggi'],['week','Settimana'],['month','Mese']].map(([id,name])=>`<button data-act="journeyTab" data-tab="${id}" aria-pressed="${tab===id}">${t(name)}</button>`).join('')}</nav><div class="progress-panel" data-period="${tab}">${body}</div><footer class="progress-footer">${tab!=='memories'?`<button class="progress-album-link" data-act="journeyTab" data-tab="memories">${uiIcon('book')}<span>${t('Ricordi')}</span><b>${j.album.filter(x=>x.at).length} / ${j.album.length}</b><span aria-hidden="true">›</span></button>`:''}</footer></section>`));
 $('#modal .modal-box').scrollTop=0;
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
  openModal('chests',collectionShell('loot',`<section class="chest-room simple-loot"><h2>${t('Le tue chest')}</h2><p>${t('Tocca una chest per aprirla.')}</p>
    ${!online?`<p class="chest-notice" role="status">${t('Copia offline: collegati per aprire o scambiare.')}</p>`:''}
    ${data.pending.length?`<div class="inventory-chests">${rarities.filter(r=>data.pending.some(x=>x.type===r.id)).map(r=>{const items=data.pending.filter(x=>x.type===r.id);return `<button class="inventory-chest" data-act="chestOpen" data-id="${esc(items[0].id)}" data-chest-type="${r.id}" aria-label="${t(rules.types[r.id].name)} · ${items.length} · ${t('Tocca per aprire')}" ${disabled||S.chestBusy?'disabled':''}><span class="chest-quantity">×${items.length}</span><span class="chest-sprite" aria-hidden="true"></span><b>${t(rules.types[r.id].name)}</b><small>${t('Tocca per aprire')}</small></button>`;}).join('')}</div>`:`<div class="loot-empty">${uiIcon('trophy')}<p>${t('Nessuna chest da aprire. Le prossime ti aspettano qui.')}</p></div>`}
    ${request?`<p role="status">${t('Un risultato è in attesa di conferma. Recuperalo prima di continuare.')}</p><button class="btn primary" data-act="chestRetry" ${!online?'disabled':''}>${t('Recupera risultato')}</button>`:''}
    ${journeySummaryHTML(data)}
    <details class="loot-secondary loot-more"><summary>${t('Altro')}</summary>
    <details class="loot-secondary collection-loot-details"><summary>${t('Usa frammenti')} · ${data.fragments}</summary><p>${t('I doppioni diventano frammenti. Usali qui per ottenere un oggetto che ti manca.')}</p><div class="chest-exchanges">${rarities.map(r=>`<div><span><b>${t(r.name)}</b><small>${rules.costs[r.id]} ${t('frammenti')}</small></span><button class="btn small" data-act="chestExchange" data-rarity="${r.id}" ${disabled||!data.missing[r.id]||data.fragments<rules.costs[r.id]?'disabled':''}>${t(!data.missing[r.id]?'Tutti ottenuti':'Scambia')}</button></div>`).join('')}</div></details>
    ${data.recent.length?`<details class="loot-secondary"><summary>${t('Ultime aperture')}</summary><div class="chest-history">${data.recent.map(x=>{const a=chestPrize(x);return `<div>${a.html}<span>${esc(t(a.name))}<small>${x.duplicate?'+'+x.fragments+' '+t('frammenti'):t('Nuovo oggetto')}</small></span></div>`;}).join('')}</div></details>`:''}
  </details></section>`));
  $('#modal .modal-box').scrollTop=0;
}
function chestReveal(reward) {
  const a=chestPrize(reward),rarity=window.SmazzataAvatars.RARITIES.find(r=>r.id===reward.rarity);
  const reduce=S.prefs.anim===false || matchMedia('(prefers-reduced-motion: reduce)').matches;
  clearTimeout(S.chestRevealTimer);
  openModal('chestReward',collectionShell('loot',`<section class="chest-reveal ${reduce?'':'is-opening'}" data-rarity="${rarity.id}">
    <h2>${t('Il tuo premio')}</h2><button class="chest-stage" data-act="chestSkip" data-chest-type="${reward.chestType || reward.rarity}" aria-label="${t('Tocca per scoprire il premio')}"><div class="chest-burst"></div><div class="chest-sprite"></div>${Array.from({length:8},(_,i)=>`<i class="chest-spark" style="--spark:${i}"></i>`).join('')}</button>
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
  journey:journeyModal,
  journeyTab(el){if(S.modalKind!=='journey'||!['today','week','month','memories'].includes(el.dataset.tab))return;if(el.dataset.tab==='memories')S.journeyPreviousTab=S.journeyTab||'today';S.journeyTab=el.dataset.tab;renderJourney();$('#modal '+(S.journeyTab==='memories'?'.progress-memory-title h3':'.progress-tabs [aria-pressed=true]'))?.focus({preventScroll:true});},
  journeyStep(el){if(S.modalKind!=='journey'||S.journeyTab!=='month')return;S.journeyStep=Number(el.dataset.step);renderJourney();$('#modal .progress-steps [aria-pressed=true]')?.focus({preventScroll:true});},
  journeyPage(el){if(S.modalKind!=='journey'||S.journeyTab!=='memories')return;S.journeyMemoryPage=Number(el.dataset.page);renderJourney();const buttons=$$('#modal .progress-pages button');(buttons.find(x=>!x.disabled&&Number(x.dataset.page)>S.journeyMemoryPage)||buttons.find(x=>!x.disabled))?.focus({preventScroll:true});},
  chests:chestsModal,
  chestOpen(el){
    if(chestRequest()||!S.chestState?.pending.some(x=>x.id===el.dataset.id))return;
    return chestSubmit({type:'open',id:el.dataset.id});
  },
  chestExchange(el){
    const requestId=crypto.randomUUID?.() || Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');
    return chestSubmit({type:'exchange',rarity:el.dataset.rarity,requestId});
  },
  async chestShowItem(el){await collectionModal(el.dataset.kind);if(collectionOwned().has(el.dataset.id))await handlers.collectionSelect(el);},
  chestRetry(){const r=chestRequest();if(r)return chestSubmit(r);},
  chestSkip(){
    clearTimeout(S.chestRevealTimer);const root=$('#modal .chest-reveal');if(!root||root.classList.contains('is-revealed'))return;
    Sound.chest(root.dataset.rarity);root.querySelector('.chest-stage').disabled=true;root.classList.remove('is-opening');root.classList.add('is-revealed');
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
  if(data.journeyEarned)toast(t('Un nuovo premio del percorso ti aspetta nel Bottino.'));
  if(S.social)S.social.nextChest={remaining:2-data.progress,limit:data.earnedToday>=1};
  if(S.screen==='home')render();
  const count=$('#modal .chest-entry small');if(count)count.textContent=t('Chest disponibili')+': '+data.pending.length;
  if(S.modalKind==='chests'&&!S.chestBusy)chestsModal();
  if(S.modalKind==='journey')journeyModal(true);
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
  const count=(d.justEarned?1:0)+(d.weeklyEarned||0)+(d.journeyEarned||0),next=d.weekly?.missions.find(m=>!m.awarded);
  return `<section class="result-progress result-loot"><h3>${t('Le tue ricompense')}</h3><p>${count?t('Chest ottenute')+': <b>'+count+'</b>':d.earnedToday>=1?t('Limite giornaliero raggiunto. Riprendi domani; le tue chest non scadono.'):t('Progressi salvati per la prossima chest')}</p><details class="result-reward-details"><summary>${t('I tuoi progressi')}</summary><progress max="2" value="${d.progress}" aria-label="${t('Progressi verso la prossima chest')}"></progress><p>${d.progress}/2 · ${t('Chest ottenute oggi')}: ${d.earnedToday}/1</p>${next?`<p>${t('Prossimo obiettivo')}: ${t(next.name)} · ${next.progress}/${next.goal}</p>`:`<p>${t('Obiettivi settimanali completati')}</p>`}</details><button class="btn" data-act="chests">${t('Vai al bottino')}</button></section>`;
}
