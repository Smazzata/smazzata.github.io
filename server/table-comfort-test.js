'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('Segnali tavolo: solo eventi nuovi, pubblici e della stessa partita',()=>{
 const source=fs.readFileSync(require.resolve('../public/js/tavolo.js'),'utf8'),S={},c=vm.createContext({S,Date:{now:()=>1000}});vm.runInContext(source.slice(source.indexOf('  function tableSignalContext('),source.indexOf('  function afterGameRender()')),c);
 const room={code:'ABCD',gameSeq:1},prev={handNo:1,turn:1,you:0,phase:'play',lastEvent:{n:4}},g={...prev,turn:0,phase:'draw',lastEvent:{type:'discard',cardId:22,n:5}};
 c.rememberTableSignals(room,prev,room,g);assert.equal(S.moveSpotlight.cardId,22);assert.equal(S.turnSpotlight.until,2700);assert.equal(S.moveSpotlight.until,3300);
 const marker=S.moveSpotlight;c.rememberTableSignals(room,g,room,g);assert.equal(S.moveSpotlight,marker);
 c.rememberTableSignals(room,g,room,{...g,lastEvent:{n:6,type:'draw',cardId:90}});assert.equal(S.moveSpotlight,marker,'la pesca non deve rivelare carte');
 c.rememberTableSignals(room,g,room,{...g,lastEvent:{n:7,type:'meld',meldIds:[2,3]}});assert.deepEqual([...S.moveSpotlight.meldIds],[2,3]);
 c.rememberTableSignals(room,g,{...room,gameSeq:2},g);assert.equal(S.moveSpotlight,null);assert.equal(S.turnSpotlight,null);
 c.rememberTableSignals(null,null,room,g);assert.equal(S.moveSpotlight,null);assert.equal(S.turnSpotlight,null);
});
test('Categoria completata: nessuna celebrazione retroattiva, ripetuta o fra profili',()=>{
 let now=1000;const S={token:'a',collectionOnline:true},source=fs.readFileSync(require.resolve('../public/js/collection.js'),'utf8'),c=vm.createContext({S,Date:{now:()=>now}});vm.runInContext(source.slice(source.indexOf('function collectionMilestone('),source.indexOf('function renderCollection()')),c);
 assert.equal(c.collectionMilestone('avatar',4,50).complete,false);assert.equal(c.collectionMilestone('avatar',50,50).celebrate,true);now=3000;assert.equal(c.collectionMilestone('avatar',50,50).celebrate,false);
 c.collectionMilestone('avatar',49,50);assert.equal(c.collectionMilestone('avatar',50,50).celebrate,false);
 assert.equal(c.collectionMilestone('back',20,20).celebrate,false);S.token='b';assert.equal(c.collectionMilestone('avatar',50,50).celebrate,false);assert.equal(c.collectionMilestone('empty',0,0).complete,false);
});

test('Pescate: evidenzia solo nuovi ID della propria mano e non prolunga ai refresh',()=>{
 const source=fs.readFileSync(require.resolve('../public/js/tavolo.js'),'utf8'),S={},c=vm.createContext({S,Date:{now:()=>1000}});vm.runInContext(source.slice(source.indexOf('  function tableSignalContext('),source.indexOf('  function afterGameRender()')),c);
 const room={code:'ABCD',gameSeq:1},prev={handNo:1,you:0,turn:0,phase:'draw',hand:[{id:1}],lastEvent:{n:1}};
 const draw={...prev,phase:'play',hand:[{id:1},{id:2},{id:3}],lastEvent:{type:'draw',seat:0,n:2}};
 c.rememberTableSignals(room,prev,room,draw);assert.deepEqual([...S.drawSpotlight.ids],[2,3]);assert.equal(S.drawSpotlight.until,4000);
 const marker=S.drawSpotlight;c.rememberTableSignals(room,draw,room,draw);assert.equal(S.drawSpotlight,marker);
 const pile={...draw,hand:[...draw.hand,{id:4},{id:5}],lastEvent:{type:'pile',seat:0,n:3}};c.rememberTableSignals(room,draw,room,pile);assert.deepEqual([...S.drawSpotlight.ids],[4,5]);
 const own=S.drawSpotlight;c.rememberTableSignals(room,pile,room,{...pile,lastEvent:{type:'draw',seat:1,n:4}});assert.equal(S.drawSpotlight,own,'pesca avversaria non espone carte');
 c.rememberTableSignals(room,pile,room,{...pile,handNo:2});assert.equal(S.drawSpotlight,null);
 c.rememberTableSignals(null,null,room,draw);assert.equal(S.drawSpotlight,null,'accesso iniziale non simula una pescata');
 c.rememberTableSignals(room,prev,room,{...draw,you:1,lastEvent:{type:'draw',seat:1,n:2}});assert.equal(S.drawSpotlight,null,'cambio posto non simula una pescata');
});
