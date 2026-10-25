'use strict';
// Un solo spazio per identità, oggetti posseduti, bottino e posta.
function collectionShell(active,content){
  const cached=store.get('bur_chest_cache',null),chests=cached?.owner===S.token?cached.data?.pending?.length||0:0;
  return `<section class="collection-app collection-simple"><header class="collection-header"><div class="collection-brand"><span class="collection-crest">${uiIcon('cards')}</span><strong>Smazzata</strong></div><button class="collection-account" data-act="inbox" aria-label="${t('Posta personale')}">${uiIcon('mail')}${S.social?.unreadMail?'<b>'+S.social.unreadMail+'</b>':''}</button></header>
    <nav class="collection-mainnav" aria-label="${t('Inventario personale')}">${[{id:'collection',act:'collection',label:'Collezione',icon:'cards'},{id:'loot',act:'chests',label:'Bottino',icon:'trophy',count:chests}].map(x=>`<button data-act="${x.act}" aria-current="${active===x.id?'page':'false'}">${uiIcon(x.icon)}<span>${t(x.label)}</span>${x.count?`<b>${x.count}</b>`:''}</button>`).join('')}</nav>
    <div class="collection-content">${content}</div></section>`;

}
function collectionCategories(){return [{id:'avatar',name:'Avatar',icon:'profile'},...window.SmazzataCosmetics.KINDS.map(x=>({...x,icon:({back:'cards',frame:'medal',felt:'home',reaction:'chat',victory:'trophy'})[x.id]}))];}
function collectionItems(){return [...window.SmazzataAvatars.LIST.map(x=>({...x,kind:'avatar'})),...window.SmazzataCosmetics.LIST];}
function collectionOwned(){const p=S.collectionData?.owner===S.token?S.collectionData.profile:null;return new Set([...(p?.ownedAvatarIds||window.SmazzataAvatarCatalog.STARTER_IDS),...cosmeticState().ownedIds]);}
function collectionEquipped(item){return item.kind==='avatar'?S.collectionData?.owner===S.token&&S.collectionData.profile?.avatar?.id===item.id:cosmeticState().loadout[item.kind]===item.id;}
function collectionArt(item){return item.kind==='avatar'?window.SmazzataAvatars.svg(item.id):cosmeticArt(item);}
function collectionNewIds(){return new Set(cosmeticState().meta?.newIds||[]);}
async function collectionModal(kind,refreshOnly=false){
  const owner=S.token;
  if(S.collectionOwner!==owner){S.collectionOwner=owner;S.collectionPositions={};S.collectionData=null;S.collectionCategory='avatar';S.collectionOnlyOwned=true;S.collectionSelected=null;S.collectionInspect=false;}
  if(collectionCategories().some(x=>x.id===kind)){S.collectionCategory=kind;S.collectionSelected=null;S.collectionInspect=false;}
  S.collectionOnline=false;
  if(!OFFLINE&&S.connected){const r=await emit('profile');if(owner!==S.token)return;if(r.ok){S.collectionData={owner,profile:r};S.collectionOnline=true;cacheCosmetics(r.cosmetics);cacheChestState(r.chests);S.chestState=r.chests;}}
  if(owner!==S.token)return;
  if(refreshOnly===true&&S.modalKind!=='cosmetics')return;
  renderCollection();
}
function collectionBaseChoices(kind){
 const list=kind==='back'?[['rosso','Rosso'],['blu','Blu'],['verde','Verde'],['nero','Nero'],...[['oro','Oro','b_oro'],['notte','Notte stellata','b_notte'],['smeraldo','Smeraldo','b_smeraldo']].filter(x=>S.progress?.unlocks?.includes(x[2]))]:kind==='felt'?[['verde','Verde'],['blu','Blu'],['bordeaux','Bordeaux'],['antracite','Antracite']]:[];
 if(!list.length)return '';return `<details class="collection-base"><summary>${t('Stile di base')}</summary><div>${list.map(([value,name])=>`<button data-act="collectionBase" data-kind="${kind}" data-value="${value}" aria-pressed="${!cosmeticState().loadout[kind]&&S.prefs[kind]===value}" ${!S.collectionOnline?'disabled':''}><i class="sw ${kind}-${value}" aria-hidden="true"></i>${t(name)}</button>`).join('')}</div></details>`;
}
function collectionRememberView(){const layout=$('#modal .collection-layout'),box=$('#modal .modal-box');if(S.modalKind==='cosmetics'&&layout?.dataset.scrollKey&&box)(S.collectionPositions||={})[layout.dataset.scrollKey]=box.scrollTop;}
function collectionMilestone(kind,have,total){
  if(S.collectionMilestones?.owner!==S.token)S.collectionMilestones={owner:S.token,counts:{},seen:{},until:{}};
  const m=S.collectionMilestones,previous=m.counts[kind],complete=total>0&&have===total;m.counts[kind]=have;
  if(previous===undefined&&complete)m.seen[kind]=true;
  if(S.collectionOnline&&complete&&previous!==undefined&&previous<total&&!m.seen[kind]){m.seen[kind]=true;m.until[kind]=Date.now()+1600;}
  return {complete,celebrate:complete&&(m.until[kind]||0)>Date.now()};
}
function renderCollection(){
  collectionRememberView();
  const categories=collectionCategories(),kind=S.collectionCategory||'avatar',owned=collectionOwned(),all=collectionItems(),category=categories.find(x=>x.id===kind),rarities=window.SmazzataAvatars.RARITIES;
  const items=all.filter(x=>x.kind===kind&&(!S.collectionOnlyOwned||owned.has(x.id))).sort((a,b)=>Number(collectionEquipped(b))-Number(collectionEquipped(a))||(cosmeticState().meta?.acquiredAt?.[b.id]||0)-(cosmeticState().meta?.acquiredAt?.[a.id]||0));
  const selected=(S.collectionInspect?all.find(x=>x.id===S.collectionSelected&&x.kind===kind):null)||items.find(x=>x.id===S.collectionSelected)||items.find(x=>collectionEquipped(x))||items[0];
  const have=all.filter(x=>x.kind===kind&&owned.has(x.id)).length,total=all.filter(x=>x.kind===kind).length;
  const milestone=collectionMilestone(kind,have,total),newIds=collectionNewIds();
  const selectedOwned=selected&&owned.has(selected.id),equipped=selected&&collectionEquipped(selected);
  const inspector=selected?`<aside class="collection-inspector" data-rarity="${selected.rarity}" aria-label="${t('Anteprima oggetto')}"><button class="collection-back" data-act="collectionBack">← ${t('Torna agli oggetti')}</button><div class="collection-inspector-art" data-kind="${kind}">${collectionArt(selected)}</div><div class="collection-inspector-copy"><span class="collection-rarity">${t(rarities.find(x=>x.id===selected.rarity).name)}</span><h3>${esc(t(selected.name))}</h3><p>${t(equipped?'In uso':selectedOwned?'Nella tua collezione':'Da scoprire nelle chest')}</p>${selectedOwned?`<button class="collection-primary" data-act="collectionEquip" data-id="${selected.id}" ${!S.collectionOnline||equipped?'disabled':''}>${t(equipped?'Equipaggiato':kind==='avatar'?'Usa avatar':'Equipaggia')}</button>`:`<button class="collection-primary" data-act="chests">${t('Vai al bottino')}</button>`}<button class="collection-secondary collection-preview-entry" data-act="collectionTable" data-id="${selected.id}">${t('Anteprima sul tavolo')}</button><details class="collection-options"><summary>${t('Altre opzioni')}</summary>${kind==='avatar'?`<button class="collection-secondary" data-act="collectionLook" ${!S.collectionOnline?'disabled':''}>${t('Titoli e colori')}</button>`:''}${kind==='victory'?`<button class="collection-secondary" data-act="cosmeticPlay" data-id="${selected.id}">${t('Prova animazione')}</button>`:''}${kind!=='avatar'&&cosmeticState().loadout[kind]?`<button class="collection-secondary cx-reset" data-act="collectionReset" data-kind="${kind}" ${!S.collectionOnline?'disabled':''}>${t('Ripristina stile base')}</button>`:''}</details></div></aside>`:'';
  openModal('cosmetics',collectionShell('collection',`<div data-scroll-key="${kind}:${S.collectionOnlyOwned!==false}:${S.collectionInspect?S.collectionSelected:'grid'}" class="collection-layout ${S.collectionInspect&&selected?'is-inspecting':''}"><nav class="collection-categories cx-tabs" aria-label="${t('Tipo di oggetto')}">${categories.map(c=>`<button data-act="collectionCategory" data-kind="${c.id}" aria-pressed="${c.id===kind}">${uiIcon(c.icon)}<span>${t(c.name)}</span></button>`).join('')}</nav><section class="collection-browser"><div class="collection-heading"><div><h2>${t(category.name)}</h2></div><div class="collection-completion"><strong>${have}<span> / ${total}</span></strong><progress value="${have}" max="${total}" aria-label="${t('Oggetti posseduti')}"></progress></div></div>
    ${milestone.complete?`<p class="collection-complete ${milestone.celebrate?'is-celebrating':''}" ${milestone.celebrate?'role="status"':''}>${uiIcon('check')}${t('Categoria completata')}</p>`:''}
    ${!S.collectionOnline?`<p class="collection-notice">${t('Copia offline: collegati per cambiare stile.')}</p>`:''}
    ${collectionBaseChoices(kind)}
    <div class="collection-ownership" role="group" aria-label="${t('Disponibilità')}"><button data-act="collectionOwnership" data-owned="true" aria-pressed="${S.collectionOnlyOwned!==false}">${t('Solo posseduti')}</button><button data-act="collectionOwnership" data-owned="false" aria-pressed="${S.collectionOnlyOwned===false}">${t('Mostra tutti')}</button></div>
    <div class="collection-grid cx-grid" role="group" aria-label="${t(category.name)}">${items.map(x=>`<button class="collection-card cx-item ${owned.has(x.id)?'':'is-locked'} ${collectionEquipped(x)?'is-equipped':''} ${newIds.has(x.id)?'is-new':''}" data-act="collectionSelect" data-id="${x.id}" data-rarity="${x.rarity}" data-kind="${kind}" aria-pressed="${selected?.id===x.id}" aria-label="${esc(t(x.name))}, ${t(rarities.find(r=>r.id===x.rarity).name)}, ${t(owned.has(x.id)?'Posseduto':'Non posseduto')}"><div class="collection-card-art">${collectionArt(x)}</div><span class="collection-card-label"><b>${esc(t(x.name))}</b><small>${t(collectionEquipped(x)?'In uso':owned.has(x.id)?rarities.find(r=>r.id===x.rarity).name:'Non posseduto')}</small></span>${newIds.has(x.id)?`<span class="collection-new">${t('Nuovo')}</span>`:''}${collectionEquipped(x)?`<span class="collection-tick" aria-label="${t('In uso')}">✓</span>`:''}</button>`).join('')||`<div class="collection-empty">${uiIcon('cards')}<h3>${t('Nessun oggetto da mostrare')}</h3><p>${t('Trova nuovi oggetti nelle chest oppure scegli Mostra tutti.')}</p><button class="collection-primary" data-act="chests">${t('Vai al bottino')}</button></div>`}</div></section>${inspector}</div>`));
  const scrollKey=$('#modal .collection-layout')?.dataset.scrollKey;$('#modal .modal-box').scrollTop=S.collectionPositions?.[scrollKey]||0;
}
Object.assign(handlers,{
  collection:()=>collectionModal(),
  collectionStyle:el=>collectionModal(el.dataset.kind),
  async collectionBase(el){
    const kind=el.dataset.kind,value=el.dataset.value,allowed=kind==='felt'?['verde','blu','bordeaux','antracite']:kind==='back'?['rosso','blu','verde','nero',...[['oro','b_oro'],['notte','b_notte'],['smeraldo','b_smeraldo']].filter(x=>S.progress?.unlocks?.includes(x[1])).map(x=>x[0])]:[];
    if(!allowed.includes(value)||!S.collectionOnline||S.collectionBusy)return;const owner=S.token;S.collectionBusy=true;
    try{if(cosmeticState().loadout[kind]&&!await equipCosmetic(kind,null))return;if(owner!==S.token)return;S.prefs[kind]=value;applyPrefs();renderCollection();const details=$('#modal .collection-base');if(details)details.open=true;toast(t('Stile aggiornato'));}finally{S.collectionBusy=false;}
  },
  collectionAvatar:()=>collectionModal('avatar'),
  collectionCategory(el){S.collectionCategory=el.dataset.kind;S.collectionSelected=null;S.collectionInspect=false;renderCollection();},
  collectionOwnership(el){S.collectionOnlyOwned=el.dataset.owned==='true';S.collectionInspect=false;renderCollection();},
  async collectionSelect(el){S.collectionSelected=el.dataset.id;S.collectionInspect=true;renderCollection();
    if(S.collectionOnline&&collectionNewIds().has(el.dataset.id)){const owner=S.token,r=await emit('seeCollectionItem',{id:el.dataset.id});if(owner===S.token&&r.ok){cacheCosmetics(r.cosmetics);if(S.modalKind==='cosmetics'&&S.collectionSelected===el.dataset.id)renderCollection();}}
  },
  collectionBack(){S.collectionInspect=false;renderCollection();$('#modal .collection-card[data-id="'+CSS.escape(S.collectionSelected||'')+'"]')?.focus({preventScroll:true});},
  collectionClear(){S.collectionInspect=false;renderCollection();},
  async collectionEquip(el){
    const item=collectionItems().find(x=>x.id===el.dataset.id);if(!item||!collectionOwned().has(item.id)||!S.collectionOnline||S.collectionBusy)return;
    const owner=S.token;S.collectionBusy=true;el.disabled=true;
    try{let ok;if(item.kind==='avatar'){const p=S.collectionData.profile,r=await emit('setAvatar',{id:item.id,c:p.avatar?.c||p.colors?.[0]||'#f2c14e'});if(owner!==S.token)return;ok=r.ok;if(ok)p.avatar=r.avatar;}else ok=await equipCosmetic(item.kind,item.id);if(owner===S.token&&ok){S.collectionSelected=item.id;renderCollection();confirmEquipped(item);}else if(owner===S.token)el.disabled=false;}finally{S.collectionBusy=false;}
  },
  async collectionReset(el){if(await equipCosmetic(el.dataset.kind,null))renderCollection();}
});
function collectionTablePreview(id){
  collectionRememberView();
  const profile=S.collectionData?.owner===S.token?S.collectionData.profile:{nick:S.social?.nick||S.name||t('Tu'),avatar:{id:'fante-quadri'}};
  const selected=collectionItems().find(x=>x.id===id),loadout={...cosmeticState().loadout};
  const avatar={...(profile.avatar||{}),id:profile.avatar?.id||'fante-quadri'};
  if(selected){if(selected.kind==='avatar')avatar.id=selected.id;else loadout[selected.kind]=selected.id;}
  if(loadout.frame)avatar.cf=loadout.frame;else delete avatar.cf;
  const back=window.SmazzataCosmetics.byId.get(loadout.back);
  const room={seats:[{style:{felt:loadout.felt}},{}]},game={n:2,you:0};
  openModal('collectionTable',collectionShell('collection',`<section class="collection-table-page"><button class="collection-secondary" data-act="collectionPreviewBack">← ${t('Torna agli oggetti')}</button><h2>${t('Anteprima sul tavolo')}</h2><p>${t('Il tuo stile nella tua metà del campo. Il centro rimane condiviso.')}</p><div class="collection-table-preview">${personalFeltsHTML(game,room)}<span class="preview-opponent">${t('Avversario')}</span><div class="preview-poker">${['♠','♥','♦','♣'].map((s,i)=>`<span class="preview-face ${i===1||i===2?'red':''}">K<small>${s}</small></span>`).join('')}</div><div class="preview-identity">${avatarHTML(profile.nick,0,false,avatar)}<b>${esc(profile.nick)}</b></div><div class="preview-hand">${Array.from({length:5},(_,i)=>`<span class="preview-back" style="--i:${i};${back?.art?`background-image:url('${back.art}')`:''}"></span>`).join('')}</div>${selected&&['reaction','victory'].includes(selected.kind)?'<div class="preview-extra">'+collectionArt(selected)+'</div>':''}</div><p>${t('È solo una prova: il tuo equipaggiamento cambia quando confermi.')}</p>${selected?`<h3>${esc(t(selected.name))}</h3><button class="collection-primary" data-act="collectionPreviewEquip" data-id="${selected.id}" ${!S.collectionOnline||!collectionOwned().has(selected.id)||collectionEquipped(selected)?'disabled':''}>${t(collectionEquipped(selected)?'Equipaggiato':'Equipaggia')}</button>`:''}</section>`));
}
async function collectionLookModal(){
  collectionRememberView();
  const owner=S.token,r=await emit('profile');if(owner!==S.token||!r.ok)return;
  S.collectionData={owner,profile:r};cacheCosmetics(r.cosmetics);
  openModal('collectionLook',collectionShell('collection',`<section class="collection-look"><button class="collection-secondary" data-act="collectionAvatar">← ${t('Avatar')}</button><h2>${t('Titoli e colori')}</h2><div class="preview-identity">${avatarHTML(r.nick,0,false,r.avatar)}</div><h3>${t('Colore del bordo')}</h3><div class="avcolors">${r.colors.map(c=>`<button class="avcol" style="background:${c}" data-act="collectionColor" data-color="${c}" aria-label="${t('Colore del bordo')}: ${c}"></button>`).join('')}</div>${lookHTML(r.avatar||{})}</section>`));
}
Object.assign(handlers,{
  collectionTable:el=>collectionTablePreview(el.dataset.id),collectionPreviewBack:()=>renderCollection(),collectionLook:collectionLookModal,
  async collectionPreviewEquip(el){await handlers.collectionEquip(el);if(S.modalKind==='cosmetics'&&S.collectionSelected===el.dataset.id&&collectionEquipped(collectionItems().find(x=>x.id===el.dataset.id)))collectionTablePreview(el.dataset.id);},
  async collectionColor(el){const owner=S.token,p=S.collectionData?.profile;if(!p||!S.collectionOnline)return;const r=await emit('setAvatar',{id:p.avatar?.id||'fante-quadri',c:el.dataset.color});if(owner===S.token&&r.ok)await collectionLookModal();}
});
