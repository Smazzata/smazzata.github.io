'use strict';
// Sala di preparazione Duo: non è un match e non assegna punti o penalità.
const crypto = require('crypto');
const E = require('./engine');
module.exports = function createParty({ ctx, clock, checked, format, enter, cancel, queue, emit }) {
  const parties = new Map();
  const find = token => [...parties.values()].find(p => p.tokens.includes(token));
  const searching = p => [...queue.values()].some(e => e.tokens.includes(p.tokens[0]));
  const view = (p, token) => p ? { id:p.id, game:p.game, host:p.tokens[0]===token, searching:searching(p),
    members:p.tokens.map(t => ({ name:ctx.sessions.get(t)?.nick || '', me:t===token, online:ctx.isConnected(t), ready:p.ready.has(t) })),
    invited:p.invite ? ctx.sessions.get(p.invite.token)?.nick : null } : null;
  const notify = p => p.tokens.forEach(t => emit(t, 'rankedParty', view(p,t)));
  function reset(token) { const p=find(token); if(p) { cancel(token); p.ready.clear(); notify(p); } }
  function leave(token) {
    const p=find(token); if(!p) return;
    cancel(token); p.ready.clear(); p.invite=null;
    if(p.tokens[0]===token) { parties.delete(p.id); p.tokens.forEach(t=>emit(t,'rankedParty',null)); }
    else { p.tokens=p.tokens.filter(t=>t!==token); emit(token,'rankedParty',null); notify(p); }
  }
  function create(token, game) {
    checked(token); const f=format({game,n:4,queue:'duo'});
    leave(token); cancel(token);
    for(const s of ctx.socketsOf(token)) if(s.data.room) ctx.leaveRoom(s);
    const p={...f,id:crypto.randomUUID(),tokens:[token],ready:new Set(),invite:null,absent:{}};
    parties.set(p.id,p); notify(p); return {party:view(p,token)};
  }
  function invite(token, nick) {
    const p=find(token);
    if(!p || p.tokens[0]!==token || p.tokens.length!==1 || searching(p)) throw new E.GameError('Invito Ranked non disponibile');
    const friend=[...ctx.sessions].find(([t,s])=>(ctx.sessions.get(token).friends||[]).includes(t)&&s.nick===nick);
    if(!friend || !ctx.isConnected(friend[0])) throw new E.GameError('Scegli un amico online');
    checked(friend[0]);
    p.invite={token:friend[0],expires:clock()+60000};
    emit(friend[0],'rankedPartyInvite',{id:p.id,from:ctx.sessions.get(token).nick,game:p.game}); notify(p); return {};
  }
  function accept(token,id) {
    const p=parties.get(id);
    if(!p || p.tokens.length!==1 || p.invite?.token!==token || p.invite.expires<clock() || !ctx.isConnected(p.tokens[0])) throw new E.GameError('Invito Ranked scaduto');
    checked(token); checked(p.tokens[0]);
    leave(token); cancel(token);
    for(const s of ctx.socketsOf(token)) if(s.data.room) ctx.leaveRoom(s);
    p.tokens.push(token); p.invite=null; p.ready.clear(); notify(p); return {party:view(p,token)};
  }
  function ready(token) {
    const p=find(token); if(!p || p.tokens.length!==2) throw new E.GameError('Attendi il tuo compagno');
    if(searching(p)) { reset(token); return {}; }
    p.tokens.forEach(checked);
    if(p.tokens.some(t=>!ctx.isConnected(t))) throw new E.GameError('Entrambi i giocatori devono essere online');
    if(p.ready.has(token)) p.ready.delete(token); else p.ready.add(token);
    if(p.ready.size===2) {
      try { enter(p.tokens,p); } catch(e) { p.ready.clear(); notify(p); throw e; }
    }
    if(parties.has(p.id)) notify(p); return {};
  }
  function matched(tokens) {
    for(const p of parties.values()) if(p.tokens.some(t=>tokens.includes(t))) { parties.delete(p.id); p.tokens.forEach(t=>emit(t,'rankedParty',null)); }
  }
  function tick() {
    for(const p of parties.values()) {
      let changed=false;
      if(p.invite && p.invite.expires<clock()) {p.invite=null;changed=true;}
      for(const t of [...p.tokens]) {
        if(ctx.isConnected(t)) {if(p.absent[t]) {delete p.absent[t];changed=true;}}
        else if(!p.absent[t]) {p.absent[t]=clock();cancel(t);p.ready.clear();changed=true;}
        else if(clock()-p.absent[t]>120000) leave(t);
      }
      if(changed && parties.has(p.id)) notify(p);
    }
  }
  return {create,invite,accept,ready,leave,reset,tick,matched,mine:token=>view(find(token),token),parties};
};
