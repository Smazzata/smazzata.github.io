'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('Indietro Android: tastiera, dettagli, pannelli, partita e Home senza navigare fuori',()=>{
 const calls=[],S={screen:'home',modalKind:null},handlers={};let field=false;
 for(const name of ['settingsBack','more','collectionPreviewBack','collectionBack','chests','avatarCatalog','goHome','leave','leagueBack'])handlers[name]=()=>calls.push(name);
 const context=vm.createContext({S,handlers,window:{},document:{querySelector:()=>null,activeElement:{matches:()=>field,blur(){field=false;calls.push('blur');}}},closeModal(){calls.push('close');S.modalKind=null;},renderCollection(){calls.push('collection');}});
 const source=fs.readFileSync(require.resolve('../public/js/comandi.js'),'utf8');
 vm.runInContext(source.slice(source.indexOf('  function mobileBack()'),source.indexOf('  // Un solo gradino')),context);
 const back=context.window.smazzataBack;
 assert.equal(back(),false);assert.equal(calls.length,0);
 field=true;S.modalKind='settings';assert(back());assert.equal(calls.pop(),'blur');assert.equal(S.modalKind,'settings');
 assert(back());assert.equal(calls.pop(),'close');
 S.modalKind='settings';S.settingsSection='audio';assert(back());assert.equal(calls.pop(),'settingsBack');S.settingsSection='';
 for(const modal of ['activities','helpMenu']){S.modalKind=modal;assert(back());assert.equal(calls.pop(),'more');}
 for(const [modal,expected] of [['collectionTable','collectionPreviewBack'],['collectionLook','collection'],['cosmetics','collectionBack'],['firstChest','chests'],['chestReward','chests']]){
  S.modalKind=modal;S.collectionInspect=true;assert(back());assert.equal(calls.pop(),expected);
 }
 S.chestBusy=true;assert(back());assert.equal(calls.length,0);S.chestBusy=false;S.modalKind=null;
 for(const [screen,expected] of [['rankedLobby','goHome'],['game','leave'],['lobby','leave'],['setup','leagueBack']]){
  S.screen=screen;assert(back());assert.equal(calls.pop(),expected);
 }
 S.screen='home';assert.equal(back(),false);assert.equal(calls.length,0);
});
