'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'../public/js',f),'utf8');
function transport(){
  const calls=[],timers=new Map();let id=0;
  const socket={connected:true,emit:(ev,data,cb)=>calls.push({ev,data,cb}),disconnect(){this.connected=false;},connect(){this.connected=true;}};
  const c={S:{connected:true,room:{code:'TEST'}},OFFLINE:false,Local:{},LOCAL_EVENTS:new Set(),pendingRequests:new Set(),socket,
    toast:()=>{},t:x=>x,Sound:{play:()=>{}},render:()=>{},setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)};
  vm.createContext(c);const source=read('connessione.js');
  vm.runInContext(source.slice(source.indexOf('  function emit(ev, data)'),source.indexOf('  /** Lettura ad alta voce')),c);
  return {c,calls,timers};
}
test('Le mosse scollegate o in attesa dello stato non vengono accodate',async()=>{
  const {c,calls}=transport();c.S.connected=false;
  assert.equal((await c.emit('action',{type:'draw'})).ok,false);assert.equal(calls.length,0);
  c.S.connected=true;c.S.syncPending=true;
  assert.equal((await c.emit('action',{type:'draw'})).ok,false);assert.equal(calls.length,0);
});
test('Una risposta persa non ripete la mossa e ignora conferme tardive',async()=>{
  const {c,calls,timers}=transport();const result=c.emit('action',{type:'draw'});
  [...timers.values()][0]();assert.equal((await result).timeout,true);
  assert.equal(c.S.syncPending,true);assert.equal(calls.length,1);assert.equal(c.pendingRequests.size,0);
  await calls[0].cb({ok:true});assert.equal(calls.length,1);
});
test('La disconnessione risolve le richieste pendenti senza ripeterle',async()=>{
  const {c,calls,timers}=transport();const result=c.emit('ready');
  for(const cancel of [...c.pendingRequests])cancel();
  assert.equal((await result).disconnected,true);assert.equal(timers.size,0);assert.equal(calls.length,1);
});
test('Il secondo tocco non invia una seconda mossa prima della conferma',async()=>{
  let resolve;let sent=0;
  const c={S:{connected:true,selected:new Set()},OFFLINE:false,anticipate:()=>{},emit:()=>{sent++;return new Promise(r=>resolve=r);}};
  vm.createContext(c);const source=read('azioni.js');
  vm.runInContext(source.slice(source.indexOf('  async function act('),source.indexOf('  // dietro il tunnel')),c);
  const first=c.act('draw');assert.equal((await c.act('draw')).busy,true);assert.equal(sent,1);
  resolve({ok:true});await first;assert.equal(c.S.actionPending,false);
});
