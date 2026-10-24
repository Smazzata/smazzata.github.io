'use strict';
const crypto=require('node:crypto'),express=require('express'),D=require('./deliveries');
const C=require('./chests'),ctx=require('./contesto');
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
module.exports=function setup(app,key){
  const csrf=crypto.randomBytes(32).toString('hex'),previews=new Map();
  const url='/stato/invii?k='+encodeURIComponent(key);
  const page=(content)=>`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Posta e regali · Smazzata</title><style>
  *{box-sizing:border-box}body{font:16px system-ui;background:#f8f6ed;color:#203d30;margin:0;padding:20px;max-width:850px;margin:auto}h1,h2{font-family:Georgia}a{color:#226045}section{background:white;border:1px solid #d8dfd5;border-radius:16px;padding:20px;margin:20px 0}label{display:block;margin:14px 0}input:not([type=checkbox]),textarea,select{display:block;width:100%;padding:12px;border:1px solid #889b8d;border-radius:8px;font:inherit}textarea{min-height:110px}button{padding:12px 20px;border:0;border-radius:10px;background:#245e45;color:white;font:inherit;cursor:pointer}small{display:block;color:#596b5e;margin:8px 0}li{margin:8px 0}p,li{overflow-wrap:anywhere}.preview{white-space:pre-wrap}.notice{padding:14px;background:#fff1c9;border-radius:12px}</style></head><body><a href="/stato?k=${encodeURIComponent(key)}">← Stato del server</a><h1>Posta e regali</h1>${content}</body></html>`;
  const hidden=()=>`<input type="hidden" name="csrf" value="${csrf}">`;
  app.use('/stato/invii',(req,res,next)=>{
    res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});
    if(req.query.k!==key)return res.status(403).send('Accesso negato');next();
  });
  app.get('/stato/invii',(req,res)=>{
    const profiles=[...ctx.sessions.values()].filter(s=>s.nick),unknown=profiles.filter(s=>!D.date(s)).length;
    res.send(page(`<p>Messaggi e regali vengono conservati sul profilo anche quando il giocatore è offline. Nessun invio parte finché non confermi l’anteprima.</p>
    <section><form method="post" action="${url}">${hidden()}
    <label>Titolo<input name="title" required maxlength="100" placeholder="Un regalo di benvenuto"></label>
    <label>Messaggio<textarea name="body" required maxlength="2000" placeholder="Benvenuto su Smazzata! Il tuo regalo ti aspetta nell’inventario."></textarea></label>
    <label>Destinatari<select name="mode"><option value="selected">Uno o più utenti scelti</option><option value="dates">Iscritti in un intervallo di date</option><option value="all">Tutti gli iscritti attuali (${profiles.length})</option></select></label>
    <label>Nickname scelti (separati da virgola o a capo)<textarea name="nicks" placeholder="Mario, Anna"></textarea></label>
    <details><summary>Consulta i nickname degli iscritti</summary><p>${profiles.map(s=>esc(s.nick)).sort().join(', ')||'Nessun iscritto'}</p></details>
    <label>Iscritti dal giorno (incluso)<input type="date" name="from"></label>
    <label>Iscritti prima del giorno (escluso)<input type="date" name="before"></label>
    <small>Date nel fuso italiano. I campi data valgono solo per l’intervallo. ${unknown} profili senza una data documentata sono esclusi dai filtri per data. L’invio riguarda soltanto utenti già iscritti: non crea una regola automatica per iscrizioni future.</small>
    <label>Regalo<select name="gift"><option value="">Nessuno: solo messaggio o aggiornamento</option><optgroup label="Chest chiusa">${Object.entries(C.RULES.types).map(([id,r])=>`<option value="${id}">${r.name}</option>`).join('')}</optgroup>${['avatar',...require('../shared/cosmetics').KINDS.map(x=>x.id)].map(kind=>`<optgroup label="${esc(({avatar:'Avatar',back:'Dorsi',frame:'Cornici',felt:'Tappetini',reaction:'Reazioni',victory:'Vittorie'})[kind])}">${D.catalog().filter(x=>x.kind===kind).map(x=>`<option value="${esc(x.id)}">${esc(x.name)} · ${esc(({common:'Comune',rare:'Rara',epic:'Epica',legendary:'Leggendaria'})[x.rarity])}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <small>Una chest o un oggetto per destinatario. Le chest regalo non consumano il limite giornaliero. Gli oggetti già posseduti diventano frammenti secondo la rarità.</small>
    <label><input type="checkbox" name="push"> Richiedi anche una notifica sul telefono (solo dispositivi che le hanno abilitate)</label>
    <button>Prepara anteprima</button></form></section>
    <section><h2>Ultimi invii</h2><ul>${(ctx.deliveries||[]).slice(-30).reverse().map(x=>`<li><b>${esc(x.title)}</b> — ${x.count} destinatari · ${esc(new Date(x.at).toLocaleString('it-IT',{timeZone:'Europe/Rome'}))}<br><small>${x.duplicates} doppioni convertiti · ${x.push?'Notifica sul telefono richiesta; la consegna dipende dal dispositivo.':'Solo posta personale.'}</small></li>`).join('')||'<li>Nessun invio effettuato.</li>'}</ul></section>`));
  });
  app.post('/stato/invii',express.urlencoded({extended:false,limit:'32kb'}),(req,res)=>{
    if(req.body?.csrf!==csrf)return res.status(403).send('Pagina scaduta: riaprila dalla pagina di stato');
    try{
      for(const [id,p] of previews)if(p.expires<Date.now())previews.delete(id);
      const id=String(req.body.id||'');
      if(id){
        const old=(ctx.deliveries||[]).find(x=>x.id===id);
        if(old)return res.send(page(`<p class="notice">Invio già completato a ${old.count} utenti. Nessun regalo duplicato.</p><a href="${url}">Torna agli invii</a>`));
        const p=previews.get(id);if(!p)throw Error('Anteprima scaduta: prepara un nuovo invio.');
        const result=D.deliver(ctx,id,p.data,p.targets,()=>ctx.saveNow(true,false));previews.delete(id);
        for(const token of p.targets){
          if(!ctx.sessions.get(token)?.nick)continue;
          ctx.social.push(token);
          for(const socket of ctx.io.sockets.sockets.values())if(socket.data.token===token){socket.emit('inboxUpdated');socket.emit('chests',C.view(ctx.sessions.get(token)));}
        }
        // Le notifiche esterne sono facoltative e partono soltanto dopo il salvataggio.
        if(p.data.push)(async()=>{for(const token of p.targets)await ctx.push.send(token,{title:p.data.title,body:p.data.body.slice(0,200),tag:'delivery-'+id,url:require('./config').HOME_URL}).catch(()=>{});})().catch(()=>{});
        return res.send(page(`<h2>Invio completato</h2><p>${result.count} consegne salvate nella posta personale. ${result.duplicates} doppioni convertiti in frammenti.</p><p>${p.data.push?'Notifiche sul telefono richieste: non garantiscono la lettura del messaggio.':'Nessuna notifica esterna richiesta.'}</p><a href="${url}">Torna agli invii</a>`));
      }
      const data=D.normalize(req.body),targets=D.recipients(ctx.sessions,data);
      if(!targets.length)throw Error('Nessun destinatario corrisponde ai criteri scelti.');
      if(previews.size>=100)throw Error('Troppe anteprime aperte: attendi qualche minuto.');
      const next=crypto.randomUUID();previews.set(next,{data,targets:targets.map(x=>x.token),expires:Date.now()+15*60000});
      const gift=C.RULES.types[data.gift]?.name||D.catalog().find(x=>x.id===data.gift)?.name||'Nessun regalo';
      res.send(page(`<h2>Anteprima: ${targets.length} ${targets.length===1?'destinatario':'destinatari'}</h2><section><h3>${esc(data.title)}</h3><p class="preview">${esc(data.body)}</p><p><b>Regalo:</b> ${esc(gift)}</p><p>${data.push?'Anche notifica sul telefono, se abilitata.':'Solo posta personale.'}</p><details><summary>Elenco completo dei destinatari</summary><p>${targets.map(x=>esc(x.nick)).join(', ')}</p></details></section><p>L’elenco è fissato a questa anteprima, valida 15 minuti. I regali diventano subito disponibili nell’inventario; non possono essere ritirati da questa pagina.</p><form method="post" action="${url}">${hidden()}<input type="hidden" name="id" value="${next}"><button>Conferma invio a ${targets.length} ${targets.length===1?'utente':'utenti'}</button></form><p><a href="${url}">Annulla e torna agli invii</a></p>`));
    }catch(e){res.status(400).send(page(`<p class="notice">${esc(e.message)}</p><a href="${url}">Torna agli invii</a>`));}
  });
};
