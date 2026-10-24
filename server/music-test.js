'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const listeners={},timers=new Map(),oscillators=[],buses=[];let issued=0;
 const param=()=>({value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(){}});
 class AudioContext{
  constructor(){this.currentTime=0;this.state='running';this.destination={};}
  createGain(){const n={gain:param(),connect(){return this;},disconnect(){this.disconnected=true;}};buses.push(n);return n;}
  createOscillator(){const o={frequency:{value:0},connect(){return this;},start(at){this.startAt=at;},stop(at){this.stopAt=at;},disconnect(){}};oscillators.push(o);return o;}
  resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}
 }
 const S={prefs:{music:false,sound:false},screen:'home',room:null},document={hidden:false,addEventListener(k,f){listeners[k]=f;}};
 const ctx=vm.createContext({S,document,window:{AudioContext,addEventListener(k,f){listeners[k]=f;}},setInterval(f){const id=++issued;timers.set(id,f);return id;},clearInterval(id){timers.delete(id);},setTimeout(f){f();}});
 vm.runInContext(fs.readFileSync(require.resolve('../public/js/music.js'),'utf8')+'\nglobalThis.music=Music;',ctx);
 return {S,document,listeners,timers,oscillators,buses,music:ctx.music};
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
 S.chestMatch.justEarned=false;S.chestMatch.weeklyEarned=0;S.chestMatch.earnedToday=2;assert.match(ctx.resultLootHTML(),/Limite giornaliero raggiunto/);
});
