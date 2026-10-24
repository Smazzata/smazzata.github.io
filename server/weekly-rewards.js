'use strict';
const MISSIONS=[{id:'matches',name:'Completa 3 partite online',goal:3,type:'common'},{id:'games',name:'Gioca a 2 giochi diversi',goal:2,type:'rare'},{id:'days',name:'Gioca in 2 giorni diversi',goal:2,type:'common'},{id:'friends',name:'Completa 3 partite con un amico',goal:3,type:'rare'}];
function weekOf(day){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10);}
function current(b,day){const week=weekOf(day);return b.weekly?.week===week?b.weekly:{week,matches:0,games:[],days:[],awarded:[]};}
function view(b,day){const w=current(b,day),end=new Date(w.week+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+7);return {week:w.week,endsDay:end.toISOString().slice(0,10),missions:MISSIONS.map(m=>({...m,progress:Math.min(m.goal,m.id==='matches'?w.matches:m.id==='friends'?(w.friends||0):w[m.id].length),awarded:w.awarded.includes(m.id)}))};}
function record(b,room,now,day,award,withFriend=false){
  const w=current(b,day);b.weekly=w;w.matches=Math.min(3,w.matches+1);
  if(withFriend)w.friends=Math.min(3,(w.friends||0)+1);
  const game=room.rules?.game||'burraco';if(!w.games.includes(game)&&w.games.length<2)w.games.push(game);
  if(!w.days.includes(day)&&w.days.length<2)w.days.push(day);
  let count=0;
  for(const m of view(b,day).missions)if(m.progress>=m.goal&&!m.awarded){award(m.type,now,m.id);w.awarded.push(m.id);count++;}
  return count;
}
module.exports={MISSIONS,weekOf,view,record};
