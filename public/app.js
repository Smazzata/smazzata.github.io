(() => {
  'use strict';
  const R = window.BurracoRules;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage non disponibile */ } },
  };

  // Senza internet (o aprendo la pagina con ?offline=1) si gioca contro il computer con il server locale
  const OFFLINE = (() => {
    try {
      if (/[?&]offline=1/.test(location.search)) sessionStorage.setItem('bur_offline', '1');
      return typeof io === 'undefined' || sessionStorage.getItem('bur_offline') === '1';
    } catch (e) { return typeof io === 'undefined'; }
  })();

  const DEFAULT_PREFS = { felt: 'verde', back: 'rosso', sound: true, big: false, theme: 'chiaro' };
  const S = {
    token: store.get('bur_token', null),
    name: store.get('bur_name', ''),
    rules: R.normalize(store.get('bur_rules', R.PRESETS[0].rules)),
    prefs: (() => {
      const p = { ...DEFAULT_PREFS, ...store.get('bur_prefs', {}) };
      // vecchie scelte (automatico/giorno/notte) → chiaro/scuro
      if (!['chiaro', 'scuro'].includes(p.theme)) p.theme = p.theme === 'notte' ? 'scuro' : 'chiaro';
      return p;
    })(),
    editRules: null,
    screen: 'home',
    room: null,
    game: null,
    selected: new Set(),
    sortMode: store.get('bur_sort', 'suit'), // suit | rank | manual
    handOrder: [],
    chat: [],
    unread: 0,
    connected: false,
    pendingJoin: (new URLSearchParams(location.search).get('t') || '').toUpperCase(),
    pendingProfile: new URLSearchParams(location.search).get('profilo') || '',
    social: null,
    nickCheck: null,
    customOpen: false,
    modalKind: null,
    newIds: new Set(),
    flashMeld: null,
    lastTap: { id: null, t: 0 },
    drag: null,
    pendingRender: false,
    justDragged: 0,
  };

  /* ================= Suoni (sintetizzati, nessun file) ================= */
  const Sound = {
    ctx: null,
    unlock() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; }
    },
    tone(freq, dur, type = 'sine', vol = 0.12, delay = 0) {
      const c = this.ctx; if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + dur + 0.02);
    },
    noise(dur = 0.09, vol = 0.18, freq = 2400) {
      const c = this.ctx; if (!c) return;
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
      g.gain.value = vol;
      src.buffer = buf; src.connect(f).connect(g).connect(c.destination); src.start();
    },
    play(kind) {
      if (!S.prefs.sound || !this.ctx) return;
      switch (kind) {
        case 'select': this.tone(1500, 0.04, 'triangle', 0.05); break;
        case 'card': this.noise(0.08, 0.22, 2600); break;
        case 'meld': this.noise(0.06, 0.18, 1800); this.noise(0.06, 0.15, 2200); break;
        case 'turn': this.tone(660, 0.18, 'sine', 0.1); this.tone(880, 0.25, 'sine', 0.1, 0.12); break;
        case 'burraco': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.1, i * 0.09)); break;
        case 'error': this.tone(180, 0.18, 'square', 0.05); break;
        case 'win': [523, 659, 784, 659, 1047].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, i * 0.12)); break;
      }
    },
  };

  /* ================= Preferenze grafiche ================= */
  function applyPrefs() {
    const night = S.prefs.theme === 'scuro';
    document.body.dataset.theme = night ? 'notte' : 'giorno';
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = night ? '#06180f' : '#0f5132';
    document.body.dataset.felt = S.prefs.felt;
    document.body.dataset.back = S.prefs.back;
    document.body.classList.toggle('bigcards', !!S.prefs.big);
    store.set('bur_prefs', S.prefs);
  }
  applyPrefs();

  /* ================= Connessione ================= */
  // tentativi di ricollegamento ravvicinati (0,3 s → massimo 2 s)
  const socket = OFFLINE
    ? LocalServer.createSocket({ engineUrl: 'engine.js', name: store.get('bur_name', '') })
    : io({ reconnectionDelay: 300, reconnectionDelayMax: 2000, randomizationFactor: 0.3 });
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
    notify('Burraco: invito', `${from} ti invita al tavolo ${code}`, 'invite');
    openModal('invite', `<div class="result" style="text-align:center"><h2>🎴 Invito</h2>
      <p><b>${esc(from)}</b> ti invita al suo tavolo <b>${esc(code)}</b>.</p>
      ${started ? '<p class="muted">La partita è già iniziata: potrai entrare solo se si libera un posto.</p>' : ''}
      <div class="row" style="justify-content:center"><button class="btn primary big" data-act="acceptInvite" data-code="${esc(code)}">Entra</button><button class="btn" data-act="closeModal">No grazie</button></div></div>`);
  });
  socket.on('state', ({ room, game }) => onState(room, game));
  socket.on('reaction', ({ seat, emoji }) => {
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
  });
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
        notify('Burraco: tocca a te!', `Tavolo ${room.code} · ${lastMove(game)}`, 'turn');
      }
      if (game.phase === 'handEnd') recordStats(room, game);
      if (game.phase === 'handEnd' && (!prev || prev.phase !== 'handEnd' || prev.handNo !== game.handNo)) {
        setTimeout(showResult, 900);
        if (prev) notify('Burraco: smazzata finita', game.over ? 'La partita è terminata: guarda chi ha vinto!' : 'Guarda il punteggio e preparati alla prossima.', 'hand');
        const mine = game.handResult && game.handResult.teams.find((t) => t.members.includes(game.you));
        const best = game.handResult && Math.max(...game.handResult.teams.map((t) => t.total));
        if (mine && mine.total === best) setTimeout(() => Sound.play('win'), 500);
        if (game.over && game.winners && game.winners.includes(game.you)) setTimeout(() => confetti(), 700);
        if (game.over && room.series && room.series.champion && room.series.champion.includes(game.you)) setTimeout(() => confetti(260, 4500), 1500);
      } else if (game.phase !== 'handEnd' && S.modalKind === 'result') closeModal();
      else if (S.modalKind === 'result') showResult();
      document.title = game.turn === game.you && game.phase !== 'handEnd' ? '● Tocca a te · Burraco' : 'Burraco Online';
    } else {
      document.title = 'Burraco Online';
      keepScreenOn(false);
      if (S.modalKind === 'result') closeModal();
    }
    render();
  }

  /* ---------- Notifiche di sistema quando la pagina è in secondo piano ---------- */
  const canNotify = 'Notification' in window && 'serviceWorker' in navigator && window.isSecureContext;
  let swReg = null;
  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js').then((r) => { swReg = r; }).catch(() => {});
  }
  async function notify(title, body, tag) {
    if (!S.prefs.notify || !canNotify || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
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
    } else Sound.play('card');
  }

  /* ================= Carte ================= */
  const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const rankName = (r) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[r] || String(r));
  const isWild = (c) => c.r === 0 || c.r === 2;

  const SUIT_NAME = { S: 'picche', H: 'cuori', D: 'quadri', C: 'fiori' };
  function cardHTML(c, cls = '', attrs = '') {
    if (c.r === 0) {
      return `<div class="card joker ${cls}" data-card="${c.id}" aria-label="Jolly" ${attrs}><span class="ix">J<br>O<br>L<br>L<br>Y</span><span class="jk">★</span></div>`;
    }
    const red = c.s === 'H' || c.s === 'D';
    const face = c.r >= 11 ? `<span class="face">${rankName(c.r)}<i>${SUIT[c.s]}</i></span>` : `<span class="pip">${SUIT[c.s]}</span>`;
    return `<div class="card ${red ? 'red' : 'black'} ${c.r === 2 ? 'two' : ''} ${cls}" data-card="${c.id}" aria-label="${rankName(c.r)} di ${SUIT_NAME[c.s]}" ${attrs}>
      <span class="ix">${rankName(c.r)}<i>${SUIT[c.s]}</i></span>${face}<span class="ix br">${rankName(c.r)}<i>${SUIT[c.s]}</i></span></div>`;
  }
  const backHTML = (cls = '', attrs = '') => `<div class="card back ${cls}" ${attrs}></div>`;

  /**
   * Ordinamento "Giochi": combinazioni pronte (3+), poi quasi pronte (coppie, scale con un buco),
   * poi carte sciolte, matte in fondo. Scelta golosa: prima i gruppi più lunghi.
   */
  function smartSort(cards) {
    const allowSets = !S.game || S.game.cfg.rules.allowSets;
    const nat = cards.filter((c) => !isWild(c));
    const wilds = sortCards(cards.filter(isWild), 'suit');
    const groups = [];
    // scale: carte consecutive dello stesso seme (l'Asso vale sia 1 sia 14)
    for (const s of ['S', 'H', 'C', 'D']) {
      const bySlot = new Map();
      for (const c of nat.filter((x) => x.s === s)) for (const p of c.r === 1 ? [1, 14] : [c.r]) if (!bySlot.has(p)) bySlot.set(p, c);
      let run = [];
      for (let p = 1; p <= 15; p++) {
        const c = bySlot.get(p);
        if (c && !run.includes(c)) run.push(c);
        else { if (run.length >= 2) groups.push({ cards: run.slice(), gap: false }); run = c ? [c] : []; }
      }
      // quasi-scale con un buco (es. 5 e 7)
      for (let p = 1; p <= 12; p++) {
        const a = bySlot.get(p), b = bySlot.get(p + 2);
        if (a && b && a !== b && !bySlot.has(p + 1)) groups.push({ cards: [a, b], gap: true });
      }
    }
    if (allowSets) {
      const byRank = new Map();
      for (const c of nat) { if (!byRank.has(c.r)) byRank.set(c.r, []); byRank.get(c.r).push(c); }
      for (const list of byRank.values()) if (list.length >= 2) groups.push({ cards: list, gap: false });
    }
    // i gruppi completi prima, poi i più lunghi; le quasi-scale per ultime
    groups.sort((x, y) => (y.cards.length >= 3) - (x.cards.length >= 3) || x.gap - y.gap || y.cards.length - x.cards.length);
    const used = new Set();
    const out = [];
    for (const gr of groups) {
      if (gr.cards.some((c) => used.has(c.id))) continue;
      gr.cards.forEach((c) => used.add(c.id));
      out.push(...gr.cards);
    }
    const loose = sortCards(nat.filter((c) => !used.has(c.id)), 'suit');
    return [...out, ...loose, ...wilds];
  }

  function sortCards(cards, mode) {
    if (mode === 'smart') return smartSort(cards);
    const suitOrder = { S: 0, H: 1, C: 2, D: 3 };
    const rk = (c) => (c.r === 1 ? 14 : c.r);
    return cards.slice().sort((a, b) => {
      const wa = isWild(a), wb = isWild(b);
      if (wa !== wb) return wa ? 1 : -1;
      if (wa && wb) return a.r - b.r || (suitOrder[a.s] || 0) - (suitOrder[b.s] || 0);
      if (mode === 'rank') return rk(a) - rk(b) || suitOrder[a.s] - suitOrder[b.s];
      return suitOrder[a.s] - suitOrder[b.s] || rk(a) - rk(b);
    });
  }

  function syncHandOrder(game, sameHand) {
    const ids = game.hand.map((c) => c.id);
    const kept = sameHand ? S.handOrder.filter((id) => ids.includes(id)) : [];
    if (S.sortMode !== 'manual' || kept.length === 0) {
      S.handOrder = sortCards(game.hand, ['rank', 'smart'].includes(S.sortMode) ? S.sortMode : 'suit').map((c) => c.id);
      if (S.sortMode === 'manual' && !sameHand) S.sortMode = 'suit';
      return;
    }
    S.handOrder = kept.concat(ids.filter((id) => !kept.includes(id)));
  }

  function orderedHand() {
    const g = S.game;
    const byId = new Map(g.hand.map((c) => [c.id, c]));
    return S.handOrder.map((id) => byId.get(id)).filter(Boolean);
  }

  /* ================= UI di base ================= */
  let toastTimer = null;
  function toast(msg, error = false) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast' + (error ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('hidden'), error ? 3200 : 2200);
  }

  function openModal(kind, html) {
    S.modalKind = kind;
    $('#modal .modal-content').innerHTML = html;
    $('#modal').classList.remove('hidden');
  }
  function closeModal() {
    S.modalKind = null;
    $('#modal').classList.add('hidden');
  }
  $('#modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal' || e.target.closest('.modal-close')) closeModal();
  });

  function presetById(id) { return R.PRESETS.find((p) => p.id === id); }

  function rulesModal(rules, title, backToEdit = false) {
    const pid = R.matchPreset(rules);
    const p = pid && presetById(pid);
    openModal('rules', `<div class="rules-text">
      ${backToEdit ? '<button class="btn small" data-act="backEdit">← Torna alla modifica</button>' : ''}
      <h2>${esc(title || (p ? p.name : 'Regole personalizzate'))}</h2>
      ${p ? p.intro : '<p>Regole personalizzate per questa partita. Ecco il riepilogo completo:</p>'}
      ${R.describe(rules)}
      ${HOW_TO}
      ${R.OTHER_VARIANTS}
    </div>`);
  }

  const HOW_TO = `
<h3>Come si gioca nell'app</h3>
<ul>
<li><b>Pescare</b>: tocca il tallone, oppure trascinalo nella tua mano. Per raccogliere gli scarti tocca il monte o trascinalo nella mano.</li>
<li><b>Selezionare</b>: tocca le carte della mano (si alzano).</li>
<li><b>Calare</b>: trascina le carte selezionate nella zona <i>“＋ Nuova combinazione”</i> del tuo tavolo, oppure premi <i>Cala</i>.</li>
<li><b>Attaccare</b>: trascina le carte su una tua combinazione, oppure selezionale e tocca la combinazione.</li>
<li><b>Scartare</b>: seleziona una carta e tocca il monte degli scarti, oppure trascinala sul monte, oppure fai doppio tocco sulla carta.</li>
<li><b>Riordinare la mano</b>: trascina una carta in un altro punto della mano. Il pulsante ⇅ riordina per seme o per valore.</li>
<li>Puoi calare <b>più combinazioni insieme</b>: selezionale tutte e tocca ＋. Le giocate fatte non si possono annullare.</li>
<li>Da ⚙️ puoi cambiare colore del tavolo, dorso delle carte, dimensione e suoni. Giocando da solo contro il computer puoi attivare i <b>suggerimenti 💡</b>.</li>
</ul>`;

  function rulesFormHTML(rules) {
    let html = '<div class="rules-form">';
    let group = null;
    for (const f of R.SCHEMA) {
      if (f.group !== group) { group = f.group; html += `<h4>${esc(group)}</h4>`; }
      const disabled = f.requires && !rules[f.requires];
      let input;
      if (f.type === 'bool') input = `<input type="checkbox" data-rule="${f.key}" ${rules[f.key] ? 'checked' : ''} ${disabled ? 'disabled' : ''}>`;
      else if (f.type === 'number') input = `<input type="number" data-rule="${f.key}" value="${rules[f.key]}" min="${f.min}" max="${f.max}" step="${f.step}">`;
      else input = `<select data-rule="${f.key}" ${disabled ? 'disabled' : ''}>${f.choices.map(([v, l]) => `<option value="${v}" ${String(v) === String(rules[f.key]) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
      html += `<label class="opt ${disabled ? 'disabled' : ''}"><span>${esc(f.label)}${f.hint ? `<br><span class="hint">${esc(f.hint)}</span>` : ''}</span>${input}</label>`;
    }
    return html + '</div>';
  }

  function presetsHTML(rules) {
    const cur = R.matchPreset(rules);
    return `<div class="presets">${R.PRESETS.map((p) => `
      <button class="preset ${cur === p.id ? 'active' : ''}" data-act="preset" data-id="${p.id}">
        <b>${esc(p.name)}</b><span>${esc(p.tagline)}</span>
      </button>`).join('')}</div>`;
  }

  function rulesStatus(rules) {
    const pid = R.matchPreset(rules);
    const p = pid && presetById(pid);
    return p ? `<span class="badge gold">${esc(p.name)}</span>` : '<span class="badge gold">Regole personalizzate</span>';
  }

  function settingsModal() {
    const opt = (key, val, label, extra = '') => `<button class="swatch ${S.prefs[key] === val ? 'on' : ''}" data-act="pref" data-key="${key}" data-val="${val}" ${extra}>${label}</button>`;
    openModal('settings', `<h2>Aspetto e suoni</h2>
      <h4>Tema</h4>
      <div class="row">${opt('theme', 'chiaro', '☀️ Chiaro')}${opt('theme', 'scuro', '🌙 Scuro')}</div>
      <h4>Colore del tavolo</h4>
      <div class="row">${opt('felt', 'verde', '<i class="sw felt-verde"></i>Verde')}${opt('felt', 'blu', '<i class="sw felt-blu"></i>Blu')}${opt('felt', 'bordeaux', '<i class="sw felt-bordeaux"></i>Bordeaux')}${opt('felt', 'antracite', '<i class="sw felt-antracite"></i>Antracite')}</div>
      <h4>Dorso delle carte</h4>
      <div class="row">${opt('back', 'rosso', '<i class="sw back-rosso"></i>Rosso')}${opt('back', 'blu', '<i class="sw back-blu"></i>Blu')}${opt('back', 'verde', '<i class="sw back-verde"></i>Verde')}${opt('back', 'nero', '<i class="sw back-nero"></i>Nero')}</div>
      <h4>Carte</h4>
      <div class="row">${opt('big', false, 'Normali')}${opt('big', true, 'Grandi')}</div>
      <h4>Notifiche "tocca a te"</h4>
      ${canNotify ? `<div class="row">${opt('notify', true, '🔔 Attive')}${opt('notify', false, '🔕 Disattivate')}</div>
        <p class="muted small">Arrivano quando il gioco è aperto in secondo piano.${typeof Notification !== 'undefined' && Notification.permission === 'denied' ? ' <b>Il browser le ha bloccate: riattivale dalle impostazioni del sito.</b>' : ''}</p>`
        : '<p class="muted small">Su questo dispositivo o browser le notifiche non sono disponibili.</p>'}
      <h4>Suoni</h4>
      <div class="row">${opt('sound', true, '🔊 Attivi')}${opt('sound', false, '🔇 Disattivati')}</div>
      <h4>Qualcosa non va?</h4><button class="btn small" data-act="report">🐞 Segnala un problema</button>
      ${S.room && S.room.isHost && (!S.game || S.game.over) ? `<h4>Torneo (si imposta tra una partita e l'altra)</h4>${seriesPickHTML(S.room.series && S.room.series.bestOf)}` : ''}
      ${S.room && S.room.isHost ? `<h4>Aiuto: dove attaccare le carte</h4>${aidsHTML(S.room.aids !== false)}` : ''}
      ${S.room && S.room.isHost ? `<h4>Tempo per turno</h4>${turnTimeHTML(S.room.turnTime)}` : ''}
      ${S.room && S.room.isHost ? `<h4>Bravura del computer</h4>${botLevelHTML(S.room.botLevel)}` : ''}
      ${S.room && S.room.isHost ? `<h4>Velocità del computer</h4>${botSpeedHTML(S.room.botSpeed)}` : ''}
      ${S.room && S.room.isHost && S.room.humans <= 1 ? `<h4>Suggerimenti 💡 (solo contro il computer)</h4>
        <div class="row"><button class="swatch ${S.room.hints ? 'on' : ''}" data-act="setHints" data-val="1">Attivi</button><button class="swatch ${S.room.hints ? '' : 'on'}" data-act="setHints" data-val="0">Disattivati</button></div>` : ''}`);
  }

  function aidsHTML(on) {
    return `<div class="row"><button class="swatch ${on ? 'on' : ''}" data-act="setAids" data-val="1">Attivi</button><button class="swatch ${on ? '' : 'on'}" data-act="setAids" data-val="0">Disattivati</button></div>
      <p class="muted small">Selezionando delle carte si illuminano le combinazioni a cui si possono attaccare e si vede se la nuova calata è valida.</p>`;
  }

  function turnTimeHTML(cur) {
    return `<div class="row">${[[0, 'Nessun limite'], [30, '30 s'], [60, '60 s'], [90, '90 s']]
      .map(([v, l]) => `<button class="swatch ${Number(cur || 0) === v ? 'on' : ''}" data-act="turnTime" data-val="${v}">${l}</button>`).join('')}</div>`;
  }

  function botLevelHTML(cur) {
    return `<div class="row">${[['facile', '🙂 Facile'], ['normale', 'Normale'], ['difficile', '🧠 Difficile']]
      .map(([v, l]) => `<button class="swatch ${(cur || 'normale') === v ? 'on' : ''}" data-act="botLevel" data-val="${v}">${l}</button>`).join('')}</div>`;
  }

  function botSpeedHTML(cur) {
    return `<div class="row">${[['lenta', '🐢 Lenta'], ['normale', 'Normale'], ['veloce', '⚡ Veloce']]
      .map(([v, l]) => `<button class="swatch ${cur === v ? 'on' : ''}" data-act="botSpeed" data-val="${v}">${l}</button>`).join('')}</div>`;
  }

  /** Link di Spotify → indirizzo del lettore integrato (solo per contenuti pubblici, non per le Jam) */
  function spotifyEmbed(url) {
    const m = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]+)/.exec(url || '');
    return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
  }

  function musicModal() {
    const r = S.room;
    const mu = r.music;
    S.musicUnseen = false;
    const embed = mu && spotifyEmbed(mu.url);
    const isJam = mu && !embed;
    openModal('music', `<h2>🎵 Musica del tavolo</h2>
      ${mu ? `<p>${esc(mu.by)} ha condiviso ${isJam ? 'una <b>Jam</b> di Spotify: entrando ascoltate tutti la stessa musica, sincronizzata.' : 'questa musica:'}</p>
        ${embed ? `<iframe class="spotify" src="${embed}" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>` : ''}
        <a class="btn primary big" style="display:block;text-align:center;text-decoration:none;margin-top:10px" href="${esc(mu.url)}" target="_blank" rel="noopener">${isJam ? '▶ Unisciti alla Jam su Spotify' : '▶ Apri in Spotify'}</a>`
        : '<p class="muted">Nessuna musica condivisa per ora.</p>'}
      ${r.isHost ? `<h4>${mu ? 'Cambia musica' : 'Condividi la musica con il tavolo'}</h4>
        <p class="muted small">Su Spotify avvia una <b>Jam</b> (dal brano in riproduzione: icona dei dispositivi → <i>Avvia una Jam</i>) e copia il link d'invito, oppure copia il link di una playlist. Poi incollalo qui.</p>
        <form id="musicform" class="row"><input id="musicin" class="grow" placeholder="https://open.spotify.com/…" autocomplete="off"><button class="btn primary">Condividi</button></form>
        ${mu ? '<button class="btn small danger" style="margin-top:8px" data-act="musicStop">Smetti di condividere</button>' : ''}` : ''}
      <p class="muted small" style="margin-top:12px">Ognuno ascolta dal proprio Spotify: per le Jam di solito serve Spotify Premium a chi la avvia.</p>`);
  }

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

  function friendsModal() {
    const so = S.social || { friends: [], reqIn: [], reqOut: [] };
    const inRoom = S.room && S.room.code;
    const friend = (f) => `<div class="friend">${avatarHTML(f.nick, 0, false, f.avatar || { e: f.nick.charAt(0).toUpperCase(), c: '#9e9e9e' })}<span class="dot ${f.online ? '' : 'off'}"></span>
      <span class="grow" data-act="playerCard" data-nick="${esc(f.nick)}" style="cursor:pointer"><b>${esc(f.nick)}</b> <span class="muted small">›</span><br><span class="muted small">${f.online ? (f.room ? (f.room === inRoom ? 'al tuo tavolo' : f.playing ? 'sta giocando' : 'in un tavolo') : 'online') : 'offline'}</span></span>
      ${inRoom && f.online && f.room !== inRoom ? `<button class="btn small primary" data-act="invite" data-nick="${esc(f.nick)}">Invita</button>` : ''}
      ${f.playing && f.room && f.room !== inRoom ? `<button class="btn small" data-act="watch" data-code="${esc(f.room)}">👁 Guarda</button>` : ''}
      <button class="btn small ghost dark" data-act="unfriend" data-nick="${esc(f.nick)}" title="Rimuovi">✕</button></div>`;
    openModal('friends', `<h2>👥 Amici</h2>
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

  /* ================= Impara a giocare ================= */
  const mini = (r, s) => cardHTML({ id: -100 - r * 4 - 'SHDCJ'.indexOf(s), r, s }, 'tut');
  const TUTORIAL = [
    { t: 'Lo scopo', h: `<p>Si gioca in coppia (o da soli) con due mazzi e i jolly. Lo scopo è <b>calare combinazioni</b>,
       fare dei <b>burraco</b> (combinazioni di almeno 7 carte), prendere il <b>pozzetto</b> e <b>chiudere</b> prima degli avversari.</p>
       <div class="tutcards">${mini(7, 'H')}${mini(8, 'H')}${mini(9, 'H')}${mini(10, 'H')}${mini(11, 'H')}${mini(12, 'H')}${mini(13, 'H')}</div><p class="muted small">Un burraco: 7 carte in scala.</p>` },
    { t: 'Il tuo turno', h: `<ol><li><b>Pesca</b>: tocca il tallone, oppure tocca gli scarti per prenderli <i>tutti</i>.</li>
       <li><b>Cala</b>: seleziona le carte toccandole e tocca <b>＋</b> sul tavolo (oppure trascinale lì).</li>
       <li><b>Scarta</b>: seleziona una carta e tocca gli scarti. Il turno finisce sempre con uno scarto.</li></ol>` },
    { t: 'Le combinazioni', h: `<p><b>Scala</b>: almeno 3 carte in fila dello stesso seme.</p><div class="tutcards">${mini(4, 'S')}${mini(5, 'S')}${mini(6, 'S')}</div>
       <p><b>Tris</b>: almeno 3 carte uguali.</p><div class="tutcards">${mini(9, 'H')}${mini(9, 'S')}${mini(9, 'D')}</div>
       <p class="muted small">Puoi attaccare carte alle tue combinazioni in qualsiasi turno.</p>` },
    { t: 'Le matte', h: `<p>Il <b>jolly</b> e i <b>2 (pinelle)</b> sostituiscono qualsiasi carta, ma al massimo <b>una per combinazione</b>.</p>
       <div class="tutcards">${mini(5, 'C')}${cardHTML({ id: -199, r: 0, s: 'J' }, 'tut')}${mini(7, 'C')}</div>
       <p>Un burraco senza matte è <b>pulito</b> (+200), con una matta è <b>sporco</b> (+100).</p>` },
    { t: 'Il pozzetto', h: `<p>Quando finisci le carte prendi un <b>pozzetto</b>: 11 carte nuove con cui continuare. Ogni coppia ne prende uno.</p>
       <p>Se a fine smazzata non l'hai preso: <b>−100 punti</b>.</p>` },
    { t: 'Chiudere e vincere', h: `<p>Per <b>chiudere</b> devi aver preso il pozzetto, avere almeno un burraco e scartare l'ultima carta (non una matta): <b>+100</b>.</p>
       <p>Contano le carte calate e i bonus; le carte rimaste in mano si sottraggono. Vince chi arriva per primo al punteggio stabilito.</p>
       <p>Ora prova una partita di allenamento: il computer gioca piano e il pulsante 💡 ti suggerisce la mossa.</p>` },
  ];

  function tutorialModal(i = 0) {
    const sl = TUTORIAL[i];
    openModal('tutorial', `<div class="tutorial">
      <div class="tutdots">${TUTORIAL.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <h2>${i + 1}. ${sl.t}</h2>${sl.h}
      <div class="row" style="margin-top:14px">
        ${i ? `<button class="btn" data-act="tutStep" data-i="${i - 1}">← Indietro</button>` : ''}
        ${i < TUTORIAL.length - 1 ? `<button class="btn primary grow" data-act="tutStep" data-i="${i + 1}">Avanti →</button>`
          : '<button class="btn primary grow big" data-act="practice">🎓 Partita di allenamento</button>'}
      </div></div>`);
  }

  /** Consiglio dell'allenatore durante la partita di allenamento */
  function coachTip(g) {
    if (g.phase === 'handEnd') return 'Guarda il riepilogo: le carte calate e i burraco danno punti, quelle in mano li tolgono.';
    if (g.turn !== g.you) return 'Ora gioca il computer: osserva cosa cala e cosa scarta.';
    const myTeam = g.teams.find((t) => t.members.includes(g.you));
    if (g.phase === 'draw') return g.discardCount > 1 ? 'Pesca dal tallone, oppure prendi tutti gli scarti se ti servono per una combinazione.' : 'Tocca il tallone per pescare una carta.';
    const sel = S.selected.size;
    if (myTeam && myTeam.canClose) return 'Puoi chiudere! Cala tutto quello che puoi e scarta l\'ultima carta.';
    if (sel >= 3) return 'Se la casella ＋ dice "✓ Cala", toccala per calare queste carte.';
    if (sel === 1) return 'Tocca gli scarti per scartare questa carta, oppure un tuo gioco per attaccarla.';
    return 'Cerca 3 carte in scala dello stesso seme o 3 uguali e selezionale. Non sai cosa fare? Tocca 💡.';
  }

  function seriesHTML(r, g) {
    const sr = r.series;
    if (!sr) return '';
    const label = (i) => (g && g.players[i] ? (i === g.you ? 'Tu' : g.players[i].name) : r.seats[i] ? r.seats[i].name : '?');
    const groups = r.n === 4 ? [[0, 2], [1, 3]] : Array.from({ length: r.n }, (_, i) => [i]);
    return `🏆 ${groups.map((gr) => `${gr.map(label).map(esc).join(' & ')} <b>${sr.wins[gr[0]]}</b>`).join(' · ')} <span class="muted small">(al meglio di ${sr.bestOf})</span>`;
  }

  function seriesPickHTML(cur) {
    return `<div class="row">${[[1, 'Partita singola'], [3, 'Al meglio di 3'], [5, 'Al meglio di 5']]
      .map(([v, l]) => `<button class="swatch ${(cur || 1) === v ? 'on' : ''}" data-act="series" data-val="${v}">${l}</button>`).join('')}</div>`;
  }

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

  function homeHTML() {
    const fan = [{ r: 1, s: 'S' }, { r: 13, s: 'H' }, { r: 0, s: 'J' }, { r: 2, s: 'D' }, { r: 7, s: 'C' }]
      .map((c, i) => cardHTML({ ...c, id: -1 - i }, 'logo-card', `style="--i:${i - 2}"`)).join('');
    return `<div class="page">
      <div class="logo"><div class="logo-fan">${fan}</div><h1>Burraco</h1>
        <div class="muted">Gioca con gli amici o contro il computer</div></div>
      <div class="panel">
        ${OFFLINE ? `<div class="offbanner">📴 <b>Senza internet</b><br>Puoi giocare contro il computer e fare l'allenamento.
            Amici, classifica e partite online tornano quando sei collegato.
            <div class="row" style="margin-top:6px"><button class="btn small" data-act="goOnline">🔄 Riprova online</button></div></div>`
        : S.social && S.social.nick
          ? `<div class="hello"><span class="row">${avatarHTML(S.social.nick, 0, false, S.social.avatar || { e: S.social.nick.charAt(0).toUpperCase(), c: '#f2c14e' })}<span>Ciao, <b>${esc(S.social.nick)}</b>!</span></span>
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
        <div class="row" style="margin-top:10px">
          <input type="text" id="joinCode" class="grow codein" maxlength="4" placeholder="Codice tavolo" value="${esc(S.pendingJoin)}">
          <button class="btn" data-act="join">Entra</button>
        </div>`}
        ${S.pendingJoin ? '<p class="muted">Sei stato invitato al tavolo: scrivi il tuo nome e premi Entra.</p>' : ''}
      </div>
      ${IS_ANDROID && !IN_APP && !OFFLINE ? `<a class="apkbanner" href="${APK_URL}">
        <img src="icons/icon-192.png" alt=""><span><b>📱 Scarica l'app per Android</b><br>Installala e gioca a schermo intero</span></a>` : ''}
      <div class="panel">
        <h2>Regole e varianti</h2>
        <p class="muted">Ogni preset è un punto di partenza: quando crei una partita puoi modificare ogni singola regola.</p>
        <div class="presets">${R.PRESETS.map((p) => `<button class="preset" data-act="presetRules" data-id="${p.id}"><b>${esc(p.name)}</b><span>${esc(p.tagline)}</span></button>`).join('')}</div>
        <div class="row" style="margin-top:10px"><button class="btn ghost small" data-act="howto">Come si gioca nell'app</button><button class="btn ghost small" data-act="settings">⚙️ Aspetto e suoni</button><button class="btn ghost small" data-act="toggleTheme">${S.prefs.theme === 'scuro' ? '☀️ Tema chiaro' : '🌙 Tema scuro'}</button><button class="btn ghost small" data-act="stats">📊 Statistiche</button>${OFFLINE ? '' : '<button class="btn ghost small" data-act="leaders">🏆 Classifica</button><button class="btn ghost small" data-act="report">🐞 Segnala un problema</button>'}</div>
        <p class="muted small" style="margin:10px 0 0;text-align:center"><a href="privacy.html" style="color:inherit">🔒 Privacy: quali dati usiamo e come cancellarli</a></p>
      </div>
    </div>`;
  }

  function setupHTML() {
    return `<div class="page">
      <div class="row"><button class="btn ghost small" data-act="goHome">← Indietro</button></div>
      <h2>Nuova partita</h2>
      <div class="panel">
        <h2>1. Scegli una base</h2>
        ${presetsHTML(S.rules)}
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

  const SEAT_COLORS = ['#f2c14e', '#64b5f6', '#ef7d7d', '#81c784'];
  function avatarHTML(name, seat, isBot, av) {
    if (av && !isBot) return `<span class="avatar emo" style="--c:${esc(av.c)}">${esc(av.e)}</span>`;
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
      const team = r.n === 4 ? `<span class="teamtag">Coppia ${i % 2 === 0 ? 'A' : 'B'}</span>` : '';
      return `<div class="seat">
        <div class="who">${s ? avatarHTML(s.name, i, s.isBot, s.avatar) : '<span class="avatar empty">?</span>'}
        <div>${s ? `<b>${esc(s.name)}</b>${me ? ' <span class="badge">tu</span>' : ''}${i === r.host ? ' <span class="badge">host</span>' : ''}${s.connected ? '' : ' <span class="muted">(offline)</span>'}` : '<span class="muted">Posto libero</span>'}<br>${team}</div>
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
            <button class="btn primary grow" data-act="start" ${full ? '' : 'disabled'}>Avvia partita</button></div>`
          : '<p class="muted">In attesa che l\'host avvii la partita…</p>'}
      </div>
      <div class="panel">
        <h2>Regole</h2>
        <p>${rulesStatus(r.rules)} <span class="muted">· ${r.n} giocatori · si vince a ${r.rules.target}</span></p>
        <div class="row"><button class="btn small" data-act="music">🎵 Musica del tavolo${r.music ? ' (attiva)' : ''}</button></div>
        <div class="row" style="margin-top:8px"><button class="btn small" data-act="roomRules">📜 Leggi le regole</button>
        ${isHost ? '<button class="btn small" data-act="editRules">✏️ Modifica regole</button>' : ''}</div>
        ${isHost ? `<h2 style="margin-top:14px">Torneo</h2>${seriesPickHTML(r.series && r.series.bestOf)}` : r.series ? `<p>🏆 Torneo al meglio di ${r.series.bestOf}</p>` : ''}
        ${isHost ? `<h2 style="margin-top:14px">Aiuto: dove attaccare le carte</h2>${aidsHTML(r.aids !== false)}` : ''}
        ${isHost ? `<h2 style="margin-top:14px">Tempo per turno</h2>${turnTimeHTML(r.turnTime)}
          <p class="muted small">Allo scadere il gioco pesca e scarta al posto del giocatore.</p>` : ''}
        ${isHost ? `<h2 style="margin-top:14px">Bravura del computer</h2>${botLevelHTML(r.botLevel)}` : ''}
        ${isHost ? `<h2 style="margin-top:14px">Velocità del computer</h2>${botSpeedHTML(r.botSpeed)}` : ''}
      </div>
    </div>`;
  }

  /* ================= Tavolo di gioco ================= */
  function teamName(g, t) {
    return t.members.map((s) => (s === g.you ? 'Tu' : g.players[s].name)).join(' & ');
  }

  /* ---------- Anteprima delle mosse (stessa logica del server) ---------- */
  const M = window.BurracoMelds;
  function meldCfg(g) {
    const r = g.cfg.rules;
    return { allowSets: r.allowSets, maxWild: r.maxWild, aceBothEnds: r.aceBothEnds };
  }

  /** Cosa si può fare con le carte selezionate: giochi a cui attaccarle e validità di una nuova calata */
  function selectionPreview(g, myTeam) {
    const out = { canAdd: new Set(), newMeld: null };
    if (!myTeam || g.turn !== g.you) return out;
    if (S.room && S.room.aids === false) return out; // aiuti visivi disattivati dall'host
    const sel = orderedHand().filter((c) => S.selected.has(c.id));
    const closedDraw = g.phase === 'draw' && g.cfg.pile === 'closed' && g.discard.length;
    if (g.phase !== 'play' && !closedDraw) return out;
    const cards = closedDraw ? [g.discard[g.discard.length - 1], ...sel] : sel;
    if (!sel.length) return out;
    const cfg = meldCfg(g);
    for (const m of myTeam.melds) if (M.analyzeMeld(m.cards.concat(cards), cfg, m.type)) out.canAdd.add(m.id);
    if (cards.length >= 3) {
      const groups = M.partitionMelds(cards, cfg);
      let ok = !!groups;
      if (groups && g.cfg.rules.noDuplicateSets) {
        const ranks = myTeam.melds.filter((m) => m.type === 'set').map((m) => m.cards.find((c) => !M.isWild(c)).r);
        for (const an of groups.filter((x) => x.type === 'set')) { if (ranks.includes(an.rank)) ok = false; ranks.push(an.rank); }
      }
      let label = groups ? (groups.length > 1 ? `${groups.length} giochi` : groups[0].type === 'seq' ? 'scala' : 'tris') : '';
      // da vulnerabili, senza giochi calati, servono abbastanza punti già in questa calata
      const vul = g.cfg.vulnerability;
      const myScore = g.scores[g.you];
      if (ok && vul && !myTeam.melds.length && myScore >= g.cfg.target * vul.ratio) {
        const v = g.cfg.values;
        const pts = cards.reduce((sum, c) => sum + (c.r === 0 ? v.joker : c.r === 2 ? v.two : c.r === 1 ? v.ace : c.r >= 8 ? v.high : v.low), 0);
        if (pts < vul.min) { ok = false; label = `${pts}/${vul.min} punti`; }
      }
      out.newMeld = { ok, label };
    }
    return out;
  }

  function meldHTML(m, mine, preview) {
    const short = { clean: 'Pulito', dirty: 'Sporco', semi: 'Semi', real13: '+500', real14: '+1000' }[m.kind] || '';
    const attrs = `data-mid="${m.id}"` + (mine ? ` data-meld="${m.id}" data-drop="meld"` : '');
    const can = preview && preview.canAdd.has(m.id) ? 'can-add' : '';
    const hint = S.hint && S.hint.meldId === m.id ? 'hinted' : '';
    const fr = S.freshCards || new Set();
    return `<div class="meld ${m.kind ? 'burraco ' + m.kind : ''} ${S.flashMeld === m.id ? 'flash' : ''} ${m.type === 'set' ? 'set' : ''} ${can} ${hint}" ${attrs} title="${esc(m.label || '')}">
      ${m.cards.map((c, i) => {
        // in modalità compatta si vedono solo le prime 2 carte e l'ultima
        const mid = m.cards.length >= 5 && i >= 2 && i < m.cards.length - 1;
        const hiddenFresh = mid && i === 2 && m.cards.slice(2, -1).some((x) => fr.has(x.id));
        const more = mid && i === 2 ? `<span class="more ${hiddenFresh ? 'fresh' : ''}">+${m.cards.length - 3}</span>` : '';
        return more + cardHTML(c, `mini ${m.wild[i] ? 'wildmark' : 'natural'} ${mid ? 'mid' : ''} ${fr.has(c.id) ? 'fresh' : ''}`);
      }).join('')}
      ${m.kind ? `<span class="tag">${short}</span>` : `<span class="cnt">${m.length}</span>`}</div>`;
  }

  function statusText(g) {
    const me = g.you;
    if (g.phase === 'handEnd') return g.over ? 'Partita terminata' : 'Smazzata terminata';
    const cur = g.players[g.turn];
    if (g.turn !== me) return `Turno di <b>${esc(cur.name)}</b>${g.lastTurn ? ' · <b>ultimo giro</b>' : ''}`;
    if (g.phase === 'draw') {
      if (g.mustDraw) return 'Tocca a te: tocca il <b>tallone</b> per pescare';
      if (g.cfg.pile === 'closed' && g.discardCount) return 'Tocca il <b>tallone</b>, oppure seleziona carte da combinare con la cima e tocca gli <b>scarti</b>';
      return 'Tocca a te: tocca il <b>tallone</b> o gli <b>scarti</b>';
    }
    const myTeam = g.teams.find((t) => t.members.includes(me));
    const sel = S.selected.size;
    let tip = sel === 1 ? 'Tocca gli <b>scarti</b> per scartare, o un tuo gioco per attaccare'
      : sel >= 2 ? 'Tocca <b>＋</b> per calare o un tuo gioco per attaccare'
        : 'Seleziona le carte: cala, attacca e poi <b>scarta</b>';
    if (myTeam && myTeam.canClose) tip = 'Puoi <b>chiudere</b>: cala tutto e scarta l\'ultima carta';
    else if (g.hand.length <= 3 && myTeam && myTeam.pozzettoTaken) tip += ` · per chiudere serve ${g.cfg.closeNeeds === 'clean' ? `una ${g.cfg.burracoName} pulita` : `un ${g.cfg.burracoName}`}`;
    if (g.lastTurn) tip += ' · <b>ultimo turno!</b>';
    return tip;
  }

  /** Avviso di fine tallone: quanti giri restano prima che la smazzata finisca */
  function stockWarning(g) {
    if (g.phase === 'handEnd') return null;
    if (g.lastTurn) return { level: 3, text: '🔔 Ultimo turno della smazzata!' };
    const r = g.cfg.rules;
    if (r.stockEnd === 'mortoToStock' && g.pozzetti.length) return null; // un pozzetto ricaricherà il tallone
    const draws = r.stockEnd === 'twoLeft' ? g.stockCount - 2 : g.stockCount;
    const rounds = Math.ceil(draws / g.n);
    if (rounds <= 1) return { level: 2, text: `⚠️ Ultimo giro: ${draws === 1 ? 'resta 1 pescata' : `restano ${draws} pescate`}` };
    if (rounds <= 2) return { level: 1, text: `⚠️ Tallone quasi finito: ~${rounds} giri` };
    return null;
  }

  /** ultima riga significativa della cronaca */
  /** Mosse degli altri dopo la mia ultima giocata (per evidenziarle e riassumerle) */
  function freshEvents(g) {
    if (g.you < 0 || !g.events) return [];
    let myLast = 0;
    for (const e of g.events) if (e.seat === g.you) myLast = e.n;
    return g.events.filter((e) => e.seat !== g.you && e.n > myLast);
  }

  /** Riassunto, una riga per giocatore: "Gegè: raccoglie 3 scarti · cala 4 · scarta K♦" */
  function recapHTML(g, fresh) {
    const bySeat = new Map();
    for (const e of fresh) {
      if (!bySeat.has(e.seat)) bySeat.set(e.seat, []);
      const parts = bySeat.get(e.seat);
      const k = (e.cardIds || []).length;
      const prevPart = parts[parts.length - 1];
      if (e.type === 'pile') parts.push(e.count === 1 ? 'raccoglie lo scarto' : `raccoglie <b>${e.count}</b> scarti`);
      else if (e.type === 'meld') {
        const ids = e.meldIds || [e.meldId];
        if (prevPart && prevPart.melds) prevPart.melds.push(...ids); else parts.push({ melds: ids.slice() });
      } else if (e.type === 'add') {
        if (prevPart && prevPart.k != null) prevPart.k += k; else parts.push({ k });
      } else if (e.type === 'pozzetto') parts.push(`prende il ${esc(g.cfg.pozzettoName)}`);
      else if (e.type === 'discard' && e.card) {
        const red = e.card.s === 'H' || e.card.s === 'D';
        parts.push(`scarta <span class="${red ? 'rs' : ''}">${e.card.r === 0 ? 'Jolly' : rankName(e.card.r) + SUIT[e.card.s]}</span>`);
      }
    }
    const allMelds = g.teams.flatMap((t) => t.melds);
    const say = (x) => {
      if (typeof x === 'string') return x;
      if (x.k != null) return `attacca <b>${x.k}</b> ${x.k === 1 ? 'carta' : 'carte'}`;
      if (x.melds.length > 1) return `cala <b>${x.melds.length}</b> giochi`;
      const m = allMelds.find((mm) => mm.id === x.melds[0]);
      return `cala ${m && m.type === 'set' ? 'un <b>tris</b>' : 'una <b>scala</b>'}`;
    };
    const lines = [...bySeat].filter(([, parts]) => parts.length)
      .map(([seat, parts]) => `<div><b>${esc(g.players[seat].name)}</b>: ${parts.map(say).join(' · ')}</div>`);
    return lines.length ? `<div class="recap" data-act="log" title="Cosa hanno fatto gli altri (tocca per la cronaca)">${lines.join('')}</div>` : '';
  }

  function lastMove(g) {
    for (let i = g.log.length - 1; i >= 0; i--) {
      if (!g.log[i].startsWith('—')) return g.log[i];
    }
    return 'La smazzata è iniziata: buon divertimento!';
  }

  /** posizione al tavolo degli altri giocatori rispetto a me */
  function seatPositions(g) {
    if (g.you < 0) return g.players.map((p) => [p.seat, 'top']);
    const me = g.you;
    const rel = (k) => (me + k) % g.n;
    if (g.n === 4) return [[rel(1), 'left'], [rel(2), 'top'], [rel(3), 'right']];
    if (g.n === 3) return [[rel(1), 'left'], [rel(2), 'right']];
    return [[rel(1), 'top']];
  }

  function seatHTML(g, seat, pos, myTeam) {
    const p = g.players[seat];
    const t = g.teams.find((x) => x.members.includes(seat));
    const partner = myTeam && myTeam.members.includes(seat);
    const turn = g.turn === seat && g.phase !== 'handEnd';
    const fan = Array.from({ length: Math.min(p.handCount, 7) }, (_, i) => backHTML('tiny', `style="--i:${i}"`)).join('');
    const rs = S.room && S.room.seats[seat];
    const off = rs && !rs.isBot && !rs.connected;
    return `<div class="seatchip pos-${pos} ${turn ? 'turn' : ''} ${partner ? 'partner' : ''} ${off ? 'offline' : ''}" data-seat="${seat}">
      ${avatarHTML(p.name, seat, p.isBot, rs && rs.avatar)}
      <div class="sinfo"><b>${esc(p.name)}</b>
        <span class="smeta">${off ? '📴 ' : ''}${partner ? '<span title="compagno">🤝</span> ' : ''}${p.handCount} carte${t && t.pozzettoTaken ? ` <span class="pz-ok" title="${g.cfg.pozzettoName} preso">✓ ${g.cfg.pozzettoName}</span>` : ''}</span></div>
      <div class="minifan">${fan}</div>
      ${turn ? (S.turnEnd ? '<span class="thinking cdchip" data-cd></span>' : '<span class="thinking"><i></i><i></i><i></i></span>') : ''}
    </div>`;
  }

  function gameHTML() {
    const g = S.game;
    const r = S.room;
    const me = g.you;
    const myTurn = g.turn === me && g.phase !== 'handEnd';
    const myTeam = g.teams.find((t) => t.members.includes(me));
    const P = g.cfg.pozzettoName;
    const canDraw = myTurn && g.phase === 'draw';
    const playing = myTurn && g.phase === 'play';
    // carte giocate dagli altri dopo la mia ultima mossa: restano evidenziate finché non gioco
    const fresh = freshEvents(g);
    S.freshCards = new Set(fresh.flatMap((e) => e.cardIds || []));

    // punteggi
    let scores;
    if (g.n === 3) scores = g.players.map((p) => `<span class="sc ${p.seat === me ? 'me' : ''}">${esc(p.seat === me ? 'Tu' : p.name)} <b>${g.scores[p.seat]}</b></span>`).join('');
    else scores = g.teams.map((t) => `<span class="sc ${t === myTeam ? 'me' : ''}">${esc(teamName(g, t))} <b>${g.scores[t.members[0]]}</b></span>`).join('');

    const seats = seatPositions(g).map(([s, pos]) => seatHTML(g, s, pos, myTeam)).join('');

    // centro: tallone, pozzetti, scarti
    const pileAll = g.cfg.pile === 'open' ? g.discard : g.discard.slice(-1);
    const pileCards = pileAll.map((c, i) => {
      const top = i === pileAll.length - 1;
      return cardHTML(c, `${top ? 'top' : ''} ${top && S.animEvent && S.animEvent.type === 'discard' ? 'landed' : ''}`, top && canDraw && !g.mustDraw ? 'data-drag="pile"' : '');
    }).join('');
    const stockLayers = Math.min(3, Math.ceil(g.stockCount / 15));
    const center = `<div class="center">
      <div class="stock ${canDraw && (g.stockCount || g.pozzetti.length) ? 'active' : ''} ${S.hint && S.hint.type === 'draw' ? 'hinted' : ''}" ${canDraw ? 'data-act="draw" data-drag="stock"' : ''}>
        <div class="deck">${g.stockCount ? Array.from({ length: stockLayers }, (_, i) => backHTML('', `style="--l:${i}"`)).join('') : '<div class="card slot"></div>'}</div>
        <span class="lbl ${stockWarning(g) ? 'lowstock' : ''}">Tallone · ${g.stockCount}</span>
      </div>
      ${g.pozzetti.length ? `<div class="pozz"><div class="pz">${g.pozzetti.map((n, i) => backHTML('', `style="--l:${i}"`)).join('')}</div><span class="lbl">${g.pozzetti.length === 1 ? cap(P) : (P === 'morto' ? 'Morti' : 'Pozzetti')}</span></div>` : ''}
      <div class="pile ${(canDraw && g.discardCount && !g.mustDraw) || (playing && S.selected.size === 1) ? 'active' : ''} ${g.cfg.pile} ${S.hint && (S.hint.type === 'takePile' || S.hint.type === 'discard') ? 'hinted' : ''}" data-drop="discard" ${canDraw && !g.mustDraw ? 'data-act="takePile"' : playing ? 'data-act="discardSel"' : ''}>
        <div class="pcards">${pileCards || '<div class="card slot"></div>'}</div>
        <span class="lbl">Scarti${g.discardCount ? ' · ' + g.discardCount : ''}${g.cfg.pile === 'closed' ? ' (chiusi)' : ''}</span>
      </div>
    </div>`;

    // giochi delle squadre
    const preview = selectionPreview(g, myTeam);
    const nm = preview.newMeld;
    const newSlotText = nm ? (nm.ok ? `✓ Cala<br>${nm.label}` : nm.label.includes('punti') ? `✗ Servono<br>${nm.label}` : '✗ Non<br>valida') : '＋ Nuova<br>combinazione';
    const zone = (t) => {
      const mine = t === myTeam;
      const label = mine ? (t.members.length > 1 ? `Noi · ${esc(teamName(g, t))}` : 'I tuoi giochi') : esc(teamName(g, t));
      const flags = [t.pozzettoTaken ? `${P} preso` : `${P} da prendere`];
      if (t.canClose) flags.push('può chiudere');
      const targetable = mine && (playing || (canDraw && g.cfg.pile === 'closed'));
      const newSlot = mine && (playing || (canDraw && g.cfg.pile === 'closed'))
        ? `<div class="meld newmeld ${nm ? (nm.ok ? 'ok' : 'bad') : ''} ${S.hint && S.hint.type === 'meld' ? 'hinted' : ''}" data-drop="newmeld" ${playing ? 'data-act="meld"' : ''}><span>${newSlotText}</span></div>` : '';
      return `<div class="teamzone ${mine ? 'mine' : 'theirs'}">
        <div class="hdr"><b>${label}</b><span>${flags.join(' · ')}</span></div>
        <div class="melds ${targetable ? 'targetable' : ''}">${t.melds.map((m) => meldHTML(m, mine, mine ? preview : null)).join('')}${newSlot}${!t.melds.length && !newSlot ? '<span class="empty">Nessuna combinazione</span>' : ''}</div>
      </div>`;
    };
    const others = g.teams.filter((t) => t !== myTeam).map(zone).join('');
    const mineZone = myTeam ? zone(myTeam) : '';

    // niente pulsanti grandi: si gioca toccando/trascinando sul tavolo; restano piccole icone
    const sel = S.selected.size;
    let actions = '';
    if (g.phase === 'handEnd') actions = '<button class="btn primary small" data-act="result">Risultati</button>';
    if (myTurn && r.hints) actions += '<button class="ico" data-act="hint" title="Suggerimento">💡</button>';
    if (g.you >= 0) actions = '<button class="ico" data-act="reactPicker" title="Reazioni">😊</button>' + actions;
    if (sel) actions += '<button class="ico" data-act="clearSel" title="Deseleziona">✕</button>';
    const sortLbl = { rank: '⇅ Valore', suit: '⇅ Seme', smart: '⇅ Giochi' }[S.sortMode] || '⇅ Ordina';
    if (g.you >= 0) actions += `<button class="ico wideico" data-act="sort" title="Riordina la mano">${sortLbl}</button>`;

    return `<div class="game ${myTurn ? 'myturn' : ''}">
      <div class="topbar">
        <span class="title">${(r.spectators || []).length ? `<span title="${esc(r.spectators.join(', '))}">👁 ${r.spectators.length}</span> · ` : ''}${r.offline ? '<span title="Partita senza internet">📴</span>' : `<b>${esc(r.code)}</b>`} · <span title="Smazzata ${g.handNo}, si vince a ${g.cfg.target}">smazzata ${g.handNo}</span></span>
        <button class="iconbtn" data-act="gameRules" title="Regole">📜</button>
        ${OFFLINE ? '' : `<button class="iconbtn ${r.music ? 'musicon' : ''}" data-act="music" title="Musica del tavolo">🎵${S.musicUnseen ? '<sup>•</sup>' : ''}</button>`}
        <button class="iconbtn" data-act="log" title="Chat">💬${S.unread ? `<sup>${S.unread}</sup>` : ''}</button>
        <button class="iconbtn" data-act="scores" title="Punteggi">🏆</button>
        <button class="iconbtn" data-act="settings" title="Aspetto e suoni">⚙️</button>
        <button class="iconbtn" data-act="leave" title="Esci">⏏</button>
      </div>
      <div class="scorebar">${r.series ? `<span class="sc series">${seriesHTML(r, g)}</span>` : ''}${scores}</div>
      <div class="seats-row n${g.n} ${g.you < 0 ? 'spect' : ''}">${seats}</div>
      ${(() => {
        const w = stockWarning(g);
        const recap = canDraw ? recapHTML(g, fresh) : '';
        return (w ? `<div class="ticker warn w${w.level}">${w.text}</div>` : recap ? '' : `<div class="ticker" data-act="log" title="Ultima mossa (tocca per la cronaca)">${esc(lastMove(g))}</div>`) + recap;
      })()}
      <div class="felt" id="felt">${others}${center}${mineZone}</div>
      ${r.tutorial && !S.coachOff ? `<div class="coach">🎓 ${coachTip(g)} <button class="ico" data-act="coachOff" title="Nascondi">✕</button></div>` : ''}
      <div class="statusbar ${myTurn ? 'on' : ''}">
        <span class="msg">${S.turnEnd && g.phase !== 'handEnd' && myTurn ? '<b class="cd" data-cd></b> ' : ''}${statusText(g)}</span>
        <div class="btns">${actions}</div>
      </div>
      ${S.reactOpen ? `<div class="reactbar">${['👏', '😂', '😱', '🔥', '👍', '😡', '🙏', '😍'].map((e) => `<button data-act="react" data-e="${e}">${e}</button>`).join('')}</div>` : ''}
      ${g.you < 0 ? `<div class="watching">👁 Stai guardando la partita · le carte in mano non sono visibili <button class="btn small" data-act="leave">Esci</button></div>`
        : `<div class="handwrap" data-drop="hand"><div class="hand" id="hand">${handHTML(g)}</div></div>`}
    </div>`;
  }

  function handHTML(g) {
    const cards = orderedHand();
    if (!cards.length) return '<span class="empty">Nessuna carta</span>';
    const toggled = S.toggledCard;
    return cards.map((c) => {
      const sel = S.selected.has(c.id) !== (c.id === toggled); // la carta appena toccata cambia stato dopo
      return cardHTML(c, `${sel ? 'sel' : ''} ${S.newIds.has(c.id) ? 'newc' : ''}`);
    }).join('');
  }

  /** dispone la mano a ventaglio su una o due file, in base alla larghezza */
  function layoutHand() {
    const hand = $('#hand');
    if (!hand) return;
    const cards = $$('.card', hand);
    if (!cards.length) return;
    hand.classList.add('placing');
    const W = hand.clientWidth - 8;
    const cw = cards[0].offsetWidth;
    const rows = cards.length * cw * 0.42 + cw > W && cards.length > 8 ? 2 : 1;
    const perRow = Math.ceil(cards.length / rows);
    const step = Math.min(cw * 0.78, (W - cw) / Math.max(1, perRow - 1));
    hand.style.setProperty('--step', `${step}px`);
    hand.classList.toggle('two-rows', rows === 2);
    cards.forEach((c, i) => {
      const row = rows === 2 && i >= perRow ? 1 : 0;
      const idx = row ? i - perRow : i;
      const n = row ? cards.length - perRow : perRow;
      const offset = (W - (cw + step * (n - 1))) / 2;
      const mid = (n - 1) / 2;
      const rot = n > 1 ? ((idx - mid) / mid) * Math.min(6, n * 0.6) : 0;
      const lift = n > 1 ? Math.abs((idx - mid) / mid) ** 2 * 6 : 0;
      c.style.left = `${offset + idx * step + 4}px`;
      c.style.top = `${row * (cw * 1.05) + lift}px`;
      c.style.setProperty('--rot', `${rot}deg`);
      c.style.zIndex = String(i + 1);
    });
    hand.style.height = `${(rows === 2 ? cw * 1.05 : 0) + cw * 1.45 + 14}px`;
  }

  /** Adatta il tavolo allo schermo: rimpicciolisce i giochi e, se serve, compatta le combinazioni lunghe */
  function fitTable() {
    const felt = $('#felt');
    if (!felt) return;
    felt.classList.remove('compact');
    felt.style.removeProperty('--mw');
    felt.style.removeProperty('--pw');
    const fits = () => felt.scrollHeight <= felt.clientHeight + 1;
    if (fits()) {
      // c'è spazio libero: carte delle combinazioni e del tallone più grandi (fino a un limite)
      const cs0 = getComputedStyle(felt);
      let mw0 = parseFloat(cs0.getPropertyValue('--mw')) || 30;
      let pw0 = parseFloat(cs0.getPropertyValue('--pw')) || 42;
      const maxMw = mw0 * 1.45;
      while (mw0 + 2 <= maxMw) {
        felt.style.setProperty('--mw', `${mw0 + 2}px`);
        felt.style.setProperty('--pw', `${Math.min(pw0 + 2, 72)}px`);
        if (!fits()) { felt.style.setProperty('--mw', `${mw0}px`); felt.style.setProperty('--pw', `${pw0}px`); break; }
        mw0 += 2; pw0 = Math.min(pw0 + 2, 72);
      }
      return;
    }
    const cs = getComputedStyle(felt);
    let mw = parseFloat(cs.getPropertyValue('--mw')) || 30;
    let pw = parseFloat(cs.getPropertyValue('--pw')) || 42;
    const shrink = (min) => {
      while (!fits() && mw > min) {
        mw -= 2;
        pw = Math.max(32, pw - 2);
        felt.style.setProperty('--mw', `${mw}px`);
        felt.style.setProperty('--pw', `${pw}px`);
      }
    };
    shrink(24);
    if (fits()) return;
    felt.classList.add('compact');
    shrink(17);
  }

  function afterGameRender() {
    layoutHand();
    const hand = $('#hand');
    if (hand) {
      void hand.offsetWidth; // applica le posizioni senza animazioni
      hand.classList.remove('placing');
      // solo la carta appena toccata si alza o si abbassa con l'animazione
      const id = S.toggledCard;
      S.toggledCard = null;
      if (id != null) {
        const el = $(`#hand .card[data-card="${id}"]`);
        if (el) { void el.offsetWidth; el.classList.toggle('sel', S.selected.has(id)); }
      }
    }
    // l'animazione d'arrivo delle carte nuove si vede una volta sola
    S.newIds = new Set();
    fitTable();
    const felt = $('#felt');
    if (felt && S.feltScroll != null) felt.scrollTop = S.feltScroll;
    const pc = $('.pile .pcards');
    if (pc) pc.scrollLeft = pc.scrollWidth;
    if (S.animEvent) { animateEvent(S.animEvent); S.animEvent = null; }
    if (S.burracoFx) { burracoFx(S.burracoFx); S.burracoFx = null; }
  }

  /* ================= Animazioni ================= */
  function rectOf(el) { return el && el.getBoundingClientRect(); }

  function fly(fromEl, toEl, html, { delay = 0, dur = 420 } = {}) {
    const a = rectOf(fromEl), b = rectOf(toEl);
    if (!a || !b || !a.width || !b.width) return;
    const el = document.createElement('div');
    el.className = 'flyer';
    el.innerHTML = html;
    document.body.appendChild(el);
    const card = el.firstElementChild;
    const w = card.offsetWidth || 50;
    const sx = a.left + a.width / 2 - w / 2, sy = a.top + a.height / 2 - w * 0.7;
    const ex = b.left + b.width / 2 - w / 2, ey = b.top + b.height / 2 - w * 0.7;
    el.style.transform = `translate(${sx}px, ${sy}px) scale(.8)`;
    el.style.opacity = '0';
    setTimeout(() => {
      el.style.transition = `transform ${dur}ms cubic-bezier(.2,.8,.2,1), opacity 150ms`;
      el.style.opacity = '1';
      el.style.transform = `translate(${ex}px, ${ey}px) scale(1) rotate(${(Math.random() - 0.5) * 16}deg)`;
    }, 20 + delay);
    setTimeout(() => el.remove(), dur + delay + 120);
  }

  function animateEvent(ev) {
    const g = S.game;
    if (!g) return;
    const mine = ev.seat === g.you;
    const seatEl = mine ? $('#hand') : $(`.seatchip[data-seat="${ev.seat}"]`);
    const stock = $('.stock .deck');
    const pile = $('.pile .pcards');
    if (ev.type === 'draw' && !mine) fly(stock, seatEl, backHTML());
    else if (ev.type === 'draw' && mine) fly(stock, $(`#hand .card.newc`) || seatEl, backHTML());
    else if (ev.type === 'discard' && !mine) {
      const top = $('.pile .card.top');
      const c = g.discard[g.discard.length - 1];
      if (top) top.style.visibility = 'hidden';
      fly(seatEl, top || pile, c ? cardHTML(c) : backHTML(), { dur: 380 });
      setTimeout(() => { if (top) top.style.visibility = ''; }, 420);
    } else if (ev.type === 'pile') {
      for (let i = 0; i < Math.min(ev.count || 1, 5); i++) fly(pile, seatEl, backHTML(), { delay: i * 60 });
    } else if (ev.type === 'pozzetto') {
      for (let i = 0; i < 4; i++) fly($('.pozz .pz') || stock, seatEl, backHTML(), { delay: i * 70 });
    }
  }

  /* ---------- Statistiche personali (salvate sul dispositivo) ---------- */
  const STATS0 = { games: 0, wins: 0, hands: 0, handsWon: 0, burraco: 0, closures: 0, bestHand: null, points: 0 };
  function loadStats() { return { ...STATS0, ...store.get('bur_stats', {}) }; }

  /** Conta ogni fine smazzata / fine partita una sola volta, anche ricaricando la pagina */
  function recordStats(room, game) {
    const hr = game.handResult;
    if (!hr || game.you < 0) return;
    const seen = store.get('bur_stats_seen', []);
    const key = `${room.code}:${game.history.length}:${hr.scores.join(',')}`;
    if (seen.includes(key)) return;
    const st = loadStats();
    const mine = hr.teams.find((t) => t.members.includes(game.you));
    if (mine) {
      st.hands++;
      if (mine.total === Math.max(...hr.teams.map((t) => t.total))) st.handsWon++;
      st.burraco += mine.burraco.length;
      st.points += mine.total;
      st.bestHand = st.bestHand == null ? mine.total : Math.max(st.bestHand, mine.total);
    }
    if (hr.reason === 'close' && hr.closer === game.you) st.closures++;
    if (game.over) { st.games++; if (game.winners.includes(game.you)) st.wins++; }
    store.set('bur_stats', st);
    store.set('bur_stats_seen', seen.concat(key).slice(-100));
  }

  const PRESET_NAMES = { classico: 'Classico', reale: 'Reale', aberto: 'Aberto', fechado: 'Fechado', personalizzate: 'Personalizzate' };
  const fmtDate = (t) => new Date(t).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });

  function statsTable(st) {
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
    const row = (l, v) => `<tr><td>${l}</td><td><b>${v}</b></td></tr>`;
    return `<table>
      ${row('Partite giocate', st.games)}${row('Partite vinte', `${st.wins} (${pct(st.wins, st.games)})`)}
      ${row('Smazzate giocate', st.hands)}${row('Smazzate vinte', `${st.handsWon} (${pct(st.handsWon, st.hands)})`)}
      ${row('Burraco fatti', st.burraco)}${row('Chiusure', st.closures)}
      ${row('Miglior smazzata', st.bestHand == null ? '—' : st.bestHand)}${row('Media punti a smazzata', st.avgHand == null ? '—' : st.avgHand)}
    </table>`;
  }

  function historyHTML(list) {
    if (!list.length) return '<p class="muted">Nessuna partita completata.</p>';
    return list.map((h) => `<div class="hist ${h.won ? 'won' : 'lost'}">
      <span class="hres">${h.won ? '🏆' : '—'}</span>
      <span class="grow"><b>${h.won ? 'Vinta' : 'Persa'}</b> · ${fmtDate(h.at)} · ${PRESET_NAMES[h.preset] || h.preset}${h.hands ? ` · ${h.hands} smazzate` : ''}<br>
      <span class="muted small">${h.teams.map((t) => `${t.mine ? '<b>' : ''}${t.names.map(esc).join(' & ')} ${t.score}${t.mine ? '</b>' : ''}`).join(' · ')}</span></span></div>`).join('');
  }

  async function statsModal() {
    if (OFFLINE || !S.social || !S.social.nick) { localStatsModal(); return; }
    const r = await emit('myStats');
    if (!r.ok) return;
    openModal('stats', `<div class="result"><h2>📊 Le tue statistiche</h2>
      ${r.stats ? statsTable(r.stats) : '<p class="muted">Gioca la tua prima smazzata per vedere le statistiche.</p>'}
      <h3>Ultime partite</h3>${historyHTML(r.history)}
      <p class="muted small">Le statistiche sono salvate sul server: ti seguono anche se cambi dispositivo.</p></div>`);
  }

  function localStatsModal() {
    const st = loadStats();
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
    const row = (l, v) => `<tr><td>${l}</td><td><b>${v}</b></td></tr>`;
    openModal('stats', `<div class="result"><h2>📊 Le tue statistiche</h2>
      ${st.hands ? `<table>
        ${row('Partite giocate', st.games)}${row('Partite vinte', `${st.wins} (${pct(st.wins, st.games)})`)}
        ${row('Smazzate giocate', st.hands)}${row('Smazzate vinte', `${st.handsWon} (${pct(st.handsWon, st.hands)})`)}
        ${row('Burraco fatti', st.burraco)}${row('Chiusure', st.closures)}
        ${row('Miglior smazzata', st.bestHand)}${row('Media punti a smazzata', Math.round(st.points / st.hands))}
      </table>` : '<p class="muted">Gioca la tua prima smazzata per vedere le statistiche.</p>'}
      <p class="muted small">Le statistiche sono salvate solo su questo dispositivo.</p>
      ${st.hands ? '<button class="btn small danger" data-act="resetStats">Azzera statistiche</button>' : ''}</div>`);
  }

  /* ---------- Effetti: burraco e coriandoli ---------- */
  const reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function burracoFx(fx) {
    const el = $(`.meld[data-mid="${fx.meldId}"]`);
    if (el) { el.classList.add('shine'); setTimeout(() => el.classList.remove('shine'), 2600); }
    const b = document.createElement('div');
    b.className = 'bigtoast' + (fx.mine ? ' mine' : '');
    b.innerHTML = `<b>${esc(fx.label.toUpperCase())}!</b><span>+${fx.bonus}</span>`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2300);
    if (fx.mine) confetti(60, 1600);
  }

  function confetti(count = 160, duration = 3200) {
    if (reducedMotion) return;
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
    const colors = ['#f2c14e', '#e53935', '#43a047', '#1e88e5', '#ffffff', '#8e63d6'];
    const ps = Array.from({ length: count }, () => ({
      x: W / 2 + (Math.random() - 0.5) * W * 0.3, y: H * 0.35,
      vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 11 - 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const t0 = performance.now();
    (function frame(t) {
      const k = (t - t0) / duration;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - 0.7) / 0.3);
      for (const p of ps) {
        p.vy += 0.25; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); ctx.restore();
      }
      if (k < 1) requestAnimationFrame(frame); else cv.remove();
    })(t0);
  }

  /* ================= Modali di gioco ================= */
  function showResult() {
    const g = S.game;
    if (!g || !g.handResult) return;
    const hr = g.handResult;
    const P = g.cfg.pozzettoName;
    const cols = hr.teams.map((t) => `<th>${esc(t.members.map((s) => (s === g.you ? 'Tu' : g.players[s].name)).join(' & '))}</th>`).join('');
    const row = (label, fn) => `<tr><td>${label}</td>${hr.teams.map((t) => `<td>${fn(t)}</td>`).join('')}</tr>`;
    const reason = hr.reason === 'close' ? `<b>${esc(g.players[hr.closer].name)}</b> ha chiuso la smazzata.` : 'Il tallone è finito.';
    const humans = S.room.seats.map((s, i) => (s && !s.isBot ? i : -1)).filter((i) => i >= 0);
    const waiting = humans.filter((i) => !S.room.ready.includes(i)).map((i) => S.room.seats[i].name);
    const imReady = S.room.ready.includes(g.you);
    let footer;
    if (g.you < 0) {
      footer = g.over ? `<div class="winner">🏆 Vince ${esc(g.winners.map((s) => g.players[s].name).join(' & '))}!</div>` : '<p class="muted">Stai guardando: la prossima smazzata parte quando i giocatori sono pronti.</p>';
    } else if (g.over && S.room.series) {
      const sr = S.room.series;
      const champ = sr.champion ? sr.champion.map((x) => (x === g.you ? 'Tu' : g.players[x].name)) : null;
      footer = `<div class="winner">${champ ? `🏆 Campione del torneo: ${esc([...new Set(champ)].join(' & '))}!` : `Partita ${sr.games} di ${sr.bestOf} vinta da ${esc(g.winners.map((x) => (x === g.you ? 'Tu' : g.players[x].name)).join(' & '))}`}</div>
        <p style="text-align:center">${seriesHTML(S.room, g)}</p>
        <button class="btn primary big" data-act="ready" style="width:100%" ${imReady ? 'disabled' : ''}>${imReady ? 'Hai votato ✓' : champ ? '🔁 Nuovo torneo' : '▶ Prossima partita del torneo'}</button>
        ${imReady && waiting.length ? `<p class="muted">In attesa di: ${esc(waiting.join(', '))}</p>` : ''}`;
    } else if (g.over) {
      footer = `<div class="winner">🏆 Vince ${esc(g.winners.map((s) => (s === g.you ? 'Tu' : g.players[s].name)).join(' & '))}!</div>
        <button class="btn primary big" data-act="ready" style="width:100%" ${imReady ? 'disabled' : ''}>${imReady ? 'Rivincita: hai votato ✓' : '🔁 Rivincita'}</button>
        ${imReady && waiting.length ? `<p class="muted">In attesa di: ${esc(waiting.join(', '))}</p>` : '<p class="muted">Stessi posti, stesse regole: si riparte quando tutti premono Rivincita.</p>'}`;
    } else {
      footer = `<button class="btn primary big" data-act="ready" style="width:100%" ${imReady ? 'disabled' : ''}>${imReady ? 'Pronto ✓' : 'Prossima smazzata'}</button>
        ${waiting.length && imReady ? `<p class="muted">In attesa di: ${esc(waiting.join(', '))}</p>` : ''}`;
    }
    // riepilogo in alto: punti della smazzata in grande e barra verso la vittoria
    const best = Math.max(...hr.teams.map((t) => t.total));
    const pct = (v) => Math.max(0, Math.min(100, (v / g.cfg.target) * 100));
    const summary = hr.teams.map((t) => {
      const tot = hr.scores[t.members[0]];
      const names = t.members.map((x) => (x === g.you ? 'Tu' : g.players[x].name)).join(' & ');
      return `<div class="rteam ${t.total === best ? 'win' : ''} ${t.members.includes(g.you) ? 'mine' : ''}">
        <div class="rname">${t.total === best ? '★ ' : ''}${esc(names)}</div>
        <div class="rpts ${t.total < 0 ? 'neg' : ''}" data-count="${t.total}" data-sign="1">${signed(t.total)}</div>
        <div class="rbar"><i style="--from:${pct(tot - t.total)}%;--to:${pct(tot)}%"></i></div>
        <div class="rtot"><b data-count="${tot}">${tot}</b> / ${g.cfg.target}</div></div>`;
    }).join('');
    // righe del dettaglio: quelle tutte a zero non servono
    const detail = (label, key, extra) => (hr.teams.some((t) => t[key]) || key === 'meldPts'
      ? `<tr><td>${label}</td>${hr.teams.map((t) => `<td class="${t[key] < 0 ? 'neg' : t[key] > 0 ? 'pos' : ''}">${signed(t[key])}${extra ? extra(t) : ''}</td>`).join('')}</tr>` : '');
    const kindCls = (b) => ({ clean: 'clean', semi: 'semi', dirty: 'dirty' }[b.kind] || 'real');
    // l'animazione si vede solo la prima volta (la finestra si ridisegna a ogni voto "pronto")
    const key = `${g.handNo}:${hr.teams.map((t) => t.total).join(',')}`;
    const firstShow = S.resultShown !== key;
    S.resultShown = key;
    openModal('result', `<div class="result ${firstShow ? 'anim' : ''}">
      <h2>Fine smazzata ${g.handNo}</h2><p>${reason}</p>
      <div class="rsum">${summary}</div>
      <table><tr><th></th>${cols}</tr>
      ${detail('Carte calate', 'meldPts')}
      ${detail(`Bonus ${g.cfg.burracoName}`, 'bonusPts', (t) => (t.burraco.length ? `<div class="bchips">${t.burraco.map((b) => `<span class="bchip ${kindCls(b)}">${esc(cap(b.label.replace(/^(burraco|canastra) /i, '')))} +${b.bonus}</span>`).join('')}</div>` : ''))}
      ${detail('Chiusura', 'closePts')}
      ${detail(cap(P), 'pozPts')}
      ${detail('Carte in mano', 'handPts')}
      <tr class="tot"><td>Smazzata</td>${hr.teams.map((t) => `<td>${signed(t.total)}</td>`).join('')}</tr>
      </table>
      ${leftoverHTML(g, hr)}
      ${footer}</div>`);
    if (firstShow) countUp($$('#modal [data-count]'));
  }

  const signed = (v) => (v > 0 ? `+${v}` : String(v));

  /** I numeri salgono da 0 al valore finale (una volta sola per smazzata) */
  function countUp(els) {
    if (reducedMotion) return;
    const t0 = performance.now(), dur = 900;
    const targets = els.map((el) => ({ el, v: Number(el.dataset.count), sign: !!el.dataset.sign }));
    for (const x of targets) x.el.textContent = '0';
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      for (const x of targets) { const v = Math.round(x.v * e); x.el.textContent = x.sign ? signed(v) : String(v); }
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function leftoverHTML(g, hr) {
    if (!hr.hands) return '';
    const rows = hr.hands.map((h, seat) => (h.length ? `<div class="leftover"><b>${esc(seat === g.you ? 'Tu' : g.players[seat].name)}</b><div class="lcards">${h.map((c) => cardHTML(c, 'mini')).join('')}</div></div>` : '')).join('');
    return rows ? `<h3>Carte rimaste in mano</h3>${rows}` : '';
  }

  function showScores() {
    const g = S.game;
    const rows = g.history.map((h) => `<tr><td>${h.handNo}</td>${h.teams.map((t) => `<td>${esc(t.members.map((s) => g.players[s].name).join(' & '))}: ${t.total}</td>`).join('')}</tr>`).join('');
    openModal('scores', `<div class="result"><h2>Punteggi</h2>
      <table>${g.players.map((p) => `<tr><td>${esc(p.name)}</td><td><b>${g.scores[p.seat]}</b></td></tr>`).join('')}</table>
      <h3>Smazzate</h3>${rows ? `<table>${rows}</table>` : '<p class="muted">Nessuna smazzata conclusa.</p>'}</div>`);
  }

  function renderLogModal() {
    const g = S.game;
    const chat = S.chat.map((m) => `<div class="chat"><b>${esc(m.name)}:</b> ${esc(m.text)}</div>`).join('');
    openModal('log', `<h2>Chat</h2>
      <div class="log" id="chatlog">${chat || '<div class="muted">Nessun messaggio</div>'}</div>
      <form id="chatform" class="row" style="margin:8px 0"><input id="chatin" class="grow" maxlength="140" placeholder="Scrivi un messaggio" autocomplete="off"><button class="btn primary">Invia</button></form>
      <div class="row quick">${['Bella!', 'Tocca a te 😉', 'Che fortuna!', 'Ops…', 'Ben giocato 👏'].map((t) => `<button class="btn small" data-act="quickChat" data-text="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <h2>Cronaca</h2><div class="log">${g ? g.log.slice().reverse().map((l) => `<div>${esc(l)}</div>`).join('') : ''}</div>`);
    const cl = $('#chatlog');
    cl.scrollTop = cl.scrollHeight;
    S.unread = 0;
  }

  function editRulesModal() {
    const r = S.editRules;
    openModal('editRules', `<h2>Modifica regole</h2>
      ${presetsHTML(r)}
      <p>${rulesStatus(r)}</p>
      ${rulesFormHTML(r)}
      <div class="row" style="margin-top:12px"><button class="btn ghost dark" data-act="previewEdit">📜 Anteprima regole</button>
      <button class="btn primary grow" data-act="applyRules">Applica</button></div>`);
  }

  /* ================= Azioni ================= */
  function requireName() {
    if (OFFLINE || (S.social && S.social.nick)) return true;
    toast('Scegli prima il tuo nickname', true);
    const el = $('#nick');
    if (el) el.focus();
    return false;
  }

  async function joinRoom(code) {
    const r = await emit('joinRoom', { code });
    if (!r.ok) { S.screen = 'home'; render(); }
  }

  async function act(type, extra = {}) {
    const r = await emit('action', { type, ...extra });
    if (r.ok && ['meld', 'add', 'discard', 'takePile', 'undo'].includes(type)) { S.selected.clear(); render(); }
    return r;
  }

  // dietro il tunnel l'indirizzo cambia: gli inviti passano dalla pagina d'ingresso fissa
  const HOME_URL = 'https://simonemuliello010500-web.github.io/BurracoByMSF/';
  function inviteLink() {
    const base = /\.trycloudflare\.com$/.test(location.hostname) ? HOME_URL : `${location.origin}/`;
    return `${base}?t=${S.room.code}`;
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(inviteLink()); toast('Link copiato'); }
    catch (e) { prompt('Copia il link:', inviteLink()); }
  }

  function setRule(target, key, value) {
    const obj = target === 'edit' ? S.editRules : S.rules;
    obj[key] = value;
    const n = R.normalize(obj);
    if (target === 'edit') { S.editRules = n; editRulesModal(); }
    else { S.rules = n; store.set('bur_rules', n); render(); }
  }

  function selectedIds() {
    return S.handOrder.filter((id) => S.selected.has(id));
  }

  const handlers = {
    goOnline() {
      try { sessionStorage.removeItem('bur_offline'); } catch (e) { /* niente */ }
      // dalla pagina fissa si torna alla pagina d'ingresso, che cerca il server
      location.href = /\/gioca\//.test(location.pathname) ? '../' : location.pathname;
    },
    goSetup() { if (!requireName()) return; S.screen = 'setup'; render(); },
    goHome() { S.screen = 'home'; render(); },
    join() {
      if (!requireName()) return;
      const code = ($('#joinCode').value || '').trim().toUpperCase();
      if (code.length !== 4) return toast('Il codice ha 4 caratteri', true);
      joinRoom(code);
    },
    presetRules(el) { const p = presetById(el.dataset.id); rulesModal(p.rules, p.name); },
    howto() { openModal('rules', `<div class="rules-text">${HOW_TO}${R.OTHER_VARIANTS}</div>`); },
    settings: settingsModal,
    pref(el) {
      const key = el.dataset.key;
      let val = el.dataset.val;
      if (val === 'true') val = true; else if (val === 'false') val = false;
      S.prefs[key] = val;
      applyPrefs();
      settingsModal();
      if (S.screen === 'game') render();
      if (key === 'sound' && val) { Sound.unlock(); Sound.play('turn'); }
      if (key === 'notify' && val && canNotify && Notification.permission !== 'granted') {
        Notification.requestPermission().then((p) => {
          if (p !== 'granted') { S.prefs.notify = false; applyPrefs(); toast('Notifiche non consentite dal browser', true); }
          settingsModal();
        });
      }
    },
    preset(el) {
      const p = presetById(el.dataset.id);
      if (S.modalKind === 'editRules') { S.editRules = R.normalize({ ...p.rules, players: S.editRules.players }); editRulesModal(); return; }
      S.rules = R.normalize({ ...p.rules, players: S.rules.players });
      store.set('bur_rules', S.rules);
      render();
    },
    previewRules() { rulesModal(S.rules); },
    previewEdit() { rulesModal(S.editRules, null, true); },
    backEdit() { editRulesModal(); },
    create() { emit('createRoom', { rules: S.rules }); },
    createBots() { emit('createRoom', { rules: S.rules, vsBots: true }); },
    leave() {
      if (S.game && !S.game.over && S.game.you >= 0) {
        if (!confirm('Vuoi davvero uscire? Il computer giocherà al tuo posto: potrai tornare quando vuoi dalla schermata iniziale.')) return;
        store.set('bur_lastroom', S.room.code);
      }
      emit('leaveRoom');
      S.screen = 'home';
    },
    share() {
      if (navigator.share) navigator.share({ title: 'Burraco', text: `Gioca a Burraco con me! Codice tavolo ${S.room.code}`, url: inviteLink() }).catch(() => {});
      else copyLink();
    },
    copy: copyLink,
    sit(el) { emit('sit', { seat: Number(el.dataset.seat) }); },
    addBot(el) { emit('addBot', { seat: Number(el.dataset.seat) }); },
    fillBots() { emit('addBot', {}); },
    removeSeat(el) { emit('removeSeat', { seat: Number(el.dataset.seat) }); },
    start() { emit('start'); },
    roomRules() { rulesModal(S.room.rules); },
    editRules() { S.editRules = R.normalize(S.room.rules); editRulesModal(); },
    async applyRules() { const r = await emit('configure', { rules: S.editRules }); if (r.ok) { closeModal(); toast('Regole aggiornate'); } },
    gameRules() { rulesModal(S.game.cfg.rules); },
    log() { renderLogModal(); render(); },
    quickChat(el) { emit('chat', { text: el.dataset.text }); },
    scores: showScores,
    result: showResult,
    ready() { emit('ready'); },
    draw() { act('draw'); },
    takePile() {
      const g = S.game;
      if (g.cfg.pile === 'closed') {
        if (!S.selected.size) return toast('Seleziona le carte della mano da combinare con la carta in cima (oppure tocca una tua combinazione)', true);
        act('takePile', { cardIds: selectedIds() });
      } else act('takePile');
    },
    meld() {
      if (S.selected.size < 3) return toast('Seleziona almeno 3 carte da calare');
      act('meld', { cardIds: selectedIds() });
    },
    discard() { if (S.selected.size === 1) act('discard', { cardId: [...S.selected][0] }); },
    discardSel() {
      if (S.selected.size !== 1) return toast(S.selected.size ? 'Per scartare seleziona una sola carta' : 'Seleziona la carta da scartare, poi tocca gli scarti');
      act('discard', { cardId: [...S.selected][0] });
    },
    undo() { act('undo'); },
    sort() {
      S.sortMode = { suit: 'rank', rank: 'smart' }[S.sortMode] || 'suit';
      store.set('bur_sort', S.sortMode);
      S.handOrder = sortCards(S.game.hand, S.sortMode).map((c) => c.id);
      render();
    },
    clearSel() { S.selected.clear(); S.hint = null; render(); },
    async hint() {
      const r = await emit('hint');
      if (!r.ok || !r.hint) return;
      const h = r.hint;
      const g = S.game;
      const byId = new Map(g.hand.map((c) => [c.id, c]));
      const names = (ids) => (ids || []).map((id) => byId.get(id)).filter(Boolean).map(cardLabel).join(' ');
      S.hint = { type: h.type, meldId: h.meldId };
      let text;
      switch (h.type) {
        case 'draw': text = 'Pesca dal tallone'; break;
        case 'takePile':
          text = h.cardIds && h.cardIds.length ? `Raccogli gli scarti e combina la carta in cima con ${names(h.cardIds)}` : 'Raccogli gli scarti: ti servono';
          if (h.cardIds) S.selected = new Set(h.cardIds);
          break;
        case 'meld': S.selected = new Set(h.cardIds); text = `Cala ${names(h.cardIds)}`; break;
        case 'add': S.selected = new Set(h.cardIds); text = `Attacca ${names(h.cardIds)} al gioco evidenziato`; break;
        case 'discard': S.selected = new Set([h.cardId]); text = `Scarta ${names([h.cardId])}`; break;
        default: text = 'Annulla le calate di questo turno e scarta';
      }
      toast(`💡 ${text}`);
      render();
    },
    music() { musicModal(); render(); },
    stats: statsModal,
    async claimNick() {
      const nick = ($('#nick') || {}).value || '';
      const r = await emit('setNick', { nick: nick.trim() });
      if (r.ok) { S.nickDraft = null; S.nickCheck = null; toast(`Benvenuto, ${r.nick}!`); render(); }
    },
    profile: profileModal,
    tutorial() { tutorialModal(0); },
    report() {
      openModal('report', `<h2>🐞 Segnala un problema</h2>
        <p class="muted small">Descrivi cosa è successo e cosa ti aspettavi. Insieme al messaggio inviamo la situazione del tavolo
          (smazzata, turno, ultime mosse e quante carte hai), senza le carte degli altri giocatori. <a href="privacy.html">Privacy</a></p>
        <form id="reportform"><textarea id="reportin" rows="5" maxlength="1000" placeholder="Es. ho trascinato una carta sugli scarti ma non è stata scartata…"></textarea>
        <div class="row" style="margin-top:8px"><button class="btn primary grow">Invia segnalazione</button></div></form>`);
      setTimeout(() => { const t = $('#reportin'); if (t) t.focus(); }, 50);
    },
    async rejoin() {
      const code = store.get('bur_lastroom', '');
      store.set('bur_lastroom', '');
      const r = await emit('joinRoom', { code });
      if (!r.ok) render();
    },
    tutStep(el) { tutorialModal(Number(el.dataset.i)); },
    practice() { if (!requireName()) return; closeModal(); emit('createRoom', { tutorial: true }); },
    coachOff() { S.coachOff = true; render(); },
    quickMenu() {
      if (!requireName()) return;
      openModal('quick', `<div class="result" style="text-align:center"><h2>⚡ Gioca subito</h2>
        <p>Entri in un tavolo con chi sta cercando una partita adesso. Si parte appena il tavolo è pieno (oppure puoi riempirlo con il computer).</p>
        <div class="row" style="justify-content:center"><button class="btn primary big" data-act="quick" data-n="2">In 2</button><button class="btn primary big" data-act="quick" data-n="4">In 4 (a coppie)</button></div></div>`);
    },
    async quick(el) { const r = await emit('quickPlay', { n: Number(el.dataset.n) }); if (r.ok) closeModal(); },
    series(el) { emit('setSeries', { bestOf: Number(el.dataset.val) }).then(() => { if (S.modalKind === 'settings') settingsModal(); }); },
    async playerCard(el) {
      const r = await emit('playerCard', { nick: el.dataset.nick });
      if (!r.ok) return;
      const t = r.together;
      openModal('card', `<div class="result">
        <button class="btn small" data-act="friends">← Amici</button>
        <div class="cardhead">${avatarHTML(r.nick, 0, false, r.avatar || { e: r.nick.charAt(0).toUpperCase(), c: '#9e9e9e' })}<h2>${esc(r.nick)}</h2></div>
        <h3>Insieme</h3>
        ${t.games ? `<p>${t.games} partite insieme: ${t.asPartners} in coppia (${t.winsTogether} vinte), ${t.games - t.asPartners} da avversari (tu ne hai vinte ${t.winsAgainst}).</p>${historyHTML(t.recent.map((h) => ({ ...h, preset: '', hands: 0 })))}` : '<p class="muted">Non avete ancora finito una partita insieme.</p>'}
        <h3>Statistiche</h3>${r.stats ? statsTable(r.stats) : '<p class="muted">Nessuna partita completata.</p>'}
        ${r.nick !== (S.social && S.social.nick) ? `<button class="btn small danger" style="margin-top:12px" data-act="block" data-nick="${esc(r.nick)}">🚫 Rimuovi e blocca</button>` : ''}</div>`);
    },
    async pickAvatar(el) { const r = await emit('setAvatar', { e: el.dataset.e, c: el.dataset.c }); if (r.ok) profileModal(); },
    reactPicker() {
      S.reactOpen = !S.reactOpen;
      render();
    },
    async react(el) {
      S.reactOpen = false;
      render();
      await emit('react', { emoji: el.dataset.e });
    },
    async deleteProfile() {
      if (!confirm('Eliminare definitivamente il profilo? Nickname, amici e classifica andranno persi.')) return;
      const r = await emit('deleteProfile');
      if (r.ok) { closeModal(); S.social = null; toast('Profilo eliminato'); render(); }
    },
    friends: friendsModal,
    recover(el, e) { if (e) e.preventDefault(); recoverModal(); },
    closeModal,
    toggleCode(el) { const c = $('#pcode'); c.classList.toggle('masked'); el.textContent = c.classList.contains('masked') ? 'Mostra' : 'Nascondi'; },
    async copyCode(el) { try { await navigator.clipboard.writeText(el.dataset.code); toast('Codice copiato'); } catch (e) { prompt('Copia il codice:', el.dataset.code); } },
    async regenCode() { if (!confirm('Generare un nuovo codice? Il vecchio codice e il vecchio QR smetteranno di funzionare.')) return; const r = await emit('regenCode'); if (r.ok) profileModal(); },
    async importCode(el) { const r = await emit('importProfile', { code: el.dataset.code }); if (r.ok) adoptProfile(r.token, r.nick); },
    acceptInvite(el) { closeModal(); if (!requireName()) return; joinRoom(el.dataset.code); },
    async invite(el) { const r = await emit('inviteFriend', { nick: el.dataset.nick }); if (r.ok) toast(`Invito inviato a ${el.dataset.nick}`); },
    async block(el) {
      if (!confirm(`Bloccare ${el.dataset.nick}? Non potrà più mandarti richieste né inviti.`)) return;
      const r = await emit('blockPlayer', { nick: el.dataset.nick });
      if (r.ok) { toast(`${el.dataset.nick} bloccato`); friendsModal(); }
    },
    unblock(el) { emit('unblockPlayer', { nick: el.dataset.nick }); },
    watch(el) { closeModal(); joinRoom(el.dataset.code); },
    friendYes(el) { emit('friendRespond', { nick: el.dataset.nick, accept: true }); },
    friendNo(el) { emit('friendRespond', { nick: el.dataset.nick, accept: false }); },
    unfriend(el) { if (confirm(`Rimuovere ${el.dataset.nick}?`)) emit('friendRemove', { nick: el.dataset.nick }); },
    toggleTheme() { S.prefs.theme = S.prefs.theme === 'scuro' ? 'chiaro' : 'scuro'; applyPrefs(); render(); },
    async leaders(el) {
      const friends = !!(el && el.dataset && el.dataset.friends);
      const r = await emit('leaderboard', { friends });
      if (!r.ok) return;
      const tabs = `<div class="row tabs"><button class="swatch ${friends ? '' : 'on'}" data-act="leaders">Tutti</button><button class="swatch ${friends ? 'on' : ''}" data-act="leaders" data-friends="1">Solo amici</button></div>`;
      const rows = r.list.map((e, i) => `<tr class="${e.me ? 'meRow' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td style="text-align:left">${esc(e.name)}${e.me ? ' (tu)' : ''}</td><td>${e.wins}/${e.games}</td><td>${Math.round((e.wins / e.games) * 100)}%</td><td>${e.burraco}</td></tr>`).join('');
      openModal('leaders', `<div class="result"><h2>🏆 Classifica</h2>${tabs}
        ${rows ? `<table><tr><th></th><th style="text-align:left">Giocatore</th><th>Vinte</th><th>%</th><th>Burraco</th></tr>${rows}</table>` : '<p class="muted">Ancora nessuna partita completata. La classifica conta le partite finite tra giocatori umani (anche contro il computer).</p>'}
        <p class="muted small">Classifica di tutti i giocatori di questo server.</p></div>`);
    },
    resetStats() { if (confirm('Azzerare le statistiche?')) { store.set('bur_stats', {}); statsModal(); } },
    musicStop() { emit('setMusic', { url: '' }).then(() => musicModal()); },
    botLevel(el) { emit('setBotLevel', { level: el.dataset.val }).then(() => { if (S.modalKind === 'settings') settingsModal(); }); },
    turnTime(el) { emit('setTurnTime', { seconds: Number(el.dataset.val) }).then(() => { if (S.modalKind === 'settings') settingsModal(); }); },
    setAids(el) { emit('setAids', { on: el.dataset.val === '1' }).then(() => { if (S.modalKind === 'settings') settingsModal(); }); },
    setHints(el) { emit('setHints', { on: el.dataset.val === '1' }).then(() => { if (S.modalKind === 'settings') settingsModal(); }); },
    botSpeed(el) { emit('setBotSpeed', { speed: el.dataset.val }).then(() => { if (S.modalKind === 'settings') settingsModal(); }); },
  };

  function cardLabel(c) {
    return c.r === 0 ? 'Jolly' : rankName(c.r) + SUIT[c.s];
  }

  /* ================= Trascinamento (mouse e touch) ================= */
  function dropTargetAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el && el.closest('[data-drop]');
  }

  function dropAllowed(d, target) {
    if (!target) return false;
    const g = S.game;
    const kind = target.dataset.drop;
    const myTurn = g.turn === g.you;
    if (d.src === 'hand') {
      if (kind === 'hand') return true;
      if (!myTurn || g.phase !== 'play') return false;
      if (kind === 'discard') return d.ids.length === 1;
      return kind === 'meld' || kind === 'newmeld';
    }
    // tallone o scarti verso la mano / i giochi
    if (!myTurn || g.phase !== 'draw') return false;
    if (kind === 'hand') return true;
    return d.src === 'pile' && g.cfg.pile === 'closed' && (kind === 'meld' || kind === 'newmeld');
  }

  function startDrag(d) {
    const g = S.game;
    d.started = true;
    let html;
    if (d.src === 'hand') {
      const id = Number(d.el.dataset.card);
      d.ids = S.selected.has(id) ? selectedIds() : [id];
      const byId = new Map(g.hand.map((c) => [c.id, c]));
      html = d.ids.map((cid, i) => cardHTML(byId.get(cid), '', `style="--i:${i}"`)).join('');
      d.ids.forEach((cid) => { const el = $(`#hand [data-card="${cid}"]`); if (el) el.classList.add('ghosted'); });
    } else if (d.src === 'stock') html = backHTML();
    else {
      const top = g.discard[g.discard.length - 1];
      html = cardHTML(top) + (g.discardCount > 1 ? backHTML('', 'style="--i:1"') : '');
    }
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.innerHTML = html;
    document.body.appendChild(ghost);
    d.ghost = ghost;
    document.body.classList.add('dragging', `drag-${d.src}`);
    Sound.play('select');
  }

  function moveDrag(d, x, y) {
    d.x = x; d.y = y;
    const w = d.ghost.firstElementChild.offsetWidth;
    d.ghost.style.transform = `translate(${x - w / 2}px, ${y - w * 1.1}px) rotate(-4deg)`;
    const t = dropTargetAt(x, y);
    const ok = dropAllowed(d, t) ? t : null;
    if (ok !== d.hover) {
      if (d.hover) d.hover.classList.remove('drop-hover');
      if (ok) ok.classList.add('drop-hover');
      d.hover = ok;
    }
    if (d.src === 'hand' && ok && ok.dataset.drop === 'hand') showInsertMarker(d, x, y);
    else hideInsertMarker();
  }

  function insertIndex(d, x, y) {
    const cards = $$('#hand .card').filter((c) => !d.ids.includes(Number(c.dataset.card)));
    let best = null, bestDist = Infinity;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const dist = Math.abs(cx - x) + Math.abs(cy - y) * 2;
      if (dist < bestDist) { bestDist = dist; best = { c, after: x > cx }; }
    }
    if (!best) return { id: null, after: true };
    return { id: Number(best.c.dataset.card), after: best.after, el: best.c };
  }

  function showInsertMarker(d, x, y) {
    const ins = insertIndex(d, x, y);
    let m = $('#insmark');
    if (!m) { m = document.createElement('div'); m.id = 'insmark'; document.body.appendChild(m); }
    if (!ins.el) { m.style.display = 'none'; return; }
    const r = ins.el.getBoundingClientRect();
    m.style.display = 'block';
    m.style.left = `${(ins.after ? r.right : r.left) - 2}px`;
    m.style.top = `${r.top}px`;
    m.style.height = `${r.height}px`;
  }
  function hideInsertMarker() { const m = $('#insmark'); if (m) m.style.display = 'none'; }

  function endDrag(d) {
    hideInsertMarker();
    if (d.ghost) d.ghost.remove();
    document.body.classList.remove('dragging', 'drag-hand', 'drag-stock', 'drag-pile');
    $$('.ghosted').forEach((e) => e.classList.remove('ghosted'));
    const target = d.hover;
    if (target) target.classList.remove('drop-hover');
    S.justDragged = Date.now();
    S.drag = null;
    if (!target) { if (S.pendingRender) render(); return; }
    const kind = target.dataset.drop;
    if (d.src === 'hand') {
      if (kind === 'hand') {
        const ins = insertIndex(d, d.x, d.y);
        const rest = S.handOrder.filter((id) => !d.ids.includes(id));
        let at = ins.id == null ? rest.length : rest.indexOf(ins.id) + (ins.after ? 1 : 0);
        rest.splice(at, 0, ...d.ids);
        S.handOrder = rest;
        S.sortMode = 'manual';
        Sound.play('select');
        render();
        return;
      }
      if (S.pendingRender) render();
      if (kind === 'discard') act('discard', { cardId: d.ids[0] });
      else if (kind === 'meld') act('add', { meldId: Number(target.dataset.meld), cardIds: d.ids });
      else if (kind === 'newmeld') {
        if (d.ids.length < 3) { toast('Per calare servono almeno 3 carte: selezionale e trascinale insieme'); return; }
        act('meld', { cardIds: d.ids });
      }
      return;
    }
    if (S.pendingRender) render();
    if (d.src === 'stock') act('draw');
    else if (kind === 'hand') handlers.takePile();
    else if (kind === 'meld') act('takePile', { meldId: Number(target.dataset.meld), cardIds: selectedIds() });
    else if (kind === 'newmeld') act('takePile', { cardIds: selectedIds() });
  }

  document.addEventListener('pointerdown', (e) => {
    Sound.unlock();
    if (e.button !== 0 || S.screen !== 'game' || !S.game) return;
    const card = e.target.closest('#hand .card');
    const dragEl = card || e.target.closest('[data-drag]');
    if (!dragEl) return;
    S.drag = { src: card ? 'hand' : dragEl.dataset.drag, el: dragEl, sx: e.clientX, sy: e.clientY, started: false, ids: [], hover: null };
  });
  document.addEventListener('pointermove', (e) => {
    const d = S.drag;
    if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 9) return;
      startDrag(d);
    }
    e.preventDefault();
    moveDrag(d, e.clientX, e.clientY);
  }, { passive: false });
  const finish = () => {
    const d = S.drag;
    if (!d) return;
    if (d.started) endDrag(d); else S.drag = null;
  };
  document.addEventListener('pointerup', finish);
  document.addEventListener('pointercancel', () => {
    const d = S.drag;
    if (d && d.started) { d.hover = null; endDrag(d); } else S.drag = null;
  });

  /* ================= Click / tap ================= */
  document.addEventListener('click', (e) => {
    if (Date.now() - S.justDragged < 350) return;
    const a = e.target.closest('[data-act]');
    if (a && a.dataset.act && handlers[a.dataset.act]) {
      if (a.disabled) return;
      handlers[a.dataset.act](a, e);
      return;
    }
    const g = S.game;
    const card = e.target.closest('#hand [data-card]');
    if (card && g) {
      const id = Number(card.dataset.card);
      const now = Date.now();
      if (S.lastTap.id === id && now - S.lastTap.t < 350 && g.turn === g.you && g.phase === 'play') {
        S.lastTap = { id: null, t: 0 };
        act('discard', { cardId: id });
        return;
      }
      S.lastTap = { id, t: now };
      if (S.selected.has(id)) S.selected.delete(id); else S.selected.add(id);
      S.toggledCard = id;
      S.hint = null;
      Sound.play('select');
      if (navigator.vibrate) navigator.vibrate(8);
      render();
      return;
    }
    const meld = e.target.closest('[data-mid]');
    if (meld && g) {
      const meldId = Number(meld.dataset.mid);
      const mine = meld.hasAttribute('data-meld');
      const myTurn = g.turn === g.you;
      // con carte selezionate nel proprio turno si attacca; altrimenti si mostrano tutte le carte del gioco
      if (mine && myTurn && g.phase === 'play' && S.selected.size) act('add', { meldId, cardIds: selectedIds() });
      else if (mine && myTurn && g.phase === 'draw' && g.cfg.pile === 'closed') act('takePile', { meldId, cardIds: selectedIds() });
      else showMeld(meldId);
    }
  });

  /** Riquadro con tutte le carte di una combinazione (utile quando il tavolo è compattato) */
  function showMeld(meldId) {
    const g = S.game;
    const team = g.teams.find((t) => t.melds.some((m) => m.id === meldId));
    if (!team) return;
    const m = team.melds.find((x) => x.id === meldId);
    const nat = m.cards.find((c) => !M.isWild(c));
    const what = m.type === 'seq'
      ? `Scala di ${nat ? SUIT[nat.s] : ''}`
      : `Tris di ${nat ? rankName(nat.r) : ''}`;
    const owner = team.members.includes(g.you) ? 'La tua squadra' : esc(teamName(g, team));
    openModal('meld', `<div class="meldview">
      <h3>${what} · ${m.length} carte</h3>
      <p class="muted">${owner}${m.kind ? ` · <b>${esc(m.label)}</b>` : ''}${m.wild.some(Boolean) ? ' · bordo viola = matta' : ''}</p>
      <div class="mvcards">${m.cards.map((c, i) => cardHTML(c, m.wild[i] ? 'wildmark' : 'natural')).join('')}</div>
    </div>`);
  }

  document.addEventListener('scroll', (e) => {
    if (e.target && e.target.id === 'felt') S.feltScroll = e.target.scrollTop;
  }, true);

  document.addEventListener('input', (e) => {
    if (e.target.id === 'nick') { S.nickDraft = e.target.value; checkNickLive(e.target.value, '#nickStatus'); }
    if (e.target.id === 'nickEdit') checkNickLive(e.target.value, '#nickStatusEdit');
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.rule) {
      const target = S.modalKind === 'editRules' ? 'edit' : 'setup';
      const value = el.type === 'checkbox' ? el.checked : el.value;
      setRule(target, el.dataset.rule, value);
    }
    if (el.id === 'name') {
      S.name = el.value.trim();
      store.set('bur_name', S.name);
      if (S.name) socket.emit('setName', { name: S.name });
    }
  });

  document.addEventListener('toggle', (e) => {
    if (e.target.matches && e.target.matches('details.custom')) S.customOpen = e.target.open;
  }, true);

  document.addEventListener('submit', (e) => {
    const forms = {
      nickform: async () => { const r = await emit('setNick', { nick: $('#nickEdit').value.trim() }); if (r.ok) { toast('Nickname aggiornato'); profileModal(); } },
      pwform: async () => { const r = await emit('setPassword', { password: $('#pwin').value }); if (r.ok) { toast('Password salvata'); profileModal(); } },
      codeform: async () => { const r = await emit('importProfile', { code: $('#codein').value }); if (r.ok) adoptProfile(r.token, r.nick); },
      loginform: async () => { const r = await emit('login', { nick: $('#lnick').value, password: $('#lpw').value }); if (r.ok) adoptProfile(r.token, r.nick); },
      reportform: async () => {
        const r = await emit('report', { text: $('#reportin').value, screen: S.screen, device: `${navigator.userAgent.slice(0, 120)} · ${innerWidth}x${innerHeight}` });
        if (r.ok) { closeModal(); toast('Grazie! Segnalazione inviata 🙏'); }
      },
      friendform: async () => { const n = $('#friendin').value.trim(); if (!n) return; const r = await emit('friendRequest', { nick: n }); if (r.ok) toast(`Richiesta inviata a ${n}`); },
    };
    if (forms[e.target.id]) { e.preventDefault(); forms[e.target.id](); return; }
    if (e.target.id === 'musicform') {
      e.preventDefault();
      const url = $('#musicin').value.trim();
      if (url) emit('setMusic', { url }).then((r) => { if (r.ok) { toast('🎵 Musica condivisa con il tavolo'); musicModal(); } });
      return;
    }
    if (e.target.id === 'chatform') {
      e.preventDefault();
      const inp = $('#chatin');
      if (inp.value.trim()) emit('chat', { text: inp.value });
      inp.value = '';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && S.modalKind) closeModal();
    if (e.key === 'Enter' && e.target.id === 'joinCode') handlers.join();
  });

  setInterval(() => {
    if (!S.turnEnd) return;
    const left = Math.max(0, Math.ceil((S.turnEnd - Date.now()) / 1000));
    for (const el of $$('[data-cd]')) {
      el.textContent = `⏱ ${left}s`;
      el.classList.toggle('low', left <= 10);
    }
    const g = S.game;
    if (g && g.turn === g.you && left <= 10 && left > 0 && !S.warned10) {
      S.warned10 = true;
      if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
      Sound.play('turn');
    }
  }, 500);

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (S.screen === 'game') { layoutHand(); fitTable(); } }, 120);
  });

  render();
})();
