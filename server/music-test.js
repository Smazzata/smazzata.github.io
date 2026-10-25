'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const listeners={},timers=new Map(),oscillators=[],buses=[];let issued=0,audio;
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}});
 class AudioContext{
  constructor(){audio=this;this.currentTime=0;this.state='running';this.destination={};}
  createGain(){const n={gain:param(),connect(){return this;},disconnect(){this.disconnected=true;}};buses.push(n);return n;}
  createBiquadFilter(){return {frequency:param(),Q:param(),connect(){return this;},disconnect(){}};}
  createDelay(){return {delayTime:param(),connect(){return this;},disconnect(){}};}
  createOscillator(){const o={frequency:{value:0},connect(){return this;},start(at){this.startAt=at;},stop(at){this.stopAt=at;},disconnect(){}};oscillators.push(o);return o;}
  resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}
 }
 const S={prefs:{music:false,sound:false},screen:'home',room:null},document={hidden:false,addEventListener(k,f){listeners[k]=f;}};
 const ctx=vm.createContext({S,document,window:{AudioContext,addEventListener(k,f){listeners[k]=f;}},setInterval(f){const id=++issued;timers.set(id,f);return id;},clearInterval(id){timers.delete(id);},setTimeout(f){f();}});
 vm.runInContext(fs.readFileSync(require.resolve('../public/js/music.js'),'utf8')+'\nglobalThis.music=Music;',ctx);
 return {S,document,listeners,timers,oscillators,buses,music:ctx.music,advance(seconds){for(let t=0;t<seconds;t+=.1){audio.currentTime+=.1;for(const f of timers.values())f();}}};
}
test('Musica: consenso separato dai suoni, melodie, cambio senza sequenze sovrapposte e arresto',()=>{
 const x=setup();x.music.sync(true);assert.equal(x.music.active,null);assert.equal(x.oscillators.length,0);
 x.S.prefs.music=true;x.music.sync();assert.equal(x.music.active,'home');assert.equal(x.timers.size,1);
 assert(x.oscillators.length>=3);assert(x.oscillators.every(o=>Number.isFinite(o.frequency.value)&&o.frequency.value>0&&o.stopAt>o.startAt));
 const first=x.buses[0];x.S.screen='game';x.S.room={rules:{game:'canasta'}};x.music.sync();assert.equal(x.music.active,'canasta');assert.equal(x.timers.size,1);assert(first.disconnected);
 x.S.prefs.music=false;x.music.sync();assert.equal(x.music.active,null);assert.equal(x.timers.size,0);
});
test('Musica: sospensione in background, rientro, Spotify e dodici contesti distinti',()=>{
 const x=setup();x.S.prefs.music=true;x.music.sync();assert.equal(x.music.active,null);
 x.listeners.pointerdown();assert.equal(x.music.active,'home');
 x.document.hidden=true;x.listeners.visibilitychange();assert.equal(x.timers.size,0);
 x.document.hidden=false;x.listeners.visibilitychange();assert.equal(x.music.active,'home');
 x.S.room={music:{url:'condivisa'}};x.music.sync();assert.equal(x.music.active,null);
 x.S.room=null;x.S.modalKind='collection';x.music.sync();assert.equal(x.music.active,'collection');
 x.S.modalKind='chestReward';x.music.sync();assert.equal(x.music.active,'chest');
 x.S.modalKind='result';x.S.game={over:true,you:0,winners:[0]};assert.equal(x.music.theme(),'victory');x.S.game.winners=[1];assert.equal(x.music.theme(),'defeat');
 assert.equal(Object.keys(x.music.themes).length,12);assert.equal(new Set(Object.values(x.music.themes).map(JSON.stringify)).size,12);
 x.listeners.pagehide();assert.equal(x.timers.size,0);
});
test('Volume musica: valori validi, limite, silenzioso e nessun riavvio del tema',()=>{
 const x=setup();assert.equal(x.music.volume(),50);
 x.music.setVolume(25);assert.equal(x.music.volume(),25);assert.equal(x.music.active,null);assert.equal(x.oscillators.length,0);
 x.S.prefs.music=true;x.music.sync(true);const bus=x.buses[0],notes=x.oscillators.length;
 let target;bus.gain.setTargetAtTime=v=>{target=v;};
 x.music.setVolume(100);assert.equal(target,.56);assert.equal(x.music.active,'home');assert.equal(x.oscillators.length,notes);assert.equal(x.timers.size,1);
 x.music.setVolume(0);assert.equal(target,0);assert.equal(x.S.prefs.music,true);assert.equal(x.S.prefs.sound,false);
 x.music.setVolume(1000);assert.equal(x.music.volume(),100);x.music.setVolume(-20);assert.equal(x.music.volume(),0);
 x.music.setVolume(NaN);assert.equal(x.music.volume(),50);x.music.setVolume('75');assert.equal(x.music.volume(),75);
});
test('Riepilogo bottino: soltanto premi confermati della propria partita online',()=>{
 const source=fs.readFileSync(require.resolve('../public/js/chests.js'),'utf8').split('function resultLootHTML()')[1];
 const S={token:'io',room:{code:'ABCD',gameSeq:2},game:{over:true,you:0},chestMatch:{owner:'io',roomCode:'ABCD',gameSeq:2,justEarned:true,weeklyEarned:1,progress:0,earnedToday:1,weekly:{missions:[{name:'Amici',progress:2,goal:3,awarded:false}]}}};
 const ctx=vm.createContext({S,t:x=>x});vm.runInContext('function resultLootHTML()'+source,ctx);
 assert.match(ctx.resultLootHTML(),/Chest ottenute: <b>2/);assert.match(ctx.resultLootHTML(),/Amici · 2\/3/);
 S.room.gameSeq=3;assert.equal(ctx.resultLootHTML(),'');S.room.gameSeq=2;
 S.token='altro';assert.equal(ctx.resultLootHTML(),'');S.token='io';
 S.game.you=-1;assert.equal(ctx.resultLootHTML(),'');S.game.you=0;
 S.room.onDevice=true;assert.equal(ctx.resultLootHTML(),'');S.room.onDevice=false;
 S.game.over=false;assert.equal(ctx.resultLootHTML(),'');S.game.over=true;
 S.chestMatch.justEarned=false;S.chestMatch.weeklyEarned=0;S.chestMatch.earnedToday=1;assert.match(ctx.resultLootHTML(),/Premio giornaliero ottenuto/);assert.doesNotMatch(ctx.resultLootHTML(),/Riprendi domani/);S.chestMatch.journey={month:{awarded:2,matches:7}};assert.match(ctx.resultLootHTML(),/Prossima tappa: 2 partite/);assert.match(ctx.resultLootHTML(),/value="2"/);S.chestMatch.journey.month.matches=8;assert.match(ctx.resultLootHTML(),/Prossima tappa: 1 partita/);
});

