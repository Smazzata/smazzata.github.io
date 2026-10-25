/* Burraco — Schermate: iniziale, nuova partita, sala d'attesa.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Schermate ================= */
  function render() {
    Music.sync();
    if (S.drag && S.drag.started) { S.pendingRender = true; return; }
    S.pendingRender = false;
    const app = $('#app');
    const changed = S.lastScreen !== S.screen;
    const draft = !changed && document.activeElement?.closest('#app') && document.activeElement.matches('input:not([type=radio]):not([type=checkbox]), textarea') ? {id:document.activeElement.id,value:document.activeElement.value,start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd} : null;
    S.lastScreen = S.screen;
    if (S.screen === 'home') app.innerHTML = homeHTML();
    else if (S.screen === 'leaders') { app.innerHTML = leadersHTML(); afterLeaguesRender(); }
    else if (S.screen === 'rankedOverview') app.innerHTML = rankedOverviewHTML();
    else if (S.screen === 'campaign') app.innerHTML = campaignHTML();
    else if (S.screen === 'setup') app.innerHTML = setupHTML();
    else if (S.screen === 'lobby') app.innerHTML = lobbyHTML();
    else if (S.screen === 'rankedLobby') app.innerHTML = rankedLobbyHTML();
    else if (S.screen === 'game') {
      S.flipFrom = changed ? null : cardRects();
      app.innerHTML = gameHTML();
      afterGameRender();
      campaignDecorateTable();
    }
    if (changed && app.firstElementChild) app.firstElementChild.classList.add('enter');
    if (S.screen === 'home' && !store.get('smazzata_intro_seen', false) && !S.modalKind && !S.pendingJoin && !S.room) {
      setTimeout(() => {
        if (S.screen === 'home' && !S.modalKind && !store.get('smazzata_intro_seen', false)) firstRunModal();
      }, 450);
    }
    campaignStoryMount();
    if (draft?.id) {
      const field = document.getElementById(draft.id);
      if (field) { field.value = draft.value; field.focus({preventScroll:true}); if (draft.start != null) field.setSelectionRange(draft.start,draft.end); }
    }
    if ((!S.connected || S.syncPending) && !S.localGame && !S.campaignActive && S.screen !== 'campaign') {
      app.insertAdjacentHTML('afterbegin', `<div class="offline" role="status" aria-live="polite"><span class="spin" aria-hidden="true"></span>${t(S.lostConnection || S.room ? "Ti stiamo ricollegando, attendi." : "Collegamento in corso, attendi.")}<button class="btn small" data-act="reconnect">${t("Riprova")}</button></div>`);
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
    if (!S.appUpdate.dismissed) toast('È disponibile un aggiornamento dell\'app');
    if (S.screen === 'home') render();
  }

  /** profilo senza email confermata (creato prima che fosse obbligatoria): prima si conferma, poi si gioca */
  function emailGateHTML() {
    const so = S.social;
    const pending = S.gatePending || so.emailPending;
    return `<div class="page">
      <div class="logo"><h1 translate="no">Smazzata</h1></div>
      <div class="panel gate"><h3><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-mail /></svg> Conferma la tua email</h3>
        <p>Per usare il profilo <b>${esc(so.nick)}</b> conferma la tua email: ti mandiamo un codice di 6 cifre. Serve per recuperare la password.</p>
        <form id="gatemailform" class="row"><input id="gatemail" type="email" class="grow" maxlength="250" autocomplete="email" placeholder="nome@esempio.it" value="${esc(pending || '')}"><button class="btn">${pending ? 'Manda di nuovo' : 'Manda il codice'}</button></form>
        ${pending ? verifyEmailHTML(pending) : ''}
        <p class="muted small" style="margin-top:10px"><a href="#" data-act="recover">Usa un altro profilo</a></p></div></div>`;
  }

  function homeToolbarHTML() {
    return `<div class="home-toolbar"><div class="home-game"><span id="homeGameLabel">${t('Scegli il gioco')}</span><button id="homeGame" class="home-game-trigger" data-act="homeGameMenu" aria-haspopup="dialog" aria-labelledby="homeGameLabel homeGameName"><span class="home-game-symbol" aria-hidden="true">${gameIcon(homeGame())}</span><b id="homeGameName">${esc(GAME_TILES.find(([id])=>id===homeGame())[2])}</b><span class="home-game-chevron" aria-hidden="true">⌄</span></button></div></div>`;
  }
  function homeNavigationHTML(){
    return `<nav class="home-navigation" aria-label="${t('Menu principale')}">${!OFFLINE&&S.social?.nick?`<button data-act="collection">${uiIcon('cards')}<span>${t('Collezione')}</span></button><button data-act="friends">${uiIcon('friends')}<span>${t('Amici')}</span>${S.social.reqIn?.length?'<b>'+S.social.reqIn.length+'</b>':''}</button>`:''}<button data-act="more">${uiIcon('menu')}<span>${t('Menu')}</span></button></nav>`;
  }
  function homeProgressHTML(){
    if(OFFLINE||!S.social?.nick)return '';
    const next=S.social.nextChest,remaining=Math.max(0,Math.min(2,Number(next?.remaining??2)));
    const label=next?.limit?t('Per oggi hai ottenuto la chest giornaliera.'):remaining===1?t('Ancora una partita per la prossima chest'):t('Ancora {0} partite per la prossima chest').replace('{0}',String(remaining));
    return `<button class="home-journey home-progress" data-act="journey"><span>${label}<progress max="2" value="${next?.limit?2:2-remaining}" aria-label="${t('Progressi verso la prossima chest')}"></progress></span><span aria-hidden="true">›</span></button>`;
  }
  function menuCardsHTML(title,items,back='more'){
    return `<section class="simple-menu">${back?`<button class="menu-back" data-act="${back}">← ${t('Menu')}</button>`:''}<h2>${t(title)}</h2><div class="menu-cards">${items.map(x=>`<button class="menu-card" data-act="${x.act}">${uiIcon(x.icon)}<span><b>${t(x.name)}</b>${x.note?`<small>${t(x.note)}</small>`:''}</span><span aria-hidden="true">›</span></button>`).join('')}</div></section>`;
  }

  function firstRunModal(step = 0) {
    store.set('smazzata_intro_seen', true);
    openModal('firstRun', `<section class="first-run"><p class="muted small">${t('Benvenuto a Smazzata')} · ${step + 1}/2</p>
      ${step === 0 ? `<h2>${t('Da quale gioco cominciamo?')}</h2><p>${t('Potrai cambiarlo quando vuoi dalla home.')}</p><div class="first-run-games">${GAME_TILES.filter(([id]) => AvailableGames.enabled(id)).map(([id,,name]) => `<button class="btn" data-act="introChoose" data-game="${id}">${gameIcon(id)}${esc(name)}</button>`).join('')}</div>`
      : `<h2>${gameIcon(homeGame())} ${t('Il tuo posto al tavolo')}</h2><dl class="first-run-modes"><dt>${uiIcon('bot')} ${t('Allenamento')}</dt><dd>${t('Impara con il computer e i suggerimenti, senza punti classifica o progressi.')}</dd><dt>${uiIcon('friends')} ${t('Amichevole online')}</dt><dd>${t('Gioca con gli amici o trova un tavolo, senza cambiare il grado.')}</dd><dt>${uiIcon('medal')} ${t('Classificata')}</dt><dd>${t('Affronta altri giocatori e costruisci il tuo grado, nelle code Solo o Duo.')}</dd></dl><button class="btn primary" data-act="introPractice">${t('Prova l’allenamento')}</button><button class="btn" data-act="closeModal">${t('Vai alla home')}</button><button class="btn small ghost dark" data-act="firstRun">${t('Cambia gioco')}</button>`}
      <button class="btn small ghost dark" data-act="closeModal">${t('Salta la guida')}</button></section>`);
    $('#modal [data-act=introChoose], #modal [data-act=introPractice]')?.focus({preventScroll:true});
  }

  function homeHTML() {
    if (!OFFLINE && S.mailOn && S.social && S.social.nick && S.social.hasEmail === false) return emailGateHTML() + `<div class="panel"><button class="btn" data-act="playBots">${uiIcon('bot')}${t('Prova senza registrarti')}</button></div>`;
    return `<div class="page home-page"><div class="home-scroll">
      <div class="logo"><h1 translate="no">Smazzata</h1>
        <div class="muted">Scegli il gioco e comincia</div></div>
      ${homeToolbarHTML()}
      ${S.appUpdate && !S.appUpdate.dismissed ? `<div class="apkbanner update">
        <img src="icons/icon-192.png" alt=""><span><b><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-home /></svg> Nuova versione dell'app</b><br>Scaricala e installala sopra quella che hai: profilo e partite restano.</span>
        <span class="updbtns"><a class="btn primary small" href="${APK_URL}">Scarica</a><button class="btn small" data-act="appUpdateLater">Più tardi</button></span></div>` : ''}
      <div class="panel">
        ${!OFFLINE && !S.social?.nick ? `<div class="guest-start"><p>${t("Prova senza registrarti")}</p><button class="btn primary" data-act="firstRun">${uiIcon("play")}${t("Scegli un gioco e prova")}</button></div>` : ""}
        ${OFFLINE ? `<div class="offbanner"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-privacy /></svg> <b>Senza internet</b><br>Puoi giocare contro il computer e fare l'allenamento.
            Amici, classifica e partite online tornano quando sei collegato.
            <div class="row" style="margin-top:6px"><button class="btn small" data-act="goOnline"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-refresh /></svg> Riprova online</button></div></div>`
        : S.social && S.social.nick
          ? `<button class="home-account" data-act="profile">${avatarHTML(S.social.nick,0,false,S.social.avatar)}<b>${esc(S.social.nick)}</b><span aria-hidden="true">›</span></button>
            ${S.social.hasPassword === false ? '<div class="offbanner"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-report /></svg> <b>Il tuo profilo non ha una password.</b> Impostala ora, così puoi sempre rientrare. <button class="btn small" data-act="profile"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-profile /></svg> Imposta</button></div>' : ''}`
          : S.signup ? `<div class="mailbox"><p><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-mail /></svg> Ti abbiamo mandato un codice a <b>${esc(S.signup.email)}</b>.</p>
              <p>Scrivilo qui per creare il profilo <b>${esc(S.signup.nick)}</b>:</p>
              <form id="signupform" class="row"><input id="sucode" class="grow" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456"><button class="btn primary">Crea il profilo</button></form>
              <p class="muted small">Non arriva? Guarda anche nello spam, oppure <a href="#" data-act="resendSignup">mandalo di nuovo</a> · <a href="#" data-act="signupBack">cambia i dati</a></p></div>`
          : `<details id="profile-signup"${S.pendingJoin || S.nickDraft != null ? ' open' : ''}><summary>${t('Crea un profilo per giocare online')}</summary><label class="field"><span>Scegli il tuo nickname</span>
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
              <p class="muted small" style="margin:8px 0 0">Il nickname è unico: serve ai tuoi amici per trovarti. Hai già un profilo? <a href="#" data-act="recover">Recuperalo</a></p></details>`}
        ${homeButtonsHTML()}
      </div>
      ${!OFFLINE && S.myGames && S.myGames.length ? `<div class="panel"><h2><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-clock /></svg> Le tue partite con calma</h2>
        ${S.myGames.map((m) => `<button class="slowgame ${m.myTurn ? 'myturn' : ''}" data-act="openSlow" data-code="${esc(m.code)}">
          <span class="who">${m.players.filter((x) => x && !x.me).map((x) => esc(x.name)).join(', ') || 'In attesa di giocatori'}</span>
          <span class="meta">${m.ranked ? `<span class="rankbadge" title="${RANKED_TIP}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-medal /></svg></span> ` : ''}${m.myTurn ? '<b>Tocca a te!</b>' : m.over ? 'Partita finita' : m.started ? `Smazzata ${m.handNo} · ${m.scores.join(' – ')}` : 'In sala d’attesa'}${m.at ? ` · ${agoText(m.at)}` : ''}</span></button>`).join('')}</div>` : ''}
      ${IS_ANDROID && !IN_APP && !OFFLINE ? `<a class="apkbanner" href="${APK_URL}">
        <img src="icons/icon-192.png" alt=""><span><b><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-home /></svg> Scarica l'app per Android</b><br>Installala e gioca a schermo intero</span></a>` : ''}
    </div><footer class="home-footer">${homeProgressHTML()}${homeNavigationHTML()}</footer></div>`;
  }

  /** modalità completa (impostazioni): mostra tutte le opzioni come prima, per chi è pratico */
  const FULL = () => S.prefs.ui === 'completa';

  /**
   * Pulsanti della schermata iniziale: quattro modalità di gioco.
   * Statistiche, regole e impostazioni restano nel menu «☰ Altro».
   * Amici, sfida del giorno, tornei e classifica hanno scorciatoie in alto.
   */
  function homeButtonsHTML() {
    if (store.get('bur_lastroom', '') === '🤖') store.set('bur_lastroom', ''); // codice delle partite sul telefono: non è un tavolo
    const last = !OFFLINE && (store.get('bur_lastroom', '') || (savedLocalGame() ? '🤖' : ''));
    return `<div class="homebtns">
      ${S.rankedParty ? `<button class="btn primary" data-act="rankedPartyOpen">${t('Torna al tavolo Duo')}</button>` : ''}
      ${S.pendingJoin && !OFFLINE ? `<div class="invitebox"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-mail /></svg> Sei stato invitato al tavolo <b>${esc(S.pendingJoin)}</b>
        <button class="btn primary big grow" data-act="joinCode" data-code="${esc(S.pendingJoin)}">Entra al tavolo</button></div>` : ''}
      ${last ? `<button class="btn primary big grow" data-act="rejoin"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-refresh /></svg> Torna alla partita</button>` : ''}
      ${S.tourMatch && !S.room ? `<div class="tourready"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg> ${esc(S.tourMatch.text)} <button class="btn small primary" data-act="tourPlay" data-code="${esc(S.tourMatch.code)}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-play /></svg> Gioca</button></div>` : ''}
      ${OFFLINE ? '' : `<button class="btn primary big grow homebtn" data-act="playFriends">${uiIcon('friends')}Gioca con gli amici</button>`}
      ${OFFLINE ? '' : `<button class="btn big grow homebtn" data-act="quickMenu" data-mode="casual">${uiIcon('cards')}<div>Gioca online<small>Trova altri giocatori</small></div></button>
      <button class="btn big grow homebtn" data-act="quickMenu" data-mode="ranked">${uiIcon('medal')}<div>Classificata<small>Gioca per salire di grado</small></div></button>`}
      <button class="btn ${OFFLINE && !last ? 'primary' : ''} big grow homebtn" data-act="playBots">${uiIcon('bot')}<div>Allenamento<small>Gioca contro il computer</small></div></button>
      ${CAMPAIGN_VISIBLE ? '<button class="btn grow campaign-entry" data-act="campaign"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-book /></svg> Avventura<small>Tre percorsi: Burraco, Scala 40 e Ramino</small></button>' : ''}


    </div>`;
  }

  /** menu «Altro»: tutte le funzioni che non servono per iniziare a giocare */
  function moreModal() {
    openModal('more',menuCardsHTML('Menu',[
      ...(!OFFLINE?[{act:S.social?.nick?'profile':'recover',icon:'profile',name:S.social?.nick?'Il mio profilo':'Accedi al tuo profilo'}]:[{act:'stats',icon:'stats',name:'Le mie statistiche'}]),
      ...(!OFFLINE?[{act:'activities',icon:'trophy',name:'Attività',note:'Classifica, sfide e tornei'}]:[]),
      {act:'settings',icon:'settings',name:'Impostazioni',note:'Suoni, aspetto e leggibilità'},
      {act:'helpMenu',icon:'help',name:'Aiuto',note:'Impara e consulta le regole'}
    ],''));
  }
  function activitiesModal(){openModal('activities',menuCardsHTML('Attività',[
    {act:'leaders',icon:'medal',name:'Classifica'},{act:'daily',icon:'calendar',name:'Sfida del giorno'},{act:'tournaments',icon:'trophy',name:'Tornei'}]));}
  function helpMenuModal(){
    const html=menuCardsHTML('Aiuto',[{act:'tutorial',icon:'bot',name:'Impara a giocare'},{act:'gamesRules',icon:'book',name:'Regole dei giochi'},{act:'firstRun',icon:'play',name:'Guida iniziale'},...(!OFFLINE?[{act:'report',icon:'report',name:'Segnala un problema'}]:[])]);
    openModal('helpMenu',html.replace('</section>',`<details class="menu-details"><summary>${t('Informazioni')}</summary><button class="btn" data-act="howto">${t('Come si usa l’app')}</button><p><a href="regole.html">${t('Regole di comportamento')}</a> · <a href="privacy.html">Privacy</a></p>${IN_APP?`<p>${t('Versione app')}: ${APP_VERSION||'—'}</p>`:''}</details></section>`));
  }

  /** elenco dei giochi e delle varianti con la loro descrizione (prima stava nella schermata iniziale) */
  function gamesRulesModal() {
    const list = [R.PRESETS[0],S40R.PRESET,OTHER.ramino.PRESET,CANR.PRESET];
    openModal('gamesRules', `<h2><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-book /></svg> Regole dei giochi</h2><p class="muted small">Tocca un gioco per leggerne le regole.</p>
      <div class="presets">${list.map((p) => `<button class="preset" data-act="presetRules" data-id="${p.id}"><b>${esc(p.name)}</b><span>${esc(p.tagline)}</span></button>`).join('')}</div>`);
  }

  /** gioco scelto nella schermata "Nuova partita" (lo Scopone è una Scopa con un'altra distribuzione) */
  const pickedGame = (r) => (r.game === 'scopa' && r.deal && r.deal !== 3 ? 'scopone' : r.game || 'burraco');

  const GAME_TILES = [['burraco', '🃏', 'Burraco'], ['scala40', '🪜', 'Scala 40'], ['ramino', '🧩', 'Ramino'], ['canasta', '🧺', 'Canasta']];
  function homeGame() { const id=store.get('smazzata_home_game','burraco'); return GAME_TILES.some(([g])=>g===id)?id:'burraco'; }
  function applyHomeGame() {
    const game=homeGame();
    if(pickedGame(S.rules)!==game) S.rules=RX.normalize(game==='burraco'?R.PRESETS[0].rules:RX.presetById(game).rules);
    store.set('bur_rules',S.rules); S.lbGame=game;
  }
  function homeGameMenu() {
    openModal('homeGamePicker', `<section class="home-game-menu"><small>SMAZZATA</small><h2>${t('Scegli il gioco')}</h2><p>${t('Un solo gioco per tutte le modalità della home.')}</p>${[['Carte francesi',GAME_TILES]].map(([label,games])=>`<h3>${t(label)}</h3><div class="home-game-options">${games.map(([id,icon,name])=>`<button class="home-game-option ${id===homeGame()?'selected':''}" data-act="homeGameChoose" data-game="${id}" aria-pressed="${id===homeGame()}"><span class="home-game-symbol" aria-hidden="true">${gameIcon(id)}</span><b>${esc(name)}</b><span class="home-game-check" aria-hidden="true">${id===homeGame()?'✓':''}</span></button>`).join('')}</div>`).join('')}</section>`);
    document.querySelector('.home-game-option.selected')?.focus();
  }

  /**
   * Nuova partita: il gioco è già scelto nella home; qui si configura il tavolo.
   * Varianti e regole personalizzate restano in «Regole e varianti» (aperto in modalità completa).
   */
  function setupHTML() {
    const friends = S.playMode === 'friends' && !OFFLINE;
    const pf = RX.schema(S.rules).find((f) => f.key === 'players');
    const adv = !!S.setupAdvanced;
    return `<div class="page">
      <div class="row"><button class="btn ghost small" data-act="goHome">← Indietro</button></div>
      ${friends ? `<div class="panel joinbox"><b>Un amico ti ha dato un codice?</b>
        <div class="row" style="margin-top:6px"><input type="text" id="joinCode" class="grow codein" maxlength="4" placeholder="Codice" value="${esc(S.pendingJoin)}"><button class="btn primary" data-act="join">Entra</button></div></div>` : ''}
      <header class="setup-game-heading"><small>${t(friends ? 'Crea il tavolo' : 'Nuova partita')}</small><h2 class="bigtitle">${esc(RX.gameName(S.rules))}</h2></header>
      <div class="panel">
        ${pf ? `<h3>Quanti giocatori?</h3><div class="row">${pf.choices.map(([v, l]) => `<button class="swatch big ${Number(S.rules.players) === Number(v) ? 'on' : ''}" data-act="pickPlayers" data-n="${v}">${esc(l)}</button>`).join('')}</div>` : ''}
        ${friends ? '' : `<details class="setup-computer"><summary>${t('Difficoltà del computer')} · ${t(({auto:'Automatica',facile:'Facile',normale:'Normale',difficile:'Difficile',esperto:'Esperto'})[S.prefs.botLevel||'auto'])}</summary><div class="row">${[['auto', 'Automatica'], ['facile', 'Facile'], ['normale', 'Normale'], ['difficile', 'Difficile'], ['esperto', 'Esperto']].map(([v, label]) => `<button class="swatch ${(S.prefs.botLevel || 'auto') === v ? 'on' : ''}" data-act="setupBotLevel" data-val="${v}" aria-pressed="${(S.prefs.botLevel || 'auto') === v}">${label}</button>`).join('')}</div><p class="muted small">Automatica: si adatta ai tuoi risultati.</p></details>`}
        <div class="row" style="margin-top:12px">${friends
          ? '<button class="btn primary big grow" data-act="create"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-friends /></svg> Crea il tavolo</button>'
          : '<button class="btn primary big grow" data-act="createBots"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-play /></svg> Inizia la partita</button>'}</div>
        <div class="row" style="margin-top:10px;justify-content:center"><button class="btn ghost small" data-act="previewRules"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-rules /></svg> Come si gioca</button><button class="btn ghost small" data-act="setupAdvanced">${adv ? '▴' : '▾'} Regole e varianti</button></div>
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
    const art = window.SmazzataAvatars;
    const entry = art.resolve(isBot ? 'mazziere' : av && (av.id || av.e), name);
    const color = av && !isBot && av.c || SEAT_COLORS[seat % SEAT_COLORS.length];
    const frame=!isBot&&window.SmazzataCosmetics?.byId.get(av?.cf),custom=frame?.kind==='frame'&&typeof cosmeticFrame==='function';
    return `<span class="avatar illustrated ${custom?'cx-framed':av && !isBot && av.f ? 'fr-' + esc(av.f) : ''}" style="--c:${esc(color)}" role="img" aria-label="${esc(t(entry.name))}">${art.svg(entry.id)}${custom?cosmeticFrame(frame):''}</span>`;
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
          ${isHost ? `<button class="btn small" data-act="addBot" data-seat="${i}" title="Metti il computer"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-bot /></svg> Computer</button>` : ''}</div>`;
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
        <div class="row" style="justify-content:center"><button class="btn primary big" data-act="share"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-exit /></svg> Manda l'invito</button></div>
        <div class="row" style="justify-content:center;margin-top:6px"><button class="btn ghost small" data-act="copy">Copia il link</button>${S.social && S.social.nick ? '<button class="btn ghost small" data-act="friends"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-friends /></svg> Dai miei amici</button>' : ''}</div>
      </div>
      <div class="panel">
        <h2>Giocatori (${filled}/${r.n}) ${r.ranked ? `<span class="rankbadge" title="${RANKED_TIP}"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-medal /></svg> Classificata</span>` : ''}</h2>
        ${r.quick ? `<p class="muted">${r.queueMode === 'casual' ? 'Amichevole online' : 'Classificata'} · ${Games2.idOf(r.rules) === 'burraco' ? 'Burraco Classico' : esc(RX.gameName(r.rules))} · ${r.n} giocatori.<br>In cerca di altri ${r.n - filled} giocatori. La partita parte appena il tavolo è pieno.</p>` : ''}
        ${r.quick ? `<div class="queue-help"><p>${t('Tempo di ricerca')}: <b data-wait-since="${S.queueSince || Date.now()}">0:00</b></p><p>${t('Puoi continuare ad aspettare, invitare un amico o allenarti con il computer.')}</p><div class="row"><button class="btn small" data-act="share">${uiIcon('friends')}${t('Invita un amico')}</button><button class="btn small" data-act="queueBots">${uiIcon('bot')}${t('Passa all’allenamento')}</button><button class="btn small" data-act="leaveNow">${t('Annulla ricerca')}</button></div></div>` : ''}
        ${r.quick && !r.ranked ? '<p class="muted small">Partita amichevole: il tuo grado non cambia.</p>' : ''}
        <div class="seats">${seats}</div>
        ${isHost ? `<div class="row" style="margin-top:12px">
            <button class="btn primary big grow" data-act="${ready ? 'start' : 'startFill'}">${r.quick && !ready ? 'Gioca amichevole con il computer' : '<svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-play /></svg> Inizia la partita'}</button></div>
            ${ready ? '' : '<p class="muted small" style="text-align:center">I posti ancora vuoti li prende il computer.</p>'}`
          : `<p class="muted" style="text-align:center">Aspettiamo che ${esc(hostName)} inizi la partita…</p>`}
      </div>
      <details class="panel tableset">
        <summary><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-settings /></svg> Impostazioni del tavolo</summary>
        <p>${rulesStatus(r.rules)} <span class="muted">· ${r.n} giocatori · si vince a ${r.rules.target}</span></p>
        <div class="row"><button class="btn small" data-act="music"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-music /></svg> Musica del tavolo${r.music ? ' (attiva)' : ''}</button></div>
        <div class="row" style="margin-top:8px"><button class="btn small" data-act="roomRules"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-rules /></svg> Leggi le regole</button>
        ${isHost && !r.quick ? '<button class="btn small" data-act="editRules"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-rules /></svg> Modifica regole</button>' : ''}</div>
        ${isHost && !r.quick ? `<h3 style="margin-top:14px">Torneo</h3>${seriesPickHTML(r.series && r.series.bestOf)}` : r.series ? `<p><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-trophy /></svg> Torneo al meglio di ${r.series.bestOf}</p>` : ''}
        ${isHost && !r.quick && !r.daily && !r.tutorial ? `<h3 style="margin-top:14px">Ritmo della partita</h3>
          <div class="row"><button class="swatch ${r.slow ? '' : 'on'}" data-act="setSlow" data-val="0"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-play /></svg> Normale</button><button class="swatch ${r.slow ? 'on' : ''}" data-act="setSlow" data-val="1"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-clock /></svg> Con calma</button></div>
          <p class="muted small">Con calma: ognuno gioca il suo turno quando può, anche ore dopo. Puoi uscire quando vuoi: il posto resta tuo, la partita ti aspetta e ti avvisiamo quando tocca a te.</p>`
          : r.slow ? '<p><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-clock /></svg> <b>Partita con calma</b>: ognuno gioca quando può, ti avvisiamo quando tocca a te.</p>' : ''}
        ${isHost ? `<h3 style="margin-top:14px">Aiuto: dove attaccare le carte</h3>${aidsHTML(r.aids !== false)}` : ''}
        ${isHost ? `<h3 style="margin-top:14px">Tempo per turno</h3>${turnTimeHTML(r.turnTime)}
          <p class="muted small">Allo scadere il gioco pesca e scarta al posto del giocatore.</p>` : ''}
        ${isHost ? `<h3 style="margin-top:14px">Bravura del computer</h3>${botLevelHTML(r.botLevel)}` : ''}
        ${isHost ? `<h3 style="margin-top:14px">Velocità del computer</h3>${botSpeedHTML(r.botSpeed)}` : ''}
        ${isHost ? '<div class="row" style="margin-top:14px"><button class="btn small" data-act="closeTable"><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-exit /></svg> Chiudi il tavolo</button></div>' : ''}
      </details>
    </div>`;
  }
