(() => {
  'use strict';
  const R = window.BurracoRules;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage non disponibile */ } },
  };

  const S = {
    token: store.get('bur_token', null),
    name: store.get('bur_name', ''),
    rules: R.normalize(store.get('bur_rules', R.PRESETS[0].rules)),
    editRules: null,
    screen: 'home',
    room: null,
    game: null,
    selected: new Set(),
    sortMode: store.get('bur_sort', 'suit'),
    chat: [],
    unread: 0,
    connected: false,
    pendingJoin: (new URLSearchParams(location.search).get('t') || '').toUpperCase(),
    customOpen: false,
    modalKind: null,
    newIds: new Set(),
    flashMeld: null,
    lastTap: { id: null, t: 0 },
  };

  /* ---------------- Connessione ---------------- */
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
    else if (S.room && m.seat !== S.room.you) { S.unread++; toast(`${m.name}: ${m.text}`); render(); }
  });

  function emit(ev, data) {
    return new Promise((res) => {
      socket.emit(ev, data, (r) => {
        if (r && !r.ok) toast(r.error, true);
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
      S.newIds = new Set(prev && prev.handNo === game.handNo ? game.hand.filter((c) => !prev.hand.some((p) => p.id === c.id)).map((c) => c.id) : []);
      const ev = JSON.stringify(game.lastEvent);
      S.flashMeld = prev && JSON.stringify(prev.lastEvent) !== ev && game.lastEvent && game.lastEvent.meldId ? game.lastEvent.meldId : null;
      if (prev && game.turn === game.you && game.phase === 'draw' && (prev.turn !== game.you || prev.phase === 'handEnd')) {
        if (navigator.vibrate) navigator.vibrate(60);
      }
      if (game.phase === 'handEnd' && (!prev || prev.phase !== 'handEnd' || prev.handNo !== game.handNo)) {
        setTimeout(showResult, 600);
      } else if (game.phase !== 'handEnd' && S.modalKind === 'result') closeModal();
      else if (S.modalKind === 'result') showResult();
      document.title = game.turn === game.you && game.phase !== 'handEnd' ? '● Tocca a te · Burraco' : 'Burraco Online';
    } else {
      document.title = 'Burraco Online';
      if (S.modalKind === 'result') closeModal();
    }
    render();
  }

  /* ---------------- Carte ---------------- */
  const SUIT = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const rankName = (r) => ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }[r] || String(r));
  const isWild = (c) => c.r === 0 || c.r === 2;

  function cardHTML(c, cls = '', wild = false) {
    if (c.r === 0) return `<div class="card joker ${cls}" data-card="${c.id}"><span class="ix">★<i>JK</i></span><span class="big">★</span></div>`;
    const red = c.s === 'H' || c.s === 'D';
    return `<div class="card ${red ? 'red' : ''} ${wild ? 'wildmark' : ''} ${cls}" data-card="${c.id}"><span class="ix">${rankName(c.r)}<i>${SUIT[c.s]}</i></span><span class="big">${SUIT[c.s]}</span></div>`;
  }
  const backHTML = (cls = '') => `<div class="card back ${cls}"></div>`;

  function sortHand(hand) {
    const suitOrder = { S: 0, H: 1, C: 2, D: 3 };
    const rk = (c) => (c.r === 1 ? 14 : c.r);
    return hand.slice().sort((a, b) => {
      const wa = isWild(a), wb = isWild(b);
      if (wa !== wb) return wa ? 1 : -1;
      if (wa && wb) return a.r - b.r || (suitOrder[a.s] || 0) - (suitOrder[b.s] || 0);
      if (S.sortMode === 'suit') return suitOrder[a.s] - suitOrder[b.s] || rk(a) - rk(b);
      return rk(a) - rk(b) || suitOrder[a.s] - suitOrder[b.s];
    });
  }

  /* ---------------- UI di base ---------------- */
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
      ${R.HOW_TO}
      ${R.OTHER_VARIANTS}
    </div>`);
  }

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

  /* ---------------- Schermate ---------------- */
  function render() {
    const app = $('#app');
    if (S.screen === 'home') app.innerHTML = homeHTML();
    else if (S.screen === 'setup') app.innerHTML = setupHTML();
    else if (S.screen === 'lobby') app.innerHTML = lobbyHTML();
    else if (S.screen === 'game') app.innerHTML = gameHTML();
    if (!S.connected) app.insertAdjacentHTML('afterbegin', '<div class="status">Connessione al server…</div>');
  }

  function homeHTML() {
    return `<div class="page">
      <div class="logo"><h1>Burraco</h1><div class="suits">♠<span class="r">♥</span>♣<span class="r">♦</span></div>
        <div class="muted">Gioca con gli amici o contro il computer</div></div>
      <div class="panel">
        <label class="field"><span>Il tuo nome</span><input type="text" id="name" maxlength="18" placeholder="Es. Simone" value="${esc(S.name)}"></label>
        <div class="row" style="margin-top:10px"><button class="btn primary grow" data-act="goSetup">Nuova partita</button></div>
        <div class="row" style="margin-top:10px">
          <input type="text" id="joinCode" class="grow" maxlength="4" placeholder="Codice tavolo" value="${esc(S.pendingJoin)}" style="padding:10px;border-radius:8px;border:0;text-transform:uppercase;min-width:0">
          <button class="btn" data-act="join">Entra</button>
        </div>
        ${S.pendingJoin ? '<p class="muted">Sei stato invitato al tavolo: scrivi il tuo nome e premi Entra.</p>' : ''}
      </div>
      <div class="panel">
        <h2>Regole e varianti</h2>
        <p class="muted">Ogni preset è un punto di partenza: quando crei una partita puoi modificare ogni singola regola.</p>
        <div class="presets">${R.PRESETS.map((p) => `<button class="preset" data-act="presetRules" data-id="${p.id}"><b>${esc(p.name)}</b><span>${esc(p.tagline)}</span></button>`).join('')}</div>
        <div class="row" style="margin-top:10px"><button class="btn ghost small" data-act="howto">Come si usa l'app</button></div>
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
        <div class="row"><button class="btn primary grow" data-act="create">Crea tavolo e invita amici</button></div>
        <div class="row" style="margin-top:8px"><button class="btn grow" data-act="createBots">Gioca subito contro il computer</button></div>
        <p class="muted">Nel tavolo online potrai riempire i posti vuoti con giocatori del computer.</p>
      </div>
    </div>`;
  }

  function seatTeamLabel(n, i) {
    if (n === 4) return `<span class="teamtag">Coppia ${i % 2 === 0 ? 'A' : 'B'}</span>`;
    return '';
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
      return `<div class="seat"><div class="who">${seatTeamLabel(r.n, i)}
        ${s ? `<span class="dot ${s.connected ? '' : 'off'}"></span><b>${esc(s.name)}</b>${s.isBot ? ' 🤖' : ''}${me ? ' <span class="badge">tu</span>' : ''}${i === r.host ? ' <span class="badge">host</span>' : ''}` : '<span class="muted">Posto libero</span>'}
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
      </div>
    </div>`;
  }

  /* ---------------- Tavolo di gioco ---------------- */
  function teamName(g, t) {
    const names = t.members.map((s) => (s === g.you ? 'Tu' : g.players[s].name));
    return names.join(' & ');
  }

  function meldHTML(m, clickable) {
    const short = { clean: 'Pulito', dirty: 'Sporco', semi: 'Semi', real13: '+500', real14: '+1000' }[m.kind] || '';
    return `<div class="meld ${m.kind ? 'burraco ' + m.kind : ''} ${S.flashMeld === m.id ? 'flash' : ''}" ${clickable ? `data-meld="${m.id}"` : ''} title="${esc(m.label || '')}">
      ${m.cards.map((c, i) => cardHTML(c, 'mini', m.wild[i])).join('')}
      ${m.kind ? `<span class="tag">${short}</span>` : ''}</div>`;
  }

  function statusText(g) {
    const me = g.you;
    if (g.phase === 'handEnd') return g.over ? 'Partita terminata' : 'Smazzata terminata';
    const cur = g.players[g.turn];
    if (g.turn !== me) return `Turno di <b>${esc(cur.name)}</b>${cur.isBot ? ' 🤖' : ''} · ${g.phase === 'draw' ? 'pesca…' : 'gioca…'}${g.lastTurn ? ' · <b>ultimo giro</b>' : ''}`;
    if (g.phase === 'draw') {
      if (g.mustDraw) return 'Tocca a te: <b>devi pescare dal tallone</b>';
      if (g.cfg.pile === 'closed' && g.discardCount) return 'Tocca a te: pesca, oppure seleziona le carte da combinare con la carta in cima e tocca gli scarti';
      return 'Tocca a te: <b>pesca</b> dal tallone o <b>raccogli</b> gli scarti';
    }
    const myTeam = g.teams.find((t) => t.members.includes(me));
    let tip = 'Cala, attacca o <b>scarta</b> per finire il turno';
    if (g.hand.length <= 3 && myTeam && myTeam.pozzettoTaken && !myTeam.canClose) tip += ` · per chiudere ti serve ${g.cfg.closeNeeds === 'clean' ? `una ${g.cfg.burracoName} pulita` : `un ${g.cfg.burracoName}`}`;
    if (g.lastTurn) tip += ' · <b>ultimo turno!</b>';
    return tip;
  }

  function gameHTML() {
    const g = S.game;
    const r = S.room;
    const me = g.you;
    const myTurn = g.turn === me && g.phase !== 'handEnd';
    const myTeam = g.teams.find((t) => t.members.includes(me));
    const P = g.cfg.pozzettoName;

    // punteggi
    let scores;
    if (g.n === 3) scores = g.players.map((p) => `<span class="sc ${p.seat === me ? 'me' : ''}">${esc(p.seat === me ? 'Tu' : p.name)}: <b>${g.scores[p.seat]}</b></span>`).join('');
    else scores = g.teams.map((t) => `<span class="sc ${t === myTeam ? 'me' : ''}">${esc(teamName(g, t))}: <b>${g.scores[t.members[0]]}</b></span>`).join('');
    scores += `<span class="sc">obiettivo ${g.cfg.target}</span>`;

    // avversari / compagni
    const order = [];
    for (let k = 1; k < g.n; k++) order.push((me + k) % g.n);
    const opps = order.map((s) => {
      const p = g.players[s];
      const partner = myTeam && myTeam.members.includes(s);
      return `<div class="opp ${g.turn === s && g.phase !== 'handEnd' ? 'turn' : ''}">${partner ? '🤝 ' : ''}${esc(p.name)}${p.isBot ? ' 🤖' : ''} <span class="cnt">${p.handCount}</span></div>`;
    }).join('');

    // centro
    const canDraw = myTurn && g.phase === 'draw';
    const pileCards = g.cfg.pile === 'open'
      ? g.discard.map((c) => cardHTML(c)).join('')
      : (g.discard.length ? `${g.discardCount > 1 ? backHTML() : ''}${cardHTML(g.discard[0])}<span class="muted" style="align-self:center;padding-left:8px">${g.discardCount} carte</span>` : '');
    const center = `<div class="center">
      <div class="stack ${canDraw && g.stockCount ? 'clickable' : ''}" data-act="${canDraw ? 'draw' : ''}">${g.stockCount ? backHTML() : '<div class="card" style="opacity:.2"></div>'}<span>Tallone ${g.stockCount}</span></div>
      ${g.pozzetti.length ? `<div class="stack"><div class="pozz">${g.pozzetti.map(() => backHTML()).join('')}</div><span>${g.pozzetti.length} ${g.pozzetti.length === 1 ? P : (P === 'morto' ? 'morti' : 'pozzetti')}</span></div>` : ''}
      <div class="pile ${canDraw && g.discardCount && !g.mustDraw ? 'clickable' : ''}" data-act="${canDraw ? 'takePile' : ''}">
        <div class="muted" style="font-size:11px">Scarti ${g.cfg.pile === 'closed' ? '(chiusi)' : ''}</div>
        <div class="cards">${pileCards || '<span class="empty">vuoto</span>'}</div>
      </div></div>`;

    // zone squadre
    const targetable = myTurn && ((g.phase === 'play' && S.selected.size > 0) || (g.phase === 'draw' && g.cfg.pile === 'closed' && g.discardCount));
    const zones = g.teams.slice().sort((a, b) => (a === myTeam ? 1 : 0) - (b === myTeam ? 1 : 0)).map((t) => {
      const mine = t === myTeam;
      const label = mine ? (t.members.length > 1 ? `Noi (${esc(teamName(g, t))})` : 'I tuoi giochi') : esc(teamName(g, t));
      const flags = [t.pozzettoTaken ? `${P} preso ✓` : `${P} da prendere`];
      if (t.canClose) flags.push('può chiudere');
      return `<div class="teamzone ${mine ? 'mine' : ''}">
        <div class="hdr"><b>${label}</b><span class="muted">${flags.join(' · ')}</span></div>
        <div class="melds ${mine && targetable ? 'targetable' : ''}">${t.melds.length ? t.melds.map((m) => meldHTML(m, mine)).join('') : '<span class="empty">Nessuna combinazione calata</span>'}</div>
      </div>`;
    }).join('');

    // azioni
    const sel = S.selected.size;
    let actions = '';
    if (g.phase === 'handEnd') actions = '<button class="btn primary" data-act="result">Vedi risultati</button>';
    else if (myTurn && g.phase === 'draw') {
      actions = `<button class="btn primary" data-act="draw" ${g.stockCount || g.pozzetti.length ? '' : 'disabled'}>Pesca</button>
        <button class="btn" data-act="takePile" ${g.discardCount && !g.mustDraw ? '' : 'disabled'}>Raccogli scarti${g.discardCount ? ` (${g.discardCount})` : ''}</button>`;
    } else if (myTurn && g.phase === 'play') {
      actions = `<button class="btn primary" data-act="meld" ${sel >= 3 ? '' : 'disabled'}>Cala${sel ? ` (${sel})` : ''}</button>
        <button class="btn" data-act="discard" ${sel === 1 ? '' : 'disabled'}>Scarta</button>
        <button class="btn ghost" data-act="undo" ${g.canUndo ? '' : 'disabled'}>Annulla</button>`;
    }
    actions += `<button class="btn ghost small" data-act="sort">${S.sortMode === 'suit' ? '⇅ Seme' : '⇅ Valore'}</button>`;
    if (sel) actions += '<button class="btn ghost small" data-act="clearSel">✕</button>';

    const hand = sortHand(g.hand).map((c) => cardHTML(c, `${S.selected.has(c.id) ? 'sel' : ''} ${S.newIds.has(c.id) ? 'newc' : ''}`)).join('');

    return `<div class="game">
      <div class="topbar">
        <span class="title">Tavolo <b>${esc(r.code)}</b> · Smazzata ${g.handNo}</span>
        <button class="iconbtn" data-act="gameRules" title="Regole">📜</button>
        <button class="iconbtn" data-act="log" title="Chat e cronaca">💬${S.unread ? ` ${S.unread}` : ''}</button>
        <button class="iconbtn" data-act="scores" title="Punteggi">🏆</button>
        <button class="iconbtn" data-act="leave" title="Esci">⏏</button>
      </div>
      <div class="scorebar">${scores}</div>
      <div class="opps">${opps}</div>
      <div class="table">${center}${zones}</div>
      <div class="status ${myTurn ? 'myturn' : ''}">${statusText(g)}</div>
      <div class="actions">${actions}</div>
      <div class="handwrap"><div class="hand">${hand || '<span class="empty">Nessuna carta</span>'}</div></div>
    </div>`;
  }

  /* ---------------- Modali di gioco ---------------- */
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
        ${S.room.isHost ? '<button class="btn primary" data-act="ready" style="width:100%">Nuova partita con le stesse regole</button>' : '<p class="muted">L\'host può avviare una nuova partita.</p>'}`;
    } else {
      footer = `<button class="btn primary" data-act="ready" style="width:100%" ${imReady ? 'disabled' : ''}>${imReady ? 'Pronto ✓' : 'Prossima smazzata'}</button>
        ${waiting.length && imReady ? `<p class="muted">In attesa di: ${esc(waiting.join(', '))}</p>` : ''}`;
    }
    openModal('result', `<div class="result">
      <h2>Fine smazzata ${g.handNo}</h2><p>${reason}</p>
      <table><tr><th></th>${cols}</tr>
      ${row('Carte calate', (t) => t.meldPts)}
      ${row(`Bonus ${g.cfg.burracoName}`, (t) => `${t.bonusPts}${t.burraco.length ? `<br><span class="muted" style="font-size:11px">${t.burraco.map((b) => esc(b.label)).join(', ')}</span>` : ''}`)}
      ${row('Chiusura', (t) => t.closePts)}
      ${row(cap(P), (t) => t.pozPts)}
      ${row('Carte in mano', (t) => t.handPts)}
      <tr class="tot"><td>Smazzata</td>${hr.teams.map((t) => `<td>${t.total}</td>`).join('')}</tr>
      ${row('<b>Totale partita</b>', (t) => `<b>${hr.scores[t.members[0]]}</b>`)}
      </table>
      <p class="muted">Si vince a ${g.cfg.target} punti.</p>
      ${footer}</div>`);
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
      <form id="chatform" class="row" style="margin:8px 0"><input id="chatin" class="grow" maxlength="140" placeholder="Scrivi un messaggio" style="padding:9px;border-radius:8px;border:1px solid #ccc;min-width:0"><button class="btn primary">Invia</button></form>
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
      <div class="row" style="margin-top:12px"><button class="btn ghost" style="color:#333;border-color:#999" data-act="previewEdit">📜 Anteprima regole</button>
      <button class="btn primary grow" data-act="applyRules">Applica</button></div>`);
  }

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------------- Azioni ---------------- */
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
    howto() { openModal('rules', `<div class="rules-text">${R.HOW_TO}${R.OTHER_VARIANTS}</div>`); },
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
    scores: showScores,
    result: showResult,
    ready() { emit('ready'); },
    draw() { act('draw'); },
    takePile() {
      const g = S.game;
      if (g.cfg.pile === 'closed') {
        if (!S.selected.size) return toast('Seleziona le carte della mano da combinare con la carta in cima (oppure tocca una tua combinazione)', true);
        act('takePile', { cardIds: [...S.selected] });
      } else act('takePile');
    },
    meld() { act('meld', { cardIds: [...S.selected] }); },
    discard() { if (S.selected.size === 1) act('discard', { cardId: [...S.selected][0] }); },
    undo() { act('undo'); },
    sort() { S.sortMode = S.sortMode === 'suit' ? 'rank' : 'suit'; store.set('bur_sort', S.sortMode); render(); },
    clearSel() { S.selected.clear(); render(); },
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]');
    if (a && a.dataset.act && handlers[a.dataset.act]) {
      if (a.disabled) return;
      handlers[a.dataset.act](a, e);
      return;
    }
    const g = S.game;
    const card = e.target.closest('.hand [data-card]');
    if (card && g) {
      const id = Number(card.dataset.card);
      const now = Date.now();
      // doppio tocco = scarta
      if (S.lastTap.id === id && now - S.lastTap.t < 350 && g.turn === g.you && g.phase === 'play') {
        S.lastTap = { id: null, t: 0 };
        act('discard', { cardId: id });
        return;
      }
      S.lastTap = { id, t: now };
      if (S.selected.has(id)) S.selected.delete(id); else S.selected.add(id);
      render();
      return;
    }
    const meld = e.target.closest('[data-meld]');
    if (meld && g && g.turn === g.you) {
      const meldId = Number(meld.dataset.meld);
      if (g.phase === 'play') {
        if (!S.selected.size) return toast('Seleziona prima le carte da attaccare');
        act('add', { meldId, cardIds: [...S.selected] });
      } else if (g.phase === 'draw' && g.cfg.pile === 'closed') {
        act('takePile', { meldId, cardIds: [...S.selected] });
      }
    }
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

  render();
})();
