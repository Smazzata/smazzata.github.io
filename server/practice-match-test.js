'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),ctx=require('./contesto'),Games=require('./games'),progress=require('./progress-rules'),Elo=require('./elo');
const {createRanked}=require('./ranked');
function fixture(count=4){
 let now=100000,codes=0;
 const sockets=Array.from({length:count},(_,i)=>({data:{token:'p'+i},emit(){},join(){}}));
 const c={sessions:new Map(sockets.map((s,i)=>['p'+i,{nick:'Persona'+i,friends:sockets.filter(x=>x!==s).map(x=>x.data.token)}])),rooms:new Map(),
 saveNow(){},newCode:()=>String(++codes),socketsOf:t=>sockets.filter(s=>s.data.token===t&&!s.offline),isConnected:t=>sockets.some(s=>s.data.token===t&&!s.offline),leaveRoom(){},
 fillBots:room=>{room.seats=room.seats.map((s,i)=>s||{isBot:true,name:'CPU'+i});},
 startGame:room=>{room.rankedGame=Elo.isRanked(room);room.progressEligible=!room.practice&&room.seats.every(s=>!s.isBot);room.game=Games.of(room).E.createGame({rules:room.rules,players:room.seats});}};
 const ranked=createRanked(c,{clock:()=>now});return{c,ranked,sockets,advance:ms=>{now+=ms;},now:()=>now};
}
for(const game of ['burraco','scala40','ramino','canasta'])test('Coda '+game+': nessuna CPU prima di 30 secondi, poi avvio automatico',()=>{
 const f=fixture();f.ranked.join('p0',{game,n:2});f.advance(29999);f.ranked.tick();assert.equal(f.c.rooms.size,0);
 f.advance(1);f.ranked.tick();const room=[...f.c.rooms.values()][0];assert(room.game);assert.equal(room.seats[0].token,'p0');assert.equal(room.seats[1].isBot,true);assert.equal(room.rankedMatch,undefined);assert.equal(room.rankedGame,false);assert.equal(progress(room),false);assert.equal(f.ranked.queue.size,0);
 f.ranked.tick();assert.equal(f.c.rooms.size,1);assert.equal(f.ranked.profile('p0',game+':solo').games,0);
});
test('Coda piena fra persone ha precedenza sulle CPU alla scadenza',()=>{
 const f=fixture();f.ranked.join('p0',{game:'burraco',n:2});f.advance(30000);f.ranked.join('p1',{game:'burraco',n:2});const room=[...f.c.rooms.values()][0];assert(room.rankedMatch);assert(room.seats.every(s=>!s.isBot));
});
test('Solo incompleta conserva le persone e separa gli altri giochi',()=>{
 const f=fixture();f.ranked.join('p0',{game:'burraco',n:4});f.ranked.join('p1',{game:'burraco',n:4});f.ranked.join('p2',{game:'ramino',n:2});f.advance(30000);f.ranked.tick();assert.equal(f.c.rooms.size,2);const room=[...f.c.rooms.values()].find(r=>r.n===4);assert.deepEqual(room.seats.filter(s=>!s.isBot).map(s=>s.token),['p0','p1']);assert.equal(room.seats.filter(s=>s.isBot).length,2);
});
test('Duo incompleta conserva la coppia nei posti 0 e 2',()=>{
 const f=fixture();f.ranked.join('p0',{game:'burraco',n:4,queue:'duo',friend:'Persona1'});f.ranked.accept('p1',[...f.ranked.invites.keys()][0]);f.advance(30000);f.ranked.tick();const room=[...f.c.rooms.values()][0];assert.equal(room.seats[0].token,'p0');assert.equal(room.seats[2].token,'p1');assert(room.seats[1].isBot&&room.seats[3].isBot);
});
test('Coda annullata o giocatore scollegato non avvia una partita CPU',()=>{
 for(const cancel of [true,false]){const f=fixture();f.ranked.join('p0',{game:'burraco',n:2});if(cancel)f.ranked.cancel('p0');else f.sockets[0].offline=true;f.advance(30000);f.ranked.tick();assert.equal(f.c.rooms.size,0);assert.equal(f.ranked.queue.size,0);}
});
test('Amichevole: dopo 30 secondi completa soltanto i posti liberi; privati esclusi',()=>{
 const f=fixture(),rules=Games.publicRules('burraco',4),room={code:'casual',quick:4,queueMode:'casual',quickWaitAt:f.now(),rules,n:4,seats:[{token:'p0',name:'A'},null,{token:'p1',name:'B'},null]};
 f.c.rooms.set('casual',room);f.c.rooms.set('private',{...room,code:'private',quick:0,seats:[...room.seats]});f.advance(29999);f.ranked.tick();assert(!room.game);f.advance(1);f.ranked.tick();assert(room.game);assert.equal(room.seats[2].token,'p1');assert.equal(room.seats.filter(s=>s.isBot).length,2);assert.equal(progress(room),false);assert(!f.c.rooms.get('private').game);
});
test('Torneo misto: anche gli incontri fra persone rimangono prove senza progressi',()=>{
 ctx.sessions.clear();ctx.rooms.clear();ctx.tournaments.clear();
 for(const token of ['a','b','c'])ctx.sessions.set(token,{nick:token});
 Object.assign(ctx,{pushMyGames:()=>{},socketsOf:()=>[],push:{send:()=>Promise.resolve()},awardTrophies:()=>{throw Error('Premio inatteso');}});
 let next=0;ctx.newCode=()=>String(++next);
 require('./gare');
 const id=ctx.Tour.create('a',{name:'Prova CPU',game:'burraco',size:4}),tour=ctx.Tour.get(id);
 ctx.Tour.join(tour,'b');ctx.Tour.join(tour,'c');ctx.Tour.fillBots(tour,'a');ctx.Tour.start(tour,'a');
 assert.equal(ctx.rooms.size,2);
 assert([...ctx.rooms.values()].some(room=>room.seats.every(s=>!s.isBot)));
 for(const room of ctx.rooms.values()){assert.equal(room.practice,true);assert.equal(progress(room),false);assert.equal(Elo.isRanked(room),false);}
 ctx.rooms.clear();ctx.sessions.clear();ctx.tournaments.clear();
});
