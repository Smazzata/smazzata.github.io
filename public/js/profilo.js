/* Burraco — Profilo e amici.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Profilo e amici ================= */
  function nickStatusHTML() {
    const c = S.nickCheck;
    if (!c) return '';
    if (c.checking) return '<span class="muted">Controllo…</span>';
    return c.available ? `<span class="ok">✓ <b>${esc(c.nick)}</b> è disponibile</span>` : `<span class="ko">✗ ${esc(c.reason || 'Non disponibile')}</span>`;
  }

  let nickTimer = null;
  function checkNickLive(value, target) {
    const nick = value.trim();
    S.nickCheck = nick ? { checking: true, nick } : null;
    const paint = () => { const el = $(target); if (el) el.innerHTML = nickStatusHTML(); };
    paint();
    clearTimeout(nickTimer);
    if (!nick) return;
    nickTimer = setTimeout(async () => {
      const r = await new Promise((res) => socket.emit('checkNick', { nick }, res));
      if (S.nickCheck && S.nickCheck.nick === nick) { S.nickCheck = { nick, available: r.available, reason: r.reason }; paint(); }
    }, 300);
  }

  function transferLink(code) {
    const base = /\.trycloudflare\.com$/.test(location.hostname) ? HOME_URL : `${location.origin}/`;
    return `${base}?profilo=${encodeURIComponent(code)}`;
  }

  function qrDataUrl(text) {
    if (typeof qrcode !== 'function') return null;
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createDataURL(6, 2);
  }

  /** I titoli compaiono solo dopo lo sblocco nella progressione. */
  function lookHTML(av) {
    const P = window.BurracoPremi;
    const free = new Set((S.progress && S.progress.unlocks) || []);
    const curT = av.tid || 't_principiante', curF = av.f ? 'f_' + av.f : 'f_nessuna';
    const chip = (p, cur, act) => (free.has(p.id)
      ? `<button class="swatch ${p.id === cur ? 'on' : ''}" data-act="${act}" data-id="${p.id}">${esc(p.name)}</button>`
      : `<button class="swatch locked" disabled title="Si sblocca con: ${esc(P.howTo(p))}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-privacy /></svg> ${esc(p.name)} <small>· ${esc(P.howTo(p))}</small></button>`);
    return `<h4>Il tuo stile</h4>
      <p class="muted small">Titolo e cornice si vedono al tavolo. Si sbloccano salendo di livello e vincendo trofei.</p>
      <div class="looks">${P.LIST.filter((p) => p.kind === 'title' && free.has(p.id)).map((p) => chip(p, curT, 'pickTitle')).join('')}</div>
      <div class="looks" style="margin-top:8px">${P.LIST.filter((p) => p.kind === 'frame').map((p) => chip(p, curF, 'pickFrame')).join('')}</div>`;
  }

  async function profileModal() {
    const r = await emit('profile');
    if (!r.ok) return;
    if (!r.nick) { closeModal(); toast('Scegli prima il tuo nickname'); return; }
    if(r.chests && typeof cacheChestState==='function')cacheChestState(r.chests);
    if(r.cosmetics && typeof cacheCosmetics==='function')cacheCosmetics(r.cosmetics);
    const link = transferLink(r.code);
    const qr = qrDataUrl(link);
    const avatars = window.SmazzataAvatars;
    const selected = avatars.resolve(r.avatar && (r.avatar.id || r.avatar.e), r.nick);
    const av = { ...(r.avatar || {}), id:selected.id, e: selected.e, c: r.avatar && r.avatar.c || r.colors[0] };
    const rarity = avatars.RARITIES.find(x=>x.id===selected.rarity);
    const owned = new Set(r.ownedAvatarIds || avatars.LIST.filter(a=>avatars.isSelectable(a.id)).map(a=>a.id));
    S.avatarOwnedIds = [...owned];
    const shown = avatars.LIST.filter(a=>owned.has(a.id));
    openModal('profile', `<h2>${uiIcon('profile')} ${esc(r.nick)}</h2>
      <div class="avatar-collection-heading"><div><p class="muted small">${t('La tua collezione')}</p><h4>Avatar</h4></div><b class="avatar-collected">${shown.length}</b></div>
      <div class="avpick"><div class="avpreview">${avatarHTML(r.nick, 0, false, av)}<div><b>${esc(t(selected.name))}</b><span class="avatar-rarity" data-rarity="${rarity.id}">${t(rarity.name)}</span></div></div>
        <div id="avatar-grid" class="avgrid" role="group" aria-label="${t('Scegli il tuo avatar')}">${!shown.length?`<p class="av-empty">${t('Nessun avatar posseduto in questa rarità.')}</p>`:''}${shown.map((a) => `<button type="button" class="avopt ${a.id === selected.id ? 'on' : ''}" aria-haspopup="dialog" data-act="previewAvatar" data-avatar-id="${a.id}" data-rarity="${a.rarity}" data-c="${av.c}" aria-pressed="${a.id === selected.id}" aria-label="${esc(t(a.name))}, ${t(avatars.RARITIES.find(r=>r.id===a.rarity).name)}${owned.has(a.id)?'':', '+t('Non ancora disponibile')}" title="${esc(t(a.name))}" >${avatars.svg(a.id)}<span>${esc(t(a.name))}</span><small class="avatar-rarity" data-rarity="${a.rarity}">${owned.has(a.id)?'':'<svg class="avlock" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 7V4a4 4 0 0 1 8 0v3"/><rect x="2" y="7" width="12" height="8" rx="2"/><path d="M8 10v2"/></svg>'}${t(avatars.RARITIES.find(r=>r.id===a.rarity).name)}</small></button>`).join('')}</div>
        <span class="avcolor-label">Colore del bordo</span><div class="avcolors">${r.colors.map((c) => `<button type="button" class="avcol ${c === av.c ? 'on' : ''}" style="background:${c}" data-act="pickAvatar" data-avatar-id="${av.id}" data-c="${c}" aria-label="${t('Colore del bordo')}: ${c}" aria-pressed="${c === av.c}"></button>`).join('')}</div></div>
      <button class="btn small" data-act="inbox">${uiIcon('mail')} ${t('Posta personale')}${S.social?.unreadMail?' · '+S.social.unreadMail:''}</button>
      <button class="chest-entry" data-act="chests"><span class="chest-thumb" aria-hidden="true"></span><span><b>${t('Inventario personale')}</b><small>${t('Chest disponibili')}: ${r.chests?.pending?.length || 0}</small></span>${uiIcon('play')}</button>
      <button class="btn" data-act="collection">${uiIcon('cards')}${t('Collezione')}</button>
      ${lookHTML(av)}
      <h4>Cambia nickname</h4>
      <form id="nickform" class="row"><input id="nickEdit" class="grow" maxlength="16" autocomplete="off" value="${esc(r.nick)}"><button class="btn primary">Salva</button></form>
      <div class="nickstatus" id="nickStatusEdit"></div>
      ${r.mail ? `<h4>Email ${r.email ? '(confermata ✓)' : ''}</h4>
      <p class="muted small">Serve per ricevere un codice se dimentichi la password, e un avviso se la password cambia.</p>
      ${r.emailPending ? verifyEmailHTML(r.emailPending) : !r.email && r.emailLast ? '<p class="muted small"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-report /></svg> Email non ancora confermata: premi «Manda il codice» per riceverne uno nuovo.</p>' : ''}
      <form id="emailform" class="row"><input id="emailin" type="email" class="grow" maxlength="250" autocomplete="email" value="${esc(r.email || r.emailLast || '')}" placeholder="nome@esempio.it"><button class="btn">${r.email ? 'Cambia' : r.emailLast ? 'Manda il codice' : 'Aggiungi'}</button></form>` : ''}
      <h4>Codice di recupero</h4>
      <p class="muted small">Serve se dimentichi la password, oppure per entrare da un altro telefono: inquadra il QR con la sua fotocamera
        o scrivi lì il codice (<i>Hai già un profilo? Recuperalo</i>). <b>Non condividerlo:</b> chi lo ha può usare il tuo profilo.</p>
      ${qr ? `<div class="qr"><img src="${qr}" alt="QR del profilo"></div>` : ''}
      <div class="code-box"><span id="pcode" class="masked">${esc(r.code)}</span>
        <button class="btn small" data-act="toggleCode">Mostra</button><button class="btn small" data-act="copyCode" data-code="${esc(r.code)}">Copia</button></div>
      <button class="btn small ghost dark" style="margin-top:6px" data-act="regenCode">Genera un nuovo codice (il vecchio smette di funzionare)</button>
      <h4>Password ${r.hasPassword ? '(impostata ✓)' : '<svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-report /></svg> (da impostare)'}</h4>
      <p class="muted small">Con nickname e password entri nel tuo profilo da qualsiasi dispositivo.</p>
      <form id="pwform" class="row"><input id="pwin" type="password" class="grow" minlength="6" autocomplete="new-password" placeholder="${r.hasPassword ? 'Nuova password' : 'Almeno 6 caratteri'}"><button class="btn">${r.hasPassword ? 'Cambia' : 'Imposta'}</button></form>
      <h4>Altro profilo</h4>
      <button class="btn small" data-act="recover">Usa un altro profilo su questo dispositivo</button>
      <h4>Elimina profilo</h4>
      <button class="btn small danger" data-act="deleteProfile">Elimina il mio profilo</button>
      <p class="muted small">Libera il nickname e cancella codice, password, amicizie e classifica. Le statistiche su questo dispositivo restano.
        <a href="privacy.html">Leggi l'informativa privacy</a> · <a href="regole.html">Regole di comportamento</a></p>`);
  }

  /** Subito dopo la creazione del profilo: il codice di recupero da conservare */
  /** conferma dell'email: il codice a 6 cifre arrivato nella posta */
  function verifyEmailHTML(email) {
    return `<div class="mailbox"><p><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-mail /></svg> Ti abbiamo mandato un codice a <b>${esc(email)}</b>: scrivilo qui per confermare l'email.</p>
      <form id="verifyform" class="row"><input id="vcode" class="grow" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456"><button class="btn primary">Conferma</button></form>
      <p class="muted small">Non arriva? Guarda anche nello spam.</p></div>`;
  }

  function recoveryCodeModal(nick, code, pendingEmail) {
    openModal('recoveryCode', `<h2>Benvenuto, ${esc(nick)}! <svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg></h2>
      ${pendingEmail ? verifyEmailHTML(pendingEmail) : ''}
      <p>Questo è il tuo <b>codice di recupero</b>. Se dimentichi la password, con questo ne scegli una nuova.</p>
      <div class="code-box"><span id="pcode">${esc(code || '')}</span><button class="btn small" data-act="copyCode" data-code="${esc(code || '')}">Copia</button></div>
      <p class="muted small">Fai uno screenshot o scrivilo da qualche parte. Non darlo a nessuno: chi lo ha può entrare nel tuo profilo.
        Lo ritrovi sempre in <svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-profile /></svg> Profilo.</p>
      <div class="row" style="margin-top:8px"><button class="btn primary grow" data-act="savedCode">Ho salvato il codice</button></div>`);
  }

  function forgotModal(email) {
    openModal('recover', `<h2>Password dimenticata</h2>
      ${S.mailOn ? `<h4>Con l'email</h4>
      ${email ? `<p class="muted small">Se <b>${esc(email)}</b> è l'email di un profilo, ti abbiamo mandato un codice (guarda anche nello spam).</p>
        <form id="mailresetform" data-email="${esc(email)}"><div class="row"><input id="mrcode" class="grow" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="Codice di 6 cifre"></div>
        <div class="row" style="margin-top:6px"><input id="mrpw" type="password" class="grow" autocomplete="new-password" placeholder="Nuova password (almeno 6 caratteri)"><button class="btn primary">Salva</button></div></form>`
      : `<form id="forgotmailform" class="row"><input id="fmail" type="email" class="grow" autocomplete="email" placeholder="La tua email"><button class="btn primary">Mandami il codice</button></form>`}
      <h4>Con il codice di recupero</h4>` : ''}
      <p class="muted small">Scrivi il tuo nickname, il codice di recupero (te l'abbiamo mostrato quando hai creato il profilo; lo trovi anche in <svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-profile /></svg> Profilo
        su un dispositivo dove sei ancora dentro) e una password nuova.</p>
      <form id="forgotform"><div class="row"><input id="fnick" class="grow" autocomplete="username" placeholder="Nickname"></div>
        <div class="row" style="margin-top:6px"><input id="fcode" class="grow" autocomplete="off" placeholder="BUR-XXXX-XXXX-XXXX" style="text-transform:uppercase"></div>
        <div class="row" style="margin-top:6px"><input id="fpw" type="password" class="grow" autocomplete="new-password" placeholder="Nuova password (almeno 6 caratteri)"><button class="btn primary">Salva</button></div></form>
      <p class="muted small" style="margin-top:12px">Hai perso anche il codice? Chiedi a chi gestisce il gioco: può mandarti un codice nuovo.</p>`);
  }

  function recoverModal() {
    openModal('recover', `<h2>Recupera il tuo profilo</h2>
      <h4>Con il codice personale</h4>
      <form id="codeform" class="row"><input id="codein" class="grow" autocomplete="off" placeholder="BUR-XXXX-XXXX-XXXX" style="text-transform:uppercase"><button class="btn primary">Usa</button></form>
      <p class="muted small">Lo trovi nel Profilo del vecchio dispositivo (o inquadra il suo QR con la fotocamera).</p>
      <h4>Con nickname e password</h4>
      <form id="loginform"><div class="row"><input id="lnick" class="grow" autocomplete="username" placeholder="Nickname"></div>
        <div class="row" style="margin-top:6px"><input id="lpw" type="password" class="grow" autocomplete="current-password" placeholder="Password"><button class="btn primary">Accedi</button></div></form>
      <p class="small" style="margin-top:6px"><a href="#" data-act="forgot">Password dimenticata?</a></p>
      ${S.social && S.social.nick ? `<p class="muted small" style="margin-top:12px">Questo dispositivo ora usa il profilo <b>${esc(S.social.nick)}</b>: per tornarci ti servirà il suo codice personale (lo trovi nel Profilo).</p>` : ''}`);
  }

  /** Passa a un altro profilo su questo dispositivo */
  function adoptProfile(token, nick) {
    store.set('bur_token', token);
    if (nick) store.set('bur_name', nick);
    toast(`Benvenuto, ${nick || 'giocatore'}!`);
    setTimeout(() => { if (!syncLauncher(token)) location.href = location.pathname; }, 600);
  }

  function askImport(code) {
    if (location.search) history.replaceState(null, '', location.pathname);
    openModal('recover', `<div class="result" style="text-align:center"><h2>Usare questo profilo?</h2>
      <p>Hai aperto un link per spostare un profilo su questo dispositivo.</p>
      <div class="row" style="justify-content:center"><button class="btn primary" data-act="importCode" data-code="${esc(code)}">Sì, usalo qui</button><button class="btn" data-act="closeModal">Annulla</button></div></div>`);
  }

  /** Campionati tra amici: classifiche della stagione, albo d'oro, membri */
  async function leaguesModal(openId) {
    const r = await emit('leagues');
    if (!r.ok) return;
    S.leagueOpen = openId !== undefined ? openId : S.leagueOpen;
    const so = S.social || { friends: [] };
    const left = (t) => { const d = Math.max(0, Math.ceil((t - Date.now()) / 86400000)); return d <= 1 ? 'finisce entro domani' : `finisce tra ${d} giorni`; };
    const card = (lg) => {
      const open = S.leagueOpen === lg.id;
      const me = lg.standings.find((x) => x.me);
      const addable = so.friends.filter((f) => !lg.members.includes(f.nick));
      return `<div class="league ${open ? 'open' : ''}">
        <button class="lghead" data-act="leagueToggle" data-id="${lg.id}"><b>${esc(lg.name)}</b>
          <span class="muted small">${lg.period === 'mese' ? 'mensile' : 'settimanale'} · ${left(lg.ends)}${me ? ` · sei ${me.pos}°` : ''}</span></button>
        ${open ? `<table>${lg.standings.map((x) => `<tr class="${x.me ? 'meRow' : ''}"><td>${x.pos <= 3 ? uiIcon('medal') + x.pos : x.pos}</td><td style="text-align:left">${esc(x.name)}</td><td><b>${x.pts}</b> pt</td><td class="muted small">${x.wins}/${x.games}</td></tr>`).join('')}</table>
          <p class="muted small">3 punti a vittoria, 1 a partecipazione. Contano le partite finite con almeno due membri al tavolo.</p>
          ${lg.past.length ? `<h4>Albo d'oro</h4>${lg.past.slice(0, 5).map((p) => `<div class="small"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg> ${esc(p.winners.join(', '))} <span class="muted">(${p.pts} pt · ${new Date(p.to - 1).toLocaleDateString(LOCALE)})</span></div>`).join('')}` : ''}
          ${lg.mineOwner && addable.length ? `<div class="row" style="margin-top:8px">${choiceMenuHTML('lgadd-' + lg.id, addable.map(f => [f.nick, f.nick]), addable[0].nick, 'Amici')}
            <button class="btn small primary" data-act="leagueAdd" data-id="${lg.id}">Aggiungi</button></div>` : ''}
          ${lg.mineOwner ? `<div class="small" style="margin-top:6px">Membri: ${lg.members.map((n) => `${esc(n)}${n !== lg.owner ? ` <a href="#" data-act="leagueKick" data-id="${lg.id}" data-nick="${esc(n)}" title="Togli">✕</a>` : ''}`).join(' · ')}</div>` : ''}
          <div class="row" style="margin-top:8px"><button class="btn small danger" data-act="leagueLeave" data-id="${lg.id}">Esci dal campionato</button></div>` : ''}</div>`;
    };
    openModal('leagues', `<div class="result"><button class="btn small" data-act="friends">← Amici</button><h2><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg> Campionati tra amici</h2>
      ${r.list.length ? r.list.map(card).join('') : '<p class="muted">Non fai ancora parte di un campionato. Creane uno e aggiungi i tuoi amici!</p>'}
      <h3>Nuovo campionato</h3>
      <form id="leagueform" class="tour-create"><label class="tour-label" for="lgname">Nome del campionato</label><input id="lgname" maxlength="30" placeholder="Es. Burraco del giovedì">
        <fieldset><legend>Durata</legend><div class="tour-options tour-games"><label class="tour-option"><input type="radio" name="lgperiod" value="settimana" checked><span><b>Settimanale</b><i aria-hidden="true">✓</i></span></label>
        <label class="tour-option"><input type="radio" name="lgperiod" value="mese"><span><b>Mensile</b><i aria-hidden="true">✓</i></span></label></div></fieldset><button class="btn primary">Crea</button></form></div>`);
  }

  /* ---------- Tornei a eliminazione ---------- */
  const TOUR_GAMES = { burraco: 'Burraco', scala40: 'Scala 40', ramino: 'Ramino', canasta: 'Canasta' };
  const roundName = (i, total) => (total - i === 1 ? 'Finale' : total - i === 2 ? 'Semifinali' : total - i === 3 ? 'Quarti' : 'Ottavi');

  async function tournamentsModal(openId) {
    if (openId !== undefined) S.tourOpen = openId;
    const r = await emit('tournaments');
    if (!r.ok) return;
    const t = S.tourOpen && r.list.find((x) => x.id === S.tourOpen);
    if (t) { tournamentDetail(t); return; }
    const card = (x) => `<button class="league tourcard" data-act="tourOpen" data-id="${x.id}"><span class="lghead"><b>${esc(x.name)}</b>
      <span class="muted small">${TOUR_GAMES[x.game]} · ${x.players.length}/${x.size} · ${x.status === 'iscrizioni' ? '<svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-rules /></svg> iscrizioni aperte' : x.status === 'in corso' ? '<svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-play /></svg> in corso' : '🏁 finito'}${x.joined ? ' · ci sei' : ''}</span></span></button>`;
    openModal('tournaments', `<div class="result"><h2><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg> Tornei</h2>
      <p class="muted small">A eliminazione diretta, partite uno contro uno in versione breve. Quando tocca a te ti avvisiamo.</p>
      ${r.list.length ? r.list.map(card).join('') : emptyStateHTML('trophy', 'La prossima coppa parte da te', 'Crea un torneo e invita gli amici a iscriversi.', 'focusField', 'Crea il torneo', 'tourname')}
      <form id="tourform" class="tour-create">
        <h3>Nuovo torneo</h3>
        <label class="tour-label" for="tourname">Nome del torneo</label>
        <input id="tourname" maxlength="30" placeholder="Es. Coppa del venerdì">
        <fieldset><legend>Scegli il gioco</legend><div class="tour-options tour-games">
          ${Object.entries(TOUR_GAMES).map(([id, n]) => `<label class="tour-option"><input type="radio" name="tourgame" value="${id}" ${id === 'burraco' ? 'checked' : ''}><span><b>${n}</b><i aria-hidden="true">✓</i></span></label>`).join('')}
        </div></fieldset>
        <fieldset><legend>Giocatori</legend><div class="tour-options tour-sizes">
          ${[4, 8, 16].map((n) => `<label class="tour-option"><input type="radio" name="toursize" value="${n}" ${n === 8 ? 'checked' : ''}><span><b>${n}</b><small>${Math.log2(n)} turni</small><i aria-hidden="true">✓</i></span></label>`).join('')}
        </div></fieldset>
        <button type="submit" class="btn primary">Crea il torneo</button>
      </form></div>`);
  }

  function tournamentDetail(t) {
    const pn = (i) => (i == null ? '?' : `${t.players[i].bot ? '🤖 ' : ''}${esc(t.players[i].name)}${t.players[i].me ? ' (tu)' : ''}`);
    const me = t.players.findIndex((p) => p.me);
    const bracket = t.rounds.map((round, ri) => `<div class="tround"><h4>${roundName(ri, Math.log2(t.size))}</h4>${round.map((m, mi) => {
      const mine = me >= 0 && (m.a === me || m.b === me) && m.winner == null;
      return `<div class="tmatch ${mine ? 'mine' : ''}">
        <span class="${m.winner === m.a ? 'tw' : m.winner != null ? 'tl' : ''}">${pn(m.a)}</span>
        <span class="${m.winner === m.b ? 'tw' : m.winner != null ? 'tl' : ''}">${pn(m.b)}</span>
        ${mine && m.room ? `<button class="btn small primary" data-act="tourPlay" data-code="${esc(m.room)}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-play /></svg> Vai al tavolo</button>` : ''}
        ${t.mine && m.winner == null && m.room ? `<span class="muted small">a tavolino: <a href="#" data-act="tourForfeit" data-id="${t.id}" data-r="${ri}" data-i="${mi}" data-side="a">${pn(m.a)}</a> · <a href="#" data-act="tourForfeit" data-id="${t.id}" data-r="${ri}" data-i="${mi}" data-side="b">${pn(m.b)}</a></span>` : ''}
      </div>`;
    }).join('')}</div>`).join('');
    openModal('tournaments', `<div class="result"><button class="btn small" data-act="tourOpen" data-id="">← Tornei</button>
      <h2><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg> ${esc(t.name)}</h2><p class="muted">${TOUR_GAMES[t.game]} · ${t.size} giocatori · organizza ${esc(t.owner)}</p>
      ${t.champion != null ? `<div class="winner"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg> Campione: ${pn(t.champion)}!</div>` : ''}
      ${t.status === 'iscrizioni' ? `<h3>Iscritti (${t.players.length}/${t.size})</h3><p>${t.players.map((p, i) => pn(i)).join(' · ')}</p>
        <div class="row">${t.joined ? `<button class="btn small" data-act="tourLeave" data-id="${t.id}">${t.mine ? 'Annulla il torneo' : 'Ritirati'}</button>` : `<button class="btn primary" data-act="tourJoin" data-id="${t.id}">Iscriviti</button>`}
        ${t.mine && t.players.length < t.size ? `<button class="btn small" data-act="tourFill" data-id="${t.id}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-bot /></svg> Riempi con il computer</button>` : ''}
        ${t.mine && t.players.length === t.size ? `<button class="btn primary" data-act="tourStart" data-id="${t.id}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-play /></svg> Inizia il torneo</button>` : ''}</div>` : ''}
      ${t.rounds.length ? `<h3>Tabellone</h3><div class="bracket">${bracket}</div>` : ''}</div>`);
  }

  /** Avviso del gestore: qualcuno ha segnalato un comportamento contro le regole (o il nickname è stato cambiato) */
  function warnModal(w) {
    openModal('warn', `<h2><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-report /></svg> Avviso del gestore</h2>
      ${w.renamed ? `<p>Il tuo nickname non rispettava le regole ed è stato cambiato in <b>${esc((S.social && S.social.nick) || '')}</b>. Puoi sceglierne uno nuovo dal profilo.</p>`
        : '<p>Il tuo comportamento nel gioco non ha rispettato le regole di comportamento.</p>'}
      <p>Se succede di nuovo, la chat può essere bloccata o il profilo eliminato.</p>
      <p class="muted small"><a href="regole.html">Leggi le regole di comportamento</a></p>
      <div class="row"><button class="btn primary grow" data-act="warnSeen">Ho capito</button></div>`);
  }

  /** chat bloccata dal gestore: al posto della casella per scrivere (stringa vuota se la chat è attiva) */
  function chatBanHTML() {
    const b = S.social && S.social.chatBan;
    if (!b) return '';
    return `<p class="muted small" style="margin:8px 0"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-report /></svg> La chat è bloccata per te ${b === 'sempre' ? '' : `fino al ${esc(new Date(b).toLocaleDateString(LOCALE))} `}perché non hai rispettato le <a href="regole.html">regole di comportamento</a>.</p>`;
  }

  /** Menu di un giocatore (toccando il suo nome al tavolo o in chat): amicizia, blocco, segnalazione */
  function playerMenu(nick) {
    if (!nick || !S.social || !S.social.nick || nick === S.social.nick) return;
    const so = S.social;
    const isFriend = so.friends.some((f) => f.nick === nick);
    const pending = so.reqOut.includes(nick);
    const blocked = (so.blocked || []).includes(nick);
    openModal('playerMenu', `<h2>${esc(nick)}</h2><div class="leaveopts">
      ${isFriend ? `<button class="btn" data-act="playerCard" data-nick="${esc(nick)}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-profile /></svg> Vedi la scheda</button>`
        : pending ? '<p class="muted">Richiesta di amicizia inviata</p>' : `<button class="btn primary" data-act="addFriendNick" data-nick="${esc(nick)}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-friends /></svg> Aggiungi agli amici</button>`}
      ${blocked ? `<button class="btn" data-act="unblock" data-nick="${esc(nick)}">Sblocca</button>` : `<button class="btn" data-act="block" data-nick="${esc(nick)}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-report /></svg> Blocca</button>`}
      <button class="btn danger" data-act="reportPlayer" data-nick="${esc(nick)}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-report /></svg> Segnala</button></div>`);
  }

  function friendsModal() {
    const draft = S.modalKind === 'friends' ? $('#friendin')?.value : '';
    const focused = document.activeElement?.id === 'friendin';
    const so = S.social || { friends: [], reqIn: [], reqOut: [] };
    const inRoom = S.room && S.room.code;
    const friend = (f) => `<div class="friend">${avatarHTML(f.nick, 0, false, f.avatar || { e: f.nick.charAt(0).toUpperCase(), c: '#9e9e9e' })}<span class="dot ${f.online ? '' : 'off'}"></span>
      <span class="grow" data-act="playerCard" data-nick="${esc(f.nick)}" style="cursor:pointer"><b>${esc(f.nick)}</b> <span class="muted small">›</span><br><span class="muted small">${f.online ? (f.room ? (f.room === inRoom ? 'al tuo tavolo' : f.playing ? 'sta giocando' : 'in un tavolo') : 'online') : 'offline'}</span></span>
      ${inRoom && f.online && f.room !== inRoom ? `<button class="btn small primary" data-act="invite" data-nick="${esc(f.nick)}">Invita</button>` : ''}
      ${f.playing && f.room && f.room !== inRoom ? `<button class="btn small" data-act="watch" data-code="${esc(f.room)}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-eye /></svg> Guarda</button>` : ''}
      <button class="btn small ghost dark" data-act="unfriend" data-nick="${esc(f.nick)}" title="Rimuovi">✕</button></div>`;
    openModal('friends', `<h2><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-friends /></svg> Amici</h2>
      <div class="row" style="margin-bottom:8px"><button class="btn small" data-act="leagues"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg> Campionati tra amici</button></div>
      <form id="friendform" class="row"><input id="friendin" class="grow" maxlength="16" autocomplete="off" placeholder="Nickname dell'amico"><button class="btn primary">Aggiungi</button></form>
      ${so.reqIn.length ? `<h4>Richieste ricevute</h4>${so.reqIn.map((n) => `<div class="friend"><span class="grow"><b>${esc(n)}</b> vuole essere tuo amico</span>
        <button class="btn small primary" data-act="friendYes" data-nick="${esc(n)}">Accetta</button><button class="btn small" data-act="friendNo" data-nick="${esc(n)}">Rifiuta</button><button class="btn small danger" data-act="block" data-nick="${esc(n)}" title="Blocca"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-report /></svg></button></div>`).join('')}` : ''}
      <h4>I tuoi amici${so.friends.length ? ` (${so.friends.filter((f) => f.online).length} online)` : ''}</h4>
      ${so.friends.length ? so.friends.map(friend).join('') : emptyStateHTML('friends', 'Un posto per i tuoi amici', 'Cerca il loro nickname per ritrovarvi e giocare allo stesso tavolo.', 'focusField', 'Aggiungi un amico', 'friendin')}
      ${!inRoom && so.friends.some((f) => f.online) ? '<p class="muted small">Crea o entra in un tavolo per invitare gli amici online.</p>' : ''}
      ${so.reqOut.length ? `<h4>Richieste inviate</h4>${so.reqOut.map((n) => `<div class="friend"><span class="grow">${esc(n)} <span class="muted small">in attesa</span></span>
        <button class="btn small" data-act="unfriend" data-nick="${esc(n)}">Annulla</button></div>`).join('')}` : ''}
      ${(so.blocked || []).length ? `<h4>Bloccati</h4>${so.blocked.map((n) => `<div class="friend"><span class="grow"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-report /></svg> ${esc(n)}</span>
        <button class="btn small" data-act="unblock" data-nick="${esc(n)}">Sblocca</button></div>`).join('')}` : ''}`);
    if (draft) $('#friendin').value = draft;
    if (focused) $('#friendin')?.focus({preventScroll:true});
  }
