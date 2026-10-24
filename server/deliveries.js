'use strict';
// Consegne amministrative: una transazione per invio, ricevute persistenti per profilo.
const Chests=require('./chests'),Avatars=require('../shared/avatars'),Cosmetics=require('../shared/cosmetics');
const {GameError}=require('./engine');
const fail=m=>{throw new GameError(m);};
const date=s=>[s.registeredAt,s.terms].find(n=>Number.isFinite(n)&&n>0&&n<=8.64e15)||null;
const catalog=()=>[...Avatars.LIST.map(x=>({...x,kind:'avatar'})),...Cosmetics.LIST];
function normalize(input){
  const title=String(input.title||'').trim(),body=String(input.body||'').trim();
  if(!title||title.length>100||!body||body.length>2000)fail('Inserisci un titolo (massimo 100 caratteri) e un testo (massimo 2000).');
  const mode=input.mode;if(!['all','selected','dates'].includes(mode))fail('Destinatari non validi');
  const nicks=[...new Set(String(input.nicks||'').split(/[\s,;]+/).filter(Boolean).map(n=>n.toLowerCase()))];
  if(mode==='selected'&&(!nicks.length||nicks.length>500))fail('Scegli da 1 a 500 nickname');
  const from=mode==='dates'?String(input.from||''):'',before=mode==='dates'?String(input.before||''):'';
  for(const d of [from,before])if(d){
    const parsed=new Date(d+'T00:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==d)fail('Data non valida');
  }
  if(mode==='dates'&&(!from&&!before||from&&before&&from>=before))fail('Intervallo di iscrizione non valido');
  const gift=String(input.gift||'');
  if(gift&&!Object.hasOwn(Chests.RULES.types,gift)&&!catalog().some(x=>x.id===gift))fail('Regalo non valido');
  return {title,body,mode,nicks:mode==='selected'?nicks:[],from:mode==='dates'?from:'',before:mode==='dates'?before:'',gift,push:input.push===true||input.push==='on'};
}
function recipients(sessions,p){
  const rows=[...sessions].filter(([,s])=>s.nick);
  if(p.mode==='selected')for(const n of p.nicks)if(!rows.some(([,s])=>s.nick.toLowerCase()===n))fail('Nickname non trovato: '+n);
  return rows.filter(([,s])=>p.mode==='all'||p.mode==='selected'&&p.nicks.includes(s.nick.toLowerCase())||p.mode==='dates'&&date(s)&&(!p.from||Chests.dayOf(date(s))>=p.from)&&(!p.before||Chests.dayOf(date(s))<p.before)).map(([token,s])=>({token,nick:s.nick}));
}
function deliver(ctx,id,p,targets,persist,now=Date.now()){
  const existing=(ctx.deliveries||[]).find(x=>x.id===id);
  if(existing)return {...existing,replayed:true};
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(id))fail('Invio non valido');
  const before=[],log=ctx.deliveries||[],item=catalog().find(x=>x.id===p.gift);
  let count=0,duplicates=0;
  try{
    for(const token of new Set(targets)){
      const s=ctx.sessions.get(token);if(!s?.nick)continue;
      before.push([s,structuredClone(s)]);
      if((s.inbox||[]).some(x=>x.id===id))continue;
      let gift=null;
      if(Object.hasOwn(Chests.RULES.types,p.gift)){
        const b=Chests.inventory(s),chest={id:String(++b.issued),type:p.gift,version:Chests.RULES.version,at:now,source:'gift'};
        b.items.push(chest);s.chests=b;gift={kind:'chest',type:p.gift,id:chest.id};
      }else if(item){
        const duplicate=(item.kind==='avatar'?Avatars.ownedIds(s):Cosmetics.ownedIds(s)).includes(item.id);
        const fragments=duplicate?Chests.RULES.fragments[item.rarity]:0;
        Object.assign(s,Chests.grant(s,item));
        if(duplicate){const b=Chests.inventory(s);b.fragments+=fragments;s.chests=b;duplicates++;}
        gift={kind:item.kind,itemId:item.id,rarity:item.rarity,duplicate,fragments};
      }
      s.inbox=[...(s.inbox||[]),{id,title:p.title,body:p.body,at:now,read:false,gift}];count++;
    }
    // Lo storico non conserva nickname o token: la cancellazione del profilo rimuove le sue ricevute.
    const result={id,title:p.title,at:now,count,duplicates,gift:p.gift,mode:p.mode,from:p.from,before:p.before,push:p.push};
    ctx.deliveries=[...log,result];persist();return result;
  }catch(e){
    for(const [s,old] of before){for(const k of Object.keys(s))delete s[k];Object.assign(s,old);}
    ctx.deliveries=log;throw e;
  }
}
function inbox(s,offset=0){
  const all=s.inbox||[],last=Math.max(0,Math.floor((all.length-1)/20)*20);
  const start=Number.isSafeInteger(offset)&&offset>=0?Math.min(Math.floor(offset/20)*20,last):0;
  // Copia soltanto la pagina richiesta, anche per archivi molto lunghi.
  return {messages:all.slice(Math.max(0,all.length-start-20),all.length-start).reverse(),offset:start,total:all.length,unread:all.filter(x=>!x.read).length};
}
function read(s,id,persist){
  const msg=(s.inbox||[]).find(x=>x.id===id);if(!msg)fail('Messaggio non disponibile');
  if(!msg.read){msg.read=true;try{persist();}catch(e){msg.read=false;throw e;}}
  return inbox(s);
}
module.exports={normalize,recipients,deliver,inbox,read,date,catalog};
