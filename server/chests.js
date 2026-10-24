'use strict';
// Inventario privato del profilo: nessuna estrazione o assegnazione dal client.
const crypto=require('node:crypto');
const A=require('../shared/avatars');
const {GameError}=require('./engine');
const RULES={version:2,matches:3,dailyLimit:2,epicPity:20,legendaryPity:50,
  chestRates:{common:75,rare:20,epic:4,legendary:1},
  types:{
    common:{name:'Chest comune',rates:{common:66.5,rare:25,epic:8,legendary:0.5}},
    rare:{name:'Chest rara',rates:{common:20,rare:61.5,epic:17,legendary:1.5}},
    epic:{name:'Chest epica',rates:{common:0,rare:20,epic:77,legendary:3}},
    legendary:{name:'Chest leggendaria',rates:{common:0,rare:0,epic:0,legendary:100}},
  },
  fragments:{common:5,rare:15,epic:50,legendary:150},costs:{common:50,rare:150,epic:500,legendary:1500}};
const dayOf=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const empty=()=>({version:2,progress:0,day:'',earnedToday:0,fragments:0,epicMisses:0,legendaryMisses:0,issued:0,items:[],exchanges:{}});
const inventory=s=>{
  const b=s.chests ? structuredClone(s.chests) : empty();
  // Ribilanciamento autorizzato: nuove tabelle anche per le chest ancora chiuse.
  // Le ricevute già aperte restano immutabili e recuperabili.
  if(b.version===1)b.version=2;
  for(const item of b.items)if(!item.reward&&item.version===1)item.version=2;
  return b;
};
const fail=text=>{throw new GameError(text);};
const typeOf=item=>item?.type || 'common';
function odds(b,type) {
  const rates=RULES.types[type].rates;
  if(b.legendaryMisses>=RULES.legendaryPity-1)return {common:0,rare:0,epic:0,legendary:100};
  if(b.epicMisses>=RULES.epicPity-1)return {common:0,rare:0,epic:100-rates.legendary,legendary:rates.legendary};
  return rates;
}
function draw(weights,randomInt) {
  let roll=randomInt(10000);
  for(const [key,weight] of Object.entries(weights)){const units=Math.round(weight*100);if(roll<units)return key;roll-=units;}
  throw new Error('Tabella probabilità non valida');
}
function view(s,now=Date.now()) {
  const b=inventory(s),owned=new Set(A.ownedIds(s));
  return {version:b.version,progress:b.progress,earnedToday:b.day===dayOf(now)?b.earnedToday:0,day:dayOf(now),
    pending:b.items.filter(x=>!x.reward).map(x=>({id:x.id,type:typeOf(x),version:x.version,at:x.at})),
    recent:b.items.filter(x=>x.reward).slice(-10).reverse().map(x=>({id:x.id,...x.reward})),
    fragments:b.fragments,epicIn:RULES.epicPity-b.epicMisses,legendaryIn:RULES.legendaryPity-b.legendaryMisses,
    odds:odds(b,typeOf(b.items.find(x=>!x.reward))),
    missing:Object.fromEntries(Object.keys(RULES.types).map(r=>[r,A.LIST.filter(a=>a.rarity===r&&!owned.has(a.id)).length])),rules:RULES};
}
// Tutte le modifiche vengono salvate insieme prima della conferma; in caso di errore si torna allo stato precedente.
function commit(s,change,persist) {
  const before={chests:s.chests,avatarOwned:s.avatarOwned,avatarInventoryVersion:s.avatarInventoryVersion};
  Object.assign(s,change);
  try { persist(); } catch(e) {
    for(const [k,v] of Object.entries(before)) {if(v===undefined)delete s[k];else s[k]=v;}
    throw e;
  }
}
function open(s,id,persist,randomInt=crypto.randomInt,now=Date.now()) {
  const b=inventory(s),item=b.items.find(x=>x.id===id);
  if(!item)fail('Chest non disponibile');
  if(item.reward)return {reward:item.reward,chests:view(s,now)};
  if(item.version!==RULES.version)fail('Versione chest non supportata');
  const chestType=typeOf(item),rarity=draw(odds(b,chestType),randomInt),pool=A.LIST.filter(a=>a.rarity===rarity&&!A.STARTER_IDS.includes(a.id));
  const avatar=pool[randomInt(pool.length)],owned=new Set(A.ownedIds(s)),duplicate=owned.has(avatar.id);
  const fragments=duplicate?RULES.fragments[rarity]:0;
  if(!duplicate)owned.add(avatar.id);
  b.fragments+=fragments;
  b.epicMisses=rarity==='epic'||rarity==='legendary'?0:b.epicMisses+1;
  b.legendaryMisses=rarity==='legendary'?0:b.legendaryMisses+1;
  item.reward={avatarId:avatar.id,rarity,chestType,duplicate,fragments,at:now};
  commit(s,{chests:b,avatarOwned:[...owned],avatarInventoryVersion:1},persist);
  return {reward:item.reward,chests:view(s,now)};
}
function exchange(s,rarity,requestId,persist,randomInt=crypto.randomInt,now=Date.now()) {
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(requestId||'') || !Object.hasOwn(RULES.costs,rarity))fail('Scambio non valido');
  const b=inventory(s),previous=b.exchanges[requestId];
  if(previous){if(previous.rarity!==rarity)fail('Scambio non valido');return {reward:previous,chests:view(s,now)};}
  const owned=new Set(A.ownedIds(s)),pool=A.LIST.filter(a=>a.rarity===rarity&&!owned.has(a.id));
  if(!pool.length)fail('Hai già tutti gli avatar di questa rarità');
  if(b.fragments<RULES.costs[rarity])fail('Frammenti insufficienti');
  const avatar=pool[randomInt(pool.length)];owned.add(avatar.id);b.fragments-=RULES.costs[rarity];
  const reward={avatarId:avatar.id,rarity,duplicate:false,fragments:0,at:now,exchange:true};
  b.exchanges[requestId]=reward;
  commit(s,{chests:b,avatarOwned:[...owned],avatarInventoryVersion:1},persist);
  return {reward,chests:view(s,now)};
}
function recordGame(room,sessions,persist,now=Date.now(),randomInt=crypto.randomInt) {
  const g=room.game;
  if(!g?.over || !g.handResult || !room.chestGameId || room.chestRecordedGame===room.chestGameId)return;
  if(room.localGame||room.onDevice||room.offline||room.tutorial||room.daily||room.progressEligible!==true||g.handResult?.reason==='surrender'||room.rankedMatch?.abandoned?.length)return;
  if(room.seats.length<2 || room.seats.some(x=>!x||x.isBot||x.leftToken||!x.token||!sessions.get(x.token)?.nick))return;
  const tokens=[...new Set(room.seats.map(x=>x.token))];
  if(tokens.length!==room.seats.length)return;
  const previous=tokens.map(t=>[sessions.get(t),sessions.get(t).chests]);
  const awarded=new Set();
  const marker=room.chestRecordedGame;
  try { for(const token of tokens) {
    const s=sessions.get(token),b=inventory(s),day=dayOf(now);
    if(b.day!==day){b.day=day;b.earnedToday=0;}
    if(b.earnedToday<RULES.dailyLimit && ++b.progress===RULES.matches) {
      b.progress=0;b.earnedToday++;b.items.push({id:String(++b.issued),type:draw(RULES.chestRates,randomInt),version:RULES.version,at:now});
      awarded.add(token);
    }
    s.chests=b;
  }
  room.chestRecordedGame=room.chestGameId;
  persist();}catch(e){
    for(const [s,b] of previous){if(b===undefined)delete s.chests;else s.chests=b;}
    if(marker===undefined)delete room.chestRecordedGame;else room.chestRecordedGame=marker;
    throw e;
  }
  return tokens.map(token=>({token,earned:awarded.has(token)}));
}
module.exports={RULES,view,open,exchange,recordGame,dayOf};
