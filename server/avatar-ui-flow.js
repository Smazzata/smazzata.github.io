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
      if (catalog.isSelectable(entry.id)) {
        if (!saved.ok || saved.avatar.id!==entry.id || saved.avatar.e !== entry.e || saved.avatar.c !== '#64b5f6') throw Error('avatar comune non salvato: '+entry.id);
      } else if(saved.ok) throw Error('avatar non comune assegnato: '+entry.id);
    }
    if((await emit('setAvatar',{id:'inesistente',c:'#64b5f6'})).ok) throw Error('ID avatar arbitrario accettato');
    const modern = await emit('setAvatar',{id:'coniglio-gentile',c:'#64b5f6'});
    const legacy = await emit('setAvatar',{e:modern.avatar.e,c:'#81c784'});
    if(legacy.avatar.id!=='coniglio-gentile') throw Error('il client precedente ha perso il nuovo avatar cambiando colore');
    if((await emit('setAvatar',{e:'😎',c:'#64b5f6'})).ok) throw Error('rarità aggirata usando la chiave precedente');
    await emit('setAvatar', {e:'🐶',c:'#81c784'});
    await profileModal();
    if (!document.querySelector('.avopt.on').title.includes('Orso')) throw Error('avatar precedente non convertito');
    document.querySelector('.avopt[data-avatar-id="volpe"]').click(); await __W(400);
    if (document.querySelector('.avpreview .avatar').getAttribute('aria-label') !== 'Volpe del fante') throw Error('anteprima non aggiornata');
    document.querySelector('.avcol[data-c="#64b5f6"]').click(); await __W(400);
    const saved = await emit('profile');
    if (saved.avatar.id!=='volpe' || saved.avatar.e !== '🦊' || saved.avatar.c !== '#64b5f6') throw Error('scelta o colore persi');
    await profileModal();
    if (document.querySelectorAll('.avopt .avatar-art').length !== 40 || document.querySelectorAll('.avopt[aria-pressed=true]').length !== 1) throw Error('selezione avatar non accessibile');
    if(document.querySelectorAll('.avopt:not(:disabled)').length!==40) throw Error('i comuni non sono tutti selezionabili');
    for(const rarity of catalog.RARITIES) {
      await handlers.avatarFilter({dataset:{rarity:rarity.id}});
      if(document.querySelectorAll('.avopt').length!==counts[rarity.id] || [...document.querySelectorAll('.avopt')].some(b=>b.dataset.rarity!==rarity.id)) throw Error('filtro rarità errato');
      if(rarity.id!=='common' && document.querySelector('.avopt:not(:disabled)')) throw Error('avatar superiore selezionabile');
    }
    const legendary = document.querySelector('.avopt[data-avatar-id="drago-imperatore"]');
    legendary.click();await __W(400);
    const picked = await emit('profile');
    if(picked.avatar.id!=='volpe') throw Error('avatar bloccato selezionato dal catalogo');
    await emit('setAvatar',{id:'volpe',c:'#64b5f6'});
    await handlers.avatarFilter({dataset:{rarity:'all'}});
    if(document.querySelectorAll('.avopt:disabled').length!==60 || document.querySelectorAll('.avopt:not(:disabled)').length!==40) throw Error('disponibilità del catalogo errata');
    const gradientIds=[...document.querySelectorAll('#modal svg defs [id]')].map(el=>el.id);
    if(new Set(gradientIds).size!==gradientIds.length) throw Error('gradienti avatar con ID duplicati');
    for(const svg of document.querySelectorAll('#modal .avatar-art')) {
      for(const el of svg.querySelectorAll('[fill],[stroke]')) {
        for(const attr of ['fill','stroke']) {
          const match=(el.getAttribute(attr)||'').match(/^url\\(#(.+)\\)$/);
          if(match&&!svg.querySelector('[id="'+match[1]+'"]')) throw Error('gradiente avatar mancante: '+match[1]);
        }
      }
    }
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
  step('100 avatar: solo 40 comuni selezionabili, rarità bloccate anche via API, compatibilità e profilo mobile verificati');
};
