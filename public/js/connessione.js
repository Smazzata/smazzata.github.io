/* Burraco — Connessione al server (o al server locale offline), eventi in arrivo, notifiche, schermo acceso.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Connessione ================= */
  // tentativi di ricollegamento ravvicinati (0,3 s → massimo 2 s)
  const socket = OFFLINE
    ? LocalServer.createSocket({ engineUrl: 'engine.js', name: store.get('bur_name', '') })
    // autoConnect: false — ci si collega solo quando tutti i file dell'interfaccia sono caricati (vedi comandi.js)
    : io({ reconnectionDelay: 300, reconnectionDelayMax: 2000, randomizationFactor: 0.3, autoConnect: false });
  // non "offline": è già la classe della striscia di connessione (body diventava flex e il tavolo sbordava)
  if (OFFLINE) document.body.classList.add('senza-rete');
  // La difficoltà automatica del computer resta locale e non assegna progressi al profilo.
  if (OFFLINE) socket.on('handOver', autoLevelRecord);

  /*
   * Profilo e indirizzo che cambia: il server gira dietro un tunnel con un indirizzo nuovo a ogni riavvio, e ogni
   * indirizzo ha la sua memoria. La pagina d'ingresso fissa tiene una copia del codice del profilo e ce lo passa
   * con #tk=…; se qui il profilo è diverso, si passa un attimo da lei (#salva=…) per aggiornarla.
   */
  const ON_TUNNEL = /\.trycloudflare\.com$/.test(location.hostname);
  // nell'app Android nuova la pagina d'ingresso è dentro l'app (https://localhost/), non sul sito
  const launcherHome = () => (/SmazzataLocale/.test(navigator.userAgent) ? 'https://localhost/' : HOME_URL);
  const LAUNCHER = { came: /^#tk=/.test(location.hash), tk: (location.hash.match(/^#tk=([A-Za-z0-9]*)$/) || [])[1] || '' };
  if (LAUNCHER.came) {
    history.replaceState(null, '', location.pathname + location.search);
    if (!S.token && LAUNCHER.tk && !OFFLINE) { S.token = LAUNCHER.tk; store.set('bur_token', LAUNCHER.tk); }
  }
  function syncLauncher(token = S.token) {
    if (!ON_TUNNEL || OFFLINE || !token || (LAUNCHER.came && LAUNCHER.tk === token)) return false;
    try { if (sessionStorage.getItem('bur_sync') === token) return false; sessionStorage.setItem('bur_sync', token); } catch (e) { return false; }
    location.replace(launcherHome() + '#salva=' + token);
    return true;
  }
  const pendingRequests = new Set();
  socket.on('connect', () => {
    S.syncPending = !OFFLINE;
    S.connected = true;
    socket.emit('hello', { token: S.token, name: S.name, lang: LANG, remind: S.prefs.remind !== false });
  });
  socket.on('disconnect', () => {
    S.connected = false;
    S.syncPending = !OFFLINE;
    for (const cancel of [...pendingRequests]) cancel();
    if (S.silentReconnect) { S.silentReconnect = false; return; } // riconnessione voluta: niente avvisi
    S.lostConnection = true;
    render();
  });
  // Tornando sull'app dopo un periodo in background la vecchia connessione può essere "morta"
  // senza che il browser se ne accorga: se si è stati via più di qualche secondo se ne apre subito una nuova.
  let hiddenAt = 0;
  const freshConnection = () => {
    if (OFFLINE) { socket.emit('sync'); return; }
    if (S.localGame && Local.sock) Local.sock.emit('sync');
    if (!socket.connected) { socket.connect(); return; }
    if (Date.now() - hiddenAt > 4000) { S.silentReconnect = true; socket.disconnect(); socket.connect(); }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt) { freshConnection(); hiddenAt = 0; }
  });
  window.addEventListener('offline', () => {
    if (OFFLINE) return;
    S.connected = false; S.syncPending = true; S.lostConnection = true;
    for (const cancel of [...pendingRequests]) cancel();
    socket.disconnect(); render();
  });
  window.addEventListener('online', () => { if (!socket.connected) socket.connect(); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) freshConnection(); });
  socket.on('welcome', ({ token, name, nick, mail, progressEpoch }) => {
    if (progressEpoch) resetDeviceProgress(progressEpoch);
    S.mailOn = !!mail;
    // offline il codice del profilo salvato non va mai sovrascritto: serve quando si torna online
    if (!OFFLINE) {
      S.token = token;
      store.set('bur_token', token);
    }
    if (nick) { S.name = nick; if (!OFFLINE) store.set('bur_name', nick); } else if (!S.name && name !== 'Giocatore') S.name = name;
    if (S.pendingProfile) { const c = S.pendingProfile; S.pendingProfile = ''; askImport(c); }
    enablePush();
  });
  // partite con calma: elenco per la schermata iniziale e avvisi "tocca a te" dagli altri tavoli
  socket.on('notice', ({ text }) => toast(text));
  // tornei: la finestra aperta si aggiorna; quando tocca a me compare l'avviso per andare al tavolo
  socket.on('tournamentsChanged', () => { if (S.modalKind === 'tournaments') tournamentsModal(); });
  socket.on('tournamentMatch', ({ code, text }) => {
    S.tourMatch = { code, text };
    Sound.play('turn');
    notify('Smazzata: torneo ', text, 'torneo');
    if (S.screen === 'home') render();
  });
  socket.on('myGames', (list) => {
    S.myGames = list;
    if (S.screen === 'home') render();
  });
  socket.on('yourTurn', ({ code, text }) => {
    Sound.play('turn');
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    notify('Smazzata: tocca a te ', text, 'slow-' + code);
    toast(`${text}`);
  });
  // la password è cambiata da un altro dispositivo: questo viene scollegato
  socket.on('loggedOut', ({ reason, deleted }) => {
    if (deleted) {
      // Le altre installazioni saranno scollegate dal server; su questa cancelliamo anche le copie locali.
      try {
        for (const key of Object.keys(localStorage)) {
          if ((key.startsWith('bur_') && !['bur_prefs', 'bur_lang'].includes(key)) || key.startsWith('smazzata_campaign_')) localStorage.removeItem(key);
        }
        sessionStorage.clear();
      } catch (e) { /* memoria non disponibile */ }
    }
    store.set('bur_token', null);
    S.token = null;
    alert(reason || 'Sei stato scollegato dal profilo.');
    if (ON_TUNNEL) location.replace(launcherHome() + '#salva=');
    else location.reload();
  });
  socket.on('social', (soc) => {
    S.social = soc;
    if (soc && soc.nick) flushLocalResults();
    // solo all'apertura della pagina: la pagina d'ingresso non conosce ancora questo profilo
    // (dopo una registrazione invece si passa da lei con «Ho salvato il codice», senza interrompere)
    if (!S.launcherChecked) { S.launcherChecked = true; if (soc && soc.nick && !S.modalKind && syncLauncher()) return; }
    if (soc && soc.nick) { S.name = soc.nick; if (!OFFLINE) store.set('bur_name', soc.nick); }
    // avviso del gestore (regole di comportamento): si mostra finché non si tocca «Ho capito»
    if (soc && soc.warn && S.modalKind !== 'warn') { warnModal(soc.warn); return; }
    if (S.modalKind === 'friends') friendsModal();
    if (S.screen === 'home' || S.screen === 'lobby' || S.screen === 'rankedLobby') render();
  });
  socket.on('invite', ({ from, code, started }) => {
    Sound.play('turn');
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    notify('Smazzata: invito', `${from} ti invita al tavolo ${code}`, 'invite');
    openModal('invite', `<div class="result" style="text-align:center"><h2><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-cards /></svg> Invito</h2>
      <p><b>${esc(from)}</b> ti invita al suo tavolo <b>${esc(code)}</b>.</p>
      ${started ? '<p class="muted">La partita è già iniziata: potrai entrare solo se si libera un posto.</p>' : ''}
      <div class="row" style="justify-content:center"><button class="btn primary big" data-act="acceptInvite" data-code="${esc(code)}">Entra</button><button class="btn" data-act="closeModal">No grazie</button></div></div>`);
  });
  socket.on('state', ({ room, game, __local }) => {
    // mentre si gioca sul telefono contro il computer, lo stato del server (es. al ricollegamento) non conta
    if (S.localGame && !__local) { hideIntro(); return; }
    const wasSyncing=S.syncPending,restored=S.lostConnection&&!__local;
    S.syncPending = false;
    if(!__local)S.lostConnection=false;
    onState(room, game); hideIntro();
    if(restored)toast(t('Sei di nuovo collegato.'));
    // Rileggi l'inventario dopo il ripristino: un altro dispositivo può averlo cambiato.
    if(wasSyncing&&!__local&&!S.chestBusy&&!S.collectionBusy){
      if(S.modalKind==='chests')chestsModal(true);
      else if(S.modalKind==='cosmetics')collectionModal(undefined,true);
    }
  });
  let inventoryRefreshTimer=null;
  socket.on('inventoryChanged',()=>{
    clearTimeout(inventoryRefreshTimer);
    const refresh=()=>{
      if(!S.connected||S.syncPending)return;
      if(S.chestBusy||S.collectionBusy){inventoryRefreshTimer=setTimeout(refresh,150);return;}
      if(S.modalKind==='chests')chestsModal(true);
      else if(S.modalKind==='cosmetics')collectionModal(undefined,true);
    };
    inventoryRefreshTimer=setTimeout(refresh,50);
  });

  /* ---------- Intro animata all'apertura ---------- */
  const INTRO_AT = Date.now();
  (() => {
    const el = $('#intro');
    if (!el) return;
    // (arrivo dalla pagina d'ingresso: la classe «cont» la mette già index.html, subito dopo l'intro)
    // collegamento lento: lo si dice, e dopo un po' si lascia comunque la schermata (con l'avviso di connessione)
    setTimeout(() => { const m = $('#introMsg'); if (m && !S.connected) m.textContent = t('Connessione al server…'); }, 3500);
    setTimeout(hideIntro, 12000);
  })();
  /** Toglie l'intro (dissolvenza) quando il gioco è pronto, lasciando finire l'animazione delle carte */
  function hideIntro() {
    const el = $('#intro');
    if (!el || el.classList.contains('out')) return;
    const min = el.classList.contains('cont') ? 400 : 1700;
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, Math.max(0, min - (Date.now() - INTRO_AT)));
  }
  socket.on('reaction', ({ seat, emoji, cosmeticId }) => showSeatBubble(seat, emoji, cosmeticId));
  /** Una nuvoletta (reazione) sopra il posto di un giocatore */
  function showSeatBubble(seat, emoji, cosmeticId) {
    const g = S.game;
    if (!g) return;
    const target = seat === g.you ? $('.handwrap') : $(`.seatchip[data-seat="${seat}"]`);
    if (!target) return;
    const r = target.getBoundingClientRect();
    const b = document.createElement('div');
    b.className = 'reaction';
    const illustration=window.SmazzataCosmetics?.byId.get(cosmeticId);
    if(illustration?.kind==='reaction'){b.classList.add('cx-illustrated');const img=document.createElement('img');img.src=illustration.art;img.alt=t(illustration.name);b.append(img);}else b.textContent = emoji;
    b.style.left = `${r.left + r.width / 2}px`;
    b.style.top = `${r.top + (seat === g.you ? 0 : r.height / 2)}px`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2400);
    if (seat !== g.you) Sound.play('select');
  }
  // livello del giocatore: si aggiorna a fine smazzata; quando sale, festa
  // punteggio di bravura (Elo) aggiornato a fine partita
  socket.on('elo', ({ game, after, before }) => {
    const rank = playerRank(after), previous = playerRank(before);
    if (rank.id !== previous.id) setTimeout(() => showRankTransition(game, before, after), 1800);
    else setTimeout(() => toast(`${RX.gameName({ game })} · ${t('Grado')}: ${t(rank.name)}`), 1800);
  });
  socket.on('progress', (p) => {
    // serie di giorni: festa quando sale (la prima smazzata di oggi)
    const before = S.progress && S.progress.streak ? S.progress.streak.streak : null;
    if (before != null && p.streak && p.streak.today && p.streak.streak > before && p.streak.streak >= 2) { toast(`${p.streak.streak} giorni di fila! Continua così`); Sound.play('turn'); }
    S.progress = p;
    if (p.earned) S.handProgress = p;
    if (S.modalKind === 'result') showResult();
    if (p.up) {
      const b = document.createElement('div');
      b.className = 'trophytoast level';
      b.innerHTML = `<i><span class="lvl big">${p.level}</span></i><div><small>Sei salito di livello!</small><b>Livello ${p.level}</b><span>Continua così: ${p.need - p.into} punti esperienza al prossimo</span></div>`;
      setTimeout(() => {
        document.body.appendChild(b);
        Sound.play('turn');
        confetti(70, 1600);
        setTimeout(() => b.remove(), 3600);
      }, trophyQueue.length ? 3800 * trophyQueue.length : 0);
    }
    if (S.screen === 'home') render();
  });

  // trofei sbloccati: uno alla volta, con un piccolo festeggiamento
  const trophyQueue = [];
  socket.on('trophy', (list) => {
    trophyQueue.push(...list);
    if (trophyQueue.length === list.length) showNextTrophy();
  });
  function showNextTrophy() {
    const t = trophyQueue[0];
    if (!t) return;
    const b = document.createElement('div');
    b.className = 'trophytoast';
    b.innerHTML = `<i>${uiIcon('trophy')}</i><div><small>Trofeo sbloccato!</small><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></div>`;
    document.body.appendChild(b);
    Sound.play('turn');
    confetti(50, 1400);
    setTimeout(() => { b.remove(); trophyQueue.shift(); showNextTrophy(); }, 3600);
  }

  socket.on('chat', (m) => {
    S.chat.push(m);
    if (S.chat.length > 100) S.chat.shift();
    if (S.modalKind === 'log') renderLogModal();
    else if (S.room && m.seat !== S.room.you) { S.unread++; toast(`${m.name}: ${m.text}`); render(); }
  });

  /* ---------- Partite contro il computer sul telefono (anche online) ----------
   * Le mosse non viaggiano fino al server: il "server nel telefono" (public/local-server.js) gioca la partita,
   * quindi tutto è istantaneo. Queste partite sono allenamento e non assegnano progressi al profilo.
   */
  // attached: la partita sul telefono è quella sullo schermo (uscendo resta in sottofondo, salvata)
  const Local = { sock: null, ready: null, attached: false };
  const LOCAL_EVENTS = new Set(['action', 'hint', 'surrender', 'endGame', 'closeTable', 'replay', 'ready', 'leaveRoom',
    'setBotSpeed', 'setBotLevel', 'setHints', 'setAids', 'setTurnTime', 'react', 'chat', 'sync']);
  function localSocket() {
    if (Local.ready) return Local.ready;
    Local.sock = OFFLINE ? socket : LocalServer.createSocket({ engineUrl: 'engine.js', name: S.name || 'Tu', onDevice: true });
    if (OFFLINE) { Local.ready = Promise.resolve(); return Local.ready; }
    for (const ev of ['state', 'chat', 'reaction']) {
      Local.sock.on(ev, (p) => {
        if (!Local.attached) return;
        if (ev === 'state') { S.localGame = !!(p && p.room); if (!S.localGame) Local.attached = false; p = { ...p, __local: true }; }
        for (const fn of socket.listeners(ev)) fn(p);
      });
    }
    Local.sock.on('handOver', autoLevelRecord);
    Local.ready = new Promise((res, rej) => { Local.sock.on('connect', res); Local.sock.on('connect_error', rej); });
    Local.sock.connect();
    return Local.ready;
  }
  /*
   * Livello automatico del computer (partite contro il computer): per ogni gioco si parte da «normale»;
   * 3 vittorie nelle ultime 4 partite → un livello in più, 3 sconfitte di fila → un livello in meno.
   */
  const LEVELS = ['facile', 'normale', 'difficile', 'esperto'];
  const AUTO_KEY = 'bur_auto_level';
  function autoLevel(gid) {
    if (S.prefs.botLevel && S.prefs.botLevel !== 'auto') return S.prefs.botLevel;
    const a = store.get(AUTO_KEY, {})[gid];
    return a && LEVELS.includes(a.level) ? a.level : 'normale';
  }
  function autoLevelRecord(p) {
    if (!p || !p.game || !p.game.over || p.tutorial || (S.prefs.botLevel && S.prefs.botLevel !== 'auto')) return;
    const gid = (p.rules && p.rules.game) || 'burraco';
    const all = store.get(AUTO_KEY, {});
    const a = all[gid] || { level: 'normale', res: [] };
    if (a.last === p.id) return; // la stessa partita conta una volta
    a.last = p.id;
    a.res = (a.res || []).concat([(p.game.winners || []).includes(0) ? 1 : 0]).slice(-4);
    const wins = a.res.reduce((x, y) => x + y, 0);
    let i = LEVELS.indexOf(a.level);
    if (a.res.length >= 4 && wins >= 3 && i < LEVELS.length - 1) { i++; a.res = []; toast(`Stai vincendo spesso: il computer diventa più bravo (${LEVELS[i]})`); }
    else if (a.res.length >= 3 && a.res.slice(-3).every((x) => !x) && i > 0) { i--; a.res = []; toast(`Il computer diventa un po' più facile (${LEVELS[i]})`); }
    a.level = LEVELS[i];
    all[gid] = a;
    store.set(AUTO_KEY, all);
  }

  /** c'è una partita sul telefono da riprendere? */
  function savedLocalGame() {
    try { const r = JSON.parse(localStorage.getItem('bur_offline_room') || 'null'); return !!(r && AvailableGames.enabled(r) && r.game && !r.game.over); } catch (e) { return false; }
  }
  /** Scarta anche i risultati contro il computer rimasti in coda dalle versioni precedenti. */
  function flushLocalResults() {
    store.set('bur_local_results', []);
  }

  /** «Hai già una partita in corso su un altro dispositivo»: true se l'utente vuole procedere */
  function askOtherDevice(mode) {
    return new Promise((res) => {
      const here = mode === 'here';
      openModal('device', `<div class="result" style="text-align:center"><h2><svg class=ui-icon viewBox=0,0,40,40 fill=none stroke=#294c3d stroke-width=1.6 aria-hidden=true><use href=#ui-home /></svg> ${t('Partita su un altro dispositivo')}</h2>
        <p>${t(here ? "Hai già una partita in corso su un altro dispositivo. Vuoi continuarla qui? L'altro dispositivo tornerà alla schermata iniziale."
          : 'Hai già una partita in corso su un altro dispositivo: se procedi la abbandonerai (il tuo posto passa al computer). Sei sicuro di voler procedere?')}</p>
        <div class="row" style="justify-content:center"><button class="btn primary" id="devYes">${t(here ? 'Continua qui' : 'Sì, procedi')}</button><button class="btn" id="devNo">${t('Annulla')}</button></div></div>`);
      $('#devYes').onclick = () => { closeModal(); res(true); };
      $('#devNo').onclick = () => { closeModal(); res(false); };
    });
  }
  socket.on('busyElsewhere', async () => {
    if (await askOtherDevice('here')) emit('takeOver', { mode: 'here' });
  });

  function emit(ev, data) {
    if (S.campaignActive && LOCAL_EVENTS.has(ev)) return Promise.resolve(campaignEvent(ev, data));
    const target = S.localGame && LOCAL_EVENTS.has(ev) && Local.sock ? Local.sock : socket;
    const network = !OFFLINE && target === socket;
    if (network && (!S.connected || !socket.connected || (ev === 'action' && S.syncPending))) {
      toast(t('Riconnessione in corso. Attendi il ripristino del tavolo.'), true);
      return Promise.resolve({ok:false, disconnected:true});
    }
    return new Promise((res) => {
      let settled = false;
      const finish = r => {
        if (settled) return false;
        settled = true; clearTimeout(timer); pendingRequests.delete(cancel); res(r); return true;
      };
      const cancel = () => finish({ok:false, disconnected:true});
      const timer = setTimeout(() => {
        if (!finish({ok:false, timeout:true})) return;
        toast(t('Risposta non ricevuta. Verifico lo stato del tavolo.'), true);
        // Nessuna ripetizione automatica: la mossa potrebbe essere già stata applicata.
        if (network && S.room) { S.syncPending = true; render(); socket.disconnect(); socket.connect(); }
      }, 12000);
      if (network) pendingRequests.add(cancel);
      target.emit(ev, data, async (r) => {
        if (settled) return;
        clearTimeout(timer); pendingRequests.delete(cancel);
        if (r && !r.ok && (r.error === 'BUSY_HERE' || r.error === 'BUSY_OTHER')) {
          settled = true;
          const mode = r.error === 'BUSY_HERE' ? 'here' : 'abandon';
          if (!(await askOtherDevice(mode))) return res({ ok: false });
          const tk = await emit('takeOver', { mode });
          return res(tk.ok ? await emit(ev, data) : tk);
        }
        if (r && !r.ok) { toast(r.error, true); Sound.play('error'); }
        finish(r || { ok: false });
      });
    });
  }

  /** Lettura ad alta voce delle mosse (accessibilità): solo le righe nuove della cronaca, al massimo due alla volta */
  let lastSpoken = null; // ultima riga della cronaca già letta
  function speakNewMoves(game) {
    const lines = (game && game.log) || [];
    if (!S.prefs.speak || !('speechSynthesis' in window)) { lastSpoken = lines[lines.length - 1] || null; return; }
    const from = lastSpoken == null ? lines.length : lines.lastIndexOf(lastSpoken) + 1;
    for (const l of lines.slice(Math.max(from, lines.length - 2))) {
      const u = new SpeechSynthesisUtterance(t(l).replace(/[♠♥♦♣]/g, (m) => ({ '♠': ' picche', '♥': ' cuori', '♦': ' quadri', '♣': ' fiori' }[m])));
      u.lang = LOCALE;
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    }
    lastSpoken = lines[lines.length - 1] || null;
  }

  function onState(room, game) {
    if (S.campaignActive && !room?.campaign) return;
    const prev = S.game;
    const keepLeaguePage = S.screen === 'leaders' && room?.code === S.room?.code && !!game === !!prev;
    speakNewMoves(game);
    const prevMusic = S.room && S.room.music;
    if (room && room.music && (!prevMusic || prevMusic.at !== room.music.at)) {
      if (prevMusic !== undefined && !room.isHost) { S.musicUnseen = true; toast(`${room.music.by} ha avviato la musica: tocca per ascoltarla`); }
    }
    if (room && !room.music) S.musicUnseen = false;
    S.turnEnd = room && room.turnLeft != null ? Date.now() + room.turnLeft : null;
    S.warned10 = S.turnKey === (game && `${game.handNo}:${game.turn}`) ? S.warned10 : false;
    S.turnKey = game && `${game.handNo}:${game.turn}`;
    if (room?.quick && !game) {
      if (S.queueRoom !== room.code) { S.queueRoom = room.code; S.queueSince = Date.now(); }
    } else { S.queueRoom = null; S.queueSince = null; }
    S.room = room;
    S.game = game;
    if (!room) {
      if (!['setup', 'campaign', 'leaders', 'rankedLobby'].includes(S.screen)) S.screen = 'home';
      if (S.pendingJoin && S.social && S.social.nick) { const code = S.pendingJoin; S.pendingJoin = ''; joinRoom(code); }
    } else {
      S.pendingJoin = '';
      if (store.get('bur_lastroom', '') === room.code) store.set('bur_lastroom', '');
      if (!keepLeaguePage) S.screen = game ? 'game' : 'lobby';
      if (location.search) history.replaceState(null, '', location.pathname);
    }
    if (game && game.over && room && store.get('bur_lastroom', '') === room.code) store.set('bur_lastroom', '');
    if (game) {
      const ids = new Set(game.hand.map((c) => c.id));
      for (const id of [...S.selected]) if (!ids.has(id)) S.selected.delete(id);
      const sameHand = prev && prev.handNo === game.handNo;
      // nuova smazzata appena distribuita: animazione della distribuzione
      S.dealAnim = game.phase === 'draw' && (!game.events || game.events.length === 0) && (!prev || !sameHand || prev.over);
      S.newIds = new Set(sameHand ? game.hand.filter((c) => !prev.hand.some((p) => p.id === c.id)).map((c) => c.id) : []);
      syncHandOrder(game, sameHand);
      const ev = game.lastEvent;
      const newEvent = ev && (!prev || !prev.lastEvent || prev.lastEvent.n !== ev.n);
      S.flashMeld = newEvent && ev.meldId ? ev.meldId : null;
      S.animEvent = newEvent ? ev : null;
      // giochi a prese: verso chi volano le carte che spariscono dal tavolo
      if (game.presa && prev) {
        if (newEvent && ev.type === 'take') S.sweepTo = ev.seat;
        else if (prev.lastTrick && (!game.lastTrick || game.lastTrick !== prev.lastTrick) && !(prev.trick || []).length && (game.trick || []).length) S.sweepTo = prev.lastTrick.winner;
      }
      if (newEvent || game.turn !== game.you) S.hint = null;
      if (game.phase === 'handEnd') S.selected.clear();
      keepScreenOn(game.phase !== 'handEnd' || !game.over);
      if (newEvent) eventSound(prev, game, ev);
      const w = stockWarning(game), pw = prev && prev.handNo === game.handNo ? stockWarning(prev) : null;
      if (w && w.level >= 2 && (!pw || pw.level < w.level)) { toast(w.text); Sound.play('turn'); }
      if (prev && game.turn === game.you && game.phase === 'draw' && (prev.turn !== game.you || prev.phase === 'handEnd')) {
        if (navigator.vibrate) navigator.vibrate(60);
        Sound.play('turn');
        notify('Smazzata: tocca a te!', `Tavolo ${room.code} · ${lastMove(game)}`, 'turn');
      }
      if (game.phase === 'handEnd') recordStats(room, game);
      if (game.phase === 'handEnd' && (!prev || prev.phase !== 'handEnd' || prev.handNo !== game.handNo)) {
        setTimeout(showResult, 900);
        if (prev) notify('Smazzata: smazzata finita', game.over ? 'La partita è terminata: guarda chi ha vinto!' : 'Guarda il punteggio e preparati alla prossima.', 'hand');
        const mine = game.handResult && game.handResult.teams.find((t) => t.members.includes(game.you));
        const best = game.handResult && Math.max(...game.handResult.teams.map((t) => t.total));
        if (mine && mine.total === best) setTimeout(() => Sound.play('win'), 500);
        if (game.over && game.winners && game.winners.includes(game.you)) setTimeout(() => {if(typeof equippedVictory!=='function'||!equippedVictory())confetti();}, 700);
        if (game.over && room.series && room.series.champion && room.series.champion.includes(game.you)) setTimeout(() => confetti(260, 4500), 1500);
      } else if (game.phase !== 'handEnd' && S.modalKind === 'result') closeModal();
      else if (S.modalKind === 'result') showResult();
      document.title = game.turn === game.you && game.phase !== 'handEnd' ? '● Tocca a te · Smazzata' : 'Smazzata';
    } else {
      document.title = 'Smazzata';
      keepScreenOn(false);
      if (S.modalKind === 'result') closeModal();
    }
    render();
  }

  /* ---------- Notifiche push: arrivano anche a gioco chiuso (dove il browser le supporta) ---------- */
  const canPush = 'PushManager' in window && 'serviceWorker' in navigator && window.isSecureContext && !OFFLINE;
  async function enablePush() {
    if (!canPush || !S.prefs.notify || Notification.permission !== 'granted') return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const k = await emit('pushKey');
      if (!k.ok) return;
      const raw = atob(k.key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (k.key.length % 4)) % 4));
      const appKey = Uint8Array.from(raw, (ch) => ch.charCodeAt(0));
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey });
      socket.emit('pushSubscribe', { sub: sub.toJSON() }, () => {});
    } catch (e) { /* notifiche push non disponibili su questo dispositivo */ }
  }
  async function disablePush() {
    if (!canPush) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { socket.emit('pushUnsubscribe', { endpoint: sub.endpoint }, () => {}); await sub.unsubscribe(); }
    } catch (e) { /* niente */ }
  }

  /* ---------- Notifiche di sistema quando la pagina è in secondo piano ---------- */
  const canNotify = 'Notification' in window && 'serviceWorker' in navigator && window.isSecureContext;
  let swReg = null;
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js').then((r) => { swReg = r; }).catch(() => {});
  }
  async function notify(title, body, tag) {
    if (!S.prefs.notify || !canNotify || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
    title = t(title); body = t(body); // nella lingua scelta
    const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', renotify: true, vibrate: [120, 60, 120] };
    try {
      const reg = swReg || (await navigator.serviceWorker.ready);
      await reg.showNotification(title, opts);
    } catch (e) {
      try { new Notification(title, opts); } catch (e2) { /* notifiche non disponibili */ }
    }
  }

  /* ---------- Schermo sempre acceso durante la partita ---------- */
  let wakeLock = null;
  let wantWake = false;
  async function keepScreenOn(on) {
    wantWake = on;
    try {
      if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    } catch (e) { wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => { if (wantWake) keepScreenOn(true); });

  function eventSound(prev, game, ev) {
    // il suono della mia mossa anticipata si è già sentito al tocco
    const a = S.antic;
    if (ev.seat === game.you && a && Date.now() - a.at < 4000 && ({ draw: ['draw'], pile: ['takePile'], discard: ['discard', 'play'] }[ev.type] || []).includes(a.type)) return;
    if (ev.type === 'meld' || ev.type === 'add') {
      const before = prev && prev.teams.flatMap((t) => t.melds).find((m) => m.id === ev.meldId);
      const now = game.teams.flatMap((t) => t.melds).find((m) => m.id === ev.meldId);
      if (now && now.kind && (!before || !before.kind)) {
        Sound.play('burraco');
        const mine = game.teams.find((t) => t.members.includes(game.you));
        S.burracoFx = { meldId: now.id, label: now.label, bonus: now.bonus, mine: !!(mine && mine.melds.some((m) => m.id === now.id)) };
      } else Sound.play('meld');
    } else if (ev.type === 'pile') Sound.play('pile');
    else Sound.play('card');
  }
