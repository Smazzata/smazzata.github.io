'use strict';
module.exports = async ({cdp,shot,step}) => {
  await cdp.run(`
    const catalog=window.SmazzataAvatars;
    const initial=['fante-quadri','dama-fiori','giardiniere-fiori','pasticciera-vaniglia'];
    if(catalog.LIST.length!==50)throw Error('catalogo incompleto');
    const profile=await emit('profile');
    for(const a of catalog.LIST){
      const result=await emit('setAvatar',{id:a.id,c:'#64b5f6'});
      if(result.ok!==initial.includes(a.id))throw Error('possesso errato: '+a.id);
    }
    if((await emit('setAvatar',{id:'inventato',c:'#64b5f6'})).ok)throw Error('ID arbitrario');
    await emit('setAvatar',{id:'fante-quadri',c:'#64b5f6'});
    S.avatarScope='all';S.avatarFilter='legendary';await profileModal();
    if(document.querySelectorAll('.avopt').length!==4)throw Error('collezione iniziale errata');
    if(document.querySelector('[data-act=avatarScope], [data-act=avatarFilter]'))throw Error('catalogo nascosto accessibile');
    await handlers.previewAvatar({dataset:{avatarId:'drago-imperatore'}});
    if(S.modalKind!=='profile')throw Error('anteprima non posseduto accessibile');
    await handlers.previewAvatar(document.querySelector('[data-avatar-id=giardiniere-fiori]'));
    if(!document.querySelector('[data-act=pickAvatar]'))throw Error('avatar iniziale non selezionabile');
    document.querySelector('[data-act=pickAvatar]').click();await __W(200);
    if((await emit('profile')).avatar.id!=='giardiniere-fiori')throw Error('selezione persa');
  `);
  for(const width of [320,375,768]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:812,deviceScaleFactor:1,mobile:true});
    await cdp.run(`await profileModal();await __W(150);const box=document.querySelector('.modal-box');if(box.scrollWidth>box.clientWidth+1)throw Error('profilo fuori schermo');`);
    await shot('avatar-profilo-'+width);
  }
  await cdp.run(`closeModal();S.screen='home';render();`);
  step('Quattro avatar iniziali: possesso server, anteprime nascoste, selezione e profilo responsive verificati');
};
