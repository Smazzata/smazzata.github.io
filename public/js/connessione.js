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
  if (OFFLINE) document.body.classList.add('offline');
  socket.on('connect', () => {
    if (S.lostConnection) toast('✓ Riconnesso');
    S.lostConnection = false;
    S.connected = true;
    socket.emit('hello', { token: S.token, name: S.name });
  });
  socket.on('disconnect', () => {
    S.connected = false;
    if (S.silentReconnect) { S.silentReconnect = false; return; } // riconnessione voluta: niente avvisi
    S.lostConnection = true;
    render();
  });
  // Tornando sull'app dopo un periodo in background la vecchia connessione può essere "morta"
  // senza che il browser se ne accorga: se si è stati via più di qualche secondo se ne apre subito una nuova.
  let hiddenAt = 0;
  const freshConnection = () => {
    if (!socket.connected) { socket.connect(); return; }
    if (Date.now() - hiddenAt > 4000) { S.silentReconnect = true; socket.disconnect(); socket.connect(); }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt) freshConnection();
  });
  window.addEventListener('online', () => { if (!socket.connected) socket.connect(); });
  socket.on('welcome', ({ token, name, nick }) => {
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
    notify('Smazzata: torneo 🏆', text, 'torneo');
    if (S.screen === 'home') render();
  });
  socket.on('myGames', (list) => {
    S.myGames = list;
    if (S.screen === 'home') render();
  });
  socket.on('yourTurn', ({ code, text }) => {
    Sound.play('turn');
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    notify('Smazzata: tocca a te 🐢', text, 'slow-' + code);
    toast(`🐢 ${text}`);
  });
  socket.on('social', (soc) => {
    S.social = soc;
    if (soc && soc.nick) { S.name = soc.nick; if (!OFFLINE) store.set('bur_name', soc.nick); }
    if (S.modalKind === 'friends') friendsModal();
    if (S.screen === 'home' || S.screen === 'lobby') render();
  });
  socket.on('invite', ({ from, code, started }) => {
    Sound.play('turn');
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    notify('Smazzata: invito', `${from} ti invita al tavolo ${code}`, 'invite');
    openModal('invite', `<div class="result" style="text-align:center"><h2>🎴 Invito</h2>
      <p><b>${esc(from)}</b> ti invita al suo tavolo <b>${esc(code)}</b>.</p>
      ${started ? '<p class="muted">La partita è già iniziata: potrai entrare solo se si libera un posto.</p>' : ''}
      <div class="row" style="justify-content:center"><button class="btn primary big" data-act="acceptInvite" data-code="${esc(code)}">Entra</button><button class="btn" data-act="closeModal">No grazie</button></div></div>`);
  });
  socket.on('state', ({ room, game }) => { onState(room, game); hideIntro(); });

  /* ---------- Intro animata all'apertura ---------- */
  const INTRO_AT = Date.now();
  (() => {
    const el = $('#intro');
    if (!el) return;
    // arrivo dalla pagina d'ingresso (stessa intro): il ventaglio è già aperto, si continua senza ripartire
    if (/github\.io/.test(document.referrer)) el.classList.add('cont');
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
  socket.on('reaction', ({ seat, emoji }) => showSeatBubble(seat, emoji));
  /** Una nuvoletta (reazione o 🎤) sopra il posto di un giocatore */
  function showSeatBubble(seat, emoji) {
    const g = S.game;
    if (!g) return;
    const target = seat === g.you ? $('.handwrap') : $(`.seatchip[data-seat="${seat}"]`);
    if (!target) return;
    const r = target.getBoundingClientRect();
    const b = document.createElement('div');
    b.className = 'reaction';
    b.textContent = emoji;
    b.style.left = `${r.left + r.width / 2}px`;
    b.style.top = `${r.top + (seat === g.you ? 0 : r.height / 2)}px`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2400);
    if (seat !== g.you) Sound.play('select');
  }
  // livello del giocatore: si aggiorna a fine smazzata; quando sale, festa
  socket.on('progress', (p) => {
    S.progress = p;
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
    b.innerHTML = `<i>${esc(t.e)}</i><div><small>Trofeo sbloccato!</small><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></div>`;
    document.body.appendChild(b);
    Sound.play('turn');
    confetti(50, 1400);
    setTimeout(() => { b.remove(); trophyQueue.shift(); showNextTrophy(); }, 3600);
  }

  socket.on('chat', (m) => {
    S.chat.push(m);
    if (S.chat.length > 100) S.chat.shift();
    if (S.modalKind === 'log') renderLogModal();
    else if (S.room && m.seat !== S.room.you) { S.unread++; toast(`💬 ${m.name}: ${m.text}`); render(); }
  });

  function emit(ev, data) {
    return new Promise((res) => {
      socket.emit(ev, data, (r) => {
        if (r && !r.ok) { toast(r.error, true); Sound.play('error'); }
        res(r || { ok: false });
      });
    });
  }

  function onState(room, game) {
    const prev = S.game;
    const prevMusic = S.room && S.room.music;
    if (room && room.music && (!prevMusic || prevMusic.at !== room.music.at)) {
      if (prevMusic !== undefined && !room.isHost) { S.musicUnseen = true; toast(`🎵 ${room.music.by} ha avviato la musica: tocca 🎵 per ascoltarla`); }
    }
    if (room && !room.music) S.musicUnseen = false;
    S.turnEnd = room && room.turnLeft != null ? Date.now() + room.turnLeft : null;
    S.warned10 = S.turnKey === (game && `${game.handNo}:${game.turn}`) ? S.warned10 : false;
    S.turnKey = game && `${game.handNo}:${game.turn}`;
    S.room = room;
    S.game = game;
    if (!room) {
      if (S.screen !== 'setup') S.screen = 'home';
      if (S.pendingJoin && S.social && S.social.nick) { const code = S.pendingJoin; S.pendingJoin = ''; joinRoom(code); }
    } else {
      S.pendingJoin = '';
      if (store.get('bur_lastroom', '') === room.code) store.set('bur_lastroom', '');
      S.screen = game ? 'game' : 'lobby';
      if (location.search) history.replaceState(null, '', location.pathname);
    }
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
        if (game.over && game.winners && game.winners.includes(game.you)) setTimeout(() => confetti(), 700);
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
