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
      footer = `<div class="winner">🏆 Vince ${esc(g.winners.map((s) => (s === g.you ? 'Tu' : g.players[s].name)).join(' & '))}!</div>
        <button class="btn primary big" data-act="ready" style="width:100%" ${imReady ? 'disabled' : ''}>${imReady ? 'Rivincita: hai votato ✓' : '🔁 Rivincita'}</button>
        ${imReady && waiting.length ? `<p class="muted">In attesa di: ${esc(waiting.join(', '))}</p>` : '<p class="muted">Stessi posti, stesse regole: si riparte quando tutti premono Rivincita.</p>'}`;
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
          : `<div class="rbar"><i style="--from:${pct(tot - t.total)}%;--to:${pct(tot)}%"></i></div><div class="rtot">${g.game === 'briscola' || g.game === 'rubamazzetto' ? `vince chi arriva a ${g.cfg.target} ${g.cfg.target === 1 ? 'smazzata' : 'smazzate'}` : g.game === 'settemezzo' ? `fiches · smazzata ${g.handNo} di ${g.cfg.target}` : `si vince a ${g.cfg.target}`}</div>`}</div>`;
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
      <form id="chatform" class="row" style="margin:8px 0"><input id="chatin" class="grow" maxlength="140" placeholder="Scrivi un messaggio" autocomplete="off"><button class="btn primary">Invia</button>${S.room && S.room.humans > 1 ? '<button type="button" class="btn voicebtn" data-voice title="Tieni premuto per parlare">🎤</button>' : ''}</form>
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
