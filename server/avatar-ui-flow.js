'use strict';
module.exports = async ({ cdp, shot, step }) => {
  await cdp.run(`
    document.querySelector('#toast').classList.add('hidden');
    const catalog = window.SmazzataAvatars;
    const profile = await emit('profile');
    if (catalog.LIST.length !== 20 || new Set(catalog.LIST.map(a => a.id)).size !== 20) throw Error('catalogo avatar incompleto');
    for (const entry of catalog.LIST) {
      if (!profile.emoji.includes(entry.e)) throw Error('avatar incompatibile con i profili salvati');
      const saved = await emit('setAvatar', {e:entry.e,c:'#64b5f6'});
      if (!saved.ok || saved.avatar.e !== entry.e || saved.avatar.c !== '#64b5f6') throw Error('avatar non salvato: '+entry.id);
    }
    await emit('setAvatar', {e:'🐶',c:'#81c784'});
    await profileModal();
    if (!document.querySelector('.avopt.on').title.includes('Orso')) throw Error('avatar precedente non convertito');
    document.querySelector('.avopt[data-e="🦊"]').click(); await __W(400);
    if (document.querySelector('.avpreview .avatar').getAttribute('aria-label') !== 'Volpe del fante') throw Error('anteprima non aggiornata');
    document.querySelector('.avcol[data-c="#64b5f6"]').click(); await __W(400);
    const saved = await emit('profile');
    if (saved.avatar.e !== '🦊' || saved.avatar.c !== '#64b5f6') throw Error('scelta o colore persi');
    await profileModal();
    if (document.querySelectorAll('.avopt svg').length !== 20 || document.querySelectorAll('.avopt[aria-pressed=true]').length !== 1) throw Error('selezione avatar non accessibile');
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
  step('20 avatar: salvataggio, compatibilità, colori, cornici, home e profilo mobile verificati');
};
