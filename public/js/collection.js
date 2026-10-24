'use strict';
// Un solo spazio per identità, oggetti posseduti, bottino e posta.
function collectionShell(active,content){
  const state=cosmeticState(),cached=store.get('bur_chest_cache',null),chestData=cached?.owner===S.token?cached.data:null,chests=chestData?.pending?.length||0;
  return `<section class="collection-app"><header class="collection-header"><div class="collection-brand"><span class="collection-crest">${uiIcon('cards')}</span><div><small>SMAZZATA</small><strong>${t('Il tuo mondo di gioco')}</strong></div></div><button class="collection-account" data-act="profile" aria-label="${t('Il mio profilo')}">${uiIcon('profile')}</button></header>
    <nav class="collection-mainnav" aria-label="${t('Inventario personale')}">${[{id:'collection',act:'collection',label:'Collezione',icon:'cards'},{id:'loot',act:'chests',label:'Bottino',icon:'trophy',count:chests},{id:'mail',act:'inbox',label:'Posta',icon:'mail',count:S.social?.unreadMail||0}].map(x=>`<button data-act="${x.act}" aria-current="${active===x.id?'page':'false'}">${uiIcon(x.icon)}<span>${t(x.label)}</span>${x.count?`<b>${x.count}</b>`:''}</button>`).join('')}<span class="collection-currency" title="${t('Frammenti')}"><i aria-hidden="true">◇</i>${chestData?.fragments||0}</span></nav>
    <div class="collection-content">${content}</div><footer class="collection-footer"><span>${t('Fai tuo ogni dettaglio.')}</span><span>${state.ownedIds.length+(S.collectionData?.owner===S.token?S.collectionData.profile.ownedAvatarIds?.length||0:0)} ${t('oggetti posseduti')}</span></footer></section>`;
}
function collectionCategories(){return [{id:'avatar',name:'Avatar',icon:'profile'},...window.SmazzataCosmetics.KINDS.map(x=>({...x,icon:({back:'cards',frame:'medal',felt:'home',reaction:'chat',victory:'trophy'})[x.id]}))];}
function collectionItems(){return [...window.SmazzataAvatars.LIST.map(x=>({...x,kind:'avatar'})),...window.SmazzataCosmetics.LIST];}
function collectionOwned(){const p=S.collectionData?.owner===S.token?S.collectionData.profile:null;return new Set([...(p?.ownedAvatarIds||window.SmazzataAvatarCatalog.STARTER_IDS),...cosmeticState().ownedIds]);}
function collectionEquipped(item){return item.kind==='avatar'?S.collectionData?.owner===S.token&&S.collectionData.profile?.avatar?.id===item.id:cosmeticState().loadout[item.kind]===item.id;}
function collectionArt(item){return item.kind==='avatar'?window.SmazzataAvatars.svg(item.id):cosmeticArt(item);}
async function collectionModal(kind){
  const owner=S.token;
  if(S.collectionOwner!==owner){S.collectionOwner=owner;S.collectionData=null;S.collectionCategory='avatar';S.collectionRarity='all';S.collectionOnlyOwned=true;S.collectionQuery='';S.collectionSelected=null;S.collectionInspect=false;}
  if(collectionCategories().some(x=>x.id===kind)){S.collectionCategory=kind;S.collectionSelected=null;S.collectionInspect=false;}
  S.collectionOnline=false;
  if(!OFFLINE&&S.connected){const r=await emit('profile');if(owner!==S.token)return;if(r.ok){S.collectionData={owner,profile:r};S.collectionOnline=true;cacheCosmetics(r.cosmetics);cacheChestState(r.chests);S.chestState=r.chests;}}
  if(owner!==S.token)return;
  renderCollection();
}
function renderCollection(){
  const categories=collectionCategories(),kind=S.collectionCategory||'avatar',owned=collectionOwned(),all=collectionItems(),category=categories.find(x=>x.id===kind),rarities=window.SmazzataAvatars.RARITIES;
  const query=(S.collectionQuery||'').toLocaleLowerCase(),items=all.filter(x=>x.kind===kind&&(!S.collectionOnlyOwned||owned.has(x.id))&&(!S.collectionRarity||S.collectionRarity==='all'||x.rarity===S.collectionRarity)&&t(x.name).toLocaleLowerCase().includes(query));
  const selected=items.find(x=>x.id===S.collectionSelected)||items.find(x=>collectionEquipped(x))||items[0];
  const have=all.filter(x=>x.kind===kind&&owned.has(x.id)).length,total=all.filter(x=>x.kind===kind).length;
  const selectedOwned=selected&&owned.has(selected.id),equipped=selected&&collectionEquipped(selected);
  const inspector=selected?`<aside class="collection-inspector" data-rarity="${selected.rarity}" aria-label="${t('Anteprima oggetto')}"><button class="collection-back" data-act="collectionBack">← ${t('Torna agli oggetti')}</button><div class="collection-inspector-art" data-kind="${kind}">${collectionArt(selected)}</div><div class="collection-inspector-copy"><span class="collection-rarity">${t(rarities.find(x=>x.id===selected.rarity).name)}</span><h3>${esc(t(selected.name))}</h3><p>${t(equipped?'In uso':selectedOwned?'Nella tua collezione':'Da scoprire nelle chest')}</p>${selectedOwned?`<button class="collection-primary" data-act="collectionEquip" data-id="${selected.id}" ${!S.collectionOnline||equipped?'disabled':''}>${t(equipped?'Equipaggiato':kind==='avatar'?'Usa avatar':'Equipaggia')}</button>`:`<button class="collection-primary" data-act="chests">${t('Vai al bottino')}</button>`}${kind==='victory'?`<button class="collection-secondary" data-act="cosmeticPlay" data-id="${selected.id}">${t('Prova animazione')}</button>`:''}${kind!=='avatar'&&cosmeticState().loadout[kind]?`<button class="collection-secondary cx-reset" data-act="collectionReset" data-kind="${kind}" ${!S.collectionOnline?'disabled':''}>${t('Ripristina stile base')}</button>`:''}</div></aside>`:'';
  openModal('cosmetics',collectionShell('collection',`<div class="collection-layout ${S.collectionInspect&&selected?'is-inspecting':''}"><nav class="collection-categories cx-tabs" aria-label="${t('Tipo di oggetto')}">${categories.map(c=>`<button data-act="collectionCategory" data-kind="${c.id}" aria-pressed="${c.id===kind}">${uiIcon(c.icon)}<span>${t(c.name)}</span><small>${all.filter(x=>x.kind===c.id&&owned.has(x.id)).length}</small></button>`).join('')}</nav><section class="collection-browser"><div class="collection-heading"><div><small>${t('COLLEZIONE PERSONALE')}</small><h2>${t(category.name)}</h2></div><div class="collection-completion"><strong>${have}<span> / ${total}</span></strong><progress value="${have}" max="${total}" aria-label="${t('Oggetti posseduti')}"></progress></div></div>
    ${!S.collectionOnline?`<p class="collection-notice">${t('Copia offline: collegati per cambiare stile.')}</p>`:''}
    <form id="collectionSearch" class="collection-search"><span>${uiIcon('eye')}</span><input id="collectionQuery" type="search" maxlength="80" autocomplete="off" value="${esc(S.collectionQuery||'')}" placeholder="${t('Cerca nella collezione')}" aria-label="${t('Cerca nella collezione')}"><button type="submit">${t('Cerca')}</button></form>
    <div class="collection-ownership" role="group" aria-label="${t('Disponibilità')}"><button data-act="collectionOwnership" data-owned="true" aria-pressed="${S.collectionOnlyOwned!==false}">${t('Solo posseduti')}</button><button data-act="collectionOwnership" data-owned="false" aria-pressed="${S.collectionOnlyOwned===false}">${t('Mostra tutti')}</button></div>
    <div class="collection-rarities" role="group" aria-label="${t('Rarità')}">${[{id:'all',name:'Tutti'},...rarities].map(r=>`<button data-act="collectionRarity" data-rarity="${r.id}" aria-pressed="${(S.collectionRarity||'all')===r.id}">${r.id==='all'?'':`<i data-rarity="${r.id}"></i>`}${t(r.name)}</button>`).join('')}</div>
    <div class="collection-grid cx-grid" role="group" aria-label="${t(category.name)}">${items.map(x=>`<button class="collection-card cx-item ${owned.has(x.id)?'':'is-locked'} ${collectionEquipped(x)?'is-equipped':''}" data-act="collectionSelect" data-id="${x.id}" data-rarity="${x.rarity}" data-kind="${kind}" aria-pressed="${selected?.id===x.id}" aria-label="${esc(t(x.name))}, ${t(rarities.find(r=>r.id===x.rarity).name)}, ${t(owned.has(x.id)?'Posseduto':'Non posseduto')}"><div class="collection-card-art">${collectionArt(x)}</div><span class="collection-card-label"><b>${esc(t(x.name))}</b><small>${t(collectionEquipped(x)?'In uso':owned.has(x.id)?rarities.find(r=>r.id===x.rarity).name:'Non posseduto')}</small></span>${collectionEquipped(x)?`<span class="collection-tick" aria-label="${t('In uso')}">✓</span>`:''}</button>`).join('')||`<div class="collection-empty">${uiIcon('cards')}<h3>${t('Nessun oggetto da mostrare')}</h3><p>${t('Prova un altro filtro oppure scopri i premi nel bottino.')}</p><button class="collection-secondary" data-act="collectionClear">${t('Azzera filtri')}</button><button class="collection-primary" data-act="chests">${t('Vai al bottino')}</button></div>`}</div></section>${inspector}</div>`));
  document.querySelector('#collectionSearch')?.addEventListener('submit',e=>{e.preventDefault();S.collectionQuery=document.querySelector('#collectionQuery').value.trim();S.collectionInspect=false;renderCollection();});
}
Object.assign(handlers,{
  collection:()=>collectionModal(),
  collectionCategory(el){S.collectionCategory=el.dataset.kind;S.collectionSelected=null;S.collectionInspect=false;S.collectionQuery='';renderCollection();},
  collectionRarity(el){S.collectionRarity=el.dataset.rarity;S.collectionInspect=false;renderCollection();},
  collectionOwnership(el){S.collectionOnlyOwned=el.dataset.owned==='true';S.collectionInspect=false;renderCollection();},
  collectionSelect(el){S.collectionSelected=el.dataset.id;S.collectionInspect=true;renderCollection();$('#modal .modal-box').scrollTop=0;},
  collectionBack(){S.collectionInspect=false;renderCollection();},
  collectionClear(){S.collectionQuery='';S.collectionRarity='all';S.collectionInspect=false;renderCollection();},
  async collectionEquip(el){
    const item=collectionItems().find(x=>x.id===el.dataset.id);if(!item||!collectionOwned().has(item.id)||!S.collectionOnline||S.collectionBusy)return;
    const owner=S.token;S.collectionBusy=true;el.disabled=true;
    try{let ok;if(item.kind==='avatar'){const p=S.collectionData.profile,r=await emit('setAvatar',{id:item.id,c:p.avatar?.c||p.colors?.[0]||'#f2c14e'});if(owner!==S.token)return;ok=r.ok;if(ok)p.avatar=r.avatar;}else ok=await equipCosmetic(item.kind,item.id);if(owner===S.token&&ok){S.collectionSelected=item.id;renderCollection();}else if(owner===S.token)el.disabled=false;}finally{S.collectionBusy=false;}
  },
  async collectionReset(el){if(await equipCosmetic(el.dataset.kind,null))renderCollection();}
});
