/* Burraco — Schermate: iniziale, nuova partita, sala d'attesa.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Schermate ================= */
  function render() {
    if (S.drag && S.drag.started) { S.pendingRender = true; return; }
    S.pendingRender = false;
    const app = $('#app');
    const changed = S.lastScreen !== S.screen;
    S.lastScreen = S.screen;
    if (S.screen === 'home') app.innerHTML = homeHTML();
    else if (S.screen === 'campaign') app.innerHTML = campaignHTML();
    else if (S.screen === 'setup') app.innerHTML = setupHTML();
    else if (S.screen === 'lobby') app.innerHTML = lobbyHTML();
    else if (S.screen === 'game') {
      S.flipFrom = changed ? null : cardRects();
      app.innerHTML = gameHTML();
      afterGameRender();
      campaignDecorateTable();
    }
    if (changed && app.firstElementChild) app.firstElementChild.classList.add('enter');
    campaignStoryMount();
    if (!S.connected && !S.localGame && !S.campaignActive && S.screen !== 'campaign') {
      app.insertAdjacentHTML('afterbegin', `<div class="offline"><span class="spin"></span>${S.lostConnection ? '📡 Connessione persa: mi ricollego…' : 'Connessione al server…'}</div>`);
      const gm = $('.game');
      if (gm) gm.classList.add('offline-lock');
    }
  }

  const APK_URL = 'https://github.com/smazzata/smazzata.github.io/releases/latest/download/Burraco.apk';
  // i tablet Android spesso si presentano come computer (Chrome «versione desktop»): Linux + schermo touch = Android
  const IS_ANDROID = /android/i.test(navigator.userAgent)
    || (navigator.userAgentData && /android/i.test(navigator.userAgentData.platform || ''))
    || (/Linux/.test(navigator.platform || navigator.userAgent) && !/CrOS/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const IN_APP = /BurracoApp/.test(navigator.userAgent);
  // versione dell'app installata (0 = APK vecchio, senza numero)
  const APP_VERSION = IN_APP ? Number((navigator.userAgent.match(/BurracoApp\/(\d+)/) || [])[1] || 0) : null;

  /**
   * Aggiornamento dell'app: si chiede a GitHub qual è l'ultimo APK pubblicato (tag apk-N).
   * Se è più nuovo di quello installato compare un avviso con il link per scaricarlo.
   * Il controllo si fa al massimo ogni 6 ore; «Più tardi» nasconde l'avviso per quella versione.
   */
  async function checkAppUpdate() {
    // l'app del Play Store si aggiorna dallo Store: niente avviso per scaricare l'APK (Google non lo permette)
    if (!IN_APP || OFFLINE || /SmazzataStore/.test(navigator.userAgent)) return;
    let latest = null;
    const cached = store.get('bur_apk_latest', null);
    if (cached && Date.now() - cached.at < 6 * 3600 * 1000) latest = cached.n;
    else {
      try {
        const r = await fetch('https://api.github.com/repos/smazzata/smazzata.github.io/releases/latest', { cache: 'no-store' });
        const tag = r.ok ? (await r.json()).tag_name : '';
        latest = Number((String(tag).match(/apk-(\d+)/) || [])[1] || 0) || null;
        if (latest) store.set('bur_apk_latest', { n: latest, at: Date.now() });
      } catch (e) { return; }
    }
    if (!latest || latest <= APP_VERSION) { S.appUpdate = null; return; }
    S.appUpdate = { n: latest, dismissed: store.get('bur_apk_later', 0) === latest };
    if (!S.appUpdate.dismissed) toast('📲 È disponibile un aggiornamento dell\'app');
    if (S.screen === 'home') render();
  }

  /** profilo senza email confermata (creato prima che fosse obbligatoria): prima si conferma, poi si gioca */
  function emailGateHTML() {
    const so = S.social;
    const pending = S.gatePending || so.emailPending;
    return `<div class="page">
      <div class="logo"><h1 translate="no">Smazzata</h1></div>
      <div class="panel gate"><h3>📧 Conferma la tua email</h3>
        <p>Per usare il profilo <b>${esc(so.nick)}</b> conferma la tua email: ti mandiamo un codice di 6 cifre. Serve per recuperare la password.</p>
        <form id="gatemailform" class="row"><input id="gatemail" type="email" class="grow" maxlength="250" autocomplete="email" placeholder="nome@esempio.it" value="${esc(pending || '')}"><button class="btn">${pending ? 'Manda di nuovo' : 'Manda il codice'}</button></form>
        ${pending ? verifyEmailHTML(pending) : ''}
        <p class="muted small" style="margin-top:10px"><a href="#" data-act="recover">Usa un altro profilo</a></p></div></div>`;
  }

  function homeHTML() {
    if (!OFFLINE && S.mailOn && S.social && S.social.nick && S.social.hasEmail === false) return emailGateHTML();
    const fan = [{ r: 1, s: 'S' }, { r: 13, s: 'H' }, { r: 0, s: 'J' }, { r: 2, s: 'D' }, { r: 7, s: 'C' }]
      .map((c, i) => cardHTML({ ...c, id: -1 - i }, 'logo-card', `style="--i:${i - 2}"`)).join('');
    return `<div class="page">
      <div class="logo"><div class="logo-fan">${fan}</div><h1 translate="no">Smazzata</h1>
        <div class="muted">Gioca con gli amici o contro il computer</div></div>
      ${S.appUpdate && !S.appUpdate.dismissed ? `<div class="apkbanner update">
        <img src="icons/icon-192.png" alt=""><span><b>📲 Nuova versione dell'app</b><br>Scaricala e installala sopra quella che hai: profilo e partite restano.</span>
        <span class="updbtns"><a class="btn primary small" href="${APK_URL}">Scarica</a><button class="btn small" data-act="appUpdateLater">Più tardi</button></span></div>` : ''}
      <div class="panel">
        ${OFFLINE ? `<div class="offbanner">📴 <b>Senza internet</b><br>Puoi giocare contro il computer e fare l'allenamento.
            Amici, classifica e partite online tornano quando sei collegato.
            <div class="row" style="margin-top:6px"><button class="btn small" data-act="goOnline">🔄 Riprova online</button></div></div>`
        : S.social && S.social.nick
          ? `<div class="hello" data-act="profile" title="Il mio profilo"><span class="row">${avatarHTML(S.social.nick, 0, false, S.social.avatar || { e: S.social.nick.charAt(0).toUpperCase(), c: '#f2c14e' })}<span>Ciao, <b>${esc(S.social.nick)}</b>!${S.progress && S.progress.streak && S.progress.streak.streak >= 2 ? ` <span class="streak" title="Giorni di gioco di fila">🔥 ${S.progress.streak.streak}</span>` : ''}${S.progress ? `<span class="lvlline">${lvlHTML(S.progress.level)} <em class="xpbar" title="${S.progress.into}/${S.progress.need} punti esperienza"><u style="width:${Math.round((S.progress.into / S.progress.need) * 100)}%"></u></em></span>` : ''}</span></span>
</div>
            ${S.social.hasPassword === false ? '<div class="offbanner">⚠️ <b>Il tuo profilo non ha una password.</b> Impostala ora, così puoi sempre rientrare. <button class="btn small" data-act="profile">👤 Imposta</button></div>' : ''}`
          : S.signup ? `<div class="mailbox"><p>📧 Ti abbiamo mandato un codice a <b>${esc(S.signup.email)}</b>.</p>
              <p>Scrivilo qui per creare il profilo <b>${esc(S.signup.nick)}</b>:</p>
              <form id="signupform" class="row"><input id="sucode" class="grow" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456"><button class="btn primary">Crea il profilo</button></form>
              <p class="muted small">Non arriva? Guarda anche nello spam, oppure <a href="#" data-act="resendSignup">mandalo di nuovo</a> · <a href="#" data-act="signupBack">cambia i dati</a></p></div>`
          : `<label class="field"><span>Scegli il tuo nickname</span>
              <input type="text" id="nick" maxlength="16" autocomplete="off" placeholder="Es. Simone_88" value="${esc(S.nickDraft != null ? S.nickDraft : (S.name || ''))}"></label>
              <div class="nickstatus" id="nickStatus">${nickStatusHTML()}</div>
              <label class="field"><span>Scegli una password</span>
              <input type="password" id="nickpw" maxlength="100" autocomplete="new-password" placeholder="Almeno 6 caratteri" value="${esc(S.pwDraft || '')}"></label>
              <p class="muted small" style="margin:0 0 6px">Ti serve per entrare dagli altri tuoi dispositivi.</p>
              ${S.mailOn ? `<label class="field"><span>La tua email</span>
              <input type="email" id="nickmail" maxlength="250" autocomplete="email" placeholder="nome@esempio.it" value="${esc(S.mailDraft || '')}"></label>
              <p class="muted small" style="margin:0 0 6px">Se dimentichi la password ti mandiamo un codice per sceglierne una nuova.</p>` : ''}
              <label class="agecheck"><input type="checkbox" id="nickage"${S.ageOk ? ' checked' : ''}><span><span>Ho almeno 14 anni e accetto le regole</span> (<a href="regole.html">Regole</a> · <a href="privacy.html">Privacy</a>)</span></label>
              <div class="row"><button class="btn primary grow" data-act="claimNick">Crea il profilo</button></div>
              <p class="muted small" style="margin:8px 0 0">Il nickname è unico: serve ai tuoi amici per trovarti. Hai già un profilo? <a href="#" data-act="recover">Recuperalo</a></p>`}
        ${homeButtonsHTML()}
      </div>
      ${!OFFLINE && S.myGames && S.myGames.length ? `<div class="panel"><h2>🐢 Le tue partite con calma</h2>
        ${S.myGames.map((m) => `<button class="slowgame ${m.myTurn ? 'myturn' : ''}" data-act="openSlow" data-code="${esc(m.code)}">
          <span class="who">${m.players.filter((x) => x && !x.me).map((x) => esc(x.name)).join(', ') || 'In attesa di giocatori'}</span>
          <span class="meta">${m.ranked ? `<span class="rankbadge" title="${RANKED_TIP}">🏅</span> ` : ''}${m.myTurn ? '<b>Tocca a te!</b>' : m.over ? 'Partita finita' : m.started ? `Smazzata ${m.handNo} · ${m.scores.join(' – ')}` : 'In sala d’attesa'}${m.at ? ` · ${agoText(m.at)}` : ''}</span></button>`).join('')}</div>` : ''}
      ${IS_ANDROID && !IN_APP && !OFFLINE ? `<a class="apkbanner" href="${APK_URL}">
        <img src="icons/icon-192.png" alt=""><span><b>📱 Scarica l'app per Android</b><br>Installala e gioca a schermo intero</span></a>` : ''}
    </div>`;
  }

  /** modalità completa (impostazioni): mostra tutte le opzioni come prima, per chi è pratico */
  const FULL = () => S.prefs.ui === 'completa';

  /**
   * Pulsanti della schermata iniziale: pochi e grandi. Tutto il resto (sfida del giorno, tornei, classifica,
   * statistiche, amici, regole, impostazioni…) sta nel menu «☰ Altro».
   */
  function homeButtonsHTML() {
    if (store.get('bur_lastroom', '') === '🤖') store.set('bur_lastroom', ''); // codice delle partite sul telefono: non è un tavolo
    const last = !OFFLINE && (store.get('bur_lastroom', '') || (savedLocalGame() ? '🤖' : ''));
    const reqs = S.social && S.social.reqIn ? S.social.reqIn.length : 0;
    return `<div class="homebtns">
      ${S.pendingJoin && !OFFLINE ? `<div class="invitebox">✉️ Sei stato invitato al tavolo <b>${esc(S.pendingJoin)}</b>
        <button class="btn primary big grow" data-act="joinCode" data-code="${esc(S.pendingJoin)}">Entra al tavolo</button></div>` : ''}
      ${last ? `<button class="btn primary big grow" data-act="rejoin">↩ Torna alla partita</button>` : ''}
      ${S.tourMatch && !S.room ? `<div class="tourready">🏆 ${esc(S.tourMatch.text)} <button class="btn small primary" data-act="tourPlay" data-code="${esc(S.tourMatch.code)}">▶ Gioca</button></div>` : ''}
      ${OFFLINE ? '' : `<button class="btn ${last ? '' : 'primary'} big grow homebtn" data-act="quickMenu" data-mode="casual"><span>🃏</span><div>Amichevole online<small>Trova un tavolo · senza punti classifica</small></div></button>
      <button class="btn big grow homebtn" data-act="quickMenu" data-mode="ranked"><span>🏅</span><div>Classificata<small>Gioca per il tuo punteggio Elo</small></div></button>`}
      ${OFFLINE ? '' : `<button class="btn big grow homebtn" data-act="playFriends"><span>👥</span>Gioca con gli amici</button>`}
      <button class="btn ${OFFLINE && !last ? 'primary' : ''} big grow homebtn" data-act="playBots"><span>🤖</span>Gioca contro il computer</button>
      ${CAMPAIGN_VISIBLE ? '<button class="btn grow campaign-entry" data-act="campaign">🌱 Avventura<small>Tre percorsi: Burraco, Scala 40 e Ramino</small></button>' : ''}
      <button class="btn ghost grow" data-act="tutorial">📖 Regole e tutorial</button>
      ${FULL() && !OFFLINE ? `<div class="row"><button class="btn grow" data-act="quickMenu">🃏 Amichevole online</button><button class="btn grow dailybtn" data-act="daily">📅 Sfida del giorno</button><button class="btn grow tourbtn" data-act="tournaments">🏆 Tornei</button></div>` : ''}
      <button class="btn ghost grow morebtn" data-act="more">☰ Altro${reqs ? ` <span class="pill">${reqs}</span>` : ''}</button>
    </div>`;
  }

  /** menu «Altro»: tutte le funzioni che non servono per iniziare a giocare */
  function moreModal() {
    const so = S.social || {};
    const reqs = so.reqIn ? so.reqIn.length : 0;
    const item = (act, icon, label, extra = '') => `<button class="menuitem" data-act="${act}"><span>${icon}</span>${label}${extra}</button>`;
    openModal('more', `<h2>☰ Altro</h2><div class="menulist">
      ${so.nick ? item('profile', '👤', 'Il mio profilo') + item('friends', '👥', 'Amici', reqs ? ` <span class="pill">${reqs}</span>` : '') : ''}
      ${OFFLINE ? '' : item('daily', '📅', 'Sfida del giorno') + item('quickMenu', '⚡', 'Amichevole online') + item('tournaments', '🏆', 'Tornei') + item('leaders', '🏅', 'Classifica')}
      ${item('stats', '📊', 'Le mie statistiche')}
      ${item('gamesRules', '📖', 'Regole dei giochi')}
      ${item('howto', '❓', 'Come si usa l\'app')}
      ${item('settings', '⚙️', 'Impostazioni')}
      ${OFFLINE ? '' : item('report', '🐞', 'Segnala un problema')}
      <a class="menuitem" href="regole.html"><span>📜</span>Regole di comportamento</a>
      <a class="menuitem" href="privacy.html"><span>🔒</span>Privacy</a></div>`);
  }

  /** elenco dei giochi e delle varianti con la loro descrizione (prima stava nella schermata iniziale) */
  function gamesRulesModal() {
    const list = R.PRESETS.concat([S40R.PRESET, OTHER.ramino.PRESET, CANR.PRESET, OTHER.scopa.PRESET, OTHER.scopa.PRESETS[1], OTHER.briscola.PRESET, OTHER.briscola5.PRESET, OTHER.tressette.PRESET, OTHER.rubamazzetto.PRESET]);
    openModal('gamesRules', `<h2>📖 Regole dei giochi</h2><p class="muted small">Tocca un gioco per leggerne le regole.</p>
      <div class="presets">${list.map((p) => `<button class="preset" data-act="presetRules" data-id="${p.id}"><b>${esc(p.name)}</b><span>${esc(p.tagline)}</span></button>`).join('')}</div>`);
  }

  /** gioco scelto nella schermata "Nuova partita" (lo Scopone è una Scopa con un'altra distribuzione) */
  const pickedGame = (r) => (r.game === 'scopa' && r.deal && r.deal !== 3 ? 'scopone' : r.game || 'burraco');

  const GAME_TILES = [['burraco', '🃏', 'Burraco'], ['scala40', '🪜', 'Scala 40'], ['ramino', '🧩', 'Ramino'], ['canasta', '🧺', 'Canasta'],
    ['scopa', '🧹', 'Scopa'], ['scopone', '🤝', 'Scopone'], ['briscola', '🍷', 'Briscola'],
    ['briscola5', '🖐️', 'Briscola in 5'], ['tressette', '3️⃣', 'Tressette'], ['rubamazzetto', '🦝', 'Rubamazzetto']];

  /**
   * Nuova partita, in due tocchi: il gioco (griglia di riquadri grandi) e «Inizia».
   * Varianti e regole personalizzate restano in «Regole e varianti» (aperto in modalità completa).
   */
  function setupHTML() {
    const friends = S.playMode === 'friends' && !OFFLINE;
    const pf = RX.schema(S.rules).find((f) => f.key === 'players');
    const adv = S.setupAdvanced || FULL();
    return `<div class="page">
      <div class="row"><button class="btn ghost small" data-act="goHome">← Indietro</button></div>
      ${friends ? `<div class="panel joinbox"><b>Un amico ti ha dato un codice?</b>
        <div class="row" style="margin-top:6px"><input type="text" id="joinCode" class="grow codein" maxlength="4" placeholder="Codice" value="${esc(S.pendingJoin)}"><button class="btn primary" data-act="join">Entra</button></div></div>` : ''}
      <h2 class="bigtitle">${friends ? 'Oppure crea un tavolo: a cosa giocate?' : 'A cosa vuoi giocare?'}</h2>
      <div class="gamegrid">${GAME_TILES.map(([id, icon, name]) => `<button class="gtile ${pickedGame(S.rules) === id ? 'on' : ''}" data-act="pickGame" data-game="${id}"><span>${icon}</span>${name}</button>`).join('')}</div>
      <div class="panel">
        ${pf ? `<h3>Quanti giocatori?</h3><div class="row">${pf.choices.map(([v, l]) => `<button class="swatch big ${Number(S.rules.players) === Number(v) ? 'on' : ''}" data-act="pickPlayers" data-n="${v}">${esc(l)}</button>`).join('')}</div>` : ''}
        ${friends ? '' : `<h3>Difficoltà del computer</h3><div class="row">${[['auto', 'Automatica'], ['facile', 'Facile'], ['normale', 'Normale'], ['difficile', 'Difficile'], ['esperto', 'Esperto']].map(([v, label]) => `<button class="swatch ${(S.prefs.botLevel || 'auto') === v ? 'on' : ''}" data-act="setupBotLevel" data-val="${v}" aria-pressed="${(S.prefs.botLevel || 'auto') === v}">${label}</button>`).join('')}</div><p class="muted small">Automatica: si adatta ai tuoi risultati.</p>`}
        <div class="row" style="margin-top:12px">${friends
          ? '<button class="btn primary big grow" data-act="create">👥 Crea il tavolo</button>'
          : '<button class="btn primary big grow" data-act="createBots">▶ Inizia la partita</button>'}</div>
        <div class="row" style="margin-top:10px;justify-content:center"><button class="btn ghost small" data-act="previewRules">📜 Come si gioca</button><button class="btn ghost small" data-act="setupAdvanced">${adv ? '▴' : '▾'} Regole e varianti</button></div>
        ${adv ? `${RX.isOther(S.rules) ? '' : `<h3 style="margin-top:12px">Variante</h3>${presetsHTML(S.rules)}`}
        <details class="custom" ${S.customOpen ? 'open' : ''}>
          <summary>Personalizza le regole ${rulesStatus(S.rules)}</summary>
          ${rulesFormHTML(S.rules)}
        </details>` : ''}
      </div>
    </div>`;
  }

  /** "2 min fa", "3 ore fa", "ieri"… */
  function agoText(t) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'adesso';
    if (m < 60) return `${m} min fa`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} ${h === 1 ? 'ora' : 'ore'} fa`;
    const d = Math.round(h / 24);
    return d === 1 ? 'ieri' : `${d} giorni fa`;
  }

  const lvlHTML = (lv) => (lv ? `<span class="lvl" title="Livello ${lv}">${lv}</span>` : '');

  const SEAT_COLORS = ['#f2c14e', '#64b5f6', '#ef7d7d', '#81c784'];
  function avatarHTML(name, seat, isBot, av) {
    if (av && !isBot) return `<span class="avatar emo ${av.f ? 'fr-' + esc(av.f) : ''}" style="--c:${esc(av.c)}">${esc(av.e)}</span>`;
    const initial = esc((name || '?').trim().charAt(0).toUpperCase());
    return `<span class="avatar" style="--c:${SEAT_COLORS[seat % 4]}">${isBot ? '🤖' : initial}</span>`;
  }

  function lobbyHTML() {
    const r = S.room;
    const isHost = r.isHost;
    const full = FULL();
    const seats = r.seats.map((s, i) => {
      const me = i === r.you;
      let right = '';
      if (!s) {
        right = `<div class="row">${full && r.you >= 0 ? `<button class="btn small" data-act="sit" data-seat="${i}">Siedi qui</button>` : ''}
          ${isHost ? `<button class="btn small" data-act="addBot" data-seat="${i}" title="Metti il computer">🤖 Computer</button>` : ''}</div>`;
      } else if (s.isBot && isHost) right = `<button class="btn small" data-act="removeSeat" data-seat="${i}">Togli</button>`;
      const team = r.n === 4 && !RX.isS40(r.rules) && r.rules.game !== 'rubamazzetto' ? `<span class="teamtag">Coppia ${i % 2 === 0 ? 'A' : 'B'}</span>` : '';
      return `<div class="seat">
        <div class="who">${s ? avatarHTML(s.name, i, s.isBot, s.avatar) : '<span class="avatar empty">?</span>'}
        <div>${s ? `<b>${esc(s.name)}</b> ${lvlHTML(s.level)}${me ? ' <span class="badge">tu</span>' : ''}${s.connected ? '' : ' <span class="muted">(offline)</span>'}` : '<span class="muted">In attesa di un giocatore…</span>'}<br>${team}</div>
        </div>${right}</div>`;
    }).join('');
    const filled = r.seats.filter(Boolean).length;
    const ready = r.seats.every(Boolean);
    const hostName = r.seats[r.host] ? r.seats[r.host].name : '';
    return `<div class="page">
      <div class="row"><button class="btn ghost small" data-act="leave">← Esci dal tavolo</button></div>
      <div class="panel" style="text-align:center">
        <h2 class="bigtitle">${esc(RX.gameName(r.rules))}: invita gli amici</h2>
        <div class="muted">Codice del tavolo</div>
        <div class="code">${esc(r.code)}</div>
        <div class="row" style="justify-content:center"><button class="btn primary big" data-act="share">📤 Manda l'invito</button></div>
        <div class="row" style="justify-content:center;margin-top:6px"><button class="btn ghost small" data-act="copy">Copia il link</button>${S.social && S.social.nick ? '<button class="btn ghost small" data-act="friends">👥 Dai miei amici</button>' : ''}</div>
      </div>
      <div class="panel">
        <h2>Giocatori (${filled}/${r.n}) ${r.ranked ? `<span class="rankbadge" title="${RANKED_TIP}">🏅 Classificata</span>` : ''}</h2>
        ${r.quick ? `<p class="muted">${r.queueMode === 'casual' ? 'Amichevole online' : 'Classificata'} · ${Games2.idOf(r.rules) === 'burraco' ? 'Burraco Classico' : esc(RX.gameName(r.rules))} · ${r.n} giocatori.<br>In cerca di altri ${r.n - filled} giocatori. La partita parte appena il tavolo è pieno.</p>` : ''}
        ${r.quick && !r.ranked ? '<p class="muted small">Partita amichevole: il punteggio Elo non cambia.</p>' : ''}
        <div class="seats">${seats}</div>
        ${isHost ? `<div class="row" style="margin-top:12px">
            <button class="btn primary big grow" data-act="${ready ? 'start' : 'startFill'}">${r.quick && !ready ? 'Gioca amichevole con il computer' : '▶ Inizia la partita'}</button></div>
            ${ready ? '' : '<p class="muted small" style="text-align:center">I posti ancora vuoti li prende il computer.</p>'}`
          : `<p class="muted" style="text-align:center">Aspettiamo che ${esc(hostName)} inizi la partita…</p>`}
      </div>
      <details class="panel tableset" ${full ? 'open' : ''}>
        <summary>⚙️ Impostazioni del tavolo</summary>
        <p>${rulesStatus(r.rules)} <span class="muted">· ${r.n} giocatori · si vince a ${r.rules.target}</span></p>
        <div class="row"><button class="btn small" data-act="music">🎵 Musica del tavolo${r.music ? ' (attiva)' : ''}</button></div>
        <div class="row" style="margin-top:8px"><button class="btn small" data-act="roomRules">📜 Leggi le regole</button>
        ${isHost && !r.quick ? '<button class="btn small" data-act="editRules">✏️ Modifica regole</button>' : ''}</div>
        ${isHost && !r.quick ? `<h3 style="margin-top:14px">Torneo</h3>${seriesPickHTML(r.series && r.series.bestOf)}` : r.series ? `<p>🏆 Torneo al meglio di ${r.series.bestOf}</p>` : ''}
        ${isHost && !r.quick && !r.daily && !r.tutorial ? `<h3 style="margin-top:14px">Ritmo della partita</h3>
          <div class="row"><button class="swatch ${r.slow ? '' : 'on'}" data-act="setSlow" data-val="0">⚡ Normale</button><button class="swatch ${r.slow ? 'on' : ''}" data-act="setSlow" data-val="1">🐢 Con calma</button></div>
          <p class="muted small">Con calma: ognuno gioca il suo turno quando può, anche ore dopo. Puoi uscire quando vuoi: il posto resta tuo, la partita ti aspetta e ti avvisiamo quando tocca a te.</p>`
          : r.slow ? '<p>🐢 <b>Partita con calma</b>: ognuno gioca quando può, ti avvisiamo quando tocca a te.</p>' : ''}
        ${isHost ? `<h3 style="margin-top:14px">Aiuto: dove attaccare le carte</h3>${aidsHTML(r.aids !== false)}` : ''}
        ${isHost ? `<h3 style="margin-top:14px">Tempo per turno</h3>${turnTimeHTML(r.turnTime)}
          <p class="muted small">Allo scadere il gioco pesca e scarta al posto del giocatore.</p>` : ''}
        ${isHost ? `<h3 style="margin-top:14px">Bravura del computer</h3>${botLevelHTML(r.botLevel)}` : ''}
        ${isHost ? `<h3 style="margin-top:14px">Velocità del computer</h3>${botSpeedHTML(r.botSpeed)}` : ''}
        ${isHost ? '<div class="row" style="margin-top:14px"><button class="btn small" data-act="closeTable">🚪 Chiudi il tavolo</button></div>' : ''}
      </details>
    </div>`;
  }
