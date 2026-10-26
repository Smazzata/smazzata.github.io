'use strict';
// Inventario privato: nel browser conserviamo solo la copia dell'ultimo profilo collegato.
function cosmeticState(){const c=store.get('bur_cosmetic_cache',null);return c?.owner===S.token?c.data:{ownedIds:[],loadout:{}};}
function cacheCosmetics(data){if(!data)return;if(data.ownedIds.length)store.set('bur_cosmetic_cache',{owner:S.token,data});else try{localStorage.removeItem('bur_cosmetic_cache');}catch(_){/* memoria non disponibile */}applyCosmetics();}
function applyCosmetics(){
  const C=window.SmazzataCosmetics,state=cosmeticState(),owned=new Set(state.ownedIds);
  for(const kind of ['back','felt']){
    const item=C.byId.get(state.loadout[kind]),valid=item?.kind===kind&&owned.has(item.id);
    document.body.classList.toggle('cx-'+kind,!!valid);
    if(valid)document.body.style.setProperty('--cx-'+kind,`url("${item.art}")`);else document.body.style.removeProperty('--cx-'+kind);
  }
}
let cosmeticSvgId=0;
function personalFeltsHTML(g,r){
  if(r.campaign)return '';
  const me=g.you>=0?g.you:0,n=g.n,rel=k=>(me+k)%n;
  const places=n===2?[[me,'bottom'],[rel(1),'top']]:n===3?[[me,'bottom'],[rel(1),'left'],[rel(2),'right']]:[[me,'bottom'],[rel(1),'left'],[rel(2),'top'],[rel(3),'right']];
  return `<div class="personal-felts n${n}" aria-hidden="true">${places.map(([seat,pos])=>{
    let id=r.seats?.[seat]?.style?.felt;
    // L'allenamento locale non possiede profili degli avversari: solo il mio settore usa la copia privata.
    if(seat===g.you&&(r.onDevice||r.offline))id=cosmeticState().loadout.felt;
    const item=window.SmazzataCosmetics.byId.get(id);
    return item?.kind==='felt'?`<div class="personal-felt pos-${pos}" data-seat="${seat}" data-item="${item.id}" style="--seat-felt:url('${item.art}')"></div>`:'';
  }).join('')}</div>`;
}
function cosmeticFrame(item){
  const uid='cf'+(++cosmeticSvgId),[base,light]=item.colors,tier=window.SmazzataCosmetics.RARITIES.indexOf(item.rarity),n=item.index;
  // Ogni cornice ha un disegno proprio; i livelli superiori aggiungono incisioni, pietre e intagli.
  const leaf='<path d="M0 0Q-10-9 0-18Q10-9 0 0Z"/>',gem='<path d="M0-7L5 0 0 7-5 0Z"/>',petal='<path d="M0 0C-12-4-10-16 0-12C10-16 12-4 0 0Z"/>';
  const forms=[leaf,petal,gem,'<path d="M0-7Q9 0 0 7Q-9 0 0-7Z"/>'];
  const count=tier===0?12:16+tier*4,radius=tier===0?43:44;
  const ornaments=Array.from({length:count},(_,i)=>{
    const a=i*360/count,choice=forms[(n+i%2)%forms.length];
    return `<g transform="translate(60 60) rotate(${a}) translate(0 -${radius}) scale(${tier===0?.42:.58+tier*.08})" fill="url(#${uid})" stroke="${base}" stroke-width=".8">${choice}<path d="M0-10V3" fill="none" stroke="${light}" stroke-width=".7"/></g>`;
  }).join('');
  const wings=tier>=2?[-1,1].map(s=>`<g transform="translate(60 60) scale(${s} 1)" fill="url(#${uid})" stroke="${base}" stroke-width=".7">${Array.from({length:tier===3?7:4},(_,i)=>`<path d="M29 ${28-i*3}Q${65-i*3} ${26-i*7} ${49-i*2} ${-12-i*3}Q${40-i} ${12-i*2} 29 ${28-i*3}Z"/>`).join('')}</g>`).join(''):'';
  const crown=tier===3?`<path d="M42 21L38 6 51 13 60 0 69 13 82 6 78 21Z" fill="url(#${uid})" stroke="${base}"/><path d="M55 14L60 7 65 14 60 19Z" fill="#9fe9e1"/><circle cx="60" cy="115" r="4" fill="${light}"/>`:'';
  return `<svg class="cx-frame cx-tier-${tier}" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="${uid}" x2=".8" y2="1"><stop stop-color="${light}"/><stop offset=".28" stop-color="${base}"/><stop offset=".48" stop-color="${light}"/><stop offset=".72" stop-color="${base}"/><stop offset="1" stop-color="${light}"/></linearGradient></defs>${wings}<circle cx="60" cy="60" r="44" fill="none" stroke="${base}" stroke-width="7"/><circle cx="60" cy="60" r="45.5" fill="none" stroke="url(#${uid})" stroke-width="4.5" ${n%3===0?'stroke-dasharray="2 1"':''}/><circle cx="60" cy="60" r="40.5" fill="none" stroke="${light}" stroke-width=".9"/>${ornaments}${tier>0?Array.from({length:4+tier*2},(_,i)=>`<g transform="translate(60 60) rotate(${i*360/(4+tier*2)}) translate(0 -44)" fill="${base}" stroke="${light}" stroke-width=".8">${gem}<path d="M0-4L2 0 0 4-2 0Z" fill="${light}" opacity=".75"/></g>`).join(''):''}${crown}</svg>`;
}
function victoryEmblem(item){
  const [base,light]=item.colors,i=item.index,tier=window.SmazzataCosmetics.RARITIES.indexOf(item.rarity),uid='ve'+(++cosmeticSvgId);
  const shapes=[
    'M-8-9L6-12 9 8-5 11Z','M0 10C-20-3-4-18 0-6C4-18 20-3 0 10Z',
    'M0-3C-13-17-19 5-4 4C-12 17 12 17 4 4C19 5 13-17 0-3ZM-2 3L-5 15H5L2 3Z','M0-15L10 0 0 15-10 0Z',
    'M0-15C-25 6-4 14-2 4L-5 15H5L2 4C4 14 25 6 0-15Z','M0-16C-18 7-10 16 0 16C10 16 18 7 0-16Z',
    'M-12-16Q15-4-3 4Q-15 11 10 17L13 11Q-8 6 3 1Q20-8-10-20Z','M-10 12Q-18-14 13-16Q16 11-10 12Z',
    'M0-17L4-5 17-5 7 3 10 16 0 8-10 16-7 3-17-5-4-5Z',
    'M0-14A14 14 0 1 0 0 14A14 14 0 1 0 0-14ZM-6-9A6 6 0 0 0-9-4',
    'M0-18L11-7 7 11 0 18-7 11-11-7Z','M0 13C-25-5-13-24 0-12C13-24 25-5 0 13Z',
    'M0 17Q-20-13 0-19Q20-13 0 17ZM0-12A6 6 0 1 0 0 0A6 6 0 1 0 0-12Z',
    'M5-20L-11 3H0L-5 21 14-5H3Z','M-20-10Q0-24 20-10L20 1Q0-12-20 1ZM-20 6Q0-7 20 6L20 17Q0 4-20 17Z',
    'M-19 15Q-8-18 18-17L2 1A10 10 0 1 1-19 15Z',
    'M-17 14L-12-2-20-17-4-10 0-18 8-10 20-16 13-1 18 15 2 6Z',
    'M-20 7C-17-20 19-23 20-3C20 16-9 20-10 4C-11-8 10-11 11-1C12 7 0 10 0 3L-3 3C-2 18 23 9 20-3',
    'M-22 14Q-20-18 0-16Q20-18 22 14L11 3 0 15-11 3Z',
    'M0-20L7-7 25-17 19 3 30 16 10 10 0 24-10 10-30 16-19 3-25-17-7-7Z'];
  const path=shapes[i],count=6+tier*3;
  return `<svg class="cx-victory-emblem" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="${uid}" x2=".8" y2="1"><stop stop-color="${light}"/><stop offset=".4" stop-color="${base}"/><stop offset=".65" stop-color="${light}"/><stop offset="1" stop-color="${base}"/></linearGradient></defs><circle cx="60" cy="60" r="48" fill="${base}" opacity=".08"/><circle cx="60" cy="60" r="44" fill="none" stroke="${light}" stroke-width=".7"/>${Array.from({length:count},(_,j)=>`<path d="${path}" transform="translate(60 60) rotate(${360*j/count}) translate(0 -37) scale(.23)" fill="url(#${uid})" stroke="${light}" stroke-width="1"/>`).join('')}<g transform="translate(60 60)">${i>=16?[-1,1].map(s=>`<g transform="scale(${s} 1)" fill="url(#${uid})" stroke="${light}" stroke-width=".7">${Array.from({length:6},(_,f)=>`<path d="M3 13Q${48-f*3} ${16-f*5} ${38-f*3} ${-24-f*2}Q${29-f*2} ${-f*2} 3 13Z"/>`).join('')}</g>`).join(''):''}<path d="${path}" transform="scale(${i>=16?1:1.4})" fill="url(#${uid})" stroke="${light}" stroke-width="1"/></g></svg>`;
}
function cosmeticArt(item){
  if(!item)return '';
  if(item.kind==='frame')return `<span class="cx-frame-preview">${window.SmazzataAvatars.svg('fante-quadri')}${cosmeticFrame(item)}</span>`;
  if(item.kind==='victory')return victoryEmblem(item);
  return `<img src="${item.art}" alt="" loading="lazy" class="cx-art cx-art-${item.kind}">`;
}
function chestPrize(reward){
  if(reward.kind==='coins')return {kind:'coins',name:'Monete',html:'<span class="coin-prize">'+uiIcon('coins')+'</span>'};
  const item=window.SmazzataCosmetics.byId.get(reward.itemId);
  if(item)return {...item,html:cosmeticArt(item)};
  const a=window.SmazzataAvatars.resolve(reward.avatarId||reward.itemId);return {...a,kind:'avatar',html:window.SmazzataAvatars.svg(a.id)};
}
async function cosmeticsModal(kind=S.cosmeticKind||'back'){
  S.cosmeticKind=kind;return collectionModal(kind);
}
function cosmeticPreview(id){
  const item=window.SmazzataCosmetics.byId.get(id);if(!item)return;
  S.collectionCategory=item.kind;S.collectionSelected=id;S.collectionInspect=true;renderCollection();
}
async function equipCosmetic(kind,id){
  if(OFFLINE||!S.connected)return false;const owner=S.token,r=await emit('setCosmetic',{kind,id});
  if(owner!==S.token||!r.ok)return false;cacheCosmetics(r.cosmetics);return true;
}
function cosmeticReactions(){
  const state=cosmeticState(),owned=new Set(state.ownedIds);return window.SmazzataCosmetics.LIST.filter(x=>x.kind==='reaction'&&owned.has(x.id)).sort((a,b)=>(b.id===state.loadout.reaction)-(a.id===state.loadout.reaction));
}
function cosmeticReactionButtons(){return cosmeticReactions().map(x=>`<button data-act="react" data-cosmetic-id="${x.id}" title="${esc(t(x.name))}" aria-label="${esc(t(x.name))}"><img src="${x.art}" alt=""></button>`).join('');}
let cancelCosmeticVictory=null;
function playCosmeticVictory(id){
  const item=window.SmazzataCosmetics.byId.get(id);if(item?.kind!=='victory')return false;
  if(S.prefs.anim===false||matchMedia('(prefers-reduced-motion: reduce)').matches)return true;
  cancelCosmeticVictory?.();
  const cv=document.createElement('canvas'),skip=document.createElement('button');cv.className='confetti cx-celebration';cv.setAttribute('aria-hidden','true');skip.className='btn small cx-celebration-skip';skip.textContent=t('Salta animazione');
  document.body.append(cv,skip);const ctx=cv.getContext('2d'),W=innerWidth,H=innerHeight,dpr=Math.min(2,devicePixelRatio||1);cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';ctx.scale(dpr,dpr);
  const tier=window.SmazzataCosmetics.RARITIES.indexOf(item.rarity),duration=2600+tier*350,start=performance.now(),effect=item.index,motif=[0,1,2,3,4,5,6,7,8,9,3,7,7,8,6,8,8,8,7,7][effect],colors=[...item.colors,'#fff3cf'];let raf;
  let phoenix=null;
  if(effect===19){phoenix=document.createElement('img');phoenix.src=window.SmazzataCosmetics.LIST.find(x=>x.kind==='reaction'&&x.rarity==='legendary').art;phoenix.alt='';phoenix.setAttribute('aria-hidden','true');phoenix.className='cx-victory-phoenix';document.body.append(phoenix);}
  const ps=Array.from({length:60+tier*28},(_,i)=>({phase:Math.random()*6.28,rad:Math.random(),speed:.7+Math.random(),size:3+Math.random()*5,color:colors[i%3]}));
  const end=()=>{cancelAnimationFrame(raf);cv.remove();skip.remove();phoenix?.remove();if(cancelCosmeticVictory===end)cancelCosmeticVictory=null;};cancelCosmeticVictory=end;skip.onclick=end;
  function frame(now){
    const time=(now-start)/1000,k=(now-start)/duration;ctx.clearRect(0,0,W,H);ctx.globalAlpha=Math.min(1,time*3)*Math.max(0,(1-k)*4);
    for(const p of ps){
      const a=p.phase+time*p.speed*(effect%2?1:-1),r=(20+p.rad*Math.min(W,H)*.6)*Math.min(1,time);
      let x=W/2+Math.cos(a)*r,y=H*.42+Math.sin(a)*r*.75;
      if([0,7,8,11].includes(effect)){x=p.phase/6.28*W+Math.sin(time+p.phase)*35;y=(p.rad*H+time*85*p.speed)%H;}
      if([1,5,9].includes(effect)){x=p.phase/6.28*W+Math.sin(time+p.phase)*22;y=H-((p.rad*H+time*90*p.speed)%H);}
      if([3,4,10,12].includes(effect)){const fan=(p.phase/6.28-.5)*2.1;x=W/2+Math.sin(fan)*time*120*p.speed;y=H*.8-time*240*p.speed+time*time*40;}
      if(effect===6||effect===14){x=p.rad*W;y=H*.5+Math.sin(p.phase+time*2)*H*.24;}
      if(effect===13){x=W/2+Math.cos(p.phase)*time*W*.3;y=H*.4+Math.sin(p.phase)*time*H*.3;}
      if(effect===15){x=W/2+Math.cos(time*2+p.phase%2*Math.PI)*r;y=H*.42+Math.sin(time*2+p.phase%2*Math.PI)*r;}
      if(effect===17){const spiralAngle=p.phase+time+p.rad*8;x=W/2+Math.cos(spiralAngle)*r;y=H*.42+Math.sin(spiralAngle)*r*.65;}
      if(effect===18||effect===19){x=W/2+Math.cos(p.phase)*r;y=H*.45-Math.abs(Math.sin(p.phase))*r-time*12;}
      ctx.save();ctx.translate(x,y);ctx.rotate(a);ctx.fillStyle=p.color;ctx.strokeStyle=p.color;ctx.lineWidth=1.4;
      const s=p.size*(1+tier*.2);ctx.beginPath();
      if(effect===19){ctx.ellipse(0,0,s*.35,s*1.6,0,0,Math.PI*2);}
      else if(motif===1){ctx.moveTo(0,s);ctx.bezierCurveTo(-s*2,-s,-s,-s*2,0,-s*.4);ctx.bezierCurveTo(s,-s*2,s*2,-s,0,s);}
      else if(motif===2||motif===7){for(let j=0;j<5;j++){ctx.ellipse(0,-s*.6,s*.4,s,0,0,Math.PI*2);ctx.rotate(Math.PI*2/5);}}
      else if(motif===3){ctx.moveTo(0,-s*1.6);ctx.lineTo(s,0);ctx.lineTo(0,s*1.6);ctx.lineTo(-s,0);}
      else if(motif===4){ctx.moveTo(0,-s*1.5);ctx.bezierCurveTo(-s*2,0,-s,s,0,0);ctx.bezierCurveTo(s,s,s*2,0,0,-s*1.5);}
      else if(motif===6){ctx.moveTo(-s,-s*2);ctx.quadraticCurveTo(s*2,0,-s,s*2);ctx.stroke();}
      else if(motif===8){for(let j=0;j<8;j++){const q=j%2?s*.35:s;ctx.lineTo(Math.cos(j*Math.PI/4)*q,Math.sin(j*Math.PI/4)*q);}}
      else if(motif===0)ctx.rect(-s/2,-s,s,s*2);
      else ctx.ellipse(0,0,s*.6,s,0,0,Math.PI*2);
      if(effect===9){ctx.stroke();}else ctx.fill();ctx.restore();
    }
    if(effect===16||effect>=18){ctx.save();ctx.translate(W/2,H*.42);ctx.strokeStyle=item.colors[1];ctx.lineWidth=tier===3?3:1.5;for(let wing=-1;wing<=1;wing+=2){for(let f=0;f<7+tier;f++){const spread=Math.sin(Math.min(time,1.2)*1.1)*Math.min(W*.38,160);ctx.beginPath();ctx.moveTo(0,20);ctx.bezierCurveTo(wing*spread*.5,-f*5,wing*spread,-40-f*6,wing*spread*(1-f*.065),-75+f*16);ctx.stroke();}}ctx.restore();}
    if(k<1)raf=requestAnimationFrame(frame);else end();
  }raf=requestAnimationFrame(frame);return true;
}
function equippedVictory(){const state=cosmeticState(),id=state.loadout.victory;return state.ownedIds.includes(id)&&playCosmeticVictory(id);}
Object.assign(handlers,{
  cosmetics:()=>cosmeticsModal(),cosmeticTab:el=>cosmeticsModal(el.dataset.kind),cosmeticPreview:el=>cosmeticPreview(el.dataset.id),
  cosmeticPlay:el=>playCosmeticVictory(el.dataset.id),
  async cosmeticEquip(el){const item=window.SmazzataCosmetics.byId.get(el.dataset.id);if(item&&await equipCosmetic(item.kind,item.id))await cosmeticsModal(item.kind);},
  async cosmeticReset(el){if(await equipCosmetic(el.dataset.kind,null))await cosmeticsModal(el.dataset.kind);}
});
socket.on('welcome',()=>{applyCosmetics();const owner=S.token;if(!OFFLINE)emit('cosmetics').then(r=>{if(owner===S.token&&r.ok)cacheCosmetics(r.cosmetics);});});
applyCosmetics();
