'use strict';
// Progressione delle sole partite umane valide, salvata insieme alle chest.
const Weekly=require('./weekly-rewards');
const MONTH_REWARDS=['common','common','rare','common','rare','common','rare','common','rare','epic'];
const GAMES=['burraco','scala40','ramino','canasta'];
const MEMORIES=[
 {id:'first',name:'Il primo tavolo',desc:'Completa una partita online',goal:1,type:'common'},
 {id:'ten',name:'Un posto abituale',desc:'Completa 10 partite online',goal:10,type:'rare'},
 {id:'fifty',name:'Tra le carte di casa',desc:'Completa 50 partite online',goal:50},
 {id:'hundred',name:'Cento belle partite',desc:'Completa 100 partite online',goal:100,type:'epic'},
 {id:'explorer',name:'Quattro tavoli, una passione',desc:'Gioca ai quattro giochi di Smazzata',goal:4,type:'rare'},
 ...GAMES.map(game=>({id:'win-'+game,name:({burraco:'Prima vittoria a Burraco',scala40:'Prima vittoria a Scala 40',ramino:'Prima vittoria a Ramino',canasta:'Prima vittoria a Canasta'})[game],desc:'Vinci una partita online',goal:1,type:'common'})),
 {id:'comeback',name:'Mai dire ultima carta',desc:'Vinci dopo uno svantaggio di almeno 500 punti',goal:1,type:'rare'},
 {id:'friend',name:'In buona compagnia',desc:'Completa una partita con un amico',goal:1},
];
const fresh=()=>({matches:0,games:[],wins:[],memories:{}});
function state(b){return b.journey||fresh();}
function month(j,day){return j.month?.id===day.slice(0,7)?j.month:{id:day.slice(0,7),matches:0,awarded:0};}
function weekend(j,day){const id=Weekly.weekOf(day),active=[0,6].includes(new Date(day+'T12:00:00Z').getUTCDay());return {...(j.weekend?.id===id?j.weekend:{id,matches:0,awarded:false}),active};}
function progress(j,m){return m.id==='explorer'?j.games.length:m.id.startsWith('win-')?Number(j.wins.includes(m.id.slice(4))):m.id==='comeback'?Number(!!j.comeback):m.id==='friend'?Number(!!j.friend):j.matches;}
function view(b,day){const j=state(b),m=month(j,day),w=weekend(j,day);return {month:{...m,steps:MONTH_REWARDS.map((type,i)=>({step:i+1,type,goal:(i+1)*3,awarded:i<m.awarded}))},weekend:w,album:MEMORIES.map(x=>({...x,progress:Math.min(x.goal,progress(j,x)),at:j.memories[x.id]||null})),matches:j.matches};}
function comeback(g,seat,game){
 if(!g.winners?.includes(seat)||!['burraco','canasta'].includes(game))return false;
 const teams=g.teams||[],mine=teams.findIndex(t=>t.members.includes(seat));if(mine<0)return false;
 const scores=teams.map(()=>0);
 for(const h of (g.history||[]).slice(0,-1)){
  for(const t of h.teams||[]){const i=teams.findIndex(x=>x.members.some(s=>t.members.includes(s)));if(i>=0)scores[i]+=t.total;}
  if(scores.some((v,i)=>i!==mine&&v-scores[mine]>=500))return true;
 }
 return false;
}
function record(b,room,seat,now,day,award,withFriend){
 const j=b.journey=structuredClone(state(b)),m=j.month=month(j,day),w=weekend(j,day),game=room.rules?.game||'burraco';
 j.matches++;if(GAMES.includes(game)&&!j.games.includes(game))j.games.push(game);
 if(room.game.winners?.includes(seat)&&GAMES.includes(game)&&!j.wins.includes(game))j.wins.push(game);
 if(withFriend)j.friend=true;if(comeback(room.game,seat,game))j.comeback=true;
 m.matches=Math.min(30,m.matches+1);let count=0;
 while(m.awarded<Math.floor(m.matches/3)){award(MONTH_REWARDS[m.awarded],now,'monthly',m.id+'-'+(++m.awarded));count++;}
 if(w.active){w.matches=Math.min(3,w.matches+1);if(w.matches===3&&!w.awarded){award('rare',now,'weekend',w.id);w.awarded=true;count++;}delete w.active;j.weekend=w;}
 for(const memory of MEMORIES)if(!j.memories[memory.id]&&progress(j,memory)>=memory.goal){j.memories[memory.id]=now;if(memory.type){award(memory.type,now,'memory',memory.id);count++;}}
 return count;
}
module.exports={MONTH_REWARDS,MEMORIES,view,record};
