'use strict';
// Piccole composizioni originali: nessun servizio esterno, download o campione protetto.
// Un solo contesto e una sola sequenza; gli effetti delle carte restano indipendenti.
const Music = (() => {
  // Accordi estesi e rivolti vicini: fraseggi di otto battute, con pause reali.
  const major=[[0,4,7,11],[9,12,16,19],[2,5,9,12],[7,11,14,17],[4,7,11,14],[9,12,16,19],[5,9,12,16],[7,11,14,17]];
  const minor=[[0,3,7,10],[5,8,12,15],[10,14,17,21],[3,7,10,14],[8,12,15,19],[5,8,12,15],[2,5,8,12],[7,11,14,17]];
  const themes={
    home:{bpm:72,root:48,chords:major,lead:[2,null,3,1,null,2,null,0],air:.7},
    lobby:{bpm:68,root:50,chords:major,lead:[null,2,null,1,null,null,2,0],air:.55},
    collection:{bpm:66,root:53,chords:major,lead:[3,null,2,null,1,null,2,0],air:.85},
    loot:{bpm:64,root:45,chords:minor,lead:[null,2,null,3,null,1,2,null],air:.8},
    chest:{bpm:78,root:48,chords:major,lead:[0,1,2,null,3,null,2,null],air:.9},
    campaign:{bpm:74,root:50,chords:minor,lead:[2,null,1,0,null,3,null,2],air:.7},
    burraco:{bpm:62,root:48,chords:major,lead:[null,null,2,null,null,1,null,null],air:.4},
    scala40:{bpm:66,root:50,chords:minor,lead:[null,1,null,null,2,null,null,null],air:.35},
    ramino:{bpm:60,root:52,chords:major,lead:[null,null,1,null,null,null,2,null],air:.45},
    canasta:{bpm:70,root:48,chords:major,lead:[null,2,null,null,1,null,null,0],air:.4},
    victory:{bpm:76,root:53,chords:major,lead:[0,null,2,3,null,2,null,1],air:.8},
    defeat:{bpm:58,root:45,chords:minor,lead:[null,2,null,1,null,null,0,null],air:.5}
  };
  let ctx,bus,tone,echo,feedback,timer=null,key=null,step=0,next=0,unlocked=false;
  function volume(){const n=Number(S.prefs.musicVolume??50);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):50;}
  function setVolume(value){
    const n=Number(value);S.prefs.musicVolume=Number.isFinite(n)?Math.max(0,Math.min(100,n)):50;
    if(bus&&ctx)bus.gain.setTargetAtTime(.56*volume()/100,ctx.currentTime,.08);
  }
  function theme(){
    if(S.modalKind==='chestReward')return 'chest';
    if(['chests','inbox','firstChest','journey'].includes(S.modalKind))return 'loot';
    if(S.modalKind?.startsWith('collection')||S.modalKind==='cosmetics')return 'collection';
    if(S.modalKind==='result'&&S.game?.over&&S.game.you>=0)return S.game.winners?.includes(S.game.you)?'victory':'defeat';
    if(S.screen==='campaign'||S.room?.campaign)return 'campaign';
    if(S.screen==='game')return themes[S.room?.rules?.game]?S.room.rules.game:'burraco';
    return ['lobby','rankedLobby','setup','leaders'].includes(S.screen)?'lobby':'home';
  }
  // Timbro di piano elettrico soffice: fondamentale e armoniche che decadono prima.
  function note(midi,at,duration,level,kind='keys'){
    const partials=kind==='bass'?[[1,1]]:kind==='pad'?[[1,1],[2,.12]]:[[1,1],[2,.22],[3,.045]];
    for(const [harmonic,weight] of partials){
      const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';
      o.frequency.value=440*2**((midi-69)/12)*harmonic;
      const attack=kind==='pad'?.3:kind==='bass'?.035:.012;
      const length=Math.max(attack+.1,duration/(harmonic===1?1:1.8));
      g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(level*weight,at+attack);
      g.gain.exponentialRampToValueAtTime(.0001,at+length);
      g.gain.linearRampToValueAtTime(0,at+length+.08);
      o.connect(g).connect(tone);o.start(at);o.stop(at+length+.1);
      o.onended=()=>{o.disconnect();g.disconnect();};
    }
  }
  function stop(){
    clearInterval(timer);timer=null;key=null;
    if(bus&&ctx){const nodes=[bus,tone,echo,feedback];bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setTargetAtTime(0,ctx.currentTime,.09);setTimeout(()=>nodes.forEach(n=>n?.disconnect()),1200);bus=tone=echo=feedback=null;}
  }
  function tick(){
    if(!ctx||ctx.state!=='running'||!key)return;
    const theme=themes[key],beat=60/theme.bpm;
    if(next<ctx.currentTime-.2)next=ctx.currentTime+.04;
    while(next<ctx.currentTime+.2){
      const pulse=step%8,bar=Math.floor(step/8)%8,phrase=Math.floor(step/64)%4;
      const chord=theme.chords[bar];
      if(pulse===0){
        note(theme.root+chord[0]-12,next,beat*3.5,.085,'bass');
        // Voicing resserrato nel registro medio, attacchi leggermente sfalsati.
        chord.slice(1).forEach((v,i)=>note(theme.root+v,next+i*.018,beat*3.7,.024,'keys'));
        if(bar%2===0)note(theme.root+chord[2],next,beat*7,.012*theme.air,'pad');
      }
      if(pulse===5&&bar%2===0)note(theme.root+chord[2]-12,next,beat*1.3,.045,'bass');
      const pick=theme.lead[(bar+phrase*2)%8];
      if(pick!==null&&pulse===(bar%2?5:3))note(theme.root+12+chord[pick],next,beat*2,.035*theme.air);
      if(pulse===7&&bar%4===2&&phrase%2===1)note(theme.root+12+chord[1],next,beat*1.2,.018*theme.air);
      next+=beat/2;step++;
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
    bus=ctx.createGain();bus.gain.setValueAtTime(0,ctx.currentTime);bus.gain.linearRampToValueAtTime(.56*volume()/100,ctx.currentTime+.6);bus.connect(ctx.destination);
    tone=ctx.createBiquadFilter();tone.type='lowpass';tone.frequency.value=2800;tone.Q.value=.3;tone.connect(bus);
    echo=ctx.createDelay(2);echo.delayTime.value=60/themes[key].bpm*.75;
    feedback=ctx.createGain();feedback.gain.value=.16;
    tone.connect(echo);echo.connect(feedback);feedback.connect(echo);feedback.connect(bus);
    tick();timer=setInterval(tick,100);
  }
  document.addEventListener('pointerdown',()=>sync(true),{passive:true});
  document.addEventListener('keydown',()=>sync(true));
  document.addEventListener('visibilitychange',()=>sync());
  window.addEventListener('pagehide',()=>{stop();ctx?.suspend().catch(()=>{});});
  window.addEventListener('pageshow',()=>sync());
  return {sync,theme,volume,setVolume,get active(){return key;},get state(){return ctx?.state||'idle';},themes};
})();
