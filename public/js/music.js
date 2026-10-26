'use strict';
// Partiture originali interne: niente campioni, servizi o registrazioni di terzi.
// Un unico arrangiamento, con piano soffice e corde pizzicate sintetizzati.
const Music = (() => {
  const line = text => text.split('/').map(bar => bar.trim().split(/\s+/).map(n => n === '-' ? null : Number(n)));
  const harmonies = {
    terrace:[[0,4,7,14],[9,12,16,19],[2,5,9,16],[7,11,14,17],[4,7,11,18],[9,12,16,19],[5,9,12,16],[7,11,14,17]],
    evening:[[0,4,9,16],[5,9,12,19],[2,5,9,12],[7,11,14,21],[4,7,11,16],[9,12,16,19],[2,5,9,16],[7,11,14,17]],
    lantern:[[0,3,7,14],[8,12,15,19],[5,8,12,19],[7,11,14,17],[0,3,7,10],[3,7,10,17],[8,12,15,19],[7,11,14,17]],
    garden:[[0,7,11,16],[4,7,11,14],[5,9,12,19],[2,5,9,16],[9,12,16,19],[5,9,12,16],[7,11,14,19],[0,7,11,16]]
  };
  const themes = {
    home:{title:'Un posto al tavolo',bpm:84,root:48,harmony:'terrace',style:'bossa',instrument:'nylon',melody:line('16 - 19 21 - 19 14 - / 16 - - 12 9 - 12 - / 14 17 - 21 19 - 17 - / 14 - 11 - - 9 7 - / 11 - 14 16 - 19 18 - / 16 12 - 9 - 12 16 - / 17 - 16 - 12 9 - 12 / 14 - 11 7 - - - - / 19 - 16 14 - 12 14 - / 16 - 19 - 21 19 16 - / 17 14 - 9 12 - 16 - / 17 - 14 11 - - 7 - / 18 - 19 14 11 - 14 - / 16 - 12 9 - 7 9 - / 12 16 - 17 16 - 12 - / 11 - 14 7 - - - -')},
    lobby:{title:'Due chiacchiere',bpm:76,root:50,harmony:'evening',style:'lounge',instrument:'felt',melody:line('12 - - 16 - 19 - - / 17 - 16 - 12 - - - / 14 - 9 - - 12 - - / 11 - - 14 16 - - - / 14 - 11 - 7 - - - / 12 - 16 - - 19 - - / 17 - - 14 - 9 - - / 11 - 7 - - - - - / 16 - 19 - 21 - 19 - / 17 - - 12 9 - - - / 9 - 12 - 14 - - - / 16 - - 14 11 - - - / 11 - 14 - 16 - - - / 19 - - 16 12 - - - / 14 - 17 - 16 - 12 - / 11 - - 7 - - - -')},
    collection:{title:'Piccole meraviglie',bpm:80,root:53,harmony:'garden',style:'chamber',instrument:'celesta',melody:line('19 - 23 - - 16 - - / 14 - - 11 16 - - - / 21 - 19 - 17 - - - / 14 - - 9 12 - - - / 16 - 19 - - 12 - - / 17 - - 16 12 - - - / 14 - 19 - 23 - - - / 19 - - 16 - - - - / 23 - 19 - 16 - - - / 18 - - 14 11 - - - / 17 - 21 - 24 - 21 - / 21 - 17 - 14 - - - / 19 - 16 - 12 - - - / 16 - - 17 12 - - - / 23 - 19 - 14 - - - / 16 - - 12 - - - -')},
    loot:{title:'La bottega delle sorprese',bpm:74,root:48,harmony:'lantern',style:'chamber',instrument:'nylon',melody:line('7 - 14 - 15 - - - / 19 - - 15 12 - - - / 17 - 12 - 8 - - - / 11 - - 14 17 - - - / 15 - 14 - 10 - - - / 17 - - 19 15 - - - / 12 - 15 - 19 - - - / 14 - 11 - 7 - - - / 14 - 15 - 19 - - - / 20 - 19 - 15 - - - / 12 - - 17 19 - - - / 17 - - 14 11 - - - / 19 - 15 - 14 - - - / 10 - - 15 17 - - - / 19 - 15 - 12 - - - / 11 - - 7 - - - -')},
    chest:{title:'Una luce nel baule',bpm:88,root:53,harmony:'garden',style:'chamber',instrument:'celesta',melody:line('12 - 16 19 - 23 - - / 18 - - 14 11 - - - / 17 - 21 24 - 21 - - / 16 - 14 - 9 - - - / 12 - 16 - 19 - - - / 17 - 16 - 12 - - - / 14 - 19 - 23 - 26 - / 24 - 23 - 19 - - - / 23 - 19 16 - 12 - - / 14 - 18 - 23 - - - / 24 - 21 - 17 - 16 - / 14 - - 16 17 - - - / 19 - 16 12 - 9 - - / 12 - 16 - 17 - - - / 19 - 23 - 26 - 23 - / 24 - 19 - 16 - - -')},
    campaign:{title:'Sentieri di carta',bpm:78,root:50,harmony:'lantern',style:'chamber',instrument:'felt',melody:line('12 - 15 - 19 - 14 - / 15 - - 12 8 - - - / 17 - 19 - 20 - - - / 17 - 14 - 11 - - - / 15 - 19 - 22 - - - / 19 - - 17 15 - - - / 12 - 15 - 19 - - - / 14 - 11 - 7 - - - / 19 - 22 - 19 - 15 - / 20 - 19 - 15 - - - / 17 - 12 - 8 - - - / 11 - 14 - 17 - - - / 19 - 15 - 12 - - - / 17 - 19 - 22 - - - / 20 - 19 - 15 - 12 - / 14 - - 11 - - - -')},
    burraco:{title:'Luci di sera',bpm:72,root:48,harmony:'evening',style:'table',instrument:'nylon',melody:line('16 - - - 12 - 9 - / 12 - - 17 - - - - / 14 - - - 9 - - - / 11 - 14 - - - - - / 16 - - - 11 - 7 - / 12 - - 16 - - - - / 17 - - - 14 - 9 - / 11 - - - - - - - / 19 - - 16 - - 12 - / 17 - - - 16 - - - / 14 - 12 - 9 - - - / 14 - - 11 - - - - / 11 - - - 14 - 16 - / 19 - - - 16 - - - / 17 - 14 - 12 - - - / 11 - - 7 - - - -')},
    scala40:{title:'Quaranta passi',bpm:76,root:50,harmony:'lantern',style:'table',instrument:'felt',melody:line('15 - - 19 - - 14 - / 12 - - - 15 - - - / 17 - - 12 - - - - / 14 - - - 11 - - - / 10 - - 15 - - 19 - / 17 - - - 15 - - - / 19 - - 15 - - 12 - / 11 - - - - - - - / 19 - - 15 - - 12 - / 20 - - - 19 - - - / 17 - - 20 - - 19 - / 17 - - - 14 - - - / 15 - - 10 - - 7 - / 10 - - - 15 - - - / 19 - - 15 - - 12 - / 14 - - 11 - - - -')},
    ramino:{title:'Il filo gentile',bpm:68,root:52,harmony:'garden',style:'table',instrument:'nylon',melody:line('11 - - - 16 - - - / 14 - - 11 - - 7 - / 12 - - - 17 - - - / 16 - - 14 - - - - / 12 - - - 9 - - - / 16 - - 12 - - 9 - / 14 - - - 19 - - - / 16 - - - - - - - / 19 - - - 16 - - - / 18 - - 14 - - 11 - / 17 - - - 21 - - - / 16 - - 14 - - 9 - / 12 - - - 16 - - - / 17 - - 16 - - 12 - / 19 - - - 14 - - - / 11 - - 12 - - - -')},
    canasta:{title:'Sotto il portico',bpm:82,root:48,harmony:'terrace',style:'bossa',instrument:'felt',melody:line('12 - - 16 19 - - - / 21 - 19 - 16 - - - / 17 - - 14 9 - - - / 11 - 14 - 17 - - - / 18 - - 16 14 - - - / 12 - 16 - 19 - - - / 17 - 16 - 12 - - - / 14 - - 11 - - - - / 16 - 19 - 21 - - - / 19 - - 16 12 - - - / 14 - 17 - 21 - 19 - / 17 - 14 - 11 - - - / 14 - - 18 19 - - - / 16 - 12 - 9 - - - / 12 - 17 - 16 - 12 - / 11 - - 7 - - - -')},
    victory:{title:'Brindisi al vincitore',bpm:92,root:53,harmony:'terrace',style:'chamber',instrument:'felt',melody:line('12 - 16 19 - 24 - - / 21 - 19 - 16 - - - / 17 - 21 24 - 26 - - / 23 - 19 - 14 - - - / 18 - 19 23 - 26 - - / 24 - 21 - 19 - - - / 21 - 17 - 16 - 12 - / 14 - 11 7 - - - - / 24 - 19 - 16 - 19 - / 21 - 24 - 28 - - - / 26 - 24 - 21 - - - / 23 - 19 - 17 - - - / 18 - 23 - 26 - - - / 24 - 21 - 16 - - - / 17 - 21 - 24 - 21 - / 19 - 14 - 12 - - -')},
    defeat:{title:'La prossima mano',bpm:66,root:50,harmony:'evening',style:'table',instrument:'felt',melody:line('16 - - - 12 - - - / 9 - - - 12 - - - / 14 - - 12 - - 9 - / 11 - - - - - - - / 14 - - - 11 - - - / 12 - - - 16 - - - / 14 - - 9 - - 12 - / 11 - - - 7 - - - / 19 - - - 16 - - - / 17 - - 12 - - - - / 14 - - - 9 - - - / 11 - - 14 - - - - / 16 - - - 14 - - - / 12 - - 9 - - - - / 9 - - - 12 - 14 - / 11 - - 7 - - - -')}
  };
  let ctx,bus,tone,echo,feedback,timer=null,key=null,step=0,next=0,unlocked=false;
  const waves=new Map(),voices=new Set();
  function volume(){const n=Number(S.prefs.musicVolume??50);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):50;}
  function setVolume(value){const n=Number(value);S.prefs.musicVolume=Number.isFinite(n)?Math.max(0,Math.min(100,n)):50;if(bus&&ctx)bus.gain.setTargetAtTime(.56*volume()/100,ctx.currentTime,.08);}
  function theme(){
    if(S.modalKind==='chestReward')return 'chest';
    if(['chests','inbox','firstChest','journey'].includes(S.modalKind))return 'loot';
    if(S.modalKind?.startsWith('collection')||S.modalKind==='cosmetics')return 'collection';
    if(S.modalKind==='result'&&S.game?.over&&S.game.you>=0)return S.game.winners?.includes(S.game.you)?'victory':'defeat';
    if(S.screen==='campaign'||S.room?.campaign)return 'campaign';
    if(S.screen==='game')return themes[S.room?.rules?.game]?S.room.rules.game:'burraco';
    return ['lobby','rankedLobby','setup','leaders'].includes(S.screen)?'lobby':'home';
  }
  function wave(kind){
    if(!waves.has(kind)){
      const partials={nylon:[1,.46,.15,.075,.034,.018,.008],felt:[1,.42,.21,.10,.048,.024,.012],bass:[1,.18,.035],celesta:[1,.08,.13,.025,.012]}[kind];
      const real=new Float32Array(16),imag=new Float32Array(16);partials.forEach((v,i)=>imag[i+1]=v);
      waves.set(kind,ctx.createPeriodicWave(real,imag));
    }
    return waves.get(kind);
  }
  function note(midi,at,duration,level,kind){
    level*=3; // Livello del sottofondo, con margine misurato anche a volume massimo.
    const o=ctx.createOscillator(),g=ctx.createGain();o.setPeriodicWave(wave(kind));o.frequency.value=440*2**((midi-69)/12);
    const attack=kind==='felt'?.018:kind==='bass'?.03:.008,length=Math.max(.15,duration);
    g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(level,at+attack);
    g.gain.exponentialRampToValueAtTime(Math.max(.00015,level*.38),at+Math.min(length*.35,.24));
    g.gain.exponentialRampToValueAtTime(.0001,at+length);g.gain.linearRampToValueAtTime(0,at+length+.06);
    o.connect(g).connect(tone);o.start(at);o.stop(at+length+.08);voices.add(o);
    o.onended=()=>{voices.delete(o);o.disconnect();g.disconnect();};
  }
  // Giro di 32 battute: sedici scritte, ripresa leggera e coda con pause.
  function score(name,index){
    const t=themes[name],pulse=index%8,bar=Math.floor(index/8)%32,chord=harmonies[t.harmony][bar%8],beat=60/t.bpm;
    const notes=[],add=(pitch,duration,level,kind,delay=0)=>notes.push({midi:t.root+pitch,duration:duration*beat,level,kind,delay:delay*beat});
    const quiet=t.style==='table',soft=bar>=16?.82:1;
    if(pulse===0)add(chord[0]-12,1.8,quiet?.052:.065,'bass');
    if(pulse===4&&t.style==='bossa')add(chord[0]-5,1.1,.04,'bass');
    const strum=t.style==='bossa'?[1,4,7]:t.style==='chamber'?[0,4]:[0,5];
    if(strum.includes(pulse)&&!(quiet&&bar%4===3&&pulse===5))chord.slice(1).forEach((pitch,i)=>add(pitch,quiet?2.5:1.3,(quiet?.014:.020)*soft,quiet?'felt':'nylon',i*.025));
    const pitch=t.melody[bar%16][pulse];
    if(pitch!==null&&!(bar>=24&&bar%4===3&&pulse>2)){
      const row=t.melody[bar%16];let space=1;while(pulse+space<8&&row[pulse+space]===null)space++;
      add(pitch,Math.min(2.8,space*.48+.35),(quiet?.045:.062)*soft,t.instrument,t.style==='bossa'&&pulse%2?.10:0);
    }
    return notes;
  }
  function stop(){
    clearInterval(timer);timer=null;key=null;
    if(bus&&ctx){
      const nodes=[bus,tone,echo,feedback],old=[...voices];voices.clear();
      bus.gain.cancelScheduledValues(ctx.currentTime);bus.gain.setTargetAtTime(0,ctx.currentTime,.06);
      old.forEach(o=>{try{o.stop(ctx.currentTime+.3);}catch(_){}});
      setTimeout(()=>nodes.forEach(n=>n?.disconnect()),400);bus=tone=echo=feedback=null;
    }
  }
  function tick(){
    if(!ctx||ctx.state!=='running'||!key)return;
    if(next<ctx.currentTime-.2)next=ctx.currentTime+.04;
    while(next<ctx.currentTime+.2){for(const n of score(key,step))note(n.midi,next+n.delay,n.duration,n.level,n.kind);next+=30/themes[key].bpm;step++;}
  }
  function sync(gesture=false){
    if(gesture)unlocked=true;
    if(!S.prefs.music||document.hidden){stop();if(ctx?.state==='running')ctx.suspend().catch(()=>{});return;}
    if(!unlocked)return;
    try{if(!ctx)ctx=new (window.AudioContext||window.webkitAudioContext)();}catch(_){return;}
    if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    const desired=theme();if(key===desired&&timer)return;
    stop();key=desired;step=0;next=ctx.currentTime+.08;
    bus=ctx.createGain();bus.gain.setValueAtTime(0,ctx.currentTime);bus.gain.linearRampToValueAtTime(.56*volume()/100,ctx.currentTime+.8);bus.connect(ctx.destination);
    tone=ctx.createBiquadFilter();tone.type='lowpass';tone.frequency.value=themes[key].style==='table'?2400:3600;tone.Q.value=.2;tone.connect(bus);
    // Ambiente corto; niente eco a tempo che raddoppia la melodia.
    echo=ctx.createDelay(1);echo.delayTime.value=.113;feedback=ctx.createGain();feedback.gain.value=.11;
    tone.connect(echo);echo.connect(feedback);feedback.connect(echo);feedback.connect(bus);
    tick();timer=setInterval(tick,100);
  }
  document.addEventListener('pointerdown',()=>sync(true),{passive:true});document.addEventListener('keydown',()=>sync(true));
  document.addEventListener('visibilitychange',()=>sync());window.addEventListener('pagehide',()=>{stop();ctx?.suspend().catch(()=>{});});window.addEventListener('pageshow',()=>sync());
  return {sync,theme,volume,setVolume,score,get active(){return key;},get state(){return ctx?.state||'idle';},themes};
})();
