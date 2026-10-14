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

  async function profileModal() {
    const r = await emit('profile');
    if (!r.ok) return;
    if (!r.nick) { closeModal(); toast('Scegli prima il tuo nickname'); return; }
    const link = transferLink(r.code);
    const qr = qrDataUrl(link);
    const av = r.avatar || { e: r.emoji[0], c: r.colors[0] };
    openModal('profile', `<h2>👤 ${esc(r.nick)}</h2>
      <h4>Avatar</h4>
      <div class="avpick">${avatarHTML(r.nick, 0, false, av)}
        <div class="avgrid">${r.emoji.map((e) => `<button class="avopt ${e === av.e ? 'on' : ''}" data-act="pickAvatar" data-e="${e}" data-c="${av.c}">${e}</button>`).join('')}</div>
        <div class="avcolors">${r.colors.map((c) => `<button class="avcol ${c === av.c ? 'on' : ''}" style="background:${c}" data-act="pickAvatar" data-e="${av.e}" data-c="${c}" aria-label="colore"></button>`).join('')}</div></div>
      <h4>Cambia nickname</h4>
      <form id="nickform" class="row"><input id="nickEdit" class="grow" maxlength="16" autocomplete="off" value="${esc(r.nick)}"><button class="btn primary">Salva</button></form>
      <div class="nickstatus" id="nickStatusEdit"></div>
      <h4>Usa il profilo su un altro dispositivo</h4>
      <p class="muted small">Inquadra il QR con la fotocamera del nuovo telefono, oppure inserisci lì il codice personale (<i>Hai già un profilo? Recuperalo</i>).
        <b>Non condividerlo:</b> chi lo ha può usare il tuo profilo.</p>
      ${qr ? `<div class="qr"><img src="${qr}" alt="QR del profilo"></div>` : ''}
      <div class="code-box"><span id="pcode" class="masked">${esc(r.code)}</span>
        <button class="btn small" data-act="toggleCode">Mostra</button><button class="btn small" data-act="copyCode" data-code="${esc(r.code)}">Copia</button></div>
      <button class="btn small ghost dark" style="margin-top:6px" data-act="regenCode">Genera un nuovo codice (il vecchio smette di funzionare)</button>
      <h4>Password ${r.hasPassword ? '(impostata ✓)' : '(facoltativa)'}</h4>
      <p class="muted small">Con nickname e password puoi recuperare il profilo anche senza il codice.</p>
      <form id="pwform" class="row"><input id="pwin" type="password" class="grow" minlength="6" autocomplete="new-password" placeholder="${r.hasPassword ? 'Nuova password' : 'Almeno 6 caratteri'}"><button class="btn">${r.hasPassword ? 'Cambia' : 'Imposta'}</button></form>
      <h4>Altro profilo</h4>
      <button class="btn small" data-act="recover">Usa un altro profilo su questo dispositivo</button>
      <h4>Elimina profilo</h4>
      <button class="btn small danger" data-act="deleteProfile">Elimina il mio profilo</button>
      <p class="muted small">Libera il nickname e cancella codice, password, amicizie e classifica. Le statistiche su questo dispositivo restano.
        <a href="privacy.html">Leggi l'informativa privacy</a>.</p>`);
  }

  function recoverModal() {
    openModal('recover', `<h2>Recupera il tuo profilo</h2>
      <h4>Con il codice personale</h4>
      <form id="codeform" class="row"><input id="codein" class="grow" autocomplete="off" placeholder="BUR-XXXX-XXXX-XXXX" style="text-transform:uppercase"><button class="btn primary">Usa</button></form>
      <p class="muted small">Lo trovi nel Profilo del vecchio dispositivo (o inquadra il suo QR con la fotocamera).</p>
      <h4>Con nickname e password</h4>
      <form id="loginform"><div class="row"><input id="lnick" class="grow" autocomplete="username" placeholder="Nickname"></div>
        <div class="row" style="margin-top:6px"><input id="lpw" type="password" class="grow" autocomplete="current-password" placeholder="Password"><button class="btn primary">Accedi</button></div></form>
      ${S.social && S.social.nick ? `<p class="muted small" style="margin-top:12px">Questo dispositivo ora usa il profilo <b>${esc(S.social.nick)}</b>: per tornarci ti servirà il suo codice personale (lo trovi nel Profilo).</p>` : ''}`);
  }

  /** Passa a un altro profilo su questo dispositivo */
  function adoptProfile(token, nick) {
    store.set('bur_token', token);
    if (nick) store.set('bur_name', nick);
    toast(`Benvenuto, ${nick || 'giocatore'}!`);
    setTimeout(() => { location.href = location.pathname; }, 600);
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
        ${open ? `<table>${lg.standings.map((x) => `<tr class="${x.me ? 'meRow' : ''}"><td>${['🥇', '🥈', '🥉'][x.pos - 1] || x.pos}</td><td style="text-align:left">${esc(x.name)}</td><td><b>${x.pts}</b> pt</td><td class="muted small">${x.wins}/${x.games}</td></tr>`).join('')}</table>
          <p class="muted small">3 punti a vittoria, 1 a partecipazione. Contano le partite finite con almeno due membri al tavolo.</p>
          ${lg.past.length ? `<h4>Albo d'oro</h4>${lg.past.slice(0, 5).map((p) => `<div class="small">🏆 ${esc(p.winners.join(', '))} <span class="muted">(${p.pts} pt · ${new Date(p.to - 1).toLocaleDateString('it-IT')})</span></div>`).join('')}` : ''}
          ${lg.mineOwner && addable.length ? `<div class="row" style="margin-top:8px"><select id="lgadd-${lg.id}" class="grow">${addable.map((f) => `<option>${esc(f.nick)}</option>`).join('')}</select>
            <button class="btn small primary" data-act="leagueAdd" data-id="${lg.id}">Aggiungi</button></div>` : ''}
          ${lg.mineOwner ? `<div class="small" style="margin-top:6px">Membri: ${lg.members.map((n) => `${esc(n)}${n !== lg.owner ? ` <a href="#" data-act="leagueKick" data-id="${lg.id}" data-nick="${esc(n)}" title="Togli">✕</a>` : ''}`).join(' · ')}</div>` : ''}
          <div class="row" style="margin-top:8px"><button class="btn small danger" data-act="leagueLeave" data-id="${lg.id}">Esci dal campionato</button></div>` : ''}</div>`;
    };
    openModal('leagues', `<div class="result"><button class="btn small" data-act="friends">← Amici</button><h2>🏟️ Campionati tra amici</h2>
      ${r.list.length ? r.list.map(card).join('') : '<p class="muted">Non fai ancora parte di un campionato. Creane uno e aggiungi i tuoi amici!</p>'}
      <h3>Nuovo campionato</h3>
      <form id="leagueform"><div class="row"><input id="lgname" class="grow" maxlength="30" placeholder="Es. Burraco del giovedì"></div>
        <div class="row" style="margin-top:6px"><label class="small"><input type="radio" name="lgperiod" value="settimana" checked> Settimanale</label>
        <label class="small"><input type="radio" name="lgperiod" value="mese"> Mensile</label><button class="btn small primary grow">Crea</button></div></form></div>`);
  }

  function friendsModal() {
    const so = S.social || { friends: [], reqIn: [], reqOut: [] };
    const inRoom = S.room && S.room.code;
    const friend = (f) => `<div class="friend">${avatarHTML(f.nick, 0, false, f.avatar || { e: f.nick.charAt(0).toUpperCase(), c: '#9e9e9e' })}<span class="dot ${f.online ? '' : 'off'}"></span>
      <span class="grow" data-act="playerCard" data-nick="${esc(f.nick)}" style="cursor:pointer"><b>${esc(f.nick)}</b> <span class="muted small">›</span><br><span class="muted small">${f.online ? (f.room ? (f.room === inRoom ? 'al tuo tavolo' : f.playing ? 'sta giocando' : 'in un tavolo') : 'online') : 'offline'}</span></span>
      ${inRoom && f.online && f.room !== inRoom ? `<button class="btn small primary" data-act="invite" data-nick="${esc(f.nick)}">Invita</button>` : ''}
      ${f.playing && f.room && f.room !== inRoom ? `<button class="btn small" data-act="watch" data-code="${esc(f.room)}">👁 Guarda</button>` : ''}
      <button class="btn small ghost dark" data-act="unfriend" data-nick="${esc(f.nick)}" title="Rimuovi">✕</button></div>`;
    openModal('friends', `<h2>👥 Amici</h2>
      <div class="row" style="margin-bottom:8px"><button class="btn small" data-act="leagues">🏟️ Campionati tra amici</button></div>
      <form id="friendform" class="row"><input id="friendin" class="grow" maxlength="16" autocomplete="off" placeholder="Nickname dell'amico"><button class="btn primary">Aggiungi</button></form>
      ${so.reqIn.length ? `<h4>Richieste ricevute</h4>${so.reqIn.map((n) => `<div class="friend"><span class="grow"><b>${esc(n)}</b> vuole essere tuo amico</span>
        <button class="btn small primary" data-act="friendYes" data-nick="${esc(n)}">Accetta</button><button class="btn small" data-act="friendNo" data-nick="${esc(n)}">Rifiuta</button><button class="btn small danger" data-act="block" data-nick="${esc(n)}" title="Blocca">🚫</button></div>`).join('')}` : ''}
      <h4>I tuoi amici${so.friends.length ? ` (${so.friends.filter((f) => f.online).length} online)` : ''}</h4>
      ${so.friends.length ? so.friends.map(friend).join('') : '<p class="muted">Nessun amico ancora: aggiungili con il loro nickname.</p>'}
      ${!inRoom && so.friends.some((f) => f.online) ? '<p class="muted small">Crea o entra in un tavolo per invitare gli amici online.</p>' : ''}
      ${so.reqOut.length ? `<h4>Richieste inviate</h4>${so.reqOut.map((n) => `<div class="friend"><span class="grow">${esc(n)} <span class="muted small">in attesa</span></span>
        <button class="btn small" data-act="unfriend" data-nick="${esc(n)}">Annulla</button></div>`).join('')}` : ''}
      ${(so.blocked || []).length ? `<h4>Bloccati</h4>${so.blocked.map((n) => `<div class="friend"><span class="grow">🚫 ${esc(n)}</span>
        <button class="btn small" data-act="unblock" data-nick="${esc(n)}">Sblocca</button></div>`).join('')}` : ''}`);
  }