test('Arrangiamento: frase lunga, pause, timbro morbido e scheduler limitato',()=>{
 const x=setup();x.S.prefs.music=true;x.music.sync(true);x.advance(70);
 assert(x.oscillators.length>100);assert(x.oscillators.length<1800);
 assert(x.oscillators.every(o=>o.type==='sine'&&o.stopAt>o.startAt&&Number.isFinite(o.frequency.value)));
 for(const theme of Object.values(x.music.themes)){
  assert.equal(theme.chords.length,8);assert.equal(theme.lead.length,8);
  assert(theme.lead.includes(null));assert(theme.bpm>=58&&theme.bpm<=78);
 }
 const before=x.oscillators.length;x.S.prefs.music=false;x.music.sync();x.advance(10);
 assert.equal(x.oscillators.length,before);assert.equal(x.timers.size,0);
});

test('Menu e partita hanno metrica, armonia e attacchi distinti',()=>{const a=setup(),b=setup();for(const x of [a,b])x.S.prefs.music=true;b.S.screen='game';b.S.room={rules:{game:'burraco'}};a.music.sync(true);b.music.sync(true);a.advance(30);b.advance(30);assert.notDeepEqual(a.music.themes.home.chords,a.music.themes.burraco.chords);assert(a.oscillators.length>b.oscillators.length*2);assert.equal(a.music.themes.home.style,'salon');assert.equal(b.music.themes.burraco.style,'ambient');});

test('Apertura chest: quattro segnali distinti e rispetto dei suoni disattivati',()=>{const source=fs.readFileSync(require.resolve('../public/js/base.js'),'utf8');const start=source.indexOf('    chest(rarity){'),end=source.indexOf('    play(kind)',start);assert(start>=0&&end>start);const S={prefs:{sound:false}},calls=[];const box=vm.createContext({S});const sound=vm.runInContext('({'+source.slice(start,end)+'})',box);sound.ctx={};sound.note=(...args)=>calls.push(args);sound.chest('legendary');assert.equal(calls.length,0);S.prefs.sound=true;const signatures=[];for(const [rarity,count] of [['common',2],['rare',3],['epic',4],['legendary',5]]){calls.length=0;sound.chest(rarity);assert.equal(calls.length,count);assert(calls.every(([f,delay,vol])=>f>0&&delay>=0&&vol<=.05));signatures.push(JSON.stringify(calls));}assert.equal(new Set(signatures).size,4);sound.ctx=null;calls.length=0;sound.chest('legendary');assert.equal(calls.length,0);});
