'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const G = require('./glicko2');
const R = require('./ranked-rules');
const { createRanked } = require('./ranked');
const { openStore } = require('./store');
const now0 = R.CONFIG.epoch + R.DAY;
function fixture(count = 4, config = {}) {
  let now = now0, fail = false, saved, codes = 0;
  const sockets = Array.from({ length: count }, (_, i) => ({ data: { token: 'p'+i }, messages: [], emit(e,d) { this.messages.push([e,d]); }, join() {} }));
  const ctx = { sessions: new Map(sockets.map((s,i) => [s.data.token, { nick: 'Player'+i, friends: sockets.filter((_,j)=>j!==i).map((s)=>s.data.token) }])), rooms: new Map(),
    saveNow() { if (fail) throw Error('disco pieno'); saved = JSON.stringify(ctx.ranked); },
    socketsOf: (t) => sockets.filter((s) => s.data.token === t && !s.offline), isConnected: (t) => sockets.some((s)=>s.data.token===t&&!s.offline),
    newCode: () => 'R'+(++codes), startGame(room) { room.rankedGame = true; room.game = require('./games').of(room).E.createGame({rules:room.rules,players:room.seats.map(s=>({name:s.name,isBot:false}))}); }, leaveRoom() {}, afterAction(room) { ranked.record(room); } };
  const ranked = createRanked(ctx, { clock: () => now, config });
  const match = (tokens = ['p0','p1'], key = 'burraco:2:solo', id = 'm1') => ({ n: tokens.length, rankedGame: true,
    rankedMatch: { id, key, tokens }, game: { over: true, winners: [0], teams: tokens.map((_, i) => ({ members: [i] })) } });
  return { ctx, ranked, sockets, match, advance(ms) { now += ms; }, fail(on) { fail = on; }, saved: () => JSON.parse(saved) };
}
test('Glicko-2: esempio ufficiale e inattività', () => {
  const p={rating:1500,rd:200,volatility:.06};
  const n=G.update(p,[{rating:1400,rd:30,score:1},{rating:1550,rd:100,score:0},{rating:1700,rd:300,score:0}]);
  assert.ok(Math.abs(n.rating-1464.06)<.02); assert.ok(Math.abs(n.rd-151.52)<.01); assert.ok(Math.abs(n.volatility-.059996)<.000001);
  const inactive=G.inactive(p,100); assert.equal(inactive.rating,p.rating); assert.ok(inactive.rd>p.rd); assert.ok(inactive.rd<=350);
});
test('squadre: una osservazione collettiva, simmetria e incertezza', () => {
  const p={rating:1500,rd:100,volatility:.06};
  const n=G.teamUpdate([[p,p],[p,p]],[1,0]);
  assert.equal(n[0][0].rating,n[0][1].rating); assert.ok(n[0][0].rating>1500);
  assert.ok(Math.abs(n[0][0].rating+n[1][0].rating-3000)<1e-8);
  assert.ok(n[0][0].rd<100); assert.ok(n[0][0].rd>G.update(p,[{...p,score:1},{...p,score:1}]).rd);
});
for (const sequence of [[1,1],[1,0,1],[0,1,1],[0,0],[1,0,0],[0,1,0]]) test('BO3 '+sequence.join('-'), () => {
  const p={...R.fresh(now0),games:20,tier:2,division:3,lp:99,rating:1800}; R.progress(p,1);
  assert.ok(p.promo); assert.equal(p.lp,100);
  sequence.forEach(s=>R.progress(p,s));
  const won=sequence.filter(x=>x===1).length===2;
  assert.equal(p.promo,null); assert.equal(p.tier,won?3:2); assert.equal(p.division,won?0:3); assert.equal(p.lp,won?0:75);
});
test('divisioni, residui, retrocessioni e limite Bronzo', () => {
  const p={...R.fresh(now0),games:20,tier:1,division:1,lp:99,rating:1300}; R.progress(p,1); assert.equal(p.division,2); assert.ok(p.lp>0&&p.lp<40);
  Object.assign(p,{tier:1,division:0,lp:0}); R.progress(p,0); assert.equal(p.tier,0); assert.equal(p.division,3); assert.ok(p.lp>0);
  Object.assign(p,{tier:0,division:0,lp:0}); R.progress(p,0); assert.equal(p.lp,0);
});
test('piazzamenti differenziati e tetto anti-fortuna', () => {
  const weak=R.fresh(now0),strong={...R.fresh(now0),rating:3000,rd:50};
  for(let i=0;i<10;i++){R.progress(weak,0);R.progress(strong,1);}
  assert.ok(R.rankValue(strong)>R.rankValue(weak)); assert.equal(strong.tier,2); assert.equal(R.view(strong).provisional,false);
});
test('persistenza atomica, replay risultato e isolamento code/giochi', () => {
  const f=fixture(); const a=f.match(); f.ranked.record(a); const saved=JSON.stringify(f.ctx.ranked);
  const placed = f.ctx.ranked.players.p0['burraco:2:solo'];
  assert.equal(placed.history[0].placementMatch, true);
  assert.equal(R.view(placed).placementTotal, 10);
  assert.equal(f.ranked.record(a),null); assert.equal(JSON.stringify(f.ctx.ranked),saved);
  f.ctx.ranked=f.saved(); const restarted=createRanked(f.ctx,{clock:()=>now0}); assert.equal(restarted.record(a),null);
  restarted.record(f.match(['p0','p1'],'scopa:2:solo','m2'));
  restarted.record(f.match(['p0','p1'],'burraco:4:duo','m3'));
  assert.equal(f.ctx.ranked.players.p0['burraco:2:solo'].games,1); assert.equal(f.ctx.ranked.players.p0['scopa:2:solo'].games,1);
  f.fail(true); const before=JSON.stringify(f.ctx.ranked); assert.throws(()=>restarted.record(f.match(['p0','p1'],'burraco:2:solo','fail')),/disco pieno/); assert.equal(JSON.stringify(f.ctx.ranked),before);
});
test('formato Solo/Duo, consenso e abbinamento 2v2', () => {
  const f=fixture(); assert.throws(()=>f.ranked.join('p0',{game:'scala40',n:4,queue:'duo'}));
  f.ranked.join('p0',{game:'burraco',n:4,queue:'duo',friend:'Player1'}); assert.equal(f.ctx.rooms.size,0); assert.equal(f.ranked.queue.size,0);
  const id=[...f.ranked.invites.keys()][0]; assert.throws(()=>f.ranked.accept('p2',id)); f.ranked.accept('p1',id);
  f.ranked.join('p2',{game:'burraco',n:4,queue:'duo',friend:'Player3'}); f.ranked.accept('p3',[...f.ranked.invites.keys()][0]);
  const room=[...f.ctx.rooms.values()][0]; assert.deepEqual(room.rankedMatch.tokens,['p0','p2','p1','p3']); assert.equal(f.ranked.queue.size,0);
});
test('Solo non incontra Duo; annullamento e disconnessione puliscono entrambi', () => {
  const f=fixture(); f.ranked.join('p0',{game:'burraco',n:4,queue:'solo'}); f.ranked.join('p1',{game:'burraco',n:4,queue:'solo'});
  f.ranked.join('p2',{game:'burraco',n:4,queue:'duo',friend:'Player3'}); f.ranked.accept('p3',[...f.ranked.invites.keys()][0]); assert.equal(f.ctx.rooms.size,0);
  f.sockets[2].offline=true; f.ranked.tick(); assert.equal(f.ranked.queue.size,2);
  f.ranked.cancel('p0'); assert.equal(f.ranked.queue.size,1);
});
test('matchmaking progressivo e limite compagni', () => {
  const f=fixture(); const key='scopa:2:solo'; f.ranked.profile('p1',key).rating=1700;
  f.ranked.join('p0',{game:'scopa',n:2}); f.ranked.join('p1',{game:'scopa',n:2}); assert.equal(f.ctx.rooms.size,0);
  f.advance(60000); f.ranked.tick(); assert.equal(f.ctx.rooms.size,1);
  const d=fixture(); d.ranked.profile('p1','burraco:4:duo').rating=2200;
  d.ranked.join('p0',{game:'burraco',n:4,queue:'duo',friend:'Player1'}); assert.throws(()=>d.ranked.accept('p1',[...d.ranked.invites.keys()][0]),/Differenza/);
});
test('Leggenda: cap 1%, abilità minima, esclusioni e retrocessione', () => {
  const f=fixture(205), key='scopa:2:solo';
  for(let i=0;i<205;i++) Object.assign(f.ranked.profile('p'+i,key),{games:30,rating:2800-i});
  f.ctx.sessions.get('p0').suspended=true; f.ranked.profile('p1',key).games=29; f.ranked.profile('p2',key).lastAt=now0-31*R.DAY;
  f.ranked.legends(true); assert.equal(f.ctx.ranked.legends[key].eligible,202);
  assert.equal(Object.values(f.ctx.ranked.players).filter(x=>x[key].legend).length,2); assert.ok(f.ranked.profile('p3',key).legend);
  f.ranked.profile('p3',key).rating=1500; f.ranked.legends(true); const p=f.ranked.profile('p3',key); assert.equal(p.legend,false); assert.equal(p.tier,7); assert.equal(p.division,3); assert.equal(p.rating,1500);
  const one=fixture(1); Object.assign(one.ranked.profile('p0',key),{games:30,rating:2599}); one.ranked.legends(true); assert.equal(one.ranked.profile('p0',key).legend,false);
  one.ranked.profile('p0',key).rating=2600; one.ranked.legends(true); assert.equal(one.ranked.profile('p0',key).legend,true);
});
test('cambio stagione conserva abilità, archivia premio e chiude promozione', () => {
  const p={...R.fresh(now0),games:40,wins:20,rating:1900,tier:4,division:3,lp:100,best:1900,promo:{results:[1],target:5}};
  R.rollover(p,now0+90*R.DAY); assert.equal(p.rating,1900); assert.equal(p.games,0); assert.equal(p.promo,null); assert.equal(p.seasons.length,1); assert.equal(p.rewards.length,1);
  R.rollover(p,now0+90*R.DAY); assert.equal(p.seasons.length,1);
});
test('nessun punto CPU/localResult; abbandono e protezione rematch', () => {
  const f=fixture(), room=f.match(); room.localGame=true; assert.equal(f.ranked.record(room),null);
  room.localGame=false; room.rankedMatch.abandoned=['p1']; f.ranked.record(room);
  assert.equal(f.ranked.profile('p1','burraco:2:solo').losses,1); assert.throws(()=>f.ranked.join('p1',{game:'burraco',n:2}),/Pausa/);
  const entries=['p0','p1'].map(t=>({...f.ranked.format({game:'burraco',n:2}),tokens:[t],at:now0})); assert.equal(f.ranked.arrangement(entries),null);
  f.advance(16*60000); f.ranked.profile('p0','burraco:2:solo').rating=1500; f.ranked.profile('p1','burraco:2:solo').rating=1500; assert.ok(f.ranked.arrangement(entries));
});
test('archivio SQLite/JSON preserva Ranked e vecchie statistiche', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'smazzata-ranked-')); const f=fixture(); f.ranked.record(f.match());
  const store=openStore(dir); store.save({ranked:f.ctx.ranked,leaderboard:[['legacy',{byGame:{burraco:{elo:1234}}}]],savedAt:now0});
  const restored=openStore(dir).load(); assert.equal(restored.ranked.players.p0['burraco:2:solo'].games,1); assert.equal(restored.leaderboard[0][1].byGame.burraco.elo,1234);
});
test('Campione I completato non è Leggenda e non avvia BO3', () => {
  const p={...R.fresh(now0),games:40,tier:7,division:3,lp:99,rating:2800};R.progress(p,1);
  assert.equal(p.lp,100);assert.equal(p.promo,null);assert.equal(p.legend,false);assert.equal(p.best,3199);
  R.rollover(p,now0+90*R.DAY);assert.ok(p.rewards[0].endsWith('-7'));
});
test('promo isolata: una partita Duo non modifica la Solo', () => {
  const f=fixture();const p=f.ranked.profile('p0','burraco:2:solo');Object.assign(p,{games:20,promo:{results:[1],target:1},division:3,lp:100});
  f.ranked.record(f.match(['p0','p1'],'burraco:4:duo'));
  assert.deepEqual(f.ranked.profile('p0','burraco:2:solo').promo.results,[1]);
});
test('varianti: Scopa/Scopone e Burraco/Reale non condividono il rating', () => {
  const f=fixture();assert.notEqual(f.ranked.format({game:'scopa',n:4}).key,f.ranked.format({game:'scopone',n:4}).key);
  for(const game of ['reale','aberto','fechado']){const v=f.ranked.format({game,n:4,queue:'duo'});assert.equal(v.key,game+':4:duo');assert.notDeepEqual(v.rules,f.ranked.format({game:'burraco',n:4}).rules);}
});
test('disconnessione: riconnessione entro grazia, poi resa autorevole', () => {
  const f=fixture();f.ranked.join('p0',{game:'scopa',n:2});f.ranked.join('p1',{game:'scopa',n:2});
  const room=[...f.ctx.rooms.values()][0];f.sockets[0].offline=true;f.ranked.tick();f.advance(100000);f.sockets[0].offline=false;f.ranked.tick();assert.equal(room.game.over,false);
  f.sockets[0].offline=true;f.ranked.tick();f.advance(121000);f.ranked.tick();assert.equal(room.game.over,true);assert.equal(f.ranked.profile('p0','scopa:2:solo').losses,1);
});
test('pareggio: Glicko aggiornato, BO3 non consumata', () => {
  const f=fixture();Object.assign(f.ranked.profile('p0','burraco:2:solo'),{games:20,promo:{results:[1],target:1},tier:0,division:3,lp:100});
  const room=f.match();room.game.winners=[0,1];f.ranked.record(room);
  const p=f.ranked.profile('p0','burraco:2:solo');assert.equal(p.draws,1);assert.deepEqual(p.promo.results,[1]);assert.ok(p.rd<350);
});
test('Leggenda: pari merito deterministico e frequenza giornaliera', () => {
  const f=fixture(3),key='scopa:2:solo';for(let i=0;i<3;i++)Object.assign(f.ranked.profile('p'+i,key),{games:30,rating:2700});
  f.ranked.legends(true);assert.equal(f.ranked.profile('p0',key).legend,true);f.ranked.profile('p1',key).rating=3000;f.ranked.legends();assert.equal(f.ranked.profile('p0',key).legend,true);
  f.advance(R.DAY);f.ranked.legends();assert.equal(f.ranked.profile('p1',key).legend,true);
});
test('Solo 2v2 sceglie coppie bilanciate per rating', () => {
  const f=fixture(),key='burraco:4:solo';[1300,1400,1600,1700].forEach((rating,i)=>{f.ranked.profile('p'+i,key).rating=rating;});
  const entries=[0,1,2,3].map(i=>({...f.ranked.format({game:'burraco',n:4}),tokens:['p'+i],at:now0}));
  const order=f.ranked.arrangement(entries);assert.ok(order);const val=t=>f.ranked.profile(t,key).rating;assert.equal(val(order[0])+val(order[2]),val(order[1])+val(order[3]));
});
test('classifica passata conserva la stagione senza alterare la corrente', () => {
  const f=fixture();f.ranked.record(f.match());f.advance(90*R.DAY);
  const current=f.ranked.board('p0',{game:'burraco',n:2});assert.equal(current.mine.games,0);assert.equal(current.currentSeason,1);
  const past=f.ranked.board('p0',{game:'burraco',n:2,season:0});assert.equal(past.archived,true);assert.equal(past.mine.games,1);assert.equal(past.list.length,2);
  assert.equal(f.ranked.profile('p0','burraco:2:solo').games,0);
});
test('la soglia della promo non assegna già il miglior rank successivo', () => {
  const p={...R.fresh(now0),games:20,tier:0,division:3,lp:99,rating:1700};R.progress(p,1);assert.equal(p.best,399);R.progress(p,1);R.progress(p,1);assert.equal(p.best,400);
});
test('risultato riprovato dopo errore del disco senza duplicati', () => {
  const f=fixture();const room=f.match();f.ctx.rooms.set('test',room);f.fail(true);assert.throws(()=>f.ranked.record(room));f.fail(false);f.ranked.tick();f.ranked.tick();assert.equal(f.ranked.profile('p0','burraco:2:solo').games,1);
});
test('timer scaduto offline si riarma alla riconnessione', () => {
  const ctx=require('./contesto'), previous=ctx.isConnected;
  require('./turni');
  const Games=require('./games'), rules=Games.publicRules('briscola',2);
  const room={rules,game:Games.of(rules).E.createGame({rules,players:[{name:'A'},{name:'B'}]}),seats:[{token:'a'},{token:'b'}],rankedMatch:{},turnTime:60,turnCounter:0};
  try {
    ctx.isConnected=()=>false;room.timerKey=ctx.turnTimerKey(room);ctx.autoPlay(room,room.timerKey);
    assert.equal(room.game.over,false);assert.equal(room.timerKey,null);
    ctx.isConnected=()=>true;ctx.scheduleTurnTimer(room);assert.ok(room.turnTimerHandle);assert.ok(room.turnDeadline>Date.now());
  } finally {clearTimeout(room.turnTimerHandle);ctx.isConnected=previous;}
});
