'use strict';
module.exports = async ({ cdp, shot, step }) => {
  await cdp.run(`
    document.querySelector('#toast').classList.add('hidden');
    const catalog = window.SmazzataAvatars;
    const profile = await emit('profile');
    if (catalog.LIST.length !== 50 || new Set(catalog.LIST.map(a => a.id)).size !== 50) throw Error('catalogo avatar incompleto');
    if (new Set(catalog.LIST.map(a=>a.art)).size!==50) throw Error('illustrazioni duplicate');
    const counts={common:24,rare:15,epic:8,legendary:3};
    await Promise.all(catalog.LIST.map(a=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.naturalWidth/img.naturalHeight===a.frames?resolve():reject(Error('pose non valide: '+a.id));img.onerror=()=>reject(Error('ritratto non caricato: '+a.id));img.src=a.art;})));
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
    S.avatarFilter='common';await profileModal();
    if (!document.querySelector('.avopt.on').title.includes('Orso')) throw Error('avatar precedente non convertito');
    document.querySelector('.avopt[data-avatar-id="volpe"]').click(); await __W(300);
    if (!document.querySelector('.avatar-detail-art')) throw Error('anteprima comune assente');
    document.querySelector('[data-act=pickAvatar]').click(); await __W(400);
    if (document.querySelector('.avpreview .avatar').getAttribute('aria-label') !== 'Volpe del fante') throw Error('anteprima non aggiornata');
    document.querySelector('.avcol[data-c="#64b5f6"]').click(); await __W(400);
    const saved = await emit('profile');
    if (saved.avatar.id!=='volpe' || saved.avatar.e !== '🦊' || saved.avatar.c !== '#64b5f6') throw Error('scelta o colore persi');
    await profileModal();
    if (document.querySelectorAll('.avopt .avatar-art').length !== 24 || document.querySelectorAll('.avopt[aria-pressed=true]').length !== 1) throw Error('selezione avatar non accessibile');
    if(document.querySelectorAll('.avopt:not(:disabled)').length!==24) throw Error('i comuni non sono tutti selezionabili');
    await handlers.avatarScope({dataset:{scope:'all'}});
    for(const rarity of catalog.RARITIES) {
      await handlers.avatarFilter({dataset:{rarity:rarity.id}});
      if(document.querySelectorAll('.avopt').length!==counts[rarity.id] || [...document.querySelectorAll('.avopt')].some(b=>b.dataset.rarity!==rarity.id)) throw Error('filtro rarità errato');
      if(rarity.id!=='common' && document.querySelectorAll('.avlock').length!==counts[rarity.id]) throw Error('blocco avatar superiore non indicato');
    }
    const legendary = document.querySelector('.avopt[data-avatar-id="drago-imperatore"]');
    legendary.click();await __W(400);
    if(!document.querySelector('.avatar-detail-art') || document.querySelector('[data-act=pickAvatar]')) throw Error('anteprima bloccata errata');
    const picked = await emit('profile');
    if(picked.avatar.id!=='volpe') throw Error('avatar bloccato selezionato dal catalogo');
    await handlers.avatarCatalog();
    await emit('setAvatar',{id:'volpe',c:'#64b5f6'});
    await handlers.avatarFilter({dataset:{rarity:'all'}});
    if(document.querySelectorAll('.avlock').length!==26 || document.querySelectorAll('.avopt').length!==50) throw Error('disponibilità del catalogo errata');
    await handlers.avatarScope({dataset:{scope:'owned'}});
    if(document.querySelectorAll('.avopt').length!==24 || document.querySelector('.avlock')) throw Error('filtro posseduti errato');
    await handlers.avatarFilter({dataset:{rarity:'legendary'}});
    if(!document.querySelector('.av-empty') || document.querySelector('.avopt')) throw Error('rarità non posseduta visibile');
    await handlers.avatarScope({dataset:{scope:'all'}});
    if(document.querySelectorAll('.avatar-living').length!==3 || document.querySelectorAll('.avatar-pose').length!==9) throw Error('pose dei tre leggendari mancanti');
    document.body.classList.add('noanim');
    if([...document.querySelectorAll('.avatar-pose')].some(el=>getComputedStyle(el).animationName!=='none')) throw Error('animazione non disattivabile');
    document.body.classList.remove('noanim');
    await handlers.avatarFilter({dataset:{rarity:'all'}});
    await Promise.all([...document.querySelectorAll('.avatar-portrait')].map(i=>{i.loading='eager';return i.decode();}));
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
  step('50 avatar: solo 24 comuni selezionabili, rarità bloccate anche via API, compatibilità e profilo mobile verificati');
};
