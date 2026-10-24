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
    await profileModal();if(document.querySelector('.avopt')||!document.querySelector('[data-act=collectionAvatar]'))throw Error('profilo ancora duplicato');
    await collectionModal('avatar');if(document.querySelectorAll('.collection-card').length!==4)throw Error('collezione iniziale errata');
    await handlers.collectionSelect({dataset:{id:'giardiniere-fiori'}});
    await handlers.collectionEquip({dataset:{id:'giardiniere-fiori'}});
    if((await emit('profile')).avatar.id!=='giardiniere-fiori')throw Error('selezione persa');
  `);
  for(const width of [320,375,768]){
    await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:812,deviceScaleFactor:1,mobile:true});
    await cdp.run(`await profileModal();await __W(150);const box=document.querySelector('.modal-box');if(box.scrollWidth>box.clientWidth+1)throw Error('profilo fuori schermo');`);
    await shot('avatar-profilo-'+width);
  }
  await cdp.run(`closeModal();S.screen='home';render();`);
  step('Quattro avatar iniziali: possesso server, selezione nella collezione e profilo essenziale responsive verificati');
};
