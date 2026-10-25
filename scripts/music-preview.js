'use strict';
// Anteprime WAV dal vero motore Web Audio, senza registrare microfono o audio del sistema.
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process'),{findBrowser,connect}=require('../server/cdp');
(async()=>{
 const out=path.resolve('test-output/musiche');fs.mkdirSync(out,{recursive:true});
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'smazzata-music-'));
 const browser=spawn(findBrowser(),['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=9349',`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'});let c;
 try{
  let target;for(let i=0;i<60&&!target;i++){try{target=(await(await fetch('http://127.0.0.1:9349/json/list')).json()).find(t=>t.type==='page');}catch{}if(!target)await new Promise(r=>setTimeout(r,100));}
  if(!target)throw Error('Browser non disponibile');c=await connect(target.webSocketDebuggerUrl);
  const source=fs.readFileSync(path.resolve('public/js/music.js'),'utf8');
  for(const name of ['home','burraco']){
   const result=await c.run(`
    const seconds=34,rate=22050,audio=new OfflineAudioContext(1,seconds*rate,rate);let time=0;const callbacks=new Map();let serial=0;
    const proxy=new Proxy(audio,{get(o,k){if(k==='currentTime')return time;if(k==='state')return 'running';const v=o[k];return typeof v==='function'?v.bind(o):v;}});
    const S={prefs:{music:true,musicVolume:65},screen:${JSON.stringify(name==='home'?'home':'game')},room:{rules:{game:'burraco'}}};
    const music=new Function('S','window','document','setInterval','clearInterval','setTimeout',${JSON.stringify(source+';return Music;')})(S,{AudioContext:function(){return proxy;},addEventListener(){}},{hidden:false,addEventListener(){}},f=>{callbacks.set(++serial,f);return serial;},id=>callbacks.delete(id),()=>{});
    music.sync(true);for(time=0;time<seconds-2;time+=.1)for(const f of callbacks.values())f();
    const data=(await audio.startRendering()).getChannelData(0),bytes=new Uint8Array(44+data.length*2),view=new DataView(bytes.buffer);
    const str=(at,s)=>{for(let i=0;i<s.length;i++)bytes[at+i]=s.charCodeAt(i);};str(0,'RIFF');view.setUint32(4,bytes.length-8,true);str(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,data.length*2,true);
    let peak=0,power=0;for(let i=0;i<data.length;i++){let v=data[i];if(!Number.isFinite(v))throw Error('Audio non finito');peak=Math.max(peak,Math.abs(v));power+=v*v;const fade=Math.min(1,i/rate,(data.length-i)/(rate*2));view.setInt16(44+i*2,Math.max(-1,Math.min(1,v*fade))*32767,true);}
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {wav:btoa(binary),peak,rms:Math.sqrt(power/data.length)};`,60000);
   if(result.peak>=.95||result.rms<.001)throw Error('Livello audio non valido: '+name);
   fs.writeFileSync(path.join(out,name+'.wav'),Buffer.from(result.wav,'base64'));console.log(name+': '+JSON.stringify({peak:result.peak,rms:result.rms}));
  }
 }finally{c?.ws.close();browser.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
