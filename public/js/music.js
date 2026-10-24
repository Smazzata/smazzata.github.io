'use strict';
// Piccole composizioni originali: nessun servizio esterno, download o campione protetto.
// Un solo contesto e una sola sequenza; gli effetti delle carte restano indipendenti.
const Music = (() => {
  const themes={
    home:[84,48,[0,7,12,16,14,12,7,4,5,12,17,16,12,9,7,4]],
    lobby:[76,50,[0,4,7,11,7,4,2,7,5,9,12,9,7,4,2,4]],
    collection:[72,53,[0,7,12,14,16,14,12,7,9,12,17,16,14,12,9,7]],
    loot:[68,45,[0,7,12,15,14,7,3,7,5,12,17,15,14,12,7,3]],
    chest:[112,48,[0,7,12,19,16,12,7,12,5,12,17,24,21,17,12,17]],
    campaign:[86,50,[0,7,10,14,12,10,7,3,5,12,15,17,15,12,10,7]],
    burraco:[66,48,[0,4,7,12,11,7,4,7,5,9,12,16,14,12,9,5]],
    scala40:[78,50,[0,3,7,10,12,10,7,3,5,8,12,15,14,12,8,5]],
    ramino:[70,52,[0,7,11,14,12,7,4,2,5,9,12,14,12,9,7,4]],
    canasta:[82,48,[0,7,12,16,19,16,12,7,5,9,12,17,16,12,9,7]],
    victory:[104,48,[0,4,7,12,16,19,16,12,5,9,12,17,19,17,16,12]],
    defeat:[60,45,[12,10,7,3,5,7,10,7,8,7,5,3,2,3,7,12]]
  };
  let ctx,bus,timer=null,key=null,step=0,next=0,unlocked=false;
  function theme(){
    if(S.modalKind==='chestReward')return 'chest';
    if(['chests','inbox','firstChest'].includes(S.modalKind))return 'loot';
    if(S.modalKind?.startsWith('collection')||S.modalKind==='cosmetics')return 'collection';
    if(S.modalKind==='result'&&S.game?.over&&S.game.you>=0)return S.game.winners?.includes(S.game.you)?'victory':'defeat';
    if(S.screen==='campaign'||S.room?.campaign)return 'campaign';
    if(S.screen==='game')return themes[S.room?.rules?.game]?S.room.rules.game:'burraco';
    return ['lobby','rankedLobby','setup','leaders'].includes(S.screen)?'lobby':'home';
  }
  function note(midi,at,duration,volume,type='sine'){
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;
    o.frequency.value=440*2**((midi-69)/12);g.gain.setValueAtTime(0,at);
    g.gain.linearRampToValueAtTime(volume,at+.025);g.gain.exponentialRampToValueAtTime(.0001,at+duration);
    o.connect(g).connect(bus);o.start(at);o.stop(at+duration+.02);
    o.onended=()=>{o.disconnect();g.disconnect();};
  }
  function stop(){
    clearInterval(timer);timer=null;key=null;
    if(bus&&ctx){const old=bus;old.gain.cancelScheduledValues(ctx.currentTime);old.gain.setTargetAtTime(0,ctx.currentTime,.06);setTimeout(()=>old.disconnect(),400);bus=null;}
  }
  function tick(){
    if(!ctx||ctx.state!=='running')return;
    const [bpm,root,melody]=themes[key],beat=60/bpm/2;
    if(next<ctx.currentTime-.2)next=ctx.currentTime+.04;
    while(next<ctx.currentTime+.2){
      const i=step%melody.length,bar=Math.floor(step/8)%4,chord=[0,5,9,7][bar];
      note(root+12+melody[i],next,beat*1.8,.11,'triangle');
      if(step%4===0){note(root-12+chord,next,beat*4,.16);note(root+chord+7,next,beat*3,.045);}
      next+=beat;step++;
    }
  }
  function sync(gesture=false){
    if(gesture)unlocked=true;
    if(!S.prefs.music||document.hidden||S.room?.music){stop();if(ctx?.state==='running')ctx.suspend().catch(()=>{});return;}
    if(!unlocked)return;
    try{if(!ctx)ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(_){return;}
    if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    const desired=theme();if(key===desired&&timer)return;
    stop();key=desired;step=0;next=ctx.currentTime+.08;
    bus=ctx.createGain();bus.gain.setValueAtTime(0,ctx.currentTime);bus.gain.linearRampToValueAtTime(.28,ctx.currentTime+.6);bus.connect(ctx.destination);
    tick();timer=setInterval(tick,100);
  }
  document.addEventListener('pointerdown',()=>sync(true),{passive:true});
  document.addEventListener('keydown',()=>sync(true));
  document.addEventListener('visibilitychange',()=>sync());
  window.addEventListener('pagehide',()=>{stop();ctx?.suspend().catch(()=>{});});
  window.addEventListener('pageshow',()=>sync());
  return {sync,theme,get active(){return key;},get state(){return ctx?.state||'idle';},themes};
})();
