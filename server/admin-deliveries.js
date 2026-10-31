'use strict';
const crypto=require('node:crypto'),express=require('express'),D=require('./deliveries');
const C=require('./chests'),ctx=require('./contesto'),Drafts=require('./delivery-drafts'),Welcome=require('./welcome-gifts');
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RARITY={common:'Comune',rare:'Rara',epic:'Epica',legendary:'Leggendaria'},KIND={avatar:'Avatar',back:'Dorsi',frame:'Cornici',felt:'Tappetini',reaction:'Reazioni',victory:'Vittorie'};
const CSS=`*{box-sizing:border-box}body{font:16px system-ui;background:#f4f1e6;color:#203d30;margin:0 auto;padding:16px 16px 120px;max-width:900px}h1,h2{font-family:Georgia;margin:.4em 0}h2{font-size:21px}h3{font-size:16px;margin:18px 0 8px}a{color:#226045}
section{background:#fff;border:1px solid #d8dfd5;border-radius:16px;padding:18px;margin:16px 0}label{display:block;margin:12px 0}input:not([type=checkbox]):not([type=radio]),textarea,select{display:block;width:100%;padding:11px;border:1px solid #889b8d;border-radius:8px;font:inherit;background:#fff;color:inherit}
textarea{min-height:90px}button{padding:11px 18px;border:0;border-radius:10px;background:#245e45;color:#fff;font:inherit;cursor:pointer;min-height:44px}button.light{background:#e7ede4;color:#245e45}button.mini{padding:6px 12px;min-height:38px;font-size:14px}
small{display:block;color:#596b5e;margin:6px 0}li{margin:8px 0}p,li{overflow-wrap:anywhere}.preview{white-space:pre-wrap}.notice{padding:14px;background:#fff1c9;border-radius:12px}
.step{display:flex;align-items:center;gap:10px}.step b{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#245e45;color:#fff;font:700 15px system-ui;flex:none}
.tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.tabs label{margin:0;flex:1;min-width:110px;position:relative}.tabs input{position:absolute;opacity:0}.tabs span{display:block;text-align:center;padding:10px 6px;border:1px solid #9fb1a3;border-radius:10px;cursor:pointer}.tabs input:checked+span{background:#245e45;color:#fff;border-color:#245e45}.tabs input:focus-visible+span{outline:3px solid #c29a3a}
.chips{display:flex;flex-wrap:wrap;gap:6px;max-height:180px;overflow:auto;padding:6px 0}.chips button{background:#eef2ea;color:#203d30;border:1px solid #c5d0c2;padding:5px 12px;min-height:36px;font-size:14px;border-radius:18px}.chips button[aria-pressed=true]{background:#245e45;color:#fff;border-color:#245e45}
.chests{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.chest{border:2px solid #cfd6cb;border-radius:12px;padding:10px 6px;text-align:center}.chest b{display:block;font-size:14px;margin-bottom:6px}.qty{display:flex;align-items:center;gap:4px}.qty button{padding:0;width:36px;min-height:38px;flex:none}.qty input{text-align:center;padding:7px 2px!important;min-width:0}
.chest[data-type=rare]{border-color:#65b4db}.chest[data-type=epic]{border-color:#c28be6}.chest[data-type=legendary]{border-color:#e2b23d}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.row>label{flex:1;min-width:160px}.filters{display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px}.filters input,.filters select{padding:9px!important}
.items{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;max-height:480px;overflow:auto;margin-top:10px;padding:2px}.item{margin:0;position:relative;border:1px solid #d3d9cf;border-radius:12px;padding:8px;cursor:pointer;font-size:13px;line-height:1.25}.item:has(input:checked){border:2px solid #245e45;background:#eef6ef}.item input{position:absolute;top:10px;right:10px;width:20px;height:20px}
.thumb{display:block;width:100%;aspect-ratio:1;border-radius:8px;background:#eee center/cover no-repeat;margin-bottom:6px}.item small{margin:2px 0 0;font-size:11px}.r-rare{color:#2675a0}.r-epic{color:#8143b0}.r-legendary{color:#9a6c06}
.bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid #cdd6ca;box-shadow:0 -4px 14px #0001;padding:10px 16px}.bar>div{max-width:900px;margin:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.bar .sum{flex:1;min-width:200px;font-size:14px}
details>summary{cursor:pointer;font-weight:700;padding:8px 0}[hidden]{display:none!important}.gifts{margin:6px 0;padding-left:20px}
@media(max-width:600px){.items{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.item{padding:6px;font-size:12px}.item input{top:8px;right:8px}.bar .sum{flex-basis:100%}.bar button{flex:1}.chests{grid-template-columns:repeat(2,minmax(0,1fr))}.filters{grid-template-columns:1fr 1fr}.filters input{grid-column:1/-1}}`;
// Gira nel browser della pagina di stato: riepilogo, filtri e scorciatoie, senza dipendenze.
function adminScript(MAX_CHESTS,MAX_COINS){
  const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],form=$('#send');
  const nicks=()=>$('#nicks').value.split(/[\s,;]+/).filter(Boolean);
  function filter(){
    const q=$('#itemSearch').value.trim().toLowerCase(),k=$('#kindFilter').value,r=$('#rarityFilter').value;
    $$('.item').forEach(el=>el.hidden=!!(q&&!el.dataset.name.includes(q)||k==='selected'&&!el.querySelector('input').checked||k&&k!=='selected'&&el.dataset.kind!==k||r&&el.dataset.rarity!==r));
    const s=$('#nickSearch')?.value.trim().toLowerCase()||'';$$('#nickChips [data-nick]').forEach(b=>b.hidden=!!s&&!b.dataset.nick.toLowerCase().includes(s));
  }
  function sync(){
    const m=form.mode.value;$$('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==m);
    const set=new Set(nicks().map(n=>n.toLowerCase()));$$('#nickChips [data-nick]').forEach(b=>b.setAttribute('aria-pressed',set.has(b.dataset.nick.toLowerCase())));
    const parts=[];let chests=0;$$('.chest input').forEach(i=>chests+=Number(i.value)||0);if(chests)parts.push(chests+' chest');
    const coins=Number($('#coins').value)||0;if(coins)parts.push(coins+' monete');
    const items=$$('.item input:checked').length;if(items)parts.push(items+(items===1?' oggetto':' oggetti'));
    $('#itemCount').textContent=items?'· '+items+' selezionati':'';
    const n=nicks().length,who=m==='all'?'tutti gli iscritti':m==='dates'?'iscritti nel periodo':n?n+(n===1?' utente':' utenti'):'nessun utente scelto';
    $('#summary').textContent=(parts.join(' + ')||'Solo messaggio')+' → '+who;filter();
  }
  form.addEventListener('input',sync);form.addEventListener('change',sync);
  form.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.nick){const list=nicks(),i=list.findIndex(n=>n.toLowerCase()===b.dataset.nick.toLowerCase());if(i>=0)list.splice(i,1);else list.push(b.dataset.nick);$('#nicks').value=list.join(', ');}
    else if(b.dataset.step){const i=b.parentNode.querySelector('input');i.value=Math.max(0,Math.min(MAX_CHESTS,(Number(i.value)||0)+Number(b.dataset.step)));}
    else if(b.dataset.coins){const i=$('#coins');i.value=Math.min(MAX_COINS,(Number(i.value)||0)+Number(b.dataset.coins));}
    else if(b.dataset.preset==='each')$$('.chest input').forEach(i=>i.value=Math.max(1,Number(i.value)||0));
    else if(b.dataset.preset==='clear'){$$('.chest input').forEach(i=>i.value=0);$('#coins').value='';$$('.item input').forEach(i=>i.checked=false);}
    else return;
    sync();
  });
  sync();
}
module.exports=function setup(app,key){
  const csrf=crypto.randomBytes(32).toString('hex'),previews=new Map();
  const url='/stato/invii?k='+encodeURIComponent(key);
  const page=(content,script='')=>`<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Posta e regali · Smazzata</title><style>${CSS}</style></head><body><a href="/stato?k=${encodeURIComponent(key)}">← Stato del server</a><h1>Posta e regali</h1>${content}${script?`<script>${script}</script>`:''}</body></html>`;
  const hidden=()=>`<input type="hidden" name="csrf" value="${csrf}">`;
  const giftList=p=>{const g=D.describe(p);return g.length?`<ul class="gifts">${g.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p>Nessun regalo: solo messaggio.</p>';};
  app.use('/stato/invii',(req,res,next)=>{
    res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY'});
    if(req.query.k!==key)return res.status(403).send('Accesso negato');next();
  });
  app.get('/stato/invii',(req,res)=>{
    const profiles=[...ctx.sessions.values()].filter(s=>s.nick),unknown=profiles.filter(s=>!D.date(s)).length;
    const draft=(ctx.deliveryDrafts||[]).find(x=>x.id===req.query.draft),f=draft?.fields||{},w=ctx.welcomeCampaign;
    // Le bozze precedenti hanno un solo regalo nel campo gift.
    const legacy=f.gift||'',qty=t=>Number(f['chest_'+t]||0)+(legacy===t?1:0);
    const chosen=new Set(String(f.items||'').split(',').filter(Boolean).concat(legacy&&!D.CHEST_TYPES.includes(legacy)?[legacy]:[]));
    const mode=f.mode||'selected',nickList=profiles.map(s=>s.nick).sort((a,b)=>a.localeCompare(b,'it'));
    const items=D.catalog().map(x=>{
      const thumb=x.art?`background-image:url('/${esc(x.art)}')`:`background:linear-gradient(135deg,${esc(x.colors?.[0]||'#ccc')},${esc(x.colors?.[1]||'#eee')})`;
      return `<label class="item" data-kind="${x.kind}" data-rarity="${x.rarity}" data-name="${esc(x.name.toLowerCase())}"><input type="checkbox" name="items" value="${esc(x.id)}" ${chosen.has(x.id)?'checked':''}><span class="thumb" style="${thumb}"></span><b>${esc(x.name)}</b><small>${KIND[x.kind]} · <span class="r-${x.rarity}">${RARITY[x.rarity]}</span></small></label>`;
    }).join('');
    res.send(page(`<p>Messaggi e regali restano sul profilo anche quando il giocatore è offline. Nessun invio parte finché non confermi l’anteprima.</p>
    <form method="post" action="${url}" id="send">${hidden()}<input type="hidden" name="draftId" value="${esc(draft?.id||'')}">
    <section><h2 class="step"><b>1</b>A chi</h2>
      <div class="tabs" role="radiogroup" aria-label="Destinatari">${[['selected','Utenti scelti'],['dates','Per iscrizione'],['all',`Tutti (${profiles.length})`]].map(([v,l])=>`<label><input type="radio" name="mode" value="${v}" ${mode===v?'checked':''}><span>${l}</span></label>`).join('')}</div>
      <div data-panel="selected"><label>Nickname (separati da virgola o a capo)<textarea name="nicks" id="nicks" placeholder="Mario, Anna">${esc(f.nicks||'')}</textarea></label>
        <input type="search" id="nickSearch" placeholder="Cerca un iscritto (${profiles.length})" aria-label="Cerca iscritti">
        <div class="chips" id="nickChips">${nickList.map(n=>`<button type="button" data-nick="${esc(n)}" aria-pressed="false">${esc(n)}</button>`).join('')||'<small>Nessun iscritto</small>'}</div></div>
      <div data-panel="dates"><div class="row"><label>Iscritti dal giorno (incluso)<input type="date" name="from" value="${esc(f.from||'')}"></label><label>Prima del giorno (escluso)<input type="date" name="before" value="${esc(f.before||'')}"></label></div>
        <small>Fuso italiano. ${unknown} profili senza data documentata sono esclusi.</small></div>
      <div data-panel="all"><small>Tutti gli iscritti attuali. Per le iscrizioni future usa «Benvenuto automatico» nelle altre opzioni del messaggio.</small></div>
    </section>
    <section><h2 class="step"><b>2</b>Regali</h2><small>Puoi combinare più chest, monete e oggetti: ogni destinatario li riceve tutti nello stesso messaggio. Le chest regalo non consumano il limite giornaliero; gli oggetti già posseduti diventano monete.</small>
      <div class="row" style="margin:10px 0"><button type="button" class="light mini" data-preset="each">Una chest per tipo</button><button type="button" class="light mini" data-preset="clear">Azzera regali</button></div>
      <h3>Chest</h3><div class="chests">${D.CHEST_TYPES.map(t=>`<div class="chest" data-type="${t}"><b>${esc(C.RULES.types[t].name)}</b><div class="qty"><button type="button" data-step="-1" aria-label="Una ${esc(C.RULES.types[t].name.toLowerCase())} in meno">−</button><input type="number" name="chest_${t}" min="0" max="${D.MAX_CHESTS}" value="${qty(t)}" inputmode="numeric" aria-label="${esc(C.RULES.types[t].name)}"><button type="button" data-step="1" aria-label="Una ${esc(C.RULES.types[t].name.toLowerCase())} in più">+</button></div></div>`).join('')}</div>
      <h3>Monete</h3><div class="row"><input type="number" name="coins" id="coins" min="0" max="${D.MAX_COINS}" value="${esc(f.coins||'')}" placeholder="0" inputmode="numeric" style="max-width:150px" aria-label="Monete">${[100,500,1000,5000].map(n=>`<button type="button" class="light mini" data-coins="${n}">+${n}</button>`).join('')}</div>
      <h3>Oggetti <span id="itemCount" style="font-weight:400;color:#596b5e"></span></h3>
      <div class="filters"><input type="search" id="itemSearch" placeholder="Cerca per nome" aria-label="Cerca oggetti"><select id="kindFilter" aria-label="Tipo di oggetto"><option value="">Tutti i tipi</option><option value="selected">Solo selezionati</option>${Object.entries(KIND).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select><select id="rarityFilter" aria-label="Rarità"><option value="">Tutte le rarità</option>${Object.entries(RARITY).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></div>
      <div class="items" id="items">${items}</div>
    </section>
    <section><h2 class="step"><b>3</b>Messaggio</h2>
      <label>Titolo<input name="title" required maxlength="100" value="${esc(draft?f.title:'Un regalo per te')}"></label>
      <label>Testo<textarea name="body" required maxlength="2000">${esc(draft?f.body:'Il tuo regalo ti aspetta nell’inventario. Buon divertimento su Smazzata!')}</textarea></label>
      <details><summary>Altre opzioni</summary>
        <label>Codice campagna (facoltativo)<input name="campaignKey" maxlength="64" value="${esc(f.campaignKey||'')}" placeholder="benvenuto-2026"></label><small>Con lo stesso codice ogni profilo riceve questi regali una sola volta, anche con invii diversi. Regali diversi richiedono un codice nuovo. Lascialo vuoto per invii ripetibili.</small>
        <label><input type="checkbox" name="push" ${f.push==='on'?'checked':''}> Notifica anche sul telefono (solo dispositivi che l’hanno abilitata)</label>
        <p><button name="action" value="welcome" formnovalidate class="light">Usa come benvenuto automatico</button></p><small>Il benvenuto vale solo per le iscrizioni future e richiede un codice campagna e almeno un regalo.</small>
      </details>
    </section>
    <div class="bar"><div><span class="sum" id="summary" aria-live="polite"></span><button name="action" value="draft" formnovalidate class="light">Salva bozza</button><button>Anteprima</button></div></div>
    </form>
    <section><h2>Benvenuto automatico</h2>${w?.enabled?`<p>Attivo: <b>${esc(w.title)}</b> · campagna ${esc(w.campaignKey)}. Solo iscrizioni successive all’attivazione; una volta per profilo.</p>${giftList(w)}<form method="post" action="${url}">${hidden()}<button name="action" value="disableWelcome" class="light">Disattiva benvenuto</button></form>`:'<p>Disattivato.</p>'}</section>
    <section><h2>Bozze salvate</h2><ul>${(ctx.deliveryDrafts||[]).slice().reverse().map(x=>`<li class="row"><a href="${url}&draft=${encodeURIComponent(x.id)}" style="flex:1">${esc(x.fields.title||'Senza titolo')}</a><form method="post" action="${url}">${hidden()}<input type="hidden" name="draftId" value="${esc(x.id)}"><button name="action" value="deleteDraft" class="light mini">Elimina</button></form></li>`).join('')||'<li>Nessuna bozza.</li>'}</ul></section>
    <section><h2>Ultimi invii</h2><ul>${(ctx.deliveries||[]).slice(-30).reverse().map(x=>`<li><b>${esc(x.title)}</b> — ${x.count} destinatari · ${esc(new Date(x.at).toLocaleString('it-IT',{timeZone:'Europe/Rome'}))}<br><small>${esc(D.describe(x).join(', ')||'Solo messaggio')} · ${x.duplicates} doppioni convertiti · ${esc(x.campaignKey||'Invio singolo')}${x.push?' · notifica richiesta':''}</small></li>`).join('')||'<li>Nessun invio effettuato.</li>'}</ul></section>`,
    `(${adminScript})(${D.MAX_CHESTS},${D.MAX_COINS});`));
  });
  app.post('/stato/invii',express.urlencoded({extended:false,limit:'32kb'}),(req,res)=>{
    if(req.body?.csrf!==csrf)return res.status(403).send('Pagina scaduta: riaprila dalla pagina di stato');
    try{
      if(req.body.action==='draft'){const id=Drafts.save(ctx,req.body,()=>ctx.saveNow(true,false));return res.redirect(303,url+'&draft='+encodeURIComponent(id));}
      if(req.body.action==='deleteDraft'){Drafts.remove(ctx,req.body.draftId,()=>ctx.saveNow(true,false));return res.redirect(303,url);}
      if(req.body.action==='disableWelcome'){Welcome.disable(ctx,()=>ctx.saveNow(true,false));return res.redirect(303,url);}
      for(const [id,p] of previews)if(p.expires<Date.now())previews.delete(id);
      const id=String(req.body.id||'');
      if(id){
        if(ctx.welcomeCampaign?.confirmationId===id)return res.send(page(`<p>Benvenuto già configurato. Nessuna modifica ripetuta.</p><a href="${url}">Controlla lo stato del benvenuto</a>`));
        const old=(ctx.deliveries||[]).find(x=>x.id===id);
        if(old)return res.send(page(`<p class="notice">Invio già completato a ${old.count} utenti. Nessun regalo duplicato.</p><a href="${url}">Torna agli invii</a>`));
        const p=previews.get(id);if(!p)throw Error('Anteprima scaduta: prepara un nuovo invio.');
        if(p.welcome){Welcome.configure(ctx,p.data,()=>ctx.saveNow(true,false),Date.now(),id);previews.delete(id);return res.send(page(`<h2>Benvenuto automatico attivato</h2><p>Solo i nuovi iscritti riceveranno questi regali, una volta per profilo.</p><a href="${url}">Torna agli invii</a>`));}
        const result=D.deliver(ctx,id,p.data,p.targets,()=>ctx.saveNow(true,false));previews.delete(id);
        for(const token of p.targets){
          if(!ctx.sessions.get(token)?.inbox?.some(m=>m.id===id))continue;
          ctx.social.push(token);
          for(const socket of ctx.io.sockets.sockets.values())if(socket.data.token===token){socket.emit('inboxUpdated');socket.emit('chests',C.view(ctx.sessions.get(token)));}
        }
        // Le notifiche esterne sono facoltative e partono soltanto dopo il salvataggio.
        if(p.data.push)(async()=>{for(const token of p.targets)if(ctx.sessions.get(token)?.inbox?.some(m=>m.id===id))await ctx.push.send(token,{title:p.data.title,body:p.data.body.slice(0,200),tag:'delivery-'+id,url:require('./config').HOME_URL}).catch(()=>{});})().catch(()=>{});
        return res.send(page(`<h2>Invio completato</h2><p>${result.count} consegne salvate nella posta personale. ${result.duplicates} doppioni convertiti in monete. ${result.skipped||0} destinatari avevano già ricevuto questa campagna.</p>${giftList(p.data)}<p>${p.data.push?'Notifiche sul telefono richieste: non garantiscono la lettura del messaggio.':'Nessuna notifica esterna richiesta.'}</p><a href="${url}">Torna agli invii</a>`));
      }
      const welcome=req.body.action==='welcome';
      const data=D.normalize(welcome?{...req.body,mode:'all',push:false}:req.body);D.checkCampaign(ctx,data);
      if(welcome){
        if(previews.size>=100)throw Error('Troppe anteprime aperte: attendi qualche minuto.');
        if(!data.campaignKey||!data.gifts.length)throw Error('Il benvenuto richiede codice campagna e almeno un regalo.');
        const id=crypto.randomUUID();previews.set(id,{welcome:true,data,expires:Date.now()+15*60000});
        return res.send(page(`<h2>Anteprima benvenuto automatico</h2><section><h3>${esc(data.title)}</h3><p class="preview">${esc(data.body)}</p><p><b>Regali:</b></p>${giftList(data)}<p>Campagna: ${esc(data.campaignKey)}. Solo nuove iscrizioni, una volta per profilo. Nessuna notifica esterna automatica.</p></section><form method="post" action="${url}">${hidden()}<input type="hidden" name="id" value="${id}"><button>Attiva benvenuto automatico</button></form><p><a href="${url}">Annulla</a></p>`));
      }
      const targets=D.recipients(ctx.sessions,data);
      if(!targets.length)throw Error('Nessun nuovo destinatario: controlla i criteri o il codice campagna già ricevuto.');
      if(previews.size>=100)throw Error('Troppe anteprime aperte: attendi qualche minuto.');
      const next=crypto.randomUUID();previews.set(next,{data,targets:targets.map(x=>x.token),expires:Date.now()+15*60000});
      res.send(page(`<h2>Anteprima: ${targets.length} ${targets.length===1?'destinatario':'destinatari'}</h2><section><h3>${esc(data.title)}</h3><p class="preview">${esc(data.body)}</p><p><b>Regali per ogni destinatario:</b></p>${giftList(data)}<p>Campagna: ${esc(data.campaignKey||'Invio singolo')}</p><p>${data.push?'Anche notifica sul telefono, se abilitata.':'Solo posta personale.'}</p><details><summary>Elenco completo dei destinatari</summary><p>${targets.map(x=>esc(x.nick)).join(', ')}</p></details></section><p>L’elenco è fissato a questa anteprima, valida 15 minuti. I regali diventano subito disponibili nell’inventario; non possono essere ritirati da questa pagina.</p><form method="post" action="${url}">${hidden()}<input type="hidden" name="id" value="${next}"><button>Conferma invio a ${targets.length} ${targets.length===1?'utente':'utenti'}</button></form><p><a href="${url}">Annulla e torna agli invii</a></p>`));
    }catch(e){res.status(400).send(page(`<p class="notice">${esc(e.message)}</p><a href="${url}">Torna agli invii</a>`));}
  });
};
