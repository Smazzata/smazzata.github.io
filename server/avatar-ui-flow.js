'use strict';
module.exports = async ({ cdp, shot, step }) => {
  await cdp.run(`
    document.querySelector('#toast').classList.add('hidden');
    const catalog = window.SmazzataAvatars;
    const profile = await emit('profile');
    if (catalog.LIST.length !== 100 || new Set(catalog.LIST.map(a => a.id)).size !== 100) throw Error('catalogo avatar incompleto');
    if (new Set(catalog.LIST.map(a=>a.art)).size!==100) throw Error('illustrazioni duplicate');
    const counts={common:40,rare:30,epic:20,legendary:10};
    for (const rarity of catalog.RARITIES) if(catalog.LIST.filter(a=>a.rarity===rarity.id).length!==counts[rarity.id]) throw Error('distribuzione rarità errata');
    for (const entry of catalog.LIST) {
      if (!profile.emoji.includes(entry.e)) throw Error('avatar incompatibile con i profili salvati');
      const saved = await emit('setAvatar', {id:entry.id,c:'#64b5f6'});
      if (!saved.ok || saved.avatar.id!==entry.id || saved.avatar.e !== entry.e || saved.avatar.c !== '#64b5f6') throw Error('avatar non salvato: '+entry.id);
    }
    if((await emit('setAvatar',{id:'inesistente',c:'#64b5f6'})).ok) throw Error('ID avatar arbitrario accettato');
    const modern = await emit('setAvatar',{id:'drago-imperatore',c:'#64b5f6'});
    const legacy = await emit('setAvatar',{e:modern.avatar.e,c:'#81c784'});
    if(legacy.avatar.id!=='drago-imperatore') throw Error('il client precedente ha perso il nuovo avatar cambiando colore');
    await emit('setAvatar', {e:'🐶',c:'#81c784'});
    await profileModal();
    if (!document.querySelector('.avopt.on').title.includes('Orso')) throw Error('avatar precedente non convertito');
    document.querySelector('.avopt[data-avatar-id="volpe"]').click(); await __W(400);
    if (document.querySelector('.avpreview .avatar').getAttribute('aria-label') !== 'Volpe del fante') throw Error('anteprima non aggiornata');
    document.querySelector('.avcol[data-c="#64b5f6"]').click(); await __W(400);
    const saved = await emit('profile');
    if (saved.avatar.id!=='volpe' || saved.avatar.e !== '🦊' || saved.avatar.c !== '#64b5f6') throw Error('scelta o colore persi');
    await profileModal();
    if (document.querySelectorAll('.avopt svg').length !== 100 || document.querySelectorAll('.avopt[aria-pressed=true]').length !== 1) throw Error('selezione avatar non accessibile');
    for(const rarity of catalog.RARITIES) {
      await handlers.avatarFilter({dataset:{rarity:rarity.id}});
      if(document.querySelectorAll('.avopt').length!==counts[rarity.id] || [...document.querySelectorAll('.avopt')].some(b=>b.dataset.rarity!==rarity.id)) throw Error('filtro rarità errato');
    }
    const legendary = document.querySelector('.avopt[data-avatar-id="drago-imperatore"]');
    legendary.click();await __W(400);
    const picked = await emit('profile');
    if(picked.avatar.id!=='drago-imperatore' || !document.querySelector('.avpreview .avatar-rarity[data-rarity=legendary]')) throw Error('avatar leggendario perso');
    await emit('setAvatar',{id:'volpe',c:'#64b5f6'});
    await handlers.avatarFilter({dataset:{rarity:'all'}});
    document.querySelector('#toast').classList.add('hidden');
    if (!avatarHTML('Anna',0,false,{e:'🦊',c:'#64b5f6',f:'oro'}).includes('fr-oro')) throw Error('cornice persa');
    if (avatarHTML('Computer',0,true).includes('🤖')) throw Error('emoji al posto del mazziere');
  `);
  for (const width of [320,375]) {
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:812,deviceScaleFactor:1,mobile:true});
    await cdp.run(`
      document.querySelector('#modal .modal-box').scrollTop=0;
      await __W(300);
      const grid=document.querySelector('.avgrid');
      if (grid.scrollWidth>grid.clientWidth || document.documentElement.scrollWidth>innerWidth) throw Error('avatar fuori schermo');
    `);
    await shot('avatar-profilo-' + width);
  }
  await cdp.run(`S.prefs.theme='scuro';applyPrefs();await profileModal();document.querySelector('#modal .modal-box').scrollTop=0;await __W(300);`);
  await shot('avatar-profilo-notte');
  await cdp.run(`
    S.prefs.theme='chiaro';applyPrefs();closeModal();await __W(250);S.screen='home';render();
    if (document.querySelector('.hello .avatar').getAttribute('aria-label')!=='Volpe del fante') throw Error('avatar perso nella home');
    await emit('setAvatar',{e:'🦊',c:'#64b5f6'});
  `);
  step('100 avatar: rarità, filtri, salvataggio, compatibilità, colori, cornici e profilo mobile verificati');
};
