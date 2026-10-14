/* Burraco — Schermate: iniziale, nuova partita, sala d'attesa.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Schermate ================= */
  function render() {
    if (S.drag && S.drag.started) { S.pendingRender = true; return; }
    S.pendingRender = false;
    const app = $('#app');
    if (S.screen === 'home') app.innerHTML = homeHTML();
    else if (S.screen === 'setup') app.innerHTML = setupHTML();
    else if (S.screen === 'lobby') app.innerHTML = lobbyHTML();
    else if (S.screen === 'game') {
      app.innerHTML = gameHTML();
      afterGameRender();
    }
    if (!S.connected) {
      app.insertAdjacentHTML('afterbegin', `<div class="offline"><span class="spin"></span>${S.lostConnection ? '📡 Connessione persa: mi ricollego…' : 'Connessione al server…'}</div>`);
      const gm = $('.game');
      if (gm) gm.classList.add('offline-lock');
    }
  }

  const APK_URL = 'https://github.com/simonemuliello010500-web/BurracoByMSF/releases/latest/download/Burraco.apk';
  const IS_ANDROID = /android/i.test(navigator.userAgent);
  const IN_APP = /BurracoApp/.test(navigator.userAgent);
  // versione dell'app installata (0 = APK vecchio, senza numero)
  const APP_VERSION = IN_APP ? Number((navigator.userAgent.match(/BurracoApp\/(\d+)/) || [])[1] || 0) : null;

  /**
   * Aggiornamento dell'app: si chiede a GitHub qual è l'ultimo APK pubblicato (tag apk-N).
   * Se è più nuovo di quello installato compare un avviso con il link per scaricarlo.
   * Il controllo si fa al massimo ogni 6 ore; «Più tardi» nasconde l'avviso per quella versione.
   */
  async function checkAppUpdate() {
    if (!IN_APP || OFFLINE) return;
    let latest = null;
    const cached = store.get('bur_apk_latest', null);
    if (cached && Date.now() - cached.at < 6 * 3600 * 1000) latest = cached.n;
    else {
      try {
        const r = await fetch('https://api.github.com/repos/simonemuliello010500-web/BurracoByMSF/releases/latest', { cache: 'no-store' });
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

  function homeHTML() {
    const fan = [{ r: 1, s: 'S' }, { r: 13, s: 'H' }, { r: 0, s: 'J' }, { r: 2, s: 'D' }, { r: 7, s: 'C' }]
      .map((c, i) => cardHTML({ ...c, id: -1 - i }, 'logo-card', `style="--i:${i - 2}"`)).join('');
    return `<div class="page">
      <div class="logo"><div class="logo-fan">${fan}</div><h1>Smazzata</h1>
        <div class="muted">Gioca con gli amici o contro il computer</div></div>
      ${S.appUpdate && !S.appUpdate.dismissed ? `<div class="apkbanner update">
        <img src="icons/icon-192.png" alt=""><span><b>📲 Nuova versione dell'app</b><br>Scaricala e installala sopra quella che hai: profilo e partite restano.</span>
        <span class="updbtns"><a class="btn primary small" href="${APK_URL}">Scarica</a><button class="btn small" data-act="appUpdateLater">Più tardi</button></span></div>` : ''}
      <div class="panel">
        ${OFFLINE ? `<div class="offbanner">📴 <b>Senza internet</b><br>Puoi giocare contro il computer e fare l'allenamento.
            Amici, classifica e partite online tornano quando sei collegato.
            <div class="row" style="margin-top:6px"><button class="btn small" data-act="goOnline">🔄 Riprova online</button></div></div>`
        : S.social && S.social.nick
          ? `<div class="hello"><span class="row">${avatarHTML(S.social.nick, 0, false, S.social.avatar || { e: S.social.nick.charAt(0).toUpperCase(), c: '#f2c14e' })}<span>Ciao, <b>${esc(S.social.nick)}</b>!${S.progress ? `<span class="lvlline">${lvlHTML(S.progress.level)} <em class="xpbar" title="${S.progress.into}/${S.progress.need} punti esperienza"><u style="width:${Math.round((S.progress.into / S.progress.need) * 100)}%"></u></em></span>` : ''}</span></span>
              <span class="row"><button class="btn small" data-act="profile">👤 Profilo</button>
              <button class="btn small" data-act="friends">👥 Amici${S.social.reqIn.length ? ` <span class="pill">${S.social.reqIn.length}</span>` : ''}</button></span></div>`
          : `<label class="field"><span>Scegli il tuo nickname</span>
              <input type="text" id="nick" maxlength="16" autocomplete="off" placeholder="Es. Simone_88" value="${esc(S.nickDraft != null ? S.nickDraft : (S.name || ''))}"></label>
              <div class="nickstatus" id="nickStatus">${nickStatusHTML()}</div>
              <div class="row"><button class="btn primary grow" data-act="claimNick">Conferma nickname</button></div>
              <p class="muted small" style="margin:8px 0 0">Il nickname è unico: serve ai tuoi amici per trovarti. Hai già un profilo? <a href="#" data-act="recover">Recuperalo</a> · <a href="privacy.html">Privacy</a></p>`}
        <div class="row" style="margin-top:10px"><button class="btn primary grow big" data-act="goSetup">Nuova partita</button></div>
        ${!OFFLINE && store.get('bur_lastroom', '') ? `<div class="row" style="margin-top:8px"><button class="btn primary grow" data-act="rejoin">↩ Torna al tavolo ${esc(store.get('bur_lastroom', ''))}</button></div>` : ''}
        ${OFFLINE ? '<div class="row" style="margin-top:8px"><button class="btn grow" data-act="tutorial">🎓 Impara a giocare</button></div>'
        : `<div class="row" style="margin-top:8px"><button class="btn grow" data-act="quickMenu">⚡ Gioca subito</button><button class="btn grow" data-act="tutorial">🎓 Impara a giocare</button></div>
        <div class="row" style="margin-top:8px"><button class="btn grow dailybtn" data-act="daily">📅 Sfida del giorno</button><button class="btn grow tourbtn" data-act="tournaments">🏆 Tornei</button></div>
        ${S.tourMatch && !S.room ? `<div class="tourready">🏆 ${esc(S.tourMatch.text)} <button class="btn small primary" data-act="tourPlay" data-code="${esc(S.tourMatch.code)}">▶ Gioca</button></div>` : ''}
        <div class="row" style="margin-top:10px">
          <input type="text" id="joinCode" class="grow codein" maxlength="4" placeholder="Codice tavolo" value="${esc(S.pendingJoin)}">
          <button class="btn" data-act="join">Entra</button>
        </div>`}
        ${S.pendingJoin ? '<p class="muted">Sei stato invitato al tavolo: scrivi il tuo nome e premi Entra.</p>' : ''}
      </div>
      ${!OFFLINE && S.myGames && S.myGames.length ? `<div class="panel"><h2>🐢 Le tue partite con calma</h2>
        ${S.myGames.map((m) => `<button class="slowgame ${m.myTurn ? 'myturn' : ''}" data-act="openSlow" data-code="${esc(m.code)}">
          <span class="who">${m.players.filter((x) => x && !x.me).map((x) => esc(x.name)).join(', ') || 'In attesa di giocatori'}</span>
          <span class="meta">${m.myTurn ? '<b>Tocca a te!</b>' : m.over ? 'Partita finita' : m.started ? `Smazzata ${m.handNo} · ${m.scores.join(' – ')}` : 'In sala d’attesa'}${m.at ? ` · ${agoText(m.at)}` : ''}</span></button>`).join('')}</div>` : ''}
      ${IS_ANDROID && !IN_APP && !OFFLINE ? `<a class="apkbanner" href="${APK_URL}">
        <img src="icons/icon-192.png" alt=""><span><b>📱 Scarica l'app per Android</b><br>Installala e gioca a schermo intero</span></a>` : ''}
      <div class="panel">
        <h2>Regole e varianti</h2>
        <p class="muted">Ogni preset è un punto di partenza: quando crei una partita puoi modificare ogni singola regola.</p>
        <div class="presets">${R.PRESETS.concat([S40R.PRESET, CANR.PRESET, OTHER.scopa.PRESET, OTHER.scopa.PRESETS[1], OTHER.briscola.PRESET, OTHER.briscola5.PRESET, OTHER.tressette.PRESET, OTHER.rubamazzetto.PRESET, OTHER.settemezzo.PRESET]).map((p) => `<button class="preset" data-act="presetRules" data-id="${p.id}"><b>${esc(p.name)}</b><span>${esc(p.tagline)}</span></button>`).join('')}</div>
        <div class="row" style="margin-top:10px"><button class="btn ghost small" data-act="howto">Come si gioca nell'app</button><button class="btn ghost small" data-act="settings">⚙️ Aspetto e suoni</button><button class="btn ghost small" data-act="toggleTheme">${S.prefs.theme === 'scuro' ? '☀️ Tema chiaro' : '🌙 Tema scuro'}</button><button class="btn ghost small" data-act="stats">📊 Statistiche</button>${OFFLINE ? '' : '<button class="btn ghost small" data-act="leaders">🏆 Classifica</button><button class="btn ghost small" data-act="report">🐞 Segnala un problema</button>'}</div>
        <p class="muted small" style="margin:10px 0 0;text-align:center"><a href="privacy.html" style="color:inherit">🔒 Privacy: quali dati usiamo e come cancellarli</a></p>
      </div>
    </div>`;
  }

  /** gioco scelto nella schermata "Nuova partita" (lo Scopone è una Scopa con un'altra distribuzione) */
  const pickedGame = (r) => (r.game === 'scopa' && r.deal && r.deal !== 3 ? 'scopone' : r.game || 'burraco');

  function setupHTML() {
    return `<div class="page">
      <div class="row"><button class="btn ghost small" data-act="goHome">← Indietro</button></div>
      <h2>Nuova partita</h2>
      <div class="panel">
        <h2>1. Scegli il gioco</h2>
        <div class="gamepick">${[['burraco', '🃏 Burraco', 'A coppie o da soli: burraco, pozzetti e tante varianti'],
          ['scala40', '🂡 Scala 40', 'Ognuno per sé: apri con 40 punti, chi arriva a 101 è fuori'],
          ['canasta', '🎴 Canasta', 'La classica: carte uguali, canaste, tre rossi e monte congelato'],
          ['scopa', '🧹 Scopa', 'Carte italiane: prendi, fai scopa, conta denari e primiera'],
          ['scopone', '🧹 Scopone', 'In quattro a coppie: 10 carte a testa, tavola vuota, napola'],
          ['briscola', '🍷 Briscola', 'Carte italiane: prese, carichi e briscole, vince chi fa 61'],
          ['briscola5', '🍷 Briscola in 5', 'La chiamata del Sud: asta, carta chiamata e socio segreto'],
          ['tressette', '🂱 Tressette', 'Carte italiane a coppie: si risponde al seme, contano Assi, Due, Tre e figure'],
          ['rubamazzetto', '🃁 Rubamazzetto', 'Facile e veloce: prendi le carte uguali e ruba il mazzetto agli altri'],
          ['settemezzo', '🎲 Sette e mezzo', 'Chiedi carte e avvicinati a 7 e mezzo senza sballare (fiches finte)']]
          .map(([id, name, sub]) => `<button class="preset ${pickedGame(S.rules) === id ? 'active' : ''}" data-act="pickGame" data-game="${id}"><b>${name}</b><span>${sub}</span></button>`).join('')}</div>
        ${RX.isOther(S.rules) ? '' : `<h2 style="margin-top:12px">Variante</h2>${presetsHTML(S.rules)}`}
        <details class="custom" ${S.customOpen ? 'open' : ''}>
          <summary>2. Personalizza le regole ${rulesStatus(S.rules)}</summary>
          ${rulesFormHTML(S.rules)}
        </details>
        <div class="row" style="margin-top:12px"><button class="btn ghost small" data-act="previewRules">📜 Leggi le regole di questa partita</button></div>
      </div>
      <div class="panel">
        <h2>3. Gioca</h2>
        ${OFFLINE ? '<div class="row"><button class="btn primary grow big" data-act="createBots">Gioca contro il computer</button></div>'
        : `<div class="row"><button class="btn primary grow big" data-act="create">Crea tavolo e invita amici</button></div>
        <div class="row" style="margin-top:8px"><button class="btn grow" data-act="createBots">Gioca subito contro il computer</button></div>
        <p class="muted">Nel tavolo online potrai riempire i posti vuoti con giocatori del computer.</p>`}
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
    const seats = r.seats.map((s, i) => {
      const me = i === r.you;
      let right = '';
      if (!s) {
        right = `<div class="row">${r.you >= 0 ? `<button class="btn small" data-act="sit" data-seat="${i}">Siedi qui</button>` : ''}
          ${isHost ? `<button class="btn small" data-act="addBot" data-seat="${i}">+ Computer</button>` : ''}</div>`;
      } else if (s.isBot && isHost) right = `<button class="btn small danger" data-act="removeSeat" data-seat="${i}">Togli</button>`;
      const team = r.n === 4 && !RX.isS40(r.rules) ? `<span class="teamtag">Coppia ${i % 2 === 0 ? 'A' : 'B'}</span>` : '';
      return `<div class="seat">
        <div class="who">${s ? avatarHTML(s.name, i, s.isBot, s.avatar) : '<span class="avatar empty">?</span>'}
        <div>${s ? `<b>${esc(s.name)}</b> ${lvlHTML(s.level)}${me ? ' <span class="badge">tu</span>' : ''}${i === r.host ? ' <span class="badge">host</span>' : ''}${s.connected ? '' : ' <span class="muted">(offline)</span>'}` : '<span class="muted">Posto libero</span>'}<br>${team}</div>
        </div>${right}</div>`;
    }).join('');
    const full = r.seats.every(Boolean);
    return `<div class="page">
      <div class="row"><button class="btn ghost small" data-act="leave">← Esci dal tavolo</button></div>
      <div class="panel" style="text-align:center">
        <div class="muted">Codice tavolo</div>
        <div class="code">${esc(r.code)}</div>
        <div class="row" style="justify-content:center"><button class="btn primary" data-act="friends">👥 Invita amici</button><button class="btn" data-act="share">Condividi link</button><button class="btn" data-act="copy">Copia</button></div>
        <p class="muted">Gli amici aprono il link oppure scrivono il codice nella schermata iniziale.</p>
      </div>
      <div class="panel">
        <h2>Giocatori (${r.seats.filter(Boolean).length}/${r.n})</h2>
        ${r.quick ? '<p class="muted">⚡ Tavolo veloce: la partita parte da sola appena il tavolo è pieno. Se non arriva nessuno, l\'host può riempirlo con il computer.</p>' : ''}
        <div class="seats">${seats}</div>
        ${isHost ? `<div class="row" style="margin-top:12px">
            ${full ? '' : '<button class="btn" data-act="fillBots">Riempi con il computer</button>'}
            <button class="btn primary grow" data-act="start" ${full ? '' : 'disabled'}>Avvia partita</button></div>
          <div class="row" style="margin-top:8px"><button class="btn small" data-act="closeTable">🚪 Chiudi il tavolo</button></div>`
          : '<p class="muted">In attesa che l\'host avvii la partita…</p>'}
      </div>
      <div class="panel">
        <h2>Regole</h2>
        <p>${rulesStatus(r.rules)} <span class="muted">· ${r.n} giocatori · si vince a ${r.rules.target}</span></p>
        <div class="row"><button class="btn small" data-act="music">🎵 Musica del tavolo${r.music ? ' (attiva)' : ''}</button></div>
        <div class="row" style="margin-top:8px"><button class="btn small" data-act="roomRules">📜 Leggi le regole</button>
        ${isHost ? '<button class="btn small" data-act="editRules">✏️ Modifica regole</button>' : ''}</div>
        ${isHost ? `<h2 style="margin-top:14px">Torneo</h2>${seriesPickHTML(r.series && r.series.bestOf)}` : r.series ? `<p>🏆 Torneo al meglio di ${r.series.bestOf}</p>` : ''}
        ${isHost && !r.daily && !r.tutorial ? `<h2 style="margin-top:14px">Ritmo della partita</h2>
          <div class="row"><button class="swatch ${r.slow ? '' : 'on'}" data-act="setSlow" data-val="0">⚡ Normale</button><button class="swatch ${r.slow ? 'on' : ''}" data-act="setSlow" data-val="1">🐢 Con calma</button></div>
          <p class="muted small">Con calma: ognuno gioca il suo turno quando può, anche ore dopo. Puoi uscire quando vuoi: il posto resta tuo, la partita ti aspetta e ti avvisiamo quando tocca a te.</p>`
          : r.slow ? '<p>🐢 <b>Partita con calma</b>: ognuno gioca quando può, ti avvisiamo quando tocca a te.</p>' : ''}
        ${isHost ? `<h2 style="margin-top:14px">Aiuto: dove attaccare le carte</h2>${aidsHTML(r.aids !== false)}` : ''}
        ${isHost ? `<h2 style="margin-top:14px">Tempo per turno</h2>${turnTimeHTML(r.turnTime)}
          <p class="muted small">Allo scadere il gioco pesca e scarta al posto del giocatore.</p>` : ''}
        ${isHost ? `<h2 style="margin-top:14px">Bravura del computer</h2>${botLevelHTML(r.botLevel)}` : ''}
        ${isHost ? `<h2 style="margin-top:14px">Velocità del computer</h2>${botSpeedHTML(r.botSpeed)}` : ''}
      </div>
    </div>`;
  }
