/* Burraco — Finestre di gioco: fine smazzata, punteggi, cronaca, regole.
 * File caricato in ordine da index.html insieme agli altri di public/js: condividono le stesse
 * dichiarazioni (S, socket, render…). Il codice in cima al file può usare solo ciò che è nei file precedenti. */
'use strict';

  /* ================= Modali di gioco ================= */
  function showResult() {
    const g = S.game;
    if (!g || !g.handResult) return;
    const hr = g.handResult;
    const P = g.cfg.pozzettoName;
    const cols = hr.teams.map((t) => `<th>${esc(t.members.map((s) => (s === g.you ? 'Tu' : g.players[s].name)).join(' & '))}</th>`).join('');
    const row = (label, fn) => `<tr><td>${label}</td>${hr.teams.map((t) => `<td>${fn(t)}</td>`).join('')}</tr>`;
    const reason = hr.reason === 'tie' ? 'Smazzata pari: 60 a 60.' : hr.reason === 'end' ? 'Smazzata terminata.' : hr.reason === 'surrender'
      ? `🏳️ <b>${esc(hr.surrendered.map((x) => (x === g.you ? 'Tu' : g.players[x].name)).join(' e '))}</b> ${hr.surrendered.length > 1 ? 'si sono arresi' : (hr.surrendered[0] === g.you ? 'ti sei arreso' : 'si è arreso')}.`
      : hr.reason === 'close' ? `<b>${esc(g.players[hr.closer].name)}</b> ha chiuso la smazzata${hr.inHand ? ' <b>in mano</b> 🎩' : ''}.` : 'Il tallone è finito.';
    const humans = S.room.seats.map((s, i) => (s && !s.isBot ? i : -1)).filter((i) => i >= 0);
    const waiting = humans.filter((i) => !S.room.ready.includes(i)).map((i) => S.room.seats[i].name);
    const imReady = S.room.ready.includes(g.you);
    let footer;
    if (S.room.daily && g.you >= 0) {
      const mineT = hr.teams.find((t) => t.members.includes(g.you));
      footer = `<div class="winner">📅 Sfida completata: ${signed(mineT.total)} punti</div>
        <div class="row"><button class="btn primary grow" data-act="dailyFromResult">🏆 Classifica della sfida</button><button class="btn grow" data-act="leave">Torna alla home</button></div>`;
    } else if (g.you < 0) {
      footer = g.over ? `<div class="winner">🏆 Vince ${esc(g.winners.map((s) => g.players[s].name).join(' & '))}!</div>` : '<p class="muted">Stai guardando: la prossima smazzata parte quando i giocatori sono pronti.</p>';
    } else if (g.over && S.room.series) {
      const sr = S.room.series;
      const champ = sr.champion ? sr.champion.map((x) => (x === g.you ? 'Tu' : g.players[x].name)) : null;
      footer = `<div class="winner">${champ ? `🏆 Campione del torneo: ${esc([...new Set(champ)].join(' & '))}!` : `Partita ${sr.games} di ${sr.bestOf} vinta da ${esc(g.winners.map((x) => (x === g.you ? 'Tu' : g.players[x].name)).join(' & '))}`}</div>
        <p style="text-align:center">${seriesHTML(S.room, g)}</p>
        <button class="btn primary big" data-act="ready" style="width:100%" ${imReady ? 'disabled' : ''}>${imReady ? 'Hai votato ✓' : champ ? '🔁 Nuovo torneo' : '▶ Prossima partita del torneo'}</button>
        ${imReady && waiting.length ? `<p class="muted">In attesa di: ${esc(waiting.join(', '))}</p>` : ''}`;
    } else if (g.over && S.room.tournament) {
      footer = `<div class="winner">${g.winners.includes(g.you) ? '🎉 Passi al turno successivo!' : 'Fuori dal torneo, alla prossima!'}</div>
        <div class="row"><button class="btn primary grow" data-act="tourBack" data-id="${esc(S.room.tournament.id)}">🏆 Torna al tabellone</button></div>`;
    } else if (g.over) {
      // fine partita: tre strade chiare (rivincita, di nuovo al tavolo, uscire)
      const solo = S.room.onDevice || S.room.offline || humans.length <= 1;
      footer = `<div class="winner">🏆 Vince ${esc(g.winners.map((s) => (s === g.you ? 'Tu' : g.players[s].name)).join(' & '))}!</div>
        <div class="endopts">
          <button class="btn primary big" data-act="ready" ${imReady ? 'disabled' : ''}>${imReady ? 'Rivincita: hai votato ✓' : '🔁 Rivincita'}</button>
          ${solo ? '<button class="btn big" data-act="newFromResult">🃏 Nuova partita</button>' : '<button class="btn big" data-act="backToLobby">🪑 Torna al tavolo</button>'}
          <button class="btn big" data-act="leaveNow">🚪 Esci dal tavolo</button>
        </div>
        <div class="row" style="justify-content:center;margin-top:8px"><button class="btn ghost dark small" data-act="shareResult">📤 Condividi il risultato</button></div>
        ${imReady && waiting.length ? `<p class="muted">In attesa di: ${esc(waiting.join(', '))}</p>` : solo ? '' : '<p class="muted small">Rivincita: stessi posti e stesse regole, si riparte quando tutti la premono. Torna al tavolo: per cambiare regole o giocatori.</p>'}`;
    } else {
      footer = `<button class="btn primary big" data-act="ready" style="width:100%" ${imReady ? 'disabled' : ''}>${imReady ? 'Pronto ✓' : 'Prossima smazzata'}</button>
        ${waiting.length && imReady ? `<p class="muted">In attesa di: ${esc(waiting.join(', '))}</p>` : ''}`;
    }
    // riepilogo in alto: il TOTALE della partita in grande, sotto i punti di questa smazzata e la barra verso il traguardo
    const best = Math.max(...hr.teams.map((t) => t.total));
    const lead = Math.max(...hr.teams.map((t) => hr.scores[t.members[0]]));
    const pct = (v) => Math.max(0, Math.min(100, (v / g.cfg.target) * 100));
    const summary = hr.teams.map((t) => {
      const tot = hr.scores[t.members[0]];
      const names = t.members.map((x) => (x === g.you ? 'Tu' : g.players[x].name)).join(' & ');
      const s40 = isS40Game();
      return `<div class="rteam ${tot === lead ? 'win' : ''} ${t.members.includes(g.you) ? 'mine' : ''}">
        <div class="rname">${esc(names)}</div>
        <div class="rgrand ${s40 || tot < 0 ? 'neg' : ''}" data-count="${s40 ? -tot : tot}">${s40 ? -tot : tot}</div>
        <div class="rlabel">${s40 ? 'penalità totale' : 'totale partita'}</div>
        <div class="rhand ${t.total < 0 ? 'neg' : 'pos'}">${t.total === best ? '★ ' : ''}smazzata <b data-count="${t.total}" data-sign="1">${signed(t.total)}</b></div>
        ${s40
          ? `<div class="rbar pen"><i style="--from:${pct(t.total - tot)}%;--to:${pct(-tot)}%"></i></div><div class="rtot">eliminato a ${g.cfg.target}</div>`
          : `<div class="rbar"><i style="--from:${pct(tot - t.total)}%;--to:${pct(tot)}%"></i></div><div class="rtot">${g.game === 'briscola' || g.game === 'rubamazzetto' ? `vince chi arriva a ${g.cfg.target} ${g.cfg.target === 1 ? 'smazzata' : 'smazzate'}` : g.game === 'briscola5' ? `punti · smazzata ${g.handNo} di ${g.cfg.target}` : `si vince a ${g.cfg.target}`}</div>`}</div>`;
    }).join('');
    // righe del dettaglio: quelle tutte a zero non servono
    const detail = (label, key, extra) => (hr.teams.some((t) => t[key]) || (key === 'meldPts' && !isS40Game())
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
      ${hr.rows ? hr.rows.map((rw) => `<tr><td>${esc(rw.label)}</td>${rw.values.map((v, i) => `<td class="${rw.plain ? '' : v > 0 ? 'pos' : ''}">${rw.plain ? v : signed(v)}${rw.notes && rw.notes[i] ? `<br><span class="muted small">${esc(rw.notes[i])}</span>` : ''}</td>`).join('')}</tr>`).join('') : ''}
      ${hr.rows ? '' : detail('Carte calate', 'meldPts')}
      ${detail(`Bonus ${g.cfg.burracoName}`, 'bonusPts', (t) => (t.burraco.length ? `<div class="bchips">${t.burraco.map((b) => `<span class="bchip ${kindCls(b)}">${esc(cap(b.label.replace(/^(burraco|canastra) /i, '')))} +${b.bonus}</span>`).join('')}</div>` : ''))}
      ${detail('Chiusura', 'closePts')}
      ${detail(cap(P), 'pozPts')}
      ${detail('Carte in mano', 'handPts')}
      <tr class="tot"><td>Smazzata</td>${hr.teams.map((t) => `<td>${signed(t.total)}</td>`).join('')}</tr>
      <tr class="grand"><td>${isS40Game() ? 'Penalità totale' : 'Totale partita'}</td>${hr.teams.map((t) => `<td>${isS40Game() ? -hr.scores[t.members[0]] : hr.scores[t.members[0]]}</td>`).join('')}</tr>
      </table>
      ${leftoverHTML(g, hr)}
      ${g.hasReplay && !S.room.daily ? '<div class="row" style="justify-content:center;margin:8px 0"><button class="btn small" data-act="replay">🎬 Rivedi la smazzata</button></div>' : ''}
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
    // sicurezza: se l'animazione non parte (pagina in secondo piano) i numeri finali si scrivono comunque
    setTimeout(() => { for (const x of targets) x.el.textContent = x.sign ? signed(x.v) : String(x.v); }, dur + 150);
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
      <h3>Smazzate</h3>${rows ? `<table>${rows}</table>` : '<p class="muted">Nessuna smazzata conclusa.</p>'}
      ${g.hasReplay && !S.room.daily ? '<div class="row" style="margin-top:10px"><button class="btn small" data-act="replay">🎬 Rivedi l\'ultima smazzata</button></div>' : ''}</div>`);
  }

  function renderLogModal() {
    const g = S.game;
    const chat = S.chat.map((m, i) => `<div class="chat"><b ${S.room && m.seat !== S.room.you && m.seat >= 0 ? `data-act="playerMenu" data-nick="${esc(m.name)}" style="cursor:pointer;text-decoration:underline dotted"` : ''}>${esc(m.name)}:</b> ${m.voice
      ? `<button class="btn small voiceplay" data-act="playVoice" data-i="${i}">▶ 🎤 ${Math.max(1, Math.round(m.ms / 1000))} s</button>` : esc(m.text)}</div>`).join('');
    openModal('log', `<h2>Chat</h2>
      <div class="log" id="chatlog">${chat || '<div class="muted">Nessun messaggio</div>'}</div>
      <form id="chatform" class="row" style="margin:8px 0"><input id="chatin" class="grow" maxlength="140" placeholder="Scrivi un messaggio" autocomplete="off"><button class="btn primary">Invia</button>${voiceAvailable() ? '<button type="button" class="btn voicebtn" data-voice title="Tieni premuto per parlare">🎤</button>' : ''}</form>
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

  /** menu ☰ del tavolo: le funzioni meno usate, con nomi scritti per intero */
  function tableMenuModal() {
    const r = S.room || {}, g = S.game;
    const item = (act, icon, label) => `<button class="menuitem" data-act="${act}"><span>${icon}</span>${label}</button>`;
    openModal('tableMenu', `<h2>☰ Menu</h2><div class="menulist">
      ${item('scores', '🏆', 'Punteggi')}
      ${item('gameRules', '📜', 'Regole del gioco')}
      ${OFFLINE ? '' : item('music', '🎵', `Musica del tavolo${r.music ? ' (attiva)' : ''}`)}
      ${item('settings', '⚙️', 'Impostazioni')}
      ${item('leave', '🚪', 'Esci dalla partita')}</div>`);
  }

  /*
   * Immagine del risultato da condividere (WhatsApp, social): tavolo verde, ventaglio di carte, chi ha vinto,
   * i punteggi e la data. Se il telefono lo permette si condivide direttamente l'immagine, altrimenti la si
   * mostra con «Scarica» e un messaggio pronto per WhatsApp.
   */
  function resultImage() {
    const g = S.game;
    const W = 1080, H = 1080;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    // panno verde con luce al centro e bordo dorato
    const bg = c.createRadialGradient(W / 2, H * 0.38, 80, W / 2, H / 2, W * 0.75);
    bg.addColorStop(0, '#1f8a55'); bg.addColorStop(0.55, '#0f5132'); bg.addColorStop(1, '#062b1a');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(242,193,78,.55)'; c.lineWidth = 6; c.strokeRect(28, 28, W - 56, H - 56);
    c.strokeStyle = 'rgba(242,193,78,.25)'; c.lineWidth = 2; c.strokeRect(44, 44, W - 88, H - 88);
    // ventaglio di tre carte
    const card = (x, y, rot, face) => {
      c.save(); c.translate(x, y); c.rotate(rot);
      c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = 24; c.shadowOffsetY = 10;
      const w = 150, h = 210, r = 16;
      c.beginPath(); c.roundRect(-w / 2, -h, w, h, r);
      if (face) { c.fillStyle = '#fbf8ef'; c.fill(); c.shadowColor = 'transparent';
        c.fillStyle = face.red ? '#c0392b' : '#1b1b1b';
        c.font = 'bold 46px Georgia, serif'; c.textAlign = 'left'; c.fillText(face.r, -w / 2 + 14, -h + 54);
        c.font = '40px serif'; c.fillText(face.s, -w / 2 + 16, -h + 98);
        c.font = '96px serif'; c.textAlign = 'center'; c.fillText(face.s, 0, -h / 2 + 36);
      } else { const gb = c.createLinearGradient(-w / 2, -h, w / 2, 0); gb.addColorStop(0, '#c0303f'); gb.addColorStop(1, '#7d1422'); c.fillStyle = gb; c.fill();
        c.shadowColor = 'transparent'; c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 4; c.beginPath(); c.roundRect(-w / 2 + 12, -h + 12, w - 24, h - 24, 10); c.stroke(); }
      c.restore();
    };
    card(W / 2 - 120, 400, -0.32, null);
    card(W / 2 + 120, 400, 0.32, { r: 'A', s: '♦', red: true });
    card(W / 2, 380, 0, { r: 'A', s: '♠', red: false });
    // titolo
    c.textAlign = 'center';
    c.fillStyle = '#f2c14e'; c.font = 'bold 92px Georgia, serif'; c.fillText('Smazzata', W / 2, 520);
    const won = g.winners.includes(g.you);
    c.fillStyle = '#ffffff'; c.font = 'bold 70px system-ui, sans-serif';
    c.fillText(won ? '🏆 Ho vinto!' : 'Che partita!', W / 2, 630);
    c.fillStyle = '#bcd6c8'; c.font = '38px system-ui, sans-serif';
    c.fillText(`${RX.gameName(g.cfg.rules)} · ${g.handNo} ${g.handNo === 1 ? 'smazzata' : 'smazzate'} · ${new Date().toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' })}`, W / 2, 690);
    // squadre e punteggi
    const s40 = isS40Game();
    const rows = g.teams.map((t) => ({
      names: t.members.map((x) => (x === g.you ? (S.social && S.social.nick) || 'Io' : g.players[x].name)).join(' & '),
      score: s40 ? -g.scores[t.members[0]] : g.scores[t.members[0]], win: t.members.some((x) => g.winners.includes(x)),
    }));
    let y = 790;
    for (const r of rows.slice(0, 5)) {
      c.fillStyle = r.win ? 'rgba(242,193,78,.22)' : 'rgba(0,0,0,.22)';
      c.beginPath(); c.roundRect(150, y - 52, W - 300, 72, 18); c.fill();
      c.textAlign = 'left'; c.fillStyle = '#fff'; c.font = `${r.win ? 'bold ' : ''}38px system-ui, sans-serif`;
      c.fillText(`${r.win ? '🏆 ' : ''}${r.names}`.slice(0, 34), 180, y - 3);
      c.textAlign = 'right'; c.fillStyle = r.win ? '#f2c14e' : '#e6efe9'; c.font = 'bold 42px system-ui, sans-serif';
      c.fillText(String(r.score), W - 180, y - 3);
      y += 88;
    }
    c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.7)'; c.font = '30px system-ui, sans-serif';
    c.fillText('Gioca con me su Smazzata 🃏', W / 2, H - 70);
    return cv;
  }

  async function shareResult() {
    if (!S.game) return;
    const cv = resultImage();
    const g = S.game;
    const won = g.winners.includes(g.you);
    const text = t(won ? `Ho vinto a ${RX.gameName(g.cfg.rules)} su Smazzata! Gioca con me:` : `Che partita a ${RX.gameName(g.cfg.rules)} su Smazzata! Gioca con me:`) + ' ' + HOME_URL;
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    const file = blob && typeof File === 'function' ? new File([blob], 'smazzata.png', { type: 'image/png' }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    // niente condivisione diretta dell'immagine (es. nell'app Android): la si mostra, si scarica, WhatsApp col testo
    const url = cv.toDataURL('image/png');
    openModal('shareImg', `<h2>📤 Condividi il risultato</h2>
      <img class="shareimg" src="${url}" alt="Risultato della partita">
      <div class="row" style="justify-content:center;margin-top:10px"><a class="btn primary" href="${url}" download="smazzata.png">⬇ Scarica l'immagine</a>
      <a class="btn" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">💬 WhatsApp</a></div>
      <p class="muted small" style="text-align:center">Scarica l'immagine e allegala al messaggio, oppure manda solo il testo con WhatsApp.</p>`);
  }

