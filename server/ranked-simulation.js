'use strict';
// Simulazione deterministica Bradley–Terry: esiti casuali da abilità latente,
// avversari locali nel rating stimato. Non è un modello empirico della fortuna delle carte.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const G = require('./glicko2');
const R = require('./ranked-rules');
let seed = 73421;
const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
const now = R.CONFIG.epoch + R.DAY;
const players = Array.from({length:600},(_,i)=>({id:i,skill:950+1700*i/599,p:R.fresh(now),firstGold:null,promos:0,promoWins:0}));
const gaps=[]; let matches=0;
for(let round=0;round<500;round++) {
  const ordered=[...players].sort((a,b)=>a.p.rating-b.p.rating || a.id-b.id);
  // Permutazioni locali evitano incontri sempre con lo stesso avversario.
  for(let start=0;start<ordered.length;start+=12) for(let j=Math.min(start+11,ordered.length-1);j>start;j--){const k=start+Math.floor(random()*(j-start+1));[ordered[j],ordered[k]]=[ordered[k],ordered[j]];}
  for(let i=0;i<ordered.length;i+=2){
    const a=ordered[i],b=ordered[i+1],score=random()<1/(1+10**((b.skill-a.skill)/400))?1:0;
    gaps.push(Math.abs(a.p.rating-b.p.rating));
    const next=G.teamUpdate([[a.p],[b.p]],[score,1-score]);
    [a,b].forEach((x,j)=>{const was=!!x.p.promo,oldTier=x.p.tier;x.p=next[j][0];R.progress(x.p,j?1-score:score);if(!was&&x.p.promo)x.promos++;if(was&&!x.p.promo&&x.p.tier>oldTier)x.promoWins++;if(x.firstGold===null&&x.p.tier>=2)x.firstGold=round+1;});matches++;
  }
}
const bands=[['bassa',950,1350],['media',1350,1750],['alta',1750,2200],['élite',2200,2700]].map(([name,min,max])=>{
  const xs=players.filter(p=>p.skill>=min&&p.skill<max);
  return {name,players:xs.length,meanRating:Math.round(xs.reduce((s,x)=>s+x.p.rating,0)/xs.length),meanRankPoints:Math.round(xs.reduce((s,x)=>s+R.rankValue(x.p),0)/xs.length),goldBy50:xs.filter(x=>x.firstGold!==null&&x.firstGold<=50).length/xs.length,diamondOrAbove:xs.filter(x=>x.p.tier>=4).length/xs.length};
});
const distribution=R.LEAGUES.slice(0,8).map((league,tier)=>({league,players:players.filter(x=>x.p.tier===tier).length}));
const promos=players.reduce((s,x)=>s+x.promos,0), wins=players.reduce((s,x)=>s+x.promoWins,0);
gaps.sort((a,b)=>a-b);
const eligible=players.filter(x=>x.p.games>=30).sort((a,b)=>b.p.rating-a.p.rating||a.id-b.id);
const slots=Math.max(1,Math.floor(eligible.length*.01)),legend=eligible.slice(0,slots).filter(x=>x.p.rating>=R.CONFIG.legendRating);
assert.ok(bands[2].meanRankPoints>bands[1].meanRankPoints+400);
assert.ok(bands[2].goldBy50>bands[1].goldBy50);
assert.ok(bands[1].diamondOrAbove<.1);
assert.ok(gaps[Math.floor(gaps.length*.95)]<250);
assert.ok(wins/promos>.25); assert.ok(legend.length<=slots);
const report={seed:73421,players:600,gamesPerPlayer:500,matches,bands,distribution,promotions:{started:promos,succeeded:wins,successRate:wins/promos},ratingGap:{median:gaps[Math.floor(gaps.length*.5)],p95:gaps[Math.floor(gaps.length*.95)]},legend:{eligible:eligible.length,slots,qualified:legend.length},limitations:'Esiti sintetici Bradley–Terry; serve telemetria reale per calibrare fortuna, popolazione e tempi di attesa.'};
fs.mkdirSync(path.join(__dirname,'../test-output'),{recursive:true});
fs.writeFileSync(path.join(__dirname,'../test-output/ranked-simulation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
