'use strict';
// Consegne amministrative: una transazione per invio, ricevute persistenti per profilo.
const Chests=require('./chests'),Avatars=require('../shared/avatars'),Cosmetics=require('../shared/cosmetics');
const {GameError}=require('./engine');
const fail=m=>{throw new GameError(m);};
const date=s=>[s.registeredAt,s.terms].find(n=>Number.isFinite(n)&&n>0&&n<=8.64e15)||null;
const catalog=()=>[...Avatars.LIST.map(x=>({...x,kind:'avatar'})),...Cosmetics.LIST];
const CHEST_TYPES=Object.keys(Chests.RULES.types),MAX_CHESTS=100,MAX_ITEMS=50,MAX_COINS=100000;
// Più premi nello stesso invio: chest per tipo, monete e oggetti distinti. Il vecchio campo gift resta valido.
function parseGifts(input){
  const gifts=[],items=new Set();
  const list=v=>(Array.isArray(v)?v:[v]).flatMap(x=>String(x??'').split(/[\s,;]+/)).filter(Boolean);
  // Dati già normalizzati (benvenuto, bozze interne): si ricontrollano con le stesse regole.
  if(Array.isArray(input.gifts)){
    const again={};for(const g of input.gifts){
      if(g?.kind==='chest'&&CHEST_TYPES.includes(g.type))again['chest_'+g.type]=(again['chest_'+g.type]||0)+g.qty;
      else if(g?.kind==='coins')again.coins=(again.coins||0)+g.coins;
      else if(g?.kind==='item')again.items=[...(again.items||[]),String(g.id)];
      else fail('Regalo non valido');
    }
    return parseGifts(again);
  }
  const legacy=String(input.gift||'');
  if(legacy&&Object.hasOwn(Chests.RULES.types,legacy))input={...input,['chest_'+legacy]:Number(input['chest_'+legacy]||0)+1};
  else if(legacy)items.add(legacy);
  let chests=0;
  for(const type of CHEST_TYPES){
    const raw=input['chest_'+type],qty=raw===undefined||raw===''?0:Number(raw);
    if(!Number.isSafeInteger(qty)||qty<0||qty>MAX_CHESTS)fail('Quantità di chest non valida');
    if(qty){gifts.push({kind:'chest',type,qty});chests+=qty;}
  }
  if(chests>MAX_CHESTS)fail('Al massimo '+MAX_CHESTS+' chest per invio');
  const coins=input.coins===undefined||input.coins===''?0:Number(input.coins);
  if(!Number.isSafeInteger(coins)||coins<0||coins>MAX_COINS)fail('Monete: da 0 a '+MAX_COINS);
  if(coins)gifts.push({kind:'coins',coins});
  for(const id of list(input.items))items.add(id);
  if(items.size>MAX_ITEMS)fail('Al massimo '+MAX_ITEMS+' oggetti per invio');
  const all=catalog();
  for(const id of items){if(!all.some(x=>x.id===id))fail('Regalo non valido');gifts.push({kind:'item',id});}
  return gifts;
}
// Vecchi invii e vecchio benvenuto salvato hanno soltanto gift.
const giftsOf=p=>Array.isArray(p.gifts)?p.gifts:p.gift?parseGifts({gift:p.gift}):[];
const giftKey=p=>giftsOf(p).map(g=>g.kind==='chest'?'chest:'+g.type+'*'+g.qty:g.kind==='coins'?'coins:'+g.coins:'item:'+g.id).sort().join('|');
function describe(p){
  const all=catalog();
  return giftsOf(p).map(g=>g.kind==='chest'?(g.qty>1?g.qty+' × ':'')+Chests.RULES.types[g.type].name:g.kind==='coins'?g.coins+' monete':all.find(x=>x.id===g.id)?.name||g.id);
}
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
  const gifts=parseGifts(input);
  const campaignKey=String(input.campaignKey||'').trim().toLowerCase();
  if(campaignKey&&!/^[a-z0-9][a-z0-9-]{2,63}$/.test(campaignKey))fail('Codice campagna: da 3 a 64 lettere minuscole, numeri o trattini');
  return {title,body,mode,nicks:mode==='selected'?nicks:[],from:mode==='dates'?from:'',before:mode==='dates'?before:'',gifts,campaignKey,push:input.push===true||input.push==='on'};
}
const eligible=(s,p)=>!p.campaignKey||!(s.campaignReceipts||[]).includes(p.campaignKey);
function checkCampaign(ctx,p){const previous=(ctx.deliveries||[]).find(x=>x.campaignKey===p.campaignKey&&p.campaignKey);if(previous&&giftKey(previous)!==giftKey(p))fail('Questo codice campagna identifica già un regalo diverso. Scegli un codice nuovo.');}
function recipients(sessions,p){
  const rows=[...sessions].filter(([,s])=>s.nick);
  if(p.mode==='selected')for(const n of p.nicks)if(!rows.some(([,s])=>s.nick.toLowerCase()===n))fail('Nickname non trovato: '+n);
  return rows.filter(([,s])=>eligible(s,p)&&(p.mode==='all'||p.mode==='selected'&&p.nicks.includes(s.nick.toLowerCase())||p.mode==='dates'&&date(s)&&(!p.from||Chests.dayOf(date(s))>=p.from)&&(!p.before||Chests.dayOf(date(s))<p.before))).map(([token,s])=>({token,nick:s.nick}));
}
function deliver(ctx,id,p,targets,persist,now=Date.now()){
  const existing=(ctx.deliveries||[]).find(x=>x.id===id);
  if(existing)return {...existing,replayed:true};
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(id))fail('Invio non valido');
  checkCampaign(ctx,p);
  const before=[],log=ctx.deliveries||[],all=catalog(),gifts=giftsOf(p);
  let count=0,duplicates=0,skipped=0;
  try{
    for(const token of new Set(targets)){
      const s=ctx.sessions.get(token);if(!s?.nick)continue;
      if(!eligible(s,p)){skipped++;continue;}
      before.push([s,structuredClone(s)]);
      if((s.inbox||[]).some(x=>x.id===id))continue;
      const received=[];
      for(const g of gifts){
        if(g.kind==='chest'){
          const b=Chests.inventory(s),ids=[];
          for(let i=0;i<g.qty;i++){const chest={id:String(++b.issued),type:g.type,version:Chests.RULES.version,at:now,source:'gift'};b.items.push(chest);ids.push(chest.id);}
          s.chests=b;received.push({kind:'chest',type:g.type,id:ids[0],count:g.qty});
        }else if(g.kind==='coins'){
          const b=Chests.inventory(s);Chests.addCoins(b,g.coins);s.chests=b;received.push({kind:'coins',coins:g.coins});
        }else{
          const item=all.find(x=>x.id===g.id);if(!item)fail('Regalo non valido');
          const duplicate=(item.kind==='avatar'?Avatars.ownedIds(s):Cosmetics.ownedIds(s)).includes(item.id);
          const coins=duplicate?Chests.RULES.duplicateCoins[item.rarity]:0;
          Object.assign(s,Chests.grant(s,item));
          if(duplicate){const b=Chests.inventory(s);Chests.addCoins(b,coins);s.chests=b;duplicates++;}
          received.push({kind:item.kind,itemId:item.id,rarity:item.rarity,duplicate,coins});
        }
      }
      // gift resta per i client precedenti, che mostrano soltanto il primo premio.
      s.inbox=[...(s.inbox||[]),{id,title:p.title,body:p.body,at:now,read:false,gift:received[0]||null,gifts:received}];
      if(p.campaignKey)s.campaignReceipts=[...(s.campaignReceipts||[]),p.campaignKey];count++;
    }
    // Lo storico non conserva nickname o token: la cancellazione del profilo rimuove le sue ricevute.
    const result={id,title:p.title,at:now,count,duplicates,skipped,campaignKey:p.campaignKey||'',gifts,mode:p.mode,from:p.from,before:p.before,push:p.push};
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
module.exports={normalize,recipients,deliver,inbox,read,date,catalog,eligible,checkCampaign,giftsOf,describe,CHEST_TYPES,MAX_CHESTS,MAX_ITEMS,MAX_COINS};
