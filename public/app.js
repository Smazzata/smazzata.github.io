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

  const DEFAULT_PREFS = { felt: 'verde', back: 'rosso', sound: true, big: false };
  const S = {
    token: store.get('bur_token', null),
    name: store.get('bur_name', ''),
    rules: R.normalize(store.get('bur_rules', R.PRESETS[0].rules)),
    prefs: { ...DEFAULT_PREFS, ...store.get('bur_prefs', {}) },
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
    document.body.dataset.felt = S.prefs.felt;
    document.body.dataset.back = S.prefs.back;
    document.body.classList.toggle('bigcards', !!S.prefs.big);
    store.set('bur_prefs', S.prefs);
  }
  applyPrefs();

  /* ================= Connessione ================= */
  const socket = io();
  socket.on('connect', () => {
    S.connected = true;
    socket.emit('hello', { token: S.token, name: S.name });
  });
  socket.on('disconnect', () => { S.connected = false; render(); });
  socket.on('welcome', ({ token, name }) => {
    S.token = token;
    store.set('bur_token', token);
    if (!S.name && name !== 'Giocatore') S.name = name;
  });
  socket.on('state', ({ room, game }) => onState(room, game));
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
    S.room = room;
    S.game = game;
    if (!room) {
      if (S.screen !== 'setup') S.screen = 'home';
      if (S.pendingJoin && S.name) { const code = S.pendingJoin; S.pendingJoin = ''; joinRoom(code); }
    } else {
      S.pendingJoin = '';
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
      if (prev && game.turn === game.you && game.phase === 'draw' && (prev.turn !== game.you || prev.phase === 'handEnd')) {
        if (navigator.vibrate) navigator.vibrate(60);
        Sound.play('turn');
      }
      if (game.phase === 'handEnd' && (!prev || prev.phase !== 'handEnd' || prev.handNo !== game.handNo)) {
        setTimeout(showResult, 900);
        const mine = game.handResult && game.handResult.teams.find((t) => t.members.includes(game.you));
        const best = game.handResult && Math.max(...game.handResult.teams.map((t) => t.total));
        if (mine && mine.total === best) setTimeout(() => Sound.play('win'), 500);
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
      if (now && now.kind && (!before || !before.kind)) Sound.play('burraco'); else Sound.play('meld');
    } else Sound.play('card');
  }

  /* ================= Carte ================= */
  const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const rankName = (r) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[r] || String(r));
  const isWild = (c) => c.r === 0 || c.r === 2;

  function cardHTML(c, cls = '', attrs = '') {
    if (c.r === 0) {
      return `<div class="card joker ${cls}" data-card="${c.id}" ${attrs}><span class="ix">J<br>O<br>L<br>L<br>Y</span><span class="jk">★</span></div>`;
    }
    const red = c.s === 'H' || c.s === 'D';
    const face = c.r >= 11 ? `<span class="face">${rankName(c.r)}<i>${SUIT[c.s]}</i></span>` : `<span class="pip">${SUIT[c.s]}</span>`;
    return `<div class="card ${red ? 'red' : 'black'} ${c.r === 2 ? 'two' : ''} ${cls}" data-card="${c.id}" ${attrs}>
      <span class="ix">${rankName(c.r)}<i>${SUIT[c.s]}</i></span>${face}<span class="ix br">${rankName(c.r)}<i>${SUIT[c.s]}</i></span></div>`;
  }
  const backHTML = (cls = '', attrs = '') => `<div class="card back ${cls}" ${attrs}></div>`;

  function sortCards(cards, mode) {
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
      S.handOrder = sortCards(game.hand, S.sortMode === 'rank' ? 'rank' : 'suit').map((c) => c.id);
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
<li><b>Annulla</b> riporta il turno a subito dopo la pesca. Da ⚙️ puoi cambiare colore del tavolo, dorso delle carte, dimensione e suoni.</li>
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
      <h4>Colore del tavolo</h4>
      <div class="row">${opt('felt', 'verde', '<i class="sw felt-verde"></i>Verde')}${opt('felt', 'blu', '<i class="sw felt-blu"></i>Blu')}${opt('felt', 'bordeaux', '<i class="sw felt-bordeaux"></i>Bordeaux')}${opt('felt', 'antracite', '<i class="sw felt-antracite"></i>Antracite')}</div>
      <h4>Dorso delle carte</h4>
      <div class="row">${opt('back', 'rosso', '<i class="sw back-rosso"></i>Rosso')}${opt('back', 'blu', '<i class="sw back-blu"></i>Blu')}${opt('back', 'verde', '<i class="sw back-verde"></i>Verde')}${opt('back', 'nero', '<i class="sw back-nero"></i>Nero')}</div>
      <h4>Carte</h4>
      <div class="row">${opt('big', false, 'Normali')}${opt('big', true, 'Grandi')}</div>
      <h4>Suoni</h4>
      <div class="row">${opt('sound', true, '🔊 Attivi')}${opt('sound', false, '🔇 Disattivati')}</div>
      ${S.room && S.room.isHost ? `<h4>Velocità del computer</h4>${botSpeedHTML(S.room.botSpeed)}` : ''}`);
  }

  function botSpeedHTML(cur) {
    return `<div class="row">${[['lenta', '🐢 Lenta'], ['normale', 'Normale'], ['veloce', '⚡ Veloce']]
      .map(([v, l]) => `<button class="swatch ${cur === v ? 'on' : ''}" data-act="botSpeed" data-val="${v}">${l}</button>`).join('')}</div>`;
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
    if (!S.connected) app.insertAdjacentHTML('afterbegin', '<div class="offline">Connessione al server…</div>');
  }

  function homeHTML() {
    const fan = [{ r: 1, s: 'S' }, { r: 13, s: 'H' }, { r: 0, s: 'J' }, { r: 2, s: 'D' }, { r: 7, s: 'C' }]
      .map((c, i) => cardHTML({ ...c, id: -1 - i }, 'logo-card', `style="--i:${i - 2}"`)).join('');
    return `<div class="page">
      <div class="logo"><div class="logo-fan">${fan}</div><h1>Burraco</h1>
        <div class="muted">Gioca con gli amici o contro il computer</div></div>
      <div class="panel">
        <label class="field"><span>Il tuo nome</span><input type="text" id="name" maxlength="18" placeholder="Es. Simone" value="${esc(S.name)}"></label>
        <div class="row" style="margin-top:10px"><button class="btn primary grow big" data-act="goSetup">Nuova partita</button></div>
        <div class="row" style="margin-top:10px">
          <input type="text" id="joinCode" class="grow codein" maxlength="4" placeholder="Codice tavolo" value="${esc(S.pendingJoin)}">
          <button class="btn" data-act="join">Entra</button>
        </div>
        ${S.pendingJoin ? '<p class="muted">Sei stato invitato al tavolo: scrivi il tuo nome e premi Entra.</p>' : ''}
      </div>
      <div class="panel">
        <h2>Regole e varianti</h2>
        <p class="muted">Ogni preset è un punto di partenza: quando crei una partita puoi modificare ogni singola regola.</p>
        <div class="presets">${R.PRESETS.map((p) => `<button class="preset" data-act="presetRules" data-id="${p.id}"><b>${esc(p.name)}</b><span>${esc(p.tagline)}</span></button>`).join('')}</div>
        <div class="row" style="margin-top:10px"><button class="btn ghost small" data-act="howto">Come si gioca nell'app</button><button class="btn ghost small" data-act="settings">⚙️ Aspetto e suoni</button></div>
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
        <div class="row"><button class="btn primary grow big" data-act="create">Crea tavolo e invita amici</button></div>
        <div class="row" style="margin-top:8px"><button class="btn grow" data-act="createBots">Gioca subito contro il computer</button></div>
        <p class="muted">Nel tavolo online potrai riempire i posti vuoti con giocatori del computer.</p>
      </div>
    </div>`;
  }

  const SEAT_COLORS = ['#f2c14e', '#64b5f6', '#ef7d7d', '#81c784'];
  function avatarHTML(name, seat, isBot) {
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
        <div class="who">${s ? avatarHTML(s.name, i, s.isBot) : '<span class="avatar empty">?</span>'}
        <div>${s ? `<b>${esc(s.name)}</b>${me ? ' <span class="badge">tu</span>' : ''}${i === r.host ? ' <span class="badge">host</span>' : ''}${s.connected ? '' : ' <span class="muted">(offline)</span>'}` : '<span class="muted">Posto libero</span>'}<br>${team}</div>
        </div>${right}</div>`;
    }).join('');
    const full = r.seats.every(Boolean);
    return `<div class="page">
      <div class="row"><button class="btn ghost small" data-act="leave">← Esci dal tavolo</button></div>
      <div class="panel" style="text-align:center">
        <div class="muted">Codice tavolo</div>
        <div class="code">${esc(r.code)}</div>
        <div class="row" style="justify-content:center"><button class="btn primary" data-act="share">Invita amici</button><button class="btn" data-act="copy">Copia link</button></div>
        <p class="muted">Gli amici aprono il link oppure scrivono il codice nella schermata iniziale.</p>
      </div>
      <div class="panel">
        <h2>Giocatori (${r.seats.filter(Boolean).length}/${r.n})</h2>
        <div class="seats">${seats}</div>
        ${isHost ? `<div class="row" style="margin-top:12px">
            ${full ? '' : '<button class="btn" data-act="fillBots">Riempi con il computer</button>'}
            <button class="btn primary grow" data-act="start" ${full ? '' : 'disabled'}>Avvia partita</button></div>`
          : '<p class="muted">In attesa che l\'host avvii la partita…</p>'}
      </div>
      <div class="panel">
        <h2>Regole</h2>
        <p>${rulesStatus(r.rules)} <span class="muted">· ${r.n} giocatori · si vince a ${r.rules.target}</span></p>
        <div class="row"><button class="btn small" data-act="roomRules">📜 Leggi le regole</button>
        ${isHost ? '<button class="btn small" data-act="editRules">✏️ Modifica regole</button>' : ''}</div>
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
    const sel = orderedHand().filter((c) => S.selected.has(c.id));
    const closedDraw = g.phase === 'draw' && g.cfg.pile === 'closed' && g.discard.length;
    if (g.phase !== 'play' && !closedDraw) return out;
    const cards = closedDraw ? [g.discard[g.discard.length - 1], ...sel] : sel;
    if (!sel.length) return out;
    const cfg = meldCfg(g);
    for (const m of myTeam.melds) if (M.analyzeMeld(m.cards.concat(cards), cfg, m.type)) out.canAdd.add(m.id);
    if (cards.length >= 3) {
      const an = M.analyzeMeld(cards, cfg);
      let ok = !!an;
      if (an && an.type === 'set' && g.cfg.rules.noDuplicateSets) {
        ok = !myTeam.melds.some((m) => m.type === 'set' && m.cards.find((c) => !M.isWild(c)).r === an.rank);
      }
      out.newMeld = { ok, label: an ? (an.type === 'seq' ? 'scala' : 'tris') : '' };
    }
    return out;
  }

  function meldHTML(m, mine, preview) {
    const short = { clean: 'Pulito', dirty: 'Sporco', semi: 'Semi', real13: '+500', real14: '+1000' }[m.kind] || '';
    const attrs = mine ? `data-meld="${m.id}" data-drop="meld"` : '';
    const can = preview && preview.canAdd.has(m.id) ? 'can-add' : '';
    const hint = S.hint && S.hint.meldId === m.id ? 'hinted' : '';
    return `<div class="meld ${m.kind ? 'burraco ' + m.kind : ''} ${S.flashMeld === m.id ? 'flash' : ''} ${m.type === 'set' ? 'set' : ''} ${can} ${hint}" ${attrs} title="${esc(m.label || '')}">
      ${m.cards.map((c, i) => cardHTML(c, `mini ${m.wild[i] ? 'wildmark' : ''}`)).join('')}
      ${m.kind ? `<span class="tag">${short}</span>` : `<span class="cnt">${m.length}</span>`}</div>`;
  }

  function statusText(g) {
    const me = g.you;
    if (g.phase === 'handEnd') return g.over ? 'Partita terminata' : 'Smazzata terminata';
    const cur = g.players[g.turn];
    if (g.turn !== me) return `Turno di <b>${esc(cur.name)}</b>${g.lastTurn ? ' · <b>ultimo giro</b>' : ''}`;
    if (g.phase === 'draw') {
      if (g.mustDraw) return 'Tocca a te: <b>pesca dal tallone</b>';
      if (g.cfg.pile === 'closed' && g.discardCount) return 'Tocca a te: pesca, o seleziona carte da combinare con la carta in cima e prendi lo scarto';
      return 'Tocca a te: <b>pesca</b> o <b>raccogli</b> gli scarti';
    }
    const myTeam = g.teams.find((t) => t.members.includes(me));
    let tip = 'Cala, attacca e <b>scarta</b>';
    if (myTeam && myTeam.canClose) tip = 'Puoi <b>chiudere</b>: cala tutto e scarta l\'ultima carta';
    else if (g.hand.length <= 3 && myTeam && myTeam.pozzettoTaken) tip += ` · per chiudere serve ${g.cfg.closeNeeds === 'clean' ? `una ${g.cfg.burracoName} pulita` : `un ${g.cfg.burracoName}`}`;
    if (g.lastTurn) tip += ' · <b>ultimo turno!</b>';
    return tip;
  }

  /** ultima riga significativa della cronaca */
  function lastMove(g) {
    for (let i = g.log.length - 1; i >= 0; i--) {
      if (!g.log[i].startsWith('—')) return g.log[i];
    }
    return 'La smazzata è iniziata: buon divertimento!';
  }

  /** posizione al tavolo degli altri giocatori rispetto a me */
  function seatPositions(g) {
    const me = g.you < 0 ? 0 : g.you;
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
    return `<div class="seatchip pos-${pos} ${turn ? 'turn' : ''} ${partner ? 'partner' : ''}" data-seat="${seat}">
      ${avatarHTML(p.name, seat, p.isBot)}
      <div class="sinfo"><b>${esc(p.name)}</b>
        <span class="smeta">${partner ? 'compagno · ' : ''}${p.handCount} carte${t && t.pozzettoTaken ? ` · ${g.cfg.pozzettoName} ✓` : ''}</span></div>
      <div class="minifan">${fan}</div>
      ${turn ? '<span class="thinking"><i></i><i></i><i></i></span>' : ''}
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
        <span class="lbl">Tallone · ${g.stockCount}</span>
      </div>
      ${g.pozzetti.length ? `<div class="pozz"><div class="pz">${g.pozzetti.map((n, i) => backHTML('', `style="--l:${i}"`)).join('')}</div><span class="lbl">${g.pozzetti.length === 1 ? cap(P) : (P === 'morto' ? 'Morti' : 'Pozzetti')}</span></div>` : ''}
      <div class="pile ${(canDraw && g.discardCount && !g.mustDraw) || (playing && S.selected.size === 1) ? 'active' : ''} ${g.cfg.pile} ${S.hint && (S.hint.type === 'takePile' || S.hint.type === 'discard') ? 'hinted' : ''}" data-drop="discard" ${canDraw && !g.mustDraw ? 'data-act="takePile"' : playing ? 'data-act="discardSel"' : ''}>
        <div class="pcards">${pileCards || '<div class="card slot"><span>Scarti</span></div>'}</div>
        <span class="lbl">Scarti${g.discardCount ? ' · ' + g.discardCount : ''}${g.cfg.pile === 'closed' ? ' (chiusi)' : ''}</span>
      </div>
    </div>`;

    // giochi delle squadre
    const preview = selectionPreview(g, myTeam);
    const nm = preview.newMeld;
    const newSlotText = nm ? (nm.ok ? `✓ Cala<br>${nm.label}` : '✗ Non<br>valida') : '＋ Nuova<br>combinazione';
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

    // azioni
    const sel = S.selected.size;
    let actions = '';
    if (g.phase === 'handEnd') actions = '<button class="btn primary" data-act="result">Vedi risultati</button>';
    else if (canDraw) {
      actions = `<button class="btn primary" data-act="draw" ${g.stockCount || g.pozzetti.length ? '' : 'disabled'}>Pesca</button>
        <button class="btn" data-act="takePile" ${g.discardCount && !g.mustDraw ? '' : 'disabled'}>Raccogli${g.discardCount ? ` (${g.discardCount})` : ''}</button>`;
    } else if (playing) {
      actions = `<button class="btn primary" data-act="meld" ${nm && nm.ok ? '' : 'disabled'}>Cala${sel ? ` ${sel}` : ''}</button>
        <button class="btn" data-act="discard" ${sel === 1 ? '' : 'disabled'}>Scarta</button>
        ${g.canUndo ? '<button class="btn ghost" data-act="undo" title="Annulla le giocate del turno">↶<span class="wide"> Annulla</span></button>' : ''}`;
    }
    if (myTurn) actions += '<button class="btn ghost small" data-act="hint" title="Suggerimento">💡</button>';
    const sortLbl = S.sortMode === 'rank' ? '⇅ Valore' : S.sortMode === 'suit' ? '⇅ Seme' : '⇅ Ordina';

    return `<div class="game ${myTurn ? 'myturn' : ''}">
      <div class="topbar">
        <span class="title">Tavolo <b>${esc(r.code)}</b> · Smazzata ${g.handNo} · a ${g.cfg.target}</span>
        <button class="iconbtn" data-act="gameRules" title="Regole">📜</button>
        <button class="iconbtn" data-act="log" title="Chat">💬${S.unread ? `<sup>${S.unread}</sup>` : ''}</button>
        <button class="iconbtn" data-act="scores" title="Punteggi">🏆</button>
        <button class="iconbtn" data-act="settings" title="Aspetto e suoni">⚙️</button>
        <button class="iconbtn" data-act="leave" title="Esci">⏏</button>
      </div>
      <div class="scorebar">${scores}</div>
      <div class="seats-row n${g.n}">${seats}</div>
      <div class="ticker" title="Ultima mossa">${esc(lastMove(g))}</div>
      <div class="felt" id="felt">${others}${center}${mineZone}</div>
      <div class="statusbar ${myTurn ? 'on' : ''}">
        <span class="msg">${statusText(g)}</span>
        <div class="btns">${actions}<button class="btn ghost small" data-act="sort">${sortLbl}</button>${sel ? '<button class="btn ghost small" data-act="clearSel">✕</button>' : ''}</div>
      </div>
      <div class="handwrap" data-drop="hand"><div class="hand" id="hand">${handHTML(g)}</div></div>
    </div>`;
  }

  function handHTML(g) {
    const cards = orderedHand();
    if (!cards.length) return '<span class="empty">Nessuna carta</span>';
    return cards.map((c) => cardHTML(c, `${S.selected.has(c.id) ? 'sel' : ''} ${S.newIds.has(c.id) ? 'newc' : ''}`)).join('');
  }

  /** dispone la mano a ventaglio su una o due file, in base alla larghezza */
  function layoutHand() {
    const hand = $('#hand');
    if (!hand) return;
    const cards = $$('.card', hand);
    if (!cards.length) return;
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

  function afterGameRender() {
    layoutHand();
    const felt = $('#felt');
    if (felt && S.feltScroll != null) felt.scrollTop = S.feltScroll;
    const pc = $('.pile .pcards');
    if (pc) pc.scrollLeft = pc.scrollWidth;
    if (S.animEvent) { animateEvent(S.animEvent); S.animEvent = null; }
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
    if (g.over) {
      footer = `<div class="winner">🏆 Vince ${esc(g.winners.map((s) => (s === g.you ? 'Tu' : g.players[s].name)).join(' & '))}!</div>
        ${S.room.isHost ? '<button class="btn primary big" data-act="ready" style="width:100%">Nuova partita con le stesse regole</button>' : '<p class="muted">L\'host può avviare una nuova partita.</p>'}`;
    } else {
      footer = `<button class="btn primary big" data-act="ready" style="width:100%" ${imReady ? 'disabled' : ''}>${imReady ? 'Pronto ✓' : 'Prossima smazzata'}</button>
        ${waiting.length && imReady ? `<p class="muted">In attesa di: ${esc(waiting.join(', '))}</p>` : ''}`;
    }
    openModal('result', `<div class="result">
      <h2>Fine smazzata ${g.handNo}</h2><p>${reason}</p>
      <table><tr><th></th>${cols}</tr>
      ${row('Carte calate', (t) => t.meldPts)}
      ${row(`Bonus ${g.cfg.burracoName}`, (t) => `${t.bonusPts}${t.burraco.length ? `<br><span class="muted small">${t.burraco.map((b) => esc(b.label)).join(', ')}</span>` : ''}`)}
      ${row('Chiusura', (t) => t.closePts)}
      ${row(cap(P), (t) => t.pozPts)}
      ${row('Carte in mano', (t) => t.handPts)}
      <tr class="tot"><td>Smazzata</td>${hr.teams.map((t) => `<td>${t.total}</td>`).join('')}</tr>
      ${row('<b>Totale partita</b>', (t) => `<b>${hr.scores[t.members[0]]}</b>`)}
      </table>
      <p class="muted">Si vince a ${g.cfg.target} punti.</p>
      ${leftoverHTML(g, hr)}
      ${footer}</div>`);
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
    const el = $('#name');
    if (el) S.name = el.value.trim();
    if (!S.name) { toast('Scrivi prima il tuo nome', true); if (el) el.focus(); return false; }
    store.set('bur_name', S.name);
    socket.emit('setName', { name: S.name });
    return true;
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

  function inviteLink() { return `${location.origin}/?t=${S.room.code}`; }

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
      if (S.game && !S.game.over && !confirm('Vuoi davvero uscire? Il tuo posto passerà al computer.')) return;
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
      S.sortMode = S.sortMode === 'suit' ? 'rank' : 'suit';
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
      S.hint = null;
      Sound.play('select');
      if (navigator.vibrate) navigator.vibrate(8);
      render();
      return;
    }
    const meld = e.target.closest('[data-meld]');
    if (meld && g && g.turn === g.you) {
      const meldId = Number(meld.dataset.meld);
      if (g.phase === 'play') {
        if (!S.selected.size) return toast('Seleziona prima le carte da attaccare');
        act('add', { meldId, cardIds: selectedIds() });
      } else if (g.phase === 'draw' && g.cfg.pile === 'closed') {
        act('takePile', { meldId, cardIds: selectedIds() });
      }
    }
  });

  document.addEventListener('scroll', (e) => {
    if (e.target && e.target.id === 'felt') S.feltScroll = e.target.scrollTop;
  }, true);

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

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (S.screen === 'game') layoutHand(); }, 120);
  });

  render();
})();
