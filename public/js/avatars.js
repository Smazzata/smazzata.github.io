/* Ritratti originali illustrati e pose dei tre avatar leggendari. */
'use strict';
(function(root){
  const catalog=typeof module==='object'&&module.exports?require('../../shared/avatars'):root.SmazzataAvatarCatalog;
  const LIST=catalog.LIST;
  function svg(value,name){
    const a=catalog.resolve(value,name);
    if(a.frames===3)return '<span class="avatar-art avatar-living" data-rarity="legendary" data-avatar="'+a.id+'" aria-hidden="true">'+[0,1,2].map(i=>'<span class="avatar-pose pose-'+i+'" style="background-image:url('+a.art+');background-position:'+i*50+'% center"></span>').join('')+'<span class="avatar-shimmer"></span><i class="avatar-mote mote-a"></i><i class="avatar-mote mote-b"></i></span>';
    return '<img class="avatar-art avatar-portrait" data-rarity="'+a.rarity+'" src="'+a.art+'" alt="" loading="eager" decoding="async" width="512" height="512" draggable="false">';
  }
  const api={LIST,RARITIES:catalog.RARITIES,resolve:catalog.resolve,svg,isSelectable:catalog.isSelectable};
  if(typeof module==='object'&&module.exports)module.exports=api;else root.SmazzataAvatars=api;
})(typeof globalThis!=='undefined'?globalThis:this);
