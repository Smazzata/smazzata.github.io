const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const C=require('../server/chests'),A=require('../shared/avatars');
const RUNS=3000,START=Date.parse('2026-11-01T12:00:00Z'),RAR=['common','rare','epic','legendary'];
const pool=RAR.map(r=>C.POOL.filter(x=>x.rarity===r).map(x=>x.id));
assert.deepEqual(pool.map(x=>x.length),[70,45,23,8]);
const counts=pool.map(x=>x.length),total=counts.reduce((a,b)=>a+b,0),chestWeights=RAR.map(x=>C.RULES.chestRates[x]);
const BASE_RATES={common:{common:66.5,rare:25,epic:8,legendary:.5},rare:{common:20,rare:61.5,epic:17,legendary:1.5},epic:{common:0,rare:20,epic:77,legendary:3},legendary:{common:0,rare:0,epic:0,legendary:100}};
function rng(seed){let s=seed>>>0;return ()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
function pick(weights,r){let x=r()*weights.reduce((a,b)=>a+b,0);for(let i=0;i<weights.length;i++){x-=weights[i];if(x<0)return i;}return weights.length-1;}
const profiles=[{id:'occasionale',days:[2,6],matches:2,friend:.25},{id:'regolare',days:[1,2,3,5,6],matches:2,friend:.35},{id:'assiduo',days:[0,1,2,3,4,5,6],matches:4,friend:.5}];
// Calendari storici generati dai moduli reali del commit f9a0eff: non cambiano con l'economia attiva.
const historicalCalendars=require('./fixtures/economy-calendar-v3.json');
function calendar(profile){return structuredClone(historicalCalendars[profile.id]);}
const proposed={common:[70,20,7,2.5,.5],rare:[45,10,35.5,8,1.5],epic:[20,0,15,62,3],legendary:[0,0,0,0,100]};
const conditional=Object.fromEntries(RAR.map((r,i)=>[r,[[70,45,20,0][i],...RAR.map(x=>BASE_RATES[r][x]*(1-[.7,.45,.2,0][i]))]]));
for(const table of [proposed,conditional])for(const row of Object.values(table))assert(Math.abs(row.reduce((a,b)=>a+b,0)-100)<1e-8);
const models=[
 {id:'attuale',table:null,cost:[50,150,500,1500],dup:[5,15,50,150],coins:[0,0,0,0],simplify:false,gameCoins:0},
 {id:'solo_monete',table:proposed,cost:[400,1200,4000,12000],dup:[20,60,200,600],coins:[40,100,250,0],simplify:false,gameCoins:5},
 {id:'proposta',table:proposed,cost:[400,1200,4000,12000],dup:[20,60,200,600],coins:[40,100,250,0],simplify:true,gameCoins:5},
 {id:'prezzi_ridotti',table:proposed,cost:[250,800,2500,8000],dup:[12,40,125,400],coins:[40,100,250,0],simplify:true,gameCoins:5},
 {id:'duratura',table:proposed,cost:[600,1800,6000,18000],dup:[30,90,300,900],coins:[30,80,200,0],simplify:true,gameCoins:5,durable:true},
 {id:'probabilita_condizionali',table:conditional,cost:[400,1200,4000,12000],dup:[20,60,200,600],coins:[40,100,250,0],simplify:true,gameCoins:5}
];
// Due comuni settimanali diventano 100 monete ciascuno. Cinque tappe mensili diventano monete.
const monthlyCoins={1:50,3:100,5:100,7:150,9:200};
function delivery(award,model){if(!model.simplify)return {type:award.type};if(model.durable){if(award.source==='weekly'&&award.mission==='games')return {money:150};if(award.source==='monthly'){const step=Number(award.mission.split('-').at(-1)),money={1:50,3:100,4:100,6:150,7:150,9:200};if(money[step])return {money:money[step]};return {type:({2:'common',5:'common',8:'rare',10:'epic'})[step]};}}if(award.source==='weekly'&&['matches','days'].includes(award.mission))return {money:100};if(award.source==='monthly'){const step=Number(award.mission.split('-').at(-1));if(monthlyCoins[step])return {money:monthlyCoins[step]};}return {type:award.type};}
function run(days,model,strategy,seed){const r=rng(seed),owned=counts.map(()=>new Set()),balance={value:0,earned:0,spent:0},res={};let epic=0,legend=0,chests=0,objects=0,coinsOnly=0,duplicates=0,purchases=0,firstLegend=null;
 const credit=n=>{balance.value+=n;balance.earned+=n;};
 function shop(day){if(strategy==='nessun_acquisto')return;
  if(strategy==='risparmia_leggendario'){if(owned[3].size<counts[3]){if(balance.value>=model.cost[3]){const ids=Array.from({length:counts[3]},(_,i)=>i).filter(i=>!owned[3].has(i));owned[3].add(ids[0]);balance.value-=model.cost[3];balance.spent+=model.cost[3];purchases++;if(firstLegend===null)firstLegend=day;}return;}}
  for(let tier=0;tier<4;tier++)while(balance.value>=model.cost[tier]&&owned[tier].size<counts[tier]){const id=Array.from({length:counts[tier]},(_,i)=>i).find(i=>!owned[tier].has(i));owned[tier].add(id);balance.value-=model.cost[tier];balance.spent+=model.cost[tier];purchases++;if(tier===3&&firstLegend===null)firstLegend=day;}
 }
 for(const day of days){credit(model.gameCoins*Math.min(3,day.matches));
  for(const a of day.awards){const d=delivery(a,model);if(d.money){credit(d.money);continue;}const type=d.type||RAR[pick(chestWeights,r)],ti=RAR.indexOf(type);chests++;
   // Garanzie conservate su TUTTE le aperture, comprese quelle a monete: a scadenza si ottiene un oggetto.
   let result;if(legend>=49)result=4;else if(epic>=19){const l=model.table?model.table[type][4]:BASE_RATES[type].legendary;result=r()*100<l?4:3;}else result=model.table?pick(model.table[type],r):pick(RAR.map(x=>BASE_RATES[type][x]),r)+1;
   if(!result){coinsOnly++;epic++;legend++;credit(model.coins[ti]);}
   else{const tier=result-1;objects++;epic=tier>=2?0:epic+1;legend=tier===3?0:legend+1;const id=Math.floor(r()*counts[tier]);if(owned[tier].has(id)){duplicates++;credit(model.dup[tier]);}else owned[tier].add(id);if(tier===3&&firstLegend===null)firstLegend=day.day;}
   shop(day.day);
  }shop(day.day);
  if([30,90,180].includes(day.day))res[day.day]={unique:owned.reduce((n,x)=>n+x.size,0),rarities:owned.map(x=>x.size),balance:balance.value,earned:balance.earned,spent:balance.spent,chests,objects,coinsOnly,duplicates,purchases,firstLegend,complete:owned.every((x,i)=>x.size===counts[i])};
 }return res;
}
function stat(values){const a=[...values].sort((a,b)=>a-b);return {mean:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2),p10:a[Math.floor(a.length*.1)],p50:a[Math.floor(a.length*.5)],p90:a[Math.floor(a.length*.9)]};}
const output={method:{runsPerScenario:RUNS,start:'2026-11-01',days:180,catalogue:total,starterAvatars:A.STARTER_IDS.length,seeded:true,calendar:'calendari storici dei moduli reali al commit f9a0eff, congelati in scripts/fixtures/economy-calendar-v3.json; estrazioni Monte Carlo',pity:'20 epico/50 leggendario su tutte le aperture, non su acquisti',limits:'Nessuna simulazione di durata partite, abbandoni, retention, regali admin, migrazione profili esistenti o costi monetari; quantità fisse di monete; calendario campione, non popolazione reale.'},profiles,models:models.map(m=>({...m,currency:m.id==='attuale'?'frammenti':'monete'})),proposed,conditional,scenarios:[],calendars:{}};
for(const profile of profiles){const days=calendar(profile);output.calendars[profile.id]=Object.fromEntries([30,90,180].map(n=>{const slice=days.slice(0,n),bySource={};for(const day of slice)for(const a of day.awards)bySource[a.source]=(bySource[a.source]||0)+1;return[n,{matches:slice.reduce((a,d)=>a+d.matches,0),chests:slice.reduce((a,d)=>a+d.awards.length,0),bySource}];}));
 for(const model of models)for(const strategy of ['economico_prima','risparmia_leggendario','nessun_acquisto']){const samples=Array.from({length:RUNS},(_,i)=>run(days,model,strategy,12345+i*371+profiles.indexOf(profile)*100000));for(const n of [30,90,180]){const rows=samples.map(x=>x[n]);output.scenarios.push({profile:profile.id,model:model.id,strategy,days:n,unique:stat(rows.map(x=>x.unique)),rarities:RAR.map((_,i)=>stat(rows.map(x=>x.rarities[i]))),balance:stat(rows.map(x=>x.balance)),earned:stat(rows.map(x=>x.earned)),chests:stat(rows.map(x=>x.chests)),objects:stat(rows.map(x=>x.objects)),purchases:stat(rows.map(x=>x.purchases)),noLegendaryPct:+(100*rows.filter(x=>x.firstLegend===null).length/RUNS).toFixed(2),completePct:100*rows.filter(x=>x.complete).length/RUNS});}}
}
const out=path.resolve(__dirname,'../store/SIMULAZIONE-ECONOMIA-2026-10-25.json');fs.writeFileSync(out,JSON.stringify(output,null,2)+'\n');
console.log('Traiettorie simulate:',RUNS*profiles.length*models.length*3);console.log('Catalogo estraibile:',total);console.table(output.scenarios.filter(x=>x.strategy==='economico_prima'&&['attuale','proposta','duratura'].includes(x.model)).map(x=>({profilo:x.profile,modello:x.model,giorni:x.days,oggetti:x.unique.mean,p10:x.unique.p10,p90:x.unique.p90,chest:x.chests.mean,valuta:x.earned.mean,senzaLeg:x.noLegendaryPct})));console.log(out);
