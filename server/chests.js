'use strict';
// Inventario privato del profilo: nessuna estrazione o assegnazione dal client.
const crypto=require('node:crypto');
const A=require('../shared/avatars');
const C=require('../shared/cosmetics');
const Weekly=require('./weekly-rewards');
const Journey=require('./player-journey');
const {GameError}=require('./engine');
const RULES={version:4,matches:2,dailyLimit:1,epicPity:20,legendaryPity:50,
  chestRates:{common:75,rare:20,epic:4,legendary:1},
  types:{
    common:{name:'Chest comune',rates:{coins:70,common:20,rare:7,epic:2.5,legendary:0.5}},
    rare:{name:'Chest rara',rates:{coins:45,common:10,rare:35.5,epic:8,legendary:1.5}},
    epic:{name:'Chest epica',rates:{coins:20,common:0,rare:15,epic:62,legendary:3}},
    legendary:{name:'Chest leggendaria',rates:{coins:0,common:0,rare:0,epic:0,legendary:100}},
  },
  coinAmounts:{common:30,rare:80,epic:200,legendary:0},duplicateCoins:{common:30,rare:90,epic:300,legendary:900},costs:{common:600,rare:1800,epic:6000,legendary:18000},matchCoins:5,coinMatchesLimit:3};
const dayOf=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const empty=()=>({version:4,progress:0,day:'',earnedToday:0,coinGames:0,coins:0,epicMisses:0,legendaryMisses:0,issued:0,items:[],purchases:{}});
const LEGACY_RATES={common:{common:66.5,rare:25,epic:8,legendary:.5},rare:{common:20,rare:61.5,epic:17,legendary:1.5},epic:{common:0,rare:20,epic:77,legendary:3},legendary:{common:0,rare:0,epic:0,legendary:100}};
const POOL=[...A.LIST.filter(a=>!A.STARTER_IDS.includes(a.id)).map(a=>({...a,kind:'avatar'})),...C.LIST];
const ownedOf=s=>new Set([...A.ownedIds(s),...C.ownedIds(s)]);
function collection(s){
  const acquiredAt={};
  const note=r=>{const id=r?.itemId||r?.avatarId;if(id&&!r.duplicate&&Number.isFinite(r.at))acquiredAt[id]=Math.max(acquiredAt[id]||0,r.at);};
  for(const x of s.chests?.items||[])note(x.reward);
  for(const x of Object.values(s.chests?.purchases||{}))note(x);
  for(const x of s.inbox||[])for(const g of x.gifts||(x.gift?[x.gift]:[]))if(g.kind!=='chest')note({...g,at:x.at});
  const owned=ownedOf(s),seen=new Set(s.collectionSeen||[]);
  return {ownedIds:C.ownedIds(s),loadout:C.equipped(s),meta:{acquiredAt,newIds:Object.keys(acquiredAt).filter(id=>owned.has(id)&&!seen.has(id)&&!A.STARTER_IDS.includes(id))}};
}
function seeItem(s,id,persist){
  if(!ownedOf(s).has(id))fail('Oggetto non posseduto');
  if(!(s.collectionSeen||[]).includes(id))commit(s,{collectionSeen:[...(s.collectionSeen||[]),id]},persist);
  return {cosmetics:collection(s)};
}
function grant(s,item){return item.kind==='avatar'?{avatarOwned:[...new Set([...A.ownedIds(s),item.id])],avatarInventoryVersion:1}:{cosmeticOwned:[...new Set([...C.ownedIds(s),item.id])]};}
function receipt(item){return {kind:item.kind,itemId:item.id,...(item.kind==='avatar'?{avatarId:item.id}:{})};}
const inventory=s=>{
  const b=s.chests ? structuredClone(s.chests) : empty();
  // Nessuna conversione: i frammenti sono rimossi su indicazione del titolare.
  if(b.version<4){if(b.journey?.month)b.journey.month.legacyAwarded=b.journey.month.awarded;if(b.weekly)b.weekly.legacyAwarded=[...b.weekly.awarded||[]];}
  b.version=4;b.coins=Number.isSafeInteger(b.coins)&&b.coins>=0?b.coins:0;b.coinGames=b.coinGames||0;b.purchases=b.purchases||{};
  delete b.fragments;delete b.exchanges;
  for(const item of b.items){if(!item.reward&&(!item.version||item.version<3))item.version=3;if(item.reward){delete item.reward.fragments;item.reward.coins=item.reward.coins||0;}}

  return b;
};
const fail=text=>{throw new GameError(text);};
const typeOf=item=>item?.type || 'common';
function odds(b,type,version=RULES.version) {
  const rates=version<4?LEGACY_RATES[type]:RULES.types[type].rates;
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
  const b=inventory(s),owned=ownedOf(s);
  return {version:b.version,progress:b.day===dayOf(now)?Math.min(b.progress,RULES.matches-1):0,earnedToday:b.day===dayOf(now)?b.earnedToday:0,day:dayOf(now),
    pending:b.items.filter(x=>!x.reward).map(x=>({id:x.id,type:typeOf(x),version:x.version,at:x.at,source:x.source||'game',odds:odds(b,typeOf(x),x.version)})),
    recent:b.items.filter(x=>x.reward).slice(-10).reverse().map(x=>({id:x.id,...x.reward})),
    coins:b.coins,coinGames:b.day===dayOf(now)?b.coinGames:0,epicIn:RULES.epicPity-b.epicMisses,legendaryIn:RULES.legendaryPity-b.legendaryMisses,
    odds:odds(b,typeOf(b.items.find(x=>!x.reward)),b.items.find(x=>!x.reward)?.version),weekly:Weekly.view(b,dayOf(now)),journey:Journey.view(b,dayOf(now)),
    missing:Object.fromEntries(Object.keys(RULES.types).map(r=>[r,POOL.filter(a=>a.rarity===r&&!owned.has(a.id)).length])),
    pools:Object.fromEntries(Object.keys(RULES.types).map(r=>[r,Object.fromEntries(['avatar',...C.KINDS.map(k=>k.id)].map(k=>[k,POOL.filter(a=>a.rarity===r&&a.kind===k).length]))])),rules:RULES};
}
// Tutte le modifiche vengono salvate insieme prima della conferma; in caso di errore si torna allo stato precedente.
function commit(s,change,persist) {
  const before=Object.fromEntries(Object.keys(change).map(k=>[k,s[k]]));
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
  if(![3,4].includes(item.version))fail('Versione chest non supportata');
  const chestType=typeOf(item),rarity=draw(odds(b,chestType,item.version),randomInt);
  b.epicMisses=rarity==='epic'||rarity==='legendary'?0:b.epicMisses+1;
  b.legendaryMisses=rarity==='legendary'?0:b.legendaryMisses+1;
  let change={};
  if(rarity==='coins'){addCoins(b,RULES.coinAmounts[chestType]);item.reward={kind:'coins',coins:RULES.coinAmounts[chestType],chestType,at:now};}
  else{const pool=POOL.filter(a=>a.rarity===rarity),prize=pool[randomInt(pool.length)],duplicate=ownedOf(s).has(prize.id),coins=duplicate?RULES.duplicateCoins[rarity]:0;
    addCoins(b,coins);item.reward={...receipt(prize),rarity,chestType,duplicate,coins,at:now};change=grant(s,prize);}
  commit(s,{chests:b,...change},persist);
  return {reward:item.reward,chests:view(s,now)};
}
function addCoins(b,amount){if(!Number.isSafeInteger(amount)||amount<0||!Number.isSafeInteger(b.coins+amount))fail('Saldo non valido');b.coins+=amount;}
function buy(s,itemId,requestId,persist,now=Date.now()) {
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(requestId||''))fail('Acquisto non valido');
  const b=inventory(s),previous=b.purchases[requestId];
  if(previous){if(previous.itemId!==itemId)fail('Acquisto non valido');return {reward:previous,chests:view(s,now)};}
  const prize=POOL.find(a=>a.id===itemId);if(!prize)fail('Oggetto non disponibile');
  if(ownedOf(s).has(prize.id))fail('Oggetto già posseduto');
  const cost=RULES.costs[prize.rarity];if(b.coins<cost)fail('Monete insufficienti');b.coins-=cost;
  const reward={...receipt(prize),rarity:prize.rarity,duplicate:false,coins:0,cost,at:now,purchase:true};
  b.purchases[requestId]=reward;commit(s,{chests:b,...grant(s,prize)},persist);
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
  const awarded=new Set(),weeklyAwarded=new Map(),journeyAwarded=new Map(),coinsEarned=new Map();
  const marker=room.chestRecordedGame;
  try { for(const token of tokens) {
    const s=sessions.get(token),b=inventory(s),day=dayOf(now);
    if(b.day!==day){b.day=day;b.earnedToday=0;b.progress=0;b.coinGames=0;}
    const previousCoins=b.coins;if(b.coinGames<RULES.coinMatchesLimit){b.coinGames++;addCoins(b,RULES.matchCoins);}
    if(b.earnedToday<RULES.dailyLimit && ++b.progress>=RULES.matches) {
      b.progress=0;b.earnedToday++;b.items.push({id:String(++b.issued),type:draw(RULES.chestRates,randomInt),version:RULES.version,at:now});
      awarded.add(token);
    }
    const withFriend=tokens.some(other=>other!==token&&s.friends?.includes(other)&&sessions.get(other)?.friends?.includes(token));
    const weeklyCount=Weekly.record(b,room,now,day,(type,at,mission)=>{if(typeof type==='number')addCoins(b,type);else b.items.push({id:String(++b.issued),type,version:RULES.version,at,source:'weekly',mission});},withFriend);
    journeyAwarded.set(token,Journey.record(b,room,room.seats.findIndex(x=>x.token===token),now,day,(type,at,source,mission)=>{if(typeof type==='number')addCoins(b,type);else b.items.push({id:String(++b.issued),type,version:RULES.version,at,source,mission});},withFriend));
    weeklyAwarded.set(token,weeklyCount);coinsEarned.set(token,b.coins-previousCoins);s.chests=b;
  }
  room.chestRecordedGame=room.chestGameId;
  persist();}catch(e){
    for(const [s,b] of previous){if(b===undefined)delete s.chests;else s.chests=b;}
    if(marker===undefined)delete room.chestRecordedGame;else room.chestRecordedGame=marker;
    throw e;
  }
  return tokens.map(token=>({token,earned:awarded.has(token),weeklyEarned:weeklyAwarded.get(token)||0,journeyEarned:journeyAwarded.get(token)||0,coinsEarned:coinsEarned.get(token)||0}));
}
module.exports={RULES,POOL,collection,view,open,buy,recordGame,dayOf,inventory,grant,odds,seeItem,addCoins};
